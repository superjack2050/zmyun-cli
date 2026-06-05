import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { logout } from "../src/auth.js";
import { saveCredential, getCredential } from "../src/credentials.js";
import { ApiClient } from "../src/http.js";
import type { FetchLike } from "../src/http.js";

const tempDirs: string[] = [];

after(async () => {
  await Promise.all(
    tempDirs.map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
});

test("logout removes local credentials even when server revoke fails", async () => {
  const env = await tempEnv();
  await saveCredential(
    "local",
    {
      access_token: "zmy_at_old",
      refresh_token: "zmy_rt_old",
      token_type: "Bearer",
      scope: "ops:read",
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
      updated_at: new Date().toISOString(),
    },
    env,
  );

  const fetchImpl: FetchLike = async () => ({
    status: 500,
    text: async () =>
      JSON.stringify({
        message: "server failed",
        reason: "server_error",
      }),
  });
  const client = new ApiClient({
    endpoint: "http://127.0.0.1:8120",
    profileName: "local",
    env,
    fetch: fetchImpl,
  });

  const result = await logout({ client, profileName: "local", env });

  assert.equal(result.ok, true);
  assert.equal(result.revoked, false);
  assert.match(String(result.warning), /server revoke failed/);
  assert.equal(await getCredential("local", env), undefined);
});

async function tempEnv(): Promise<NodeJS.ProcessEnv> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "zmy-cli-auth-"));
  tempDirs.push(dir);
  return { ...process.env, ZMY_CLI_HOME: dir };
}
