import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after } from "node:test";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  runSetCollectionProjectAction,
  runSubmitCollectionAiEditingAction,
} from "../src/collection-actions.js";
import { saveCredential } from "../src/credentials.js";
import type { FetchLike } from "../src/http.js";
import { ApiClient } from "../src/http.js";

const tempDirs: string[] = [];

after(async () => {
  await Promise.all(
    tempDirs.map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
});

test("set-project dry-run validates target project but does not write", async () => {
  const calls: Array<{ method: string; url: string; body?: string }> = [];
  const client = await clientWithCollectionSequence(
    calls,
    [{ id: "1", project_id: 0 }],
    { "/api/v1/develop/project/get_info_by_id": { id: "9", name: "Launch" } },
  );

  const result = await runSetCollectionProjectAction(client, {
    ids: ["1"],
    projectId: "9",
    dryRun: true,
  });

  assert.equal(result.operation, "set-project");
  assert.equal(result.results[0].status, "dry-run");
  assert.equal(
    calls.some((call) => call.method === "PUT"),
    false,
  );
});

test("set-project refuses replacing a different project without force", async () => {
  const calls: Array<{ method: string; url: string; body?: string }> = [];
  const client = await clientWithCollectionSequence(
    calls,
    [{ id: "1", project_id: 8 }],
    { "/api/v1/develop/project/get_info_by_id": { id: "9", name: "Launch" } },
  );

  const result = await runSetCollectionProjectAction(client, {
    ids: ["1"],
    projectId: "9",
  });

  assert.equal(result.results[0].status, "failed");
  assert.match(result.results[0].message, /--force/);
  assert.equal(
    calls.some((call) => call.method === "PUT"),
    false,
  );
});

test("set-project skips collections already in the target project", async () => {
  const calls: Array<{ method: string; url: string; body?: string }> = [];
  const client = await clientWithCollectionSequence(
    calls,
    [{ id: "1", project_id: 9 }],
    { "/api/v1/develop/project/get_info_by_id": { id: "9", name: "Launch" } },
  );

  const result = await runSetCollectionProjectAction(client, {
    ids: ["1"],
    projectId: "9",
  });

  assert.equal(result.results[0].status, "unchanged");
  assert.equal(
    calls.some((call) => call.method === "PUT"),
    false,
  );
});

test("set-project force writes the target project id", async () => {
  const calls: Array<{ method: string; url: string; body?: string }> = [];
  const client = await clientWithCollectionSequence(
    calls,
    [{ id: "1", project_id: 8 }],
    {
      "/api/v1/develop/project/get_info_by_id": { id: "9", name: "Launch" },
      "/api/v1/develop/collection/1/project": { ok: true },
    },
  );

  const result = await runSetCollectionProjectAction(client, {
    ids: ["1"],
    projectId: "9",
    force: true,
  });

  assert.equal(result.results[0].status, "success");
  const writeCall = calls.find((call) => call.method === "PUT");
  assert.ok(writeCall?.body);
  assert.deepEqual(JSON.parse(writeCall.body), { project_id: 9 });
});

test("submit-ai-editing skips processing and completed items unless forced", async () => {
  const calls: Array<{ method: string; url: string; body?: string }> = [];
  const client = await clientWithCollectionSequence(calls, [
    { id: "1", workflow: 8, ai_editing_status: 2 },
    { id: "2", workflow: 8, ai_editing_status: 3 },
  ]);

  const result = await runSubmitCollectionAiEditingAction(client, {
    ids: ["1", "2"],
  });

  assert.deepEqual(result.results.map((item) => item.status), ["skipped", "skipped"]);
  assert.equal(
    calls.some((call) => call.url.includes("/api/v1/develop/collection/submit_ai_editing")),
    false,
  );
});

test("submit-ai-editing falls back to list state when detail omits AI status", async () => {
  const calls: Array<{ method: string; url: string; body?: string }> = [];
  const client = await clientWithResponses(calls, {
    "/api/v1/develop/collection/get_by_id": {
      id: "123",
      spu_serial_num: "spu-1",
      current_workflow: "AIEditing",
    },
    "/api/v1/develop/collection/get_list_by_workflow": {
      collection_list: [
        {
          id: "123",
          spu_serial_num: "spu-1",
          workflow: "AIEditing",
          ai_editing_status: 3,
        },
      ],
      total: "1",
    },
    "/api/v1/develop/collection/submit_ai_editing": { ok: true },
  });

  const result = await runSubmitCollectionAiEditingAction(client, {
    ids: ["123"],
  });

  assert.equal(result.results[0].status, "skipped");
  assert.equal(
    calls.some((call) => call.url.includes("/api/v1/develop/collection/submit_ai_editing")),
    false,
  );
});

test("submit-ai-editing dry-run does not send write request", async () => {
  const calls: Array<{ method: string; url: string; body?: string }> = [];
  const client = await clientWithCollectionSequence(calls, [
    { id: "1", workflow: 8, ai_editing_status: 1 },
  ]);

  const result = await runSubmitCollectionAiEditingAction(client, {
    ids: ["1"],
    dryRun: true,
  });

  assert.equal(result.results[0].status, "dry-run");
  assert.equal(
    calls.some((call) => call.url.includes("/api/v1/develop/collection/submit_ai_editing")),
    false,
  );
});

test("submit-ai-editing validates options before dry-run preflight", async () => {
  const calls: Array<{ method: string; url: string; body?: string }> = [];
  const client = await clientWithCollectionSequence(calls, [
    { id: "1", workflow: 8, ai_editing_status: 1 },
  ]);

  await assert.rejects(
    () =>
      runSubmitCollectionAiEditingAction(client, {
        ids: ["1"],
        dryRun: true,
        processMode: "text-only",
        requireMainImgWhiteBg: true,
      }),
    /only valid/,
  );
  assert.equal(calls.length, 0);
});

test("submit-ai-editing force allows completed resubmission", async () => {
  const calls: Array<{ method: string; url: string; body?: string }> = [];
  const client = await clientWithCollectionSequence(
    calls,
    [{ id: "1", workflow: 8, ai_editing_status: 3 }],
    { "/api/v1/develop/collection/submit_ai_editing": { ok: true } },
  );

  const result = await runSubmitCollectionAiEditingAction(client, {
    ids: ["1"],
    force: true,
    processMode: "image-only",
    requireMainImgWhiteBg: true,
    enableAutoPricing: true,
    collectionFinishMode: "auto",
    market: "ca",
    priority: "7",
  });

  assert.equal(result.results[0].status, "success");
  const submitCall = calls.find((call) =>
    call.url.includes("/api/v1/develop/collection/submit_ai_editing"),
  );
  assert.ok(submitCall?.body);
  assert.deepEqual(JSON.parse(submitCall.body), {
    collectionIds: [1],
    market: "CA",
    priority: 7,
    processMode: "PROCESS_MODE_IMAGE_ONLY",
    requireMainImgWhiteBg: true,
    enableAutoPricing: true,
    collectionFinishMode: "COLLECTION_FINISH_AUTO",
  });
});

async function clientWithCollectionSequence(
  calls: Array<{ method: string; url: string; body?: string }>,
  collections: Array<Record<string, unknown>>,
  extraResponses: Record<string, unknown> = {},
): Promise<ApiClient> {
  const queue = [...collections];
  return authenticatedClient(async (input, init) => {
    const url = input.toString();
    calls.push({ method: init?.method ?? "GET", url, body: init?.body?.toString() });
    const path = new URL(url).pathname;
    if (path === "/api/v1/develop/collection/get_by_id") {
      return envelopeResponse(queue.shift() ?? {});
    }
    return envelopeResponse(extraResponses[path] ?? {});
  });
}

async function clientWithResponses(
  calls: Array<{ method: string; url: string; body?: string }>,
  responses: Record<string, unknown>,
): Promise<ApiClient> {
  const fetch: FetchLike = async (input, init) => {
    const url = input.toString();
    calls.push({ method: init?.method ?? "GET", url, body: init?.body?.toString() });
    return envelopeResponse(responses[new URL(url).pathname] ?? {});
  };

  return authenticatedClient(fetch);
}

async function authenticatedClient(fetch: FetchLike): Promise<ApiClient> {
  const env = await tempEnv();
  await saveCredential(
    "local",
    {
      access_token: "zmy_at_test",
      refresh_token: "zmy_rt_test",
      token_type: "Bearer",
      scope: "ops:read collection:read collection:write project:read",
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
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "zmy-cli-actions-"));
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
