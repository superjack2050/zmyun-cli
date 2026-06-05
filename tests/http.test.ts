import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { saveCredential, getCredential } from "../src/credentials.js";
import { classifyTokenMetadata } from "../src/auth.js";
import { ApiClient, unwrapEnvelope, unwrapResponse } from "../src/http.js";
import type { FetchLike } from "../src/http.js";

const tempDirs: string[] = [];

after(async () => {
  await Promise.all(
    tempDirs.map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
});

test("unwrapEnvelope returns metadata and requires code 200", () => {
  const metadata = unwrapEnvelope<{ ok: boolean }>({
    code: 200,
    message: "success",
    reason: "",
    metadata: { ok: true },
  });

  assert.deepEqual(metadata, { ok: true });
  assert.throws(
    () =>
      unwrapEnvelope({
        code: 500,
        message: "nope",
        reason: "backend_error",
        metadata: {},
      }),
    /nope/,
  );
});

test("OAuth token metadata errors are classified as business states", () => {
  assert.equal(
    classifyTokenMetadata({
      error: "authorization_pending",
      error_description: "wait",
    }).type,
    "pending",
  );
  assert.equal(
    classifyTokenMetadata({
      error: "slow_down",
      error_description: "wait slower",
    }).type,
    "slow_down",
  );
  assert.equal(
    classifyTokenMetadata({
      error: "access_denied",
      error_description: "denied",
    }).type,
    "fatal",
  );
  assert.equal(
    classifyTokenMetadata({
      access_token: "zmy_at_new",
      refresh_token: "zmy_rt_new",
      token_type: "Bearer",
      expires_in: 3600,
      scope: "ops:read",
      error: "",
      error_description: "",
    }).type,
    "token",
  );
});

test("expired access token refreshes before request and rotates stored refresh token", async () => {
  const env = await tempEnv("refresh-before");
  const now = Date.UTC(2026, 0, 1, 0, 0, 0);
  await saveCredential(
    "local",
    {
      access_token: "zmy_at_old",
      refresh_token: "zmy_rt_old",
      token_type: "Bearer",
      scope: "ops:read",
      expires_at: new Date(now - 1).toISOString(),
      updated_at: new Date(now - 3600).toISOString(),
    },
    env,
  );

  const calls: CapturedRequest[] = [];
  const fetchImpl: FetchLike = async (input, init) => {
    calls.push(capture(input, init));
    if (calls.length === 1) {
      return jsonResponse(200, {
        code: 200,
        message: "success",
        metadata: {
          access_token: "zmy_at_new",
          refresh_token: "zmy_rt_new",
          token_type: "Bearer",
          expires_in: 3600,
          scope: "ops:read collection:read project:read",
        },
      });
    }
    return jsonResponse(200, {
      code: 200,
      message: "success",
      metadata: { ok: true },
    });
  };

  const client = new ApiClient({
    endpoint: "http://127.0.0.1:8120",
    profileName: "local",
    env,
    fetch: fetchImpl,
    now: () => now,
    requestId: () => "rid-test",
  });

  const result = await client.request<{ ok: boolean }>("GET", "/api/v1/secure", {
    requireAuth: true,
  });

  assert.deepEqual(result, { ok: true });
  assert.equal(calls[0].url, "http://127.0.0.1:8120/api/v1/oauth/token");
  assert.equal(JSON.parse(String(calls[0].body)).refresh_token, "zmy_rt_old");
  assert.equal(calls[1].headers.Authorization, "Bearer zmy_at_new");

  const stored = await getCredential("local", env);
  assert.equal(stored?.access_token, "zmy_at_new");
  assert.equal(stored?.refresh_token, "zmy_rt_new");
});

test("401 response refreshes once and retries the original request", async () => {
  const env = await tempEnv("refresh-retry");
  const now = Date.UTC(2026, 0, 1, 0, 0, 0);
  await saveCredential(
    "local",
    {
      access_token: "zmy_at_old",
      refresh_token: "zmy_rt_old",
      token_type: "Bearer",
      scope: "ops:read",
      expires_at: new Date(now + 3600_000).toISOString(),
      updated_at: new Date(now - 1000).toISOString(),
    },
    env,
  );

  const calls: CapturedRequest[] = [];
  const fetchImpl: FetchLike = async (input, init) => {
    calls.push(capture(input, init));
    if (calls.length === 1) {
      return jsonResponse(401, {
        message: "unauthorized",
        reason: "UNAUTHORIZED",
      });
    }
    if (calls.length === 2) {
      return jsonResponse(200, {
        code: 200,
        message: "success",
        metadata: {
          access_token: "zmy_at_new",
          refresh_token: "zmy_rt_new",
          token_type: "Bearer",
          expires_in: 3600,
          scope: "ops:read",
        },
      });
    }
    return jsonResponse(200, {
      code: 200,
      message: "success",
      metadata: { ok: true },
    });
  };

  const client = new ApiClient({
    endpoint: "http://127.0.0.1:8120",
    profileName: "local",
    env,
    fetch: fetchImpl,
    now: () => now,
    requestId: () => "rid-test",
  });

  const result = await client.request<{ ok: boolean }>("GET", "/api/v1/secure", {
    requireAuth: true,
  });

  assert.deepEqual(result, { ok: true });
  assert.equal(calls[0].url, "http://127.0.0.1:8120/api/v1/secure");
  assert.equal(calls[0].headers.Authorization, "Bearer zmy_at_old");
  assert.equal(calls[1].url, "http://127.0.0.1:8120/api/v1/oauth/token");
  assert.equal(calls[2].url, "http://127.0.0.1:8120/api/v1/secure");
  assert.equal(calls[2].headers.Authorization, "Bearer zmy_at_new");
});

test("PUT requests send JSON accept, request id, bearer token, and body", async () => {
  const env = await tempEnv("put-request");
  await saveCredential(
    "local",
    {
      access_token: "zmy_at_write",
      refresh_token: "zmy_rt_write",
      token_type: "Bearer",
      scope: "ops:read collection:read project:read collection:write",
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
      updated_at: new Date().toISOString(),
    },
    env,
  );

  const calls: CapturedRequest[] = [];
  const client = new ApiClient({
    endpoint: "http://127.0.0.1:8120",
    profileName: "local",
    env,
    fetch: async (input, init) => {
      calls.push(capture(input, init));
      return jsonResponse(200, {
        code: 200,
        message: "success",
        metadata: { updated_at: "2026-06-03 17:40:00" },
      });
    },
    requestId: () => "rid-put",
  });

  const result = await client.request("PUT", "/api/v1/write", {
    data: { ok: true },
    requireAuth: true,
  });

  assert.deepEqual(result, { updated_at: "2026-06-03 17:40:00" });
  assert.equal(calls[0].headers.Accept, "application/json");
  assert.equal(calls[0].headers.RequestId, "rid-put");
  assert.equal(calls[0].headers.Authorization, "Bearer zmy_at_write");
  assert.equal(calls[0].headers["Content-Type"], "application/json");
  assert.equal(calls[0].method, "PUT");
  assert.equal(String(calls[0].body), JSON.stringify({ ok: true }));
});

test("403 errors hint at reauthorization for write scope", () => {
  assert.throws(
    () =>
      unwrapResponse(403, {
        code: 403,
        reason: "FORBIDDEN",
        message: "missing scope",
        metadata: {},
      }),
    (error) =>
      error instanceof Error &&
      "hint" in error &&
      error.hint === "Run: zmy auth login to request the required scope.",
  );
});

test("non-json HTTP errors keep status instead of invalid_json", async () => {
  const client = new ApiClient({
    endpoint: "http://127.0.0.1:8120",
    fetch: async () => ({
      status: 404,
      text: async () => "404 page not found\n",
    }),
    requestId: () => "rid-404",
  });

  await assert.rejects(
    () => client.request("POST", "/missing", { auth: false }),
    (error) =>
      error instanceof Error &&
      "status" in error &&
      error.status === 404 &&
      error.message === "HTTP 404",
  );
});

interface CapturedRequest {
  url: string;
  method?: string;
  headers: Record<string, string>;
  body?: BodyInit | null;
}

function capture(input: string | URL, init?: RequestInit): CapturedRequest {
  return {
    url: String(input),
    method: init?.method,
    headers: init?.headers as Record<string, string>,
    body: init?.body,
  };
}

function jsonResponse(status: number, body: unknown) {
  return {
    status,
    text: async () => JSON.stringify(body),
  };
}

async function tempEnv(name: string): Promise<NodeJS.ProcessEnv> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), `zmy-cli-${name}-`));
  tempDirs.push(dir);
  return { ...process.env, ZMY_CLI_HOME: dir };
}
