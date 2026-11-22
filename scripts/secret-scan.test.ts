// @vitest-environment node
import { describe, expect, it } from "vitest";
import { mask, scanDiff, scanLine } from "./secret-scan.mjs";

// Fixtures are assembled at runtime so this file never contains a contiguous secret-shaped string.
const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
const jwt = (payload: object) =>
  [b64({ alg: "HS256", typ: "JWT" }), b64(payload), "c2lnbmF0dXJlLXNpZ25hdHVyZS1zaWc"].join(".");
const rand = (n: number) => "aB3dE5gH7jK9mN2pQ4rS6tV8wY1zC0fL".repeat(3).slice(0, n);

const rules = (line: string) => scanLine(line).map((f) => f.rule);

describe("scanLine detects", () => {
  it("JWT-shaped tokens", () => {
    expect(rules(`const t = "${jwt({ role: "service_role", iss: "acme" })}";`)).toEqual(["jwt"]);
  });
  it("sb_secret_ keys", () => {
    expect(rules(`KEY=${"sb_secret_" + rand(30)}`)).toEqual(["supabase-secret-key"]);
  });
  it("service-role style assignments", () => {
    expect(rules(`SUPABASE_SERVICE_ROLE_KEY=${rand(40)}`)).toEqual(["service-role-key"]);
    expect(rules(`serviceRoleKey: "${rand(40)}"`)).toEqual(["service-role-key"]);
  });
  it("GitHub tokens", () => {
    expect(rules(`t=${"ghp_" + rand(36)}`)).toEqual(["github-token"]);
    expect(rules(`t=${"gho_" + rand(36)}`)).toEqual(["github-token"]);
    expect(rules(`t=${"github_pat_" + rand(50)}`)).toEqual(["github-pat"]);
  });
  it("sk- style API keys", () => {
    expect(rules(`k=${"sk-" + rand(40)}`)).toEqual(["api-key-sk"]);
    expect(rules(`k=${"sk-proj-" + rand(40)}`)).toEqual(["api-key-sk"]);
  });
  it("AWS access key ids", () => {
    expect(rules(`id=${"AKIA" + "QWERTYUIOPASDFGH"}`)).toEqual(["aws-access-key-id"]);
  });
  it("private key blocks", () => {
    expect(rules("-----BEGIN " + "RSA PRIVATE KEY-----")).toEqual(["private-key"]);
    expect(rules("-----BEGIN " + "PRIVATE KEY-----")).toEqual(["private-key"]);
  });
  it("postgres URLs with a real password", () => {
    expect(rules(`url=postgres://app:${"Zq8" + "vL2mPx9"}@db.example.org:5432/app`)).toEqual([
      "postgres-url-password",
    ]);
  });
  it("Vercel tokens", () => {
    expect(rules(`t=${"vcp_" + rand(30)}`)).toEqual(["vercel-token"]);
    expect(rules(`VERCEL_API_TOKEN=${rand(24)}`)).toEqual(["vercel-token"]);
  });
});

describe("scanLine allows", () => {
  it.each([
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx",
    'vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_demo");',
    "SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET: ci-placeholder-google-secret",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: ci-placeholder-key",
    'SUPABASE_SERVICE_ROLE_KEY="<real-service-role-key>" \\',
    'SUPABASE_SERVICE_ROLE_KEY="your-service-role-key" \\',
    'SUPABASE_TEST_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" npm run test:live',
    "SUPABASE_SERVICE_ROLE_KEY=",
    "const serviceKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;",
    "secret: process.env.GOOGLE_CLIENT_SECRET_VALUE_FOR_AUTH",
    "DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres",
    "DATABASE_URL=postgres://user:[YOUR-PASSWORD]@host:5432/db",
    "DATABASE_URL=postgres://user:${DB_PASSWORD}@host:5432/db",
    "aws=" + "AKIA" + "IOSFODNN7EXAMPLE",
    "token=" + "ghp_" + "x".repeat(36),
    "key=" + "sk-" + "x".repeat(40),
    "const risk-assessment-for-a-very-long-identifier-name-here = 1;",
  ])("%s", (line) => {
    expect(scanLine(line)).toEqual([]);
  });

  it("the public Supabase local-demo JWT", () => {
    expect(rules(`ANON=${jwt({ iss: "supabase-demo", role: "anon" })}`)).toEqual([]);
  });

  it("a line carrying the inline opt-out marker", () => {
    const line = `const t = "${"ghp_" + rand(36)}"; // secret-scan: ignore`;
    expect(scanLine(line)).toEqual([]);
  });
});

describe("scanDiff", () => {
  const token = "ghp_" + rand(36);
  const diff = [
    "diff --git a/src/a.ts b/src/a.ts",
    "--- a/src/a.ts",
    "+++ b/src/a.ts",
    "@@ -1,2 +10,3 @@",
    ` context ${token}`,
    `-removed ${token}`,
    "+const ok = 1;",
    `+const bad = "${token}";`,
    "diff --git a/package-lock.json b/package-lock.json",
    "--- a/package-lock.json",
    "+++ b/package-lock.json",
    "@@ -1 +1 @@",
    `+"x": "${token}"`,
  ].join("\n");

  it("reports added lines only, with file and line number", () => {
    expect(scanDiff(diff)).toEqual([
      expect.objectContaining({ file: "src/a.ts", line: 11, rule: "github-token" }),
    ]);
  });

  it("ignores removed and context lines", () => {
    const removedOnly = ["+++ b/src/a.ts", "@@ -1 +1 @@", `-old ${token}`, "+new"].join("\n");
    expect(scanDiff(removedOnly)).toEqual([]);
  });

  it("never prints the full secret", () => {
    const [finding] = scanDiff(diff);
    expect(finding.masked).not.toContain(token);
    expect(finding.masked).toMatch(/^ghp_….+\(40 chars\)$/);
    expect(JSON.stringify(finding)).not.toContain(token.slice(8));
  });
});

describe("mask", () => {
  it("keeps a short prefix and suffix only", () => {
    expect(mask("abcdefghijklmnop")).toBe("abcd…op (16 chars)");
    expect(mask("short")).toBe("s*** (5 chars)");
  });
});
