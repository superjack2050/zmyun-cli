import { test } from "node:test";
import assert from "node:assert/strict";
import {
  batchHasFailures,
  batchTableRows,
  buildBatchResult,
  summarizeBatchResults,
} from "../src/batch.js";

test("summarizeBatchResults counts every status", () => {
  assert.deepEqual(
    summarizeBatchResults([
      { id: "1", status: "success", message: "ok" },
      { id: "2", status: "failed", message: "bad" },
      { id: "3", status: "skipped", message: "skip" },
      { id: "4", status: "unchanged", message: "same" },
      { id: "5", status: "dry-run", message: "preview" },
    ]),
    {
      total: 5,
      success: 1,
      failed: 1,
      skipped: 1,
      unchanged: 1,
      dry_run: 1,
    },
  );
});

test("buildBatchResult and batchHasFailures expose failed summaries", () => {
  const result = buildBatchResult("submit-ai-editing", [
    { id: "1", status: "success", message: "ok" },
    { id: "2", status: "failed", message: "bad" },
  ]);

  assert.equal(result.operation, "submit-ai-editing");
  assert.equal(batchHasFailures(result), true);
});

test("batchTableRows flattens before and after fields", () => {
  const rows = batchTableRows(
    buildBatchResult("set-project", [
      {
        id: "1",
        status: "success",
        message: "ok",
        before: { workflow: "ai-editing", ai_editing_status: "pending" },
        after: { project_id: "456" },
      },
    ]),
  );

  assert.deepEqual(rows[0], {
    ID: "1",
    Status: "success",
    Message: "ok",
    Workflow: "ai-editing",
    AI: "pending",
    Project: "456",
  });
});
