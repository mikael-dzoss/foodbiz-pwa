// @vitest-environment node
import { spawn } from "node:child_process";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { resolve } from "node:path";
import { PassThrough } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_TIMEOUT_MS,
  createBridge,
  forwardJsonRpc,
  parseSseMessages,
  parseTimeoutMs,
} from "../stitch-mcp-bridge.mjs";

const servers: http.Server[] = [];

async function startStubServer(
  handler: (req: http.IncomingMessage, body: string, res: http.ServerResponse) => void,
): Promise<string> {
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => handler(req, Buffer.concat(chunks).toString("utf8"), res));
  });
  servers.push(server);
  await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}/mcp`;
}

afterEach(async () => {
  while (servers.length > 0) {
    const server = servers.pop();
    if (server) {
      await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
    }
  }
});

describe("parseTimeoutMs", () => {
  it("parses positive integers and falls back for missing or invalid values", () => {
    expect(parseTimeoutMs("120000")).toBe(120_000);
    expect(parseTimeoutMs(240_500.9)).toBe(240_500);
    expect(parseTimeoutMs(undefined)).toBe(DEFAULT_TIMEOUT_MS);
    expect(parseTimeoutMs("")).toBe(DEFAULT_TIMEOUT_MS);
    expect(parseTimeoutMs("0")).toBe(DEFAULT_TIMEOUT_MS);
    expect(parseTimeoutMs("-500")).toBe(DEFAULT_TIMEOUT_MS);
    expect(parseTimeoutMs("abc")).toBe(DEFAULT_TIMEOUT_MS);
  });
});

describe("parseSseMessages", () => {
  it("extracts JSON payloads from LF and CRLF SSE streams and ignores [DONE] / comments", () => {
    const stream = [
      ": keep-alive",
      "event: message",
      'data: {"jsonrpc":"2.0","id":1,"result":{"ok":true}}',
      "",
      "data: {",
      'data: "jsonrpc":"2.0","id":2,"result":{"ok":true}',
      "data: }",
      "",
      "data: [DONE]",
      "",
    ].join("\r\n");

    expect(parseSseMessages(stream)).toEqual([
      '{"jsonrpc":"2.0","id":1,"result":{"ok":true}}',
      '{\n"jsonrpc":"2.0","id":2,"result":{"ok":true}\n}',
    ]);
  });
});

describe("createBridge", () => {
  it("forwards JSON-RPC calls, preserves Mcp-Session-Id, and handles notifications", async () => {
    const seenHeaders: Array<{ apiKey?: string; sessionId?: string }> = [];
    const url = await startStubServer((req, body, res) => {
      seenHeaders.push({
        apiKey: String(req.headers["x-goog-api-key"] ?? ""),
        sessionId: req.headers["mcp-session-id"]
          ? String(req.headers["mcp-session-id"])
          : undefined,
      });
      const parsed = JSON.parse(body) as { id?: number; method?: string };
      if (parsed.method === "initialize") {
        res.writeHead(200, {
          "Content-Type": "application/json",
          "Mcp-Session-Id": "sess-123",
        });
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            id: parsed.id,
            result: { protocolVersion: "2025-03-26" },
          }),
        );
        return;
      }
      if (parsed.method === "notifications/initialized") {
        res.writeHead(202);
        res.end();
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ jsonrpc: "2.0", id: parsed.id, result: { screens: [] } }));
    });

    const input = new PassThrough();
    const output = new PassThrough();
    const error = new PassThrough();
    let outText = "";
    output.on("data", (chunk: Buffer) => {
      outText += chunk.toString("utf8");
    });

    const bridge = createBridge({
      input,
      output,
      error,
      env: { STITCH_API_KEY: "test-stitch-key", STITCH_MCP_URL: url, STITCH_TIMEOUT_MS: "5000" },
    });

    input.write(`${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize" })}\n`);
    await new Promise((r) => setTimeout(r, 30));
    input.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);
    input.write(
      `${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "list_screens" } })}\n`,
    );
    input.end();

    await bridge.closed;

    const lines = outText
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as { id: number; result?: unknown });
    expect(lines).toHaveLength(2);
    expect(lines[0]).toEqual({ jsonrpc: "2.0", id: 1, result: { protocolVersion: "2025-03-26" } });
    expect(lines[1]).toEqual({ jsonrpc: "2.0", id: 2, result: { screens: [] } });
    expect(bridge.getSessionId()).toBe("sess-123");
    expect(seenHeaders[0]).toEqual({ apiKey: "test-stitch-key", sessionId: undefined });
    expect(seenHeaders[2]).toEqual({ apiKey: "test-stitch-key", sessionId: "sess-123" });
  });

  it("relays SSE responses and normalizes them to single-line JSON-RPC frames", async () => {
    const url = await startStubServer((_req, _body, res) => {
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      res.end(
        'event: message\ndata: {"jsonrpc":"2.0","id":7,"result":{"content":[{"type":"text","text":"ok"}]}}\n\n',
      );
    });

    const input = new PassThrough();
    const output = new PassThrough();
    let outText = "";
    output.on("data", (chunk: Buffer) => {
      outText += chunk.toString("utf8");
    });

    const bridge = createBridge({
      input,
      output,
      error: new PassThrough(),
      env: { STITCH_API_KEY: "test-stitch-key", STITCH_MCP_URL: url },
    });

    input.end(`${JSON.stringify({ jsonrpc: "2.0", id: 7, method: "tools/call" })}\n`);
    await bridge.closed;

    expect(JSON.parse(outText.trim())).toEqual({
      jsonrpc: "2.0",
      id: 7,
      result: { content: [{ type: "text", text: "ok" }] },
    });
  });

  it("returns JSON-RPC errors when STITCH_API_KEY is missing, on HTTP errors, or on invalid JSON", async () => {
    const url = await startStubServer((_req, _body, res) => {
      res.writeHead(502, { "Content-Type": "text/plain" });
      res.end("Bad gateway");
    });

    const input1 = new PassThrough();
    const output1 = new PassThrough();
    let out1 = "";
    output1.on("data", (c: Buffer) => {
      out1 += c.toString("utf8");
    });

    const bridge1 = createBridge({
      input: input1,
      output: output1,
      error: new PassThrough(),
      env: { STITCH_MCP_URL: url },
    });
    input1.write("not-json\n");
    input1.end(`${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" })}\n`);
    await bridge1.closed;

    const frames1 = out1
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l) as { id: number | null; error: { code: number; message: string } });
    expect(frames1[0].error.code).toBe(-32700);
    expect(frames1[1].id).toBe(1);
    expect(frames1[1].error.message).toContain("STITCH_API_KEY");

    const input2 = new PassThrough();
    const output2 = new PassThrough();
    let out2 = "";
    output2.on("data", (c: Buffer) => {
      out2 += c.toString("utf8");
    });
    const bridge2 = createBridge({
      input: input2,
      output: output2,
      error: new PassThrough(),
      env: { STITCH_API_KEY: "test-stitch-key", STITCH_MCP_URL: url },
    });
    input2.end(`${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" })}\n`);
    await bridge2.closed;

    const frame2 = JSON.parse(out2.trim()) as { id: number; error: { message: string } };
    expect(frame2.id).toBe(2);
    expect(frame2.error.message).toContain("HTTP 502");
  });

  it("enforces STITCH_TIMEOUT_MS and returns a timeout JSON-RPC error", async () => {
    const url = await startStubServer((_req, _body, res) => {
      const timer = setTimeout(() => {
        if (!res.writableEnded) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end("{}");
        }
      }, 300);
      timer.unref();
    });

    const input = new PassThrough();
    const output = new PassThrough();
    let outText = "";
    output.on("data", (c: Buffer) => {
      outText += c.toString("utf8");
    });

    const bridge = createBridge({
      input,
      output,
      error: new PassThrough(),
      env: { STITCH_API_KEY: "test-stitch-key", STITCH_MCP_URL: url, STITCH_TIMEOUT_MS: "50" },
    });

    input.end(`${JSON.stringify({ jsonrpc: "2.0", id: 9, method: "tools/call" })}\n`);
    await bridge.closed;

    const frame = JSON.parse(outText.trim()) as { id: number; error: { message: string } };
    expect(frame.id).toBe(9);
    expect(frame.error.message).toContain("timed out after 50ms");
  });

  it("dispatches concurrent calls without head-of-line blocking and emits progress heartbeats", async () => {
    const url = await startStubServer((_req, body, res) => {
      const parsed = JSON.parse(body) as { id: number };
      const delay = parsed.id === 1 ? 120 : 10;
      setTimeout(() => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ jsonrpc: "2.0", id: parsed.id, result: { id: parsed.id } }));
      }, delay);
    });

    const input = new PassThrough();
    const output = new PassThrough();
    let outText = "";
    output.on("data", (c: Buffer) => {
      outText += c.toString("utf8");
    });

    const bridge = createBridge({
      input,
      output,
      error: new PassThrough(),
      env: {
        STITCH_API_KEY: "test-stitch-key",
        STITCH_MCP_URL: url,
        STITCH_TIMEOUT_MS: "5000",
        STITCH_PROGRESS_INTERVAL_MS: "35",
      },
    });

    input.write(
      `${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { _meta: { progressToken: "tok-1" } } })}\n`,
    );
    input.write(`${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call" })}\n`);
    input.end();

    await bridge.closed;

    const frames = outText
      .trim()
      .split("\n")
      .map(
        (line) =>
          JSON.parse(line) as { id?: number; method?: string; params?: { progressToken?: string } },
      );

    const responses = frames.filter((f) => f.id !== undefined).map((f) => f.id);
    expect(responses).toEqual([2, 1]);
    expect(
      frames.some(
        (f) => f.method === "notifications/progress" && f.params?.progressToken === "tok-1",
      ),
    ).toBe(true);
  });

  it("works end-to-end as a stdio child process", async () => {
    const url = await startStubServer((_req, body, res) => {
      const parsed = JSON.parse(body) as { id: number };
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({ jsonrpc: "2.0", id: parsed.id, result: { tools: ["list_screens"] } }),
      );
    });

    const scriptPath = resolve(import.meta.dirname, "..", "stitch-mcp-bridge.mjs");
    const child = spawn(process.execPath, [scriptPath], {
      env: {
        ...process.env,
        STITCH_API_KEY: "test-stitch-key",
        STITCH_MCP_URL: url,
        STITCH_TIMEOUT_MS: "5000",
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    child.stdout.on("data", (c: Buffer) => {
      stdout += c.toString("utf8");
    });

    child.stdin.end(`${JSON.stringify({ jsonrpc: "2.0", id: 42, method: "tools/list" })}\n`);

    const code = await new Promise<number | null>((resolveExit) => child.on("close", resolveExit));
    expect(code).toBe(0);
    expect(JSON.parse(stdout.trim())).toEqual({
      jsonrpc: "2.0",
      id: 42,
      result: { tools: ["list_screens"] },
    });
  });
});

describe("forwardJsonRpc", () => {
  it("sends required headers directly over node:http", async () => {
    let capturedAccept = "";
    const url = await startStubServer((req, _body, res) => {
      capturedAccept = String(req.headers.accept ?? "");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end('{"jsonrpc":"2.0","id":1,"result":{}}');
    });

    const res = await forwardJsonRpc('{"jsonrpc":"2.0","id":1,"method":"ping"}', {
      url,
      apiKey: "test-key",
      timeoutMs: 2000,
    });
    expect(res.statusCode).toBe(200);
    expect(capturedAccept).toContain("application/json");
    expect(capturedAccept).toContain("text/event-stream");
  });
});
