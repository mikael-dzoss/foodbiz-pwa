#!/usr/bin/env node
// Local stdio-to-Streamable-HTTP MCP bridge for Stitch.
//
// Why this exists: remote HTTP MCP clients (e.g. Antigravity's Go HTTP/2 transport) can enforce a
// fixed 60s response-header timeout, while Stitch `generate_screen_from_text` and `edit_screens`
// often take 65-180s. Running this bridge over stdio uses `node:http2` (with 15s HTTP/2 PING
// keep-alives + TCP keepalive) and a configurable timeout (default 180s via `STITCH_TIMEOUT_MS`),
// plus elapsed-time/disconnect diagnostics on stderr, across Antigravity, Claude Code, and Copilot.
import http from "node:http";
import http2 from "node:http2";
import https from "node:https";
import readline from "node:readline";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_UPSTREAM_URL = "https://stitch.googleapis.com/mcp";
export const DEFAULT_TIMEOUT_MS = 180_000;
export const DEFAULT_PROGRESS_INTERVAL_MS = 25_000;
export const DEFAULT_PING_INTERVAL_MS = 15_000;

/**
 * Parses a positive millisecond timeout from env/CLI input, falling back safely on bad values.
 * @param {string | number | undefined} raw
 * @param {number} [fallback]
 * @returns {number}
 */
export function parseTimeoutMs(raw, fallback = DEFAULT_TIMEOUT_MS) {
  if (raw === undefined || raw === null || raw === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

/**
 * Extracts JSON-RPC payload strings from a `text/event-stream` response body.
 * Supports LF and CRLF framing and multi-line `data:` blocks.
 * @param {string} body
 * @returns {string[]}
 */
export function parseSseMessages(body) {
  const normalized = body.replace(/\r\n/g, "\n");
  const messages = [];
  for (const block of normalized.split("\n\n")) {
    const dataLines = [];
    for (const line of block.split("\n")) {
      if (line.startsWith("data:")) {
        const value = line.slice(5);
        dataLines.push(value.startsWith(" ") ? value.slice(1) : value);
      }
    }
    if (dataLines.length === 0) continue;
    const payload = dataLines.join("\n").trim();
    if (!payload || payload === "[DONE]") continue;
    messages.push(payload);
  }
  return messages;
}

/**
 * Builds a JSON-RPC 2.0 error object for a request id.
 * @param {string | number | null} id
 * @param {string} message
 * @param {number} [code]
 */
export function jsonRpcError(id, message, code = -32000) {
  return {
    jsonrpc: "2.0",
    id,
    error: { code, message },
  };
}

/**
 * Normalizes a JSON payload onto a single line for stdio JSON-RPC framing.
 * @param {string} text
 * @returns {string}
 */
function toSingleLineJson(text) {
  try {
    return JSON.stringify(JSON.parse(text));
  } catch {
    return text.replace(/[\r\n]+/g, " ").trim();
  }
}

/**
 * Formats safe transport telemetry for stderr diagnostics and error messages (never contains keys).
 * @param {{
 *   protocol: "h2" | "h1",
 *   elapsedMs: number,
 *   pingsSent?: number,
 *   pingsAcked?: number,
 *   errCode?: string | null,
 *   rstCode?: number | null,
 *   goawayCode?: number | null,
 * }} info
 */
export function formatTelemetry(info) {
  const parts = [`protocol=${info.protocol}`, `elapsed=${info.elapsedMs}ms`];
  if (info.protocol === "h2") {
    parts.push(`pings=${info.pingsAcked ?? 0}/${info.pingsSent ?? 0}`);
  }
  if (info.errCode) parts.push(`code=${info.errCode}`);
  if (info.rstCode !== undefined && info.rstCode !== null && info.rstCode !== 0) {
    parts.push(`rst=${info.rstCode}`);
  }
  if (info.goawayCode !== undefined && info.goawayCode !== null) {
    parts.push(`goaway=${info.goawayCode}`);
  }
  return parts.join(" ");
}

/**
 * Extracts a safe, short label for a JSON-RPC request (method + optional tool name) for logs.
 * @param {Record<string, unknown>} msg
 * @returns {string}
 */
function requestLabel(msg) {
  const method = typeof msg.method === "string" ? msg.method : "unknown";
  const params =
    msg.params && typeof msg.params === "object"
      ? /** @type {Record<string, unknown>} */ (msg.params)
      : null;
  if (method === "tools/call" && typeof params?.name === "string") {
    return `${method}:${params.name}`;
  }
  return method;
}

/**
 * Forwards one JSON-RPC message over HTTP/2 with periodic PING keep-alive frames and TCP keepalive.
 * @param {string} payload
 * @param {{
 *   url: string,
 *   apiKey: string,
 *   timeoutMs: number,
 *   sessionId?: string | null,
 *   pingIntervalMs?: number,
 * }} options
 * @returns {Promise<{
 *   statusCode: number,
 *   contentType: string,
 *   sessionId: string | null,
 *   body: string,
 *   telemetry: { protocol: "h2", elapsedMs: number, pingsSent: number, pingsAcked: number },
 * }>}
 */
export function forwardJsonRpcHttp2(
  payload,
  { url, apiKey, timeoutMs, sessionId = null, pingIntervalMs = DEFAULT_PING_INTERVAL_MS },
) {
  return new Promise((resolvePromise, rejectPromise) => {
    const target = new URL(url);
    const bodyBuffer = Buffer.from(payload, "utf8");
    const startedAt = Date.now();
    let pingsSent = 0;
    let pingsAcked = 0;
    /** @type {number | null} */
    let goawayCode = null;
    /** @type {number | null} */
    let rstCode = null;
    let settled = false;

    const client = http2.connect(target.origin);
    /** @type {ReturnType<typeof setInterval> | null} */
    let pingTimer = null;

    const cleanup = (destroy = false) => {
      if (pingTimer) {
        clearInterval(pingTimer);
        pingTimer = null;
      }
      if (!client.destroyed) {
        if (destroy) client.destroy();
        else client.close();
      }
    };

    const fail = (rawErr) => {
      if (settled) return;
      settled = true;
      const elapsedMs = Date.now() - startedAt;
      const errCode =
        rawErr && typeof rawErr === "object" && "code" in rawErr && typeof rawErr.code === "string"
          ? rawErr.code
          : null;
      const baseMessage = rawErr instanceof Error ? rawErr.message : String(rawErr);
      const tag = formatTelemetry({
        protocol: "h2",
        elapsedMs,
        pingsSent,
        pingsAcked,
        errCode,
        rstCode,
        goawayCode,
      });
      cleanup(true);
      rejectPromise(new Error(`${baseMessage} (${tag})`));
    };

    const succeed = (result) => {
      if (settled) return;
      settled = true;
      cleanup(false);
      resolvePromise(result);
    };

    client.on("connect", (_session, socket) => {
      socket?.setKeepAlive?.(true, pingIntervalMs);
    });

    client.on("goaway", (errorCode) => {
      goawayCode = errorCode;
    });

    client.on("error", (err) => fail(err));
    client.on("close", () => {
      if (!settled) fail(new Error("HTTP/2 session closed before response completed"));
    });

    if (pingIntervalMs > 0) {
      pingTimer = setInterval(() => {
        if (client.closed || client.destroyed) return;
        pingsSent += 1;
        client.ping((err) => {
          if (!err) pingsAcked += 1;
        });
      }, pingIntervalMs);
      pingTimer.unref?.();
    }

    /** @type {Record<string, string>} */
    const headers = {
      ":method": "POST",
      ":path": `${target.pathname}${target.search}`,
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "content-length": String(bodyBuffer.length),
      "x-goog-api-key": apiKey,
    };
    if (sessionId) {
      headers["mcp-session-id"] = sessionId;
    }

    const req = client.request(headers);
    let statusCode = 0;
    let contentType = "";
    /** @type {string | null} */
    let nextSessionId = null;
    const chunks = [];

    req.on("response", (resHeaders) => {
      statusCode = Number(resHeaders[":status"] ?? 0);
      const rawSession = resHeaders["mcp-session-id"];
      nextSessionId = Array.isArray(rawSession) ? (rawSession[0] ?? null) : (rawSession ?? null);
      const rawContentType = resHeaders["content-type"];
      contentType = (
        Array.isArray(rawContentType) ? rawContentType[0] : (rawContentType ?? "")
      ).toLowerCase();
    });

    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const elapsedMs = Date.now() - startedAt;
      succeed({
        statusCode,
        contentType,
        sessionId: nextSessionId,
        body: Buffer.concat(chunks).toString("utf8"),
        telemetry: { protocol: "h2", elapsedMs, pingsSent, pingsAcked },
      });
    });

    req.on("close", () => {
      if (req.rstCode) rstCode = req.rstCode;
      if (!settled) {
        const reason = req.rstCode
          ? `HTTP/2 stream reset (rstCode=${req.rstCode})`
          : "HTTP/2 stream closed before response ended";
        fail(new Error(reason));
      }
    });

    req.setTimeout(timeoutMs, () => {
      req.close(http2.constants.NGHTTP2_CANCEL);
      fail(new Error(`Stitch MCP request timed out after ${timeoutMs}ms`));
    });

    req.on("error", (err) => {
      if (req.rstCode) rstCode = req.rstCode;
      fail(err);
    });
    req.write(bodyBuffer);
    req.end();
  });
}

/**
 * Forwards one JSON-RPC message over HTTP/1.1 using a fresh non-pooled socket with TCP keepalive.
 * Used for `http:` local test servers or when `STITCH_TRANSPORT=http1`.
 * @param {string} payload
 * @param {{
 *   url: string,
 *   apiKey: string,
 *   timeoutMs: number,
 *   sessionId?: string | null,
 *   pingIntervalMs?: number,
 * }} options
 * @returns {Promise<{
 *   statusCode: number,
 *   contentType: string,
 *   sessionId: string | null,
 *   body: string,
 *   telemetry: { protocol: "h1", elapsedMs: number, pingsSent: number, pingsAcked: number },
 * }>}
 */
export function forwardJsonRpcHttp1(
  payload,
  { url, apiKey, timeoutMs, sessionId = null, pingIntervalMs = DEFAULT_PING_INTERVAL_MS },
) {
  return new Promise((resolvePromise, rejectPromise) => {
    const target = new URL(url);
    const client = target.protocol === "http:" ? http : https;
    const bodyBuffer = Buffer.from(payload, "utf8");
    const startedAt = Date.now();
    /** @type {Record<string, string | number>} */
    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "Content-Length": bodyBuffer.length,
      "X-Goog-Api-Key": apiKey,
    };
    if (sessionId) {
      headers["Mcp-Session-Id"] = sessionId;
    }

    let settled = false;
    const fail = (rawErr) => {
      if (settled) return;
      settled = true;
      const elapsedMs = Date.now() - startedAt;
      const errCode =
        rawErr && typeof rawErr === "object" && "code" in rawErr && typeof rawErr.code === "string"
          ? rawErr.code
          : null;
      const baseMessage = rawErr instanceof Error ? rawErr.message : String(rawErr);
      const tag = formatTelemetry({ protocol: "h1", elapsedMs, errCode });
      rejectPromise(new Error(`${baseMessage} (${tag})`));
    };

    const req = client.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || (target.protocol === "http:" ? 80 : 443),
        path: `${target.pathname}${target.search}`,
        method: "POST",
        agent: false,
        headers,
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          if (settled) return;
          settled = true;
          const rawSession = res.headers["mcp-session-id"];
          const nextSessionId = Array.isArray(rawSession)
            ? (rawSession[0] ?? null)
            : (rawSession ?? null);
          const rawContentType = res.headers["content-type"];
          const contentType = (
            Array.isArray(rawContentType) ? rawContentType[0] : (rawContentType ?? "")
          ).toLowerCase();
          resolvePromise({
            statusCode: res.statusCode ?? 0,
            contentType,
            sessionId: nextSessionId,
            body: Buffer.concat(chunks).toString("utf8"),
            telemetry: {
              protocol: "h1",
              elapsedMs: Date.now() - startedAt,
              pingsSent: 0,
              pingsAcked: 0,
            },
          });
        });
        res.on("error", (err) => fail(err));
      },
    );

    req.on("socket", (socket) => {
      socket.setKeepAlive(true, pingIntervalMs);
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`Stitch MCP request timed out after ${timeoutMs}ms`));
    });

    req.on("error", (err) => fail(err));
    req.write(bodyBuffer);
    req.end();
  });
}

/**
 * Forwards one JSON-RPC message to the Stitch Streamable HTTP MCP endpoint.
 * Defaults to HTTP/2 with 15s PING keep-alives for `https:` URLs (and `http2`/`h2c` mode),
 * falling back to HTTP/1.1 with fresh sockets for plain `http:` test stubs or `http1` mode.
 * @param {string} payload
 * @param {{
 *   url: string,
 *   apiKey: string,
 *   timeoutMs: number,
 *   sessionId?: string | null,
 *   pingIntervalMs?: number,
 *   transportMode?: string,
 * }} options
 */
export function forwardJsonRpc(payload, options) {
  const mode = options.transportMode?.trim().toLowerCase();
  const isHttps = new URL(options.url).protocol === "https:";
  const useHttp2 =
    mode === "h2" || mode === "http2" || mode === "h2c" || (mode !== "http1" && isHttps);
  return useHttp2 ? forwardJsonRpcHttp2(payload, options) : forwardJsonRpcHttp1(payload, options);
}

/**
 * Starts a stdio MCP bridge connected to `input`/`output`/`error` streams.
 * Dispatches requests concurrently so parallel calls do not head-of-line block each other.
 * @param {{
 *   input?: NodeJS.ReadableStream,
 *   output?: NodeJS.WritableStream,
 *   error?: NodeJS.WritableStream,
 *   env?: Record<string, string | undefined>,
 *   transport?: typeof forwardJsonRpc,
 * }} [options]
 */
export function createBridge({
  input = process.stdin,
  output = process.stdout,
  error = process.stderr,
  env = process.env,
  transport = forwardJsonRpc,
} = {}) {
  const url = env.STITCH_MCP_URL?.trim() || DEFAULT_UPSTREAM_URL;
  const timeoutMs = parseTimeoutMs(env.STITCH_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
  const progressIntervalMs = parseTimeoutMs(
    env.STITCH_PROGRESS_INTERVAL_MS,
    DEFAULT_PROGRESS_INTERVAL_MS,
  );
  const pingIntervalMs = parseTimeoutMs(env.STITCH_PING_INTERVAL_MS, DEFAULT_PING_INTERVAL_MS);
  const transportMode = env.STITCH_TRANSPORT?.trim().toLowerCase();
  let sessionId = null;

  const writeLine = (line) => {
    output.write(`${line}\n`);
  };

  const writeJson = (obj) => {
    writeLine(JSON.stringify(obj));
  };

  const logError = (message) => {
    error.write(`[stitch-mcp-bridge] ${message}\n`);
  };

  const inFlight = new Set();

  const handleLine = async (rawLine) => {
    const trimmed = rawLine.trim();
    if (!trimmed) return;

    let msg;
    try {
      msg = JSON.parse(trimmed);
    } catch {
      logError("Ignoring malformed JSON-RPC frame on stdin.");
      writeJson(jsonRpcError(null, "Parse error: invalid JSON-RPC payload.", -32700));
      return;
    }

    const hasId =
      msg !== null &&
      typeof msg === "object" &&
      Object.prototype.hasOwnProperty.call(msg, "id") &&
      msg.id !== undefined;
    const reqId = hasId ? msg.id : null;
    const label = msg && typeof msg === "object" ? requestLabel(msg) : "unknown";

    const apiKey = env.STITCH_API_KEY?.trim() || "";
    if (!apiKey) {
      const detail = "STITCH_API_KEY is not set in the Stitch MCP bridge environment.";
      logError(detail);
      if (hasId) writeJson(jsonRpcError(reqId, detail));
      return;
    }

    const progressToken = msg?.params?._meta?.progressToken;
    let progressTimer = null;
    let progressTick = 0;
    if (hasId && progressToken !== undefined && progressIntervalMs > 0) {
      progressTimer = setInterval(() => {
        progressTick += 1;
        writeJson({
          jsonrpc: "2.0",
          method: "notifications/progress",
          params: {
            progressToken,
            progress: progressTick,
            message: `Waiting for Stitch response (${Math.round((progressTick * progressIntervalMs) / 1000)}s)...`,
          },
        });
      }, progressIntervalMs);
      progressTimer.unref?.();
    }

    try {
      const response = await transport(trimmed, {
        url,
        apiKey,
        timeoutMs,
        sessionId,
        pingIntervalMs,
        transportMode,
      });
      if (response.sessionId) {
        sessionId = response.sessionId;
      }

      const telemetryTag = response.telemetry ? formatTelemetry(response.telemetry) : "";

      if (response.statusCode >= 400) {
        const snippet = response.body.trim().slice(0, 300);
        const detail = snippet
          ? `Stitch MCP HTTP ${response.statusCode}: ${snippet}`
          : `Stitch MCP HTTP ${response.statusCode}`;
        logError(`${label} failed: ${detail}${telemetryTag ? ` (${telemetryTag})` : ""}`);
        if (hasId) writeJson(jsonRpcError(reqId, detail));
        return;
      }

      if (response.telemetry && response.telemetry.elapsedMs >= 5_000) {
        logError(`${label} completed HTTP ${response.statusCode} (${telemetryTag})`);
      }

      if (
        !hasId &&
        (response.statusCode === 202 || response.statusCode === 204 || !response.body.trim())
      ) {
        return;
      }

      if (response.contentType.includes("text/event-stream")) {
        for (const frame of parseSseMessages(response.body)) {
          writeLine(toSingleLineJson(frame));
        }
        return;
      }

      if (response.body.trim()) {
        writeLine(toSingleLineJson(response.body));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logError(`${label} upstream request failed: ${message}`);
      if (hasId) {
        writeJson(jsonRpcError(reqId, message));
      }
    } finally {
      if (progressTimer) clearInterval(progressTimer);
    }
  };

  const rl = readline.createInterface({ input, crlfDelay: Infinity });
  rl.on("line", (line) => {
    const task = handleLine(line).finally(() => {
      inFlight.delete(task);
    });
    inFlight.add(task);
  });

  const closed = new Promise((resolveClose) => {
    rl.on("close", async () => {
      await Promise.allSettled([...inFlight]);
      resolveClose();
    });
  });

  return {
    close: () => rl.close(),
    closed,
    getSessionId: () => sessionId,
  };
}

const isMain =
  Boolean(process.argv[1]) && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  createBridge();
}
