#!/usr/bin/env node
// Local stdio-to-Streamable-HTTP MCP bridge for Stitch.
//
// Why this exists: remote HTTP MCP clients (e.g. Antigravity's Go HTTP/2 transport) can enforce a
// fixed 60s response-header timeout, while Stitch `generate_screen_from_text` and `edit_screens`
// often take 65-180s. Running this bridge over stdio uses `node:https` with a configurable timeout
// (default 180s via `STITCH_TIMEOUT_MS`) and works identically across Antigravity, Claude Code,
// and GitHub Copilot.
import http from "node:http";
import https from "node:https";
import readline from "node:readline";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_UPSTREAM_URL = "https://stitch.googleapis.com/mcp";
export const DEFAULT_TIMEOUT_MS = 180_000;
export const DEFAULT_PROGRESS_INTERVAL_MS = 25_000;

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
 * Forwards one JSON-RPC message over HTTP(S) to the Stitch Streamable HTTP MCP endpoint.
 * Uses `node:https` / `node:http` directly to avoid HTTP/2 60s header timeouts and `undici` caps.
 * @param {string} payload
 * @param {{ url: string, apiKey: string, timeoutMs: number, sessionId?: string | null }} options
 * @returns {Promise<{ statusCode: number, contentType: string, sessionId: string | null, body: string }>}
 */
export function forwardJsonRpc(payload, { url, apiKey, timeoutMs, sessionId = null }) {
  return new Promise((resolvePromise, rejectPromise) => {
    const target = new URL(url);
    const client = target.protocol === "http:" ? http : https;
    const bodyBuffer = Buffer.from(payload, "utf8");
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
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      fn(value);
    };

    const req = client.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || (target.protocol === "http:" ? 80 : 443),
        path: `${target.pathname}${target.search}`,
        method: "POST",
        headers,
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const rawSession = res.headers["mcp-session-id"];
          const nextSessionId = Array.isArray(rawSession)
            ? (rawSession[0] ?? null)
            : (rawSession ?? null);
          const rawContentType = res.headers["content-type"];
          const contentType = (
            Array.isArray(rawContentType) ? rawContentType[0] : (rawContentType ?? "")
          ).toLowerCase();
          finish(resolvePromise, {
            statusCode: res.statusCode ?? 0,
            contentType,
            sessionId: nextSessionId,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
        res.on("error", (err) => finish(rejectPromise, err));
      },
    );

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`Stitch MCP request timed out after ${timeoutMs}ms`));
    });

    req.on("error", (err) => finish(rejectPromise, err));
    req.write(bodyBuffer);
    req.end();
  });
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
      const response = await transport(trimmed, { url, apiKey, timeoutMs, sessionId });
      if (response.sessionId) {
        sessionId = response.sessionId;
      }

      if (response.statusCode >= 400) {
        const snippet = response.body.trim().slice(0, 300);
        const detail = snippet
          ? `Stitch MCP HTTP ${response.statusCode}: ${snippet}`
          : `Stitch MCP HTTP ${response.statusCode}`;
        logError(detail);
        if (hasId) writeJson(jsonRpcError(reqId, detail));
        return;
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
      logError(`Upstream request failed: ${message}`);
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
