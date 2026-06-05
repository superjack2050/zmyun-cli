import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { listCollections } from "../src/collections.js";
import { saveCredential } from "../src/credentials.js";
import type { FetchLike } from "../src/http.js";
import { ApiClient } from "../src/http.js";

const tempDirs: string[] = [];

after(async () => {
  await Promise.all(
    tempDirs.map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
});

test("collection list by id resolves detail SPU and filters exact id locally", async () => {
  const calls: Array<{ method: string; url: string }> = [];
  const client = await authenticatedClient(async (input, init) => {
    const url = input.toString();
    calls.push({ method: init?.method ?? "GET", url });
    const parsed = new URL(url);

    if (parsed.pathname === "/api/v1/develop/collection/get_by_id") {
      return envelopeResponse({
        id: "123",
        spu_serial_num: "spu-1",
      });
    }

    if (parsed.pathname === "/api/v1/develop/collection/get_list_by_workflow") {
      assert.equal(parsed.searchParams.get("id"), null);
      assert.equal(parsed.searchParams.get("spu_serial_num"), "spu-1");
      return envelopeResponse({
        collection_list: [
          { id: "999", spu_serial_num: "spu-1", ai_editing_status: 2 },
          { id: "123", spu_serial_num: "spu-1", ai_editing_status: 4 },
        ],
        total: "2",
      });
    }

    return envelopeResponse({});
  });

  const result = await listCollections(client, { id: "123" });

  assert.equal(calls.length, 2);
  assert.deepEqual(result.collection_list, [
    { id: "123", spu_serial_num: "spu-1", ai_editing_status: 4 },
  ]);
  assert.equal(result.total, 1);
});

test("collection list rejects id with spu because id already resolves SPU", async () => {
  const client = await authenticatedClient(async () => envelopeResponse({}));

  await assert.rejects(
    () => listCollections(client, { id: "123", spu: "spu-1" }),
    /--id and --spu cannot be combined/,
  );
});

async function authenticatedClient(fetch: FetchLike): Promise<ApiClient> {
  const env = await tempEnv();
  await saveCredential(
    "local",
    {
      access_token: "zmy_at_test",
      refresh_token: "zmy_rt_test",
      token_type: "Bearer",
      scope: "ops:read collection:read project:read",
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
      updated_at: new Date().toISOString(),
    },
    env,
  );

  return new ApiClient({
    endpoint: "http://example.test",
    profileName: "local",
    env,
    fetch,
  });
}

async function tempEnv(): Promise<NodeJS.ProcessEnv> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "zmy-cli-list-"));
  tempDirs.push(dir);
  return { ...process.env, ZMY_CLI_HOME: dir };
}

function envelopeResponse(metadata: unknown) {
  return {
    status: 200,
    async text() {
      return JSON.stringify({
        code: 200,
        message: "success",
        reason: "",
        metadata,
      });
    },
  };
}
