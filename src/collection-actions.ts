import type { BatchResult, BatchResultItem } from "./batch.js";
import { buildBatchResult } from "./batch.js";
import {
  AI_EDITING_STATUS_OPTIONS,
  getCollection,
  listCollections,
  normalizeSubmitCollectionAiEditingOptions,
  setCollectionProject,
  submitCollectionAiEditing,
  WORKFLOW_OPTIONS,
} from "./collections.js";
import type { SubmitCollectionAiEditingOptions } from "./collections.js";
import type { ApiClient } from "./http.js";
import { getProject } from "./projects.js";

export interface SetProjectActionOptions {
  ids: string[];
  projectId: string | number;
  dryRun?: boolean;
  force?: boolean;
}

export interface SubmitAiEditingActionOptions
  extends SubmitCollectionAiEditingOptions {
  ids: string[];
  dryRun?: boolean;
  force?: boolean;
}

export async function runSetCollectionProjectAction(
  client: ApiClient,
  options: SetProjectActionOptions,
): Promise<BatchResult> {
  await getProject(client, String(options.projectId));

  const results: BatchResultItem[] = [];
  for (const id of options.ids) {
    results.push(await runBatchItem(id, () => setProjectItem(client, id, options)));
  }

  return buildBatchResult("set-project", results);
}

export async function runSubmitCollectionAiEditingAction(
  client: ApiClient,
  options: SubmitAiEditingActionOptions,
): Promise<BatchResult> {
  normalizeSubmitCollectionAiEditingOptions(options);

  const results: BatchResultItem[] = [];
  for (const id of options.ids) {
    results.push(await runBatchItem(id, () => submitAiEditingItem(client, id, options)));
  }

  return buildBatchResult("submit-ai-editing", results);
}

export function collectionPreview(collection: unknown): Record<string, unknown> {
  const source = asRecord(collection);
  const workflow = pick(source, ["workflow", "current_workflow"]);
  const aiStatus = pick(source, ["ai_editing_status"]);

  return {
    project_id: pick(source, ["project_id", "develop_project_id"]),
    workflow: formatChoiceValue(workflow, WORKFLOW_OPTIONS),
    ai_editing_status: formatChoiceValue(aiStatus, AI_EDITING_STATUS_OPTIONS),
  };
}

async function setProjectItem(
  client: ApiClient,
  id: string,
  options: SetProjectActionOptions,
): Promise<BatchResultItem> {
  const collection = await getCollection(client, id);
  const before = collectionPreview(collection);
  const currentProjectId = normalizeId(before.project_id);
  const targetProjectId = String(options.projectId);

  if (currentProjectId === targetProjectId) {
    return {
      id,
      status: "unchanged",
      message: "Collection already belongs to the target project.",
      before,
      after: { project_id: targetProjectId },
    };
  }

  if (currentProjectId && !options.force) {
    return {
      id,
      status: "failed",
      message: "Collection already belongs to another project. Use --force to replace it.",
      before,
    };
  }

  if (options.dryRun) {
    return {
      id,
      status: "dry-run",
      message: "Project would be set.",
      before,
      after: { project_id: targetProjectId },
    };
  }

  await setCollectionProject(client, id, options.projectId);
  return {
    id,
    status: "success",
    message: "Project set.",
    before,
    after: { project_id: targetProjectId },
  };
}

async function submitAiEditingItem(
  client: ApiClient,
  id: string,
  options: SubmitAiEditingActionOptions,
): Promise<BatchResultItem> {
  const collection = await getCollectionWithListState(client, id);
  const before = collectionPreview(collection);
  const workflow = normalizeChoiceName(before.workflow);
  const aiStatus = normalizeChoiceName(before.ai_editing_status);

  if (aiStatus === "processing") {
    return {
      id,
      status: "skipped",
      message: "AI editing is already processing.",
      before,
    };
  }

  if (aiStatus === "completed" && !options.force) {
    return {
      id,
      status: "skipped",
      message: "AI editing is already completed. Use --force to resubmit.",
      before,
    };
  }

  if (workflow && workflow !== "ai-editing" && !options.force) {
    return {
      id,
      status: "failed",
      message: "Collection workflow does not allow AI submission.",
      before,
    };
  }

  if (options.dryRun) {
    return {
      id,
      status: "dry-run",
      message: "AI editing would be submitted.",
      before,
    };
  }

  await submitCollectionAiEditing(client, id, options);
  return {
    id,
    status: "success",
    message: "AI editing submitted.",
    before,
  };
}

async function getCollectionWithListState(
  client: ApiClient,
  id: string,
): Promise<unknown> {
  const detail = await getCollection(client, id);
  const preview = collectionPreview(detail);
  if (preview.ai_editing_status !== "") {
    return detail;
  }

  const detailRecord = asRecord(detail);
  const spu = pick(detailRecord, ["spu_serial_num", "spu"]);
  if (spu === "") {
    return detail;
  }

  const listResult = await listCollections(client, {
    spu: String(spu),
    size: 5,
  });
  const listRecord = listResult.collection_list.find((item) => {
    const itemId = pick(item, ["id", "collection_id"]);
    return String(itemId) === id;
  });

  return listRecord ? { ...detailRecord, ...listRecord } : detail;
}

async function runBatchItem(
  id: string,
  action: () => Promise<BatchResultItem>,
): Promise<BatchResultItem> {
  try {
    return await action();
  } catch (error) {
    return {
      id,
      status: "failed",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function pick(source: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null) {
      return source[key];
    }
  }
  return "";
}

function normalizeId(value: unknown): string {
  if (value === undefined || value === null || value === "" || value === 0 || value === "0") {
    return "";
  }
  return String(value);
}

function normalizeChoiceName(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.toLowerCase();
}

function formatChoiceValue(
  value: unknown,
  options: Array<{ name: string; value: number; aliases: string[] }>,
): unknown {
  if (value === "" || value === undefined || value === null) {
    return "";
  }

  const numeric = Number(value);
  if (Number.isInteger(numeric)) {
    return options.find((option) => option.value === numeric)?.name ?? value;
  }

  if (typeof value === "string") {
    const normalized = value.toLowerCase().replace(/[^a-z0-9]/g, "");
    return (
      options.find(
        (option) =>
          option.name.toLowerCase().replace(/[^a-z0-9]/g, "") === normalized ||
          option.aliases.some(
            (alias) => alias.toLowerCase().replace(/[^a-z0-9]/g, "") === normalized,
          ),
      )?.name ?? value
    );
  }

  return value;
}
