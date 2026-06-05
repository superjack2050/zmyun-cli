import { ApiClient } from "./http.js";
import { CliError } from "./errors.js";
import {
  assertValidCollectionCreatePayload,
  normalizeCreateMetadata,
  normalizeCreatePreviewMetadata,
} from "./collection-create.js";
import {
  assertValidSkuPatchBatchPayload,
  assertValidVariantsSetPayload,
  normalizeVariantsMetadata,
  normalizeVariantsPreviewMetadata,
  normalizeVariantsWriteMetadata,
  validateSkuPatchItem,
} from "./collection-variants.js";
import type {
  CollectionCreatePayload,
  CollectionCreatePreviewResult,
  CollectionCreateResult,
} from "./collection-create.js";
import type {
  AttributeOperationPayload,
  CollectionVariantsMetadata,
  SkuPatchBatchPayload,
  SkuPatchItem,
  VariantsPreviewResult,
  VariantsSetPayload,
  VariantsWriteResult,
} from "./collection-variants.js";

export interface CollectionListOptions {
  id?: string | number;
  page?: string | number;
  size?: string | number;
  projectId?: string | number;
  noProject?: boolean;
  workflow?: string;
  title?: string;
  spu?: string;
  creator?: string;
  developer?: string;
  currentPrincipal?: string;
  categoryId?: string | number;
  originType?: string;
  createdAfter?: string | number;
  createdBefore?: string | number;
  repeatOriginUrl?: boolean;
  onlyMine?: boolean;
  aiEditingStatus?: string;
  confirmer?: string;
  sortField?: string;
  sortOrder?: string;
}

export interface CollectionListMetadata {
  collection_list: Array<Record<string, unknown>>;
  total: string | number;
}

export function buildGetCollectionVariantsRequest(
  collectionId: string,
): { path: string } {
  return {
    path: `/api/v1/develop/collection/${encodeURIComponent(collectionId)}/variants`,
  };
}

export async function getCollectionVariants(
  client: ApiClient,
  collectionId: string,
): Promise<CollectionVariantsMetadata> {
  const request = buildGetCollectionVariantsRequest(collectionId);
  const metadata = await client.request("GET", request.path, {
    requireAuth: true,
  });
  return normalizeVariantsMetadata(metadata);
}

export function buildPreviewCollectionVariantsRequest(
  collectionId: string,
  payload: VariantsSetPayload,
): { path: string; data: VariantsSetPayload } {
  assertValidVariantsSetPayload(payload);
  return {
    path: `/api/v1/develop/collection/${encodeURIComponent(collectionId)}/variants/preview`,
    data: payload,
  };
}

export async function previewCollectionVariants(
  client: ApiClient,
  collectionId: string,
  payload: VariantsSetPayload,
): Promise<VariantsPreviewResult> {
  const request = buildPreviewCollectionVariantsRequest(collectionId, payload);
  const metadata = await client.request("POST", request.path, {
    data: request.data,
    requireAuth: true,
  });
  return normalizeVariantsPreviewMetadata(metadata);
}

export function buildReplaceCollectionVariantsRequest(
  collectionId: string,
  payload: VariantsSetPayload,
): { path: string; data: VariantsSetPayload } {
  assertValidVariantsSetPayload(payload);
  return {
    path: `/api/v1/develop/collection/${encodeURIComponent(collectionId)}/variants`,
    data: payload,
  };
}

export async function replaceCollectionVariants(
  client: ApiClient,
  collectionId: string,
  payload: VariantsSetPayload,
): Promise<VariantsWriteResult> {
  const request = buildReplaceCollectionVariantsRequest(collectionId, payload);
  const metadata = await client.request("PUT", request.path, {
    data: request.data,
    requireAuth: true,
  });
  return normalizeVariantsWriteMetadata(metadata);
}

export function buildPatchCollectionVariantSkuRequest(
  collectionId: string,
  skuId: string,
  payload: SkuPatchItem,
): { path: string; data: SkuPatchItem } {
  const errors = validateSkuPatchItem(payload);
  if (errors.length > 0) {
    throw new CliError("invalid_argument", "collection variant SKU patch validation failed", {
      details: { errors },
    });
  }
  return {
    path: `/api/v1/develop/collection/${encodeURIComponent(collectionId)}/variants/skus/${encodeURIComponent(skuId)}`,
    data: payload,
  };
}

export async function patchCollectionVariantSku(
  client: ApiClient,
  collectionId: string,
  skuId: string,
  payload: SkuPatchItem,
): Promise<VariantsWriteResult> {
  const request = buildPatchCollectionVariantSkuRequest(collectionId, skuId, payload);
  const metadata = await client.request("PATCH", request.path, {
    data: request.data,
    requireAuth: true,
  });
  return normalizeVariantsWriteMetadata(metadata);
}

export function buildPatchCollectionVariantSkusRequest(
  collectionId: string,
  payload: SkuPatchBatchPayload,
): { path: string; data: SkuPatchBatchPayload } {
  assertValidSkuPatchBatchPayload(payload as unknown as Record<string, unknown>);
  return {
    path: `/api/v1/develop/collection/${encodeURIComponent(collectionId)}/variants/skus`,
    data: payload,
  };
}

export async function patchCollectionVariantSkus(
  client: ApiClient,
  collectionId: string,
  payload: SkuPatchBatchPayload,
): Promise<VariantsWriteResult> {
  const request = buildPatchCollectionVariantSkusRequest(collectionId, payload);
  const metadata = await client.request("PATCH", request.path, {
    data: request.data,
    requireAuth: true,
  });
  return normalizeVariantsWriteMetadata(metadata);
}

export function buildPreviewCollectionVariantAttributeOperationRequest(
  collectionId: string,
  payload: AttributeOperationPayload,
): { path: string; data: AttributeOperationPayload } {
  return {
    path: `/api/v1/develop/collection/${encodeURIComponent(collectionId)}/variants/attributes/operation/preview`,
    data: payload,
  };
}

export async function previewCollectionVariantAttributeOperation(
  client: ApiClient,
  collectionId: string,
  payload: AttributeOperationPayload,
): Promise<VariantsPreviewResult> {
  const request = buildPreviewCollectionVariantAttributeOperationRequest(
    collectionId,
    payload,
  );
  const metadata = await client.request("POST", request.path, {
    data: request.data,
    requireAuth: true,
  });
  return normalizeVariantsPreviewMetadata(metadata);
}

export function buildCommitCollectionVariantAttributeOperationRequest(
  collectionId: string,
  payload: AttributeOperationPayload,
): { path: string; data: AttributeOperationPayload } {
  return {
    path: `/api/v1/develop/collection/${encodeURIComponent(collectionId)}/variants/attributes/operation`,
    data: payload,
  };
}

export async function commitCollectionVariantAttributeOperation(
  client: ApiClient,
  collectionId: string,
  payload: AttributeOperationPayload,
): Promise<VariantsWriteResult> {
  const request = buildCommitCollectionVariantAttributeOperationRequest(
    collectionId,
    payload,
  );
  const metadata = await client.request("POST", request.path, {
    data: request.data,
    requireAuth: true,
  });
  return normalizeVariantsWriteMetadata(metadata);
}

export function buildCreateCollectionPreviewRequest(
  payload: CollectionCreatePayload,
): { path: string; data: CollectionCreatePayload } {
  assertValidCollectionCreatePayload(payload);
  return {
    path: "/api/v1/develop/collection/create_preview",
    data: payload,
  };
}

export async function previewCollectionCreate(
  client: ApiClient,
  payload: CollectionCreatePayload,
): Promise<CollectionCreatePreviewResult> {
  const request = buildCreateCollectionPreviewRequest(payload);
  const metadata = await client.request("POST", request.path, {
    data: request.data,
    requireAuth: true,
  });
  return normalizeCreatePreviewMetadata(metadata);
}

export function buildCreateCollectionRequest(
  payload: CollectionCreatePayload,
): { path: string; data: CollectionCreatePayload } {
  assertValidCollectionCreatePayload(payload);
  return {
    path: "/api/v1/develop/collection/create",
    data: payload,
  };
}

export async function createCollection(
  client: ApiClient,
  payload: CollectionCreatePayload,
): Promise<CollectionCreateResult> {
  const request = buildCreateCollectionRequest(payload);
  const metadata = await client.request("POST", request.path, {
    data: request.data,
    requireAuth: true,
  });
  return normalizeCreateMetadata(metadata);
}

export interface ChoiceOption {
  name: string;
  value: number;
  description: string;
  aliases: string[];
}

export interface StringChoiceOption {
  name: string;
  value: string;
  description: string;
  aliases: string[];
}

export interface SubmitCollectionAiEditingOptions {
  market?: string;
  priority?: string | number;
  processMode?: string;
  requireMainImgWhiteBg?: boolean;
  enableAutoPricing?: boolean;
  collectionFinishMode?: string;
  targetWorkflow?: string;
}

export interface PatchCollectionContentOptions {
  englishTitle?: string;
  searchTerms?: string;
  description?: string;
  bulletPointList?: string[];
  ifMatchUpdatedAt?: string;
}

export interface SetCollectionSourceOptions {
  originUrl: string;
  allowDuplicate?: boolean;
  ifMatchUpdatedAt?: string;
}

export interface SetCollectionDeveloperOptions {
  developer: string;
  ifMatchUpdatedAt?: string;
}

export interface SetCollectionKeywordsOptions {
  keywords: CollectionKeywords;
  ifMatchUpdatedAt?: string;
}

export interface SetCollectionProjectOptions {
  projectId: string | number;
}

export interface CollectionKeywords {
  core_main?: string[];
  feature_attribute?: string[];
  scenario_audience_purpose?: string[];
  appearance_visual?: string[];
  long_tail?: string[];
}

export const WORKFLOW_OPTIONS: ChoiceOption[] = [
  {
    name: "pending",
    value: 1,
    description: "Pending collection handling.",
    aliases: ["pending", "Pending"],
  },
  {
    name: "procurement",
    value: 2,
    description: "Deprecated procurement workflow.",
    aliases: ["procurement", "Procurement"],
  },
  {
    name: "photograph",
    value: 3,
    description: "Deprecated photograph workflow.",
    aliases: ["photograph"],
  },
  {
    name: "edit-data",
    value: 4,
    description: "Deprecated data editing workflow.",
    aliases: ["edit-data", "edit_data", "EditData"],
  },
  {
    name: "pending-review",
    value: 5,
    description: "Pending review and confirmation.",
    aliases: ["pending-review", "pending_review", "PendingReview", "review"],
  },
  {
    name: "finished",
    value: 6,
    description: "Finished collections.",
    aliases: ["finished", "Finished", "done"],
  },
  {
    name: "trashed",
    value: 7,
    description: "Trashed collections.",
    aliases: ["trashed", "Trashed"],
  },
  {
    name: "ai-editing",
    value: 8,
    description: "AI editing workflow.",
    aliases: ["ai-editing", "ai_editing", "AIEditing"],
  },
  {
    name: "art-design",
    value: 100,
    description: "Art design workflow.",
    aliases: ["art-design", "art_design", "ArtDesign"],
  },
];

export const AI_EDITING_STATUS_OPTIONS: ChoiceOption[] = [
  {
    name: "pending",
    value: 1,
    description: "Waiting for AI editing.",
    aliases: ["pending", "PENDING"],
  },
  {
    name: "processing",
    value: 2,
    description: "AI editing is processing.",
    aliases: ["processing", "PROCESSING", "running"],
  },
  {
    name: "completed",
    value: 3,
    description: "AI editing completed.",
    aliases: ["completed", "COMPLETED", "done"],
  },
  {
    name: "failed",
    value: 4,
    description: "AI editing failed.",
    aliases: ["failed", "FAILED", "error"],
  },
  {
    name: "cancelled",
    value: 5,
    description: "AI editing was cancelled.",
    aliases: ["cancelled", "canceled", "CANCELLED", "CANCELED"],
  },
];

export const AI_EDITING_PROCESS_MODE_OPTIONS: StringChoiceOption[] = [
  {
    name: "text-and-image",
    value: "PROCESS_MODE_TEXT_AND_IMAGE",
    description: "Optimize both listing copy and images.",
    aliases: ["text-and-image", "text_image", "text-image", "both", "all"],
  },
  {
    name: "text-only",
    value: "PROCESS_MODE_TEXT_ONLY",
    description: "Only generate title, selling points, and copy.",
    aliases: ["text-only", "text_only", "copy", "copy-only"],
  },
  {
    name: "image-only",
    value: "PROCESS_MODE_IMAGE_ONLY",
    description: "Only optimize main image and material images.",
    aliases: ["image-only", "image_only", "images", "image"],
  },
];

export const COLLECTION_FINISH_MODE_OPTIONS: StringChoiceOption[] = [
  {
    name: "auto",
    value: "COLLECTION_FINISH_AUTO",
    description: "Automatically finish and stock in when AI editing completes.",
    aliases: ["auto", "automatic"],
  },
  {
    name: "manual",
    value: "COLLECTION_FINISH_MANUAL",
    description: "Leave completed AI editing for manual review.",
    aliases: ["manual", "review", "manual-review"],
  },
  {
    name: "intelligent",
    value: "COLLECTION_FINISH_SMART",
    description: "Let the backend choose the completion path intelligently.",
    aliases: ["intelligent", "smart"],
  },
];

export const ORIGIN_TYPE_OPTIONS: ChoiceOption[] = [
  {
    name: "1688",
    value: 1,
    description: "Alibaba 1688.",
    aliases: ["1688", "ali1688", "OriginType_Ali1688"],
  },
  {
    name: "aliexpress",
    value: 2,
    description: "AliExpress.",
    aliases: ["aliexpress", "ali-express", "ali_express", "OriginType_AliExpress"],
  },
  {
    name: "taobao",
    value: 3,
    description: "Taobao.",
    aliases: ["taobao", "ali-taobao", "ali_taobao", "OriginType_AliTaobao"],
  },
  {
    name: "tmall",
    value: 4,
    description: "Tmall.",
    aliases: ["tmall", "ali-tmall", "ali_tmall", "OriginType_AliTmall"],
  },
  {
    name: "ali-global",
    value: 5,
    description: "Alibaba global.",
    aliases: ["ali-global", "ali_global", "aliglobal", "OriginType_AliGlobal"],
  },
  {
    name: "gigab2b",
    value: 6,
    description: "GigaB2B.",
    aliases: ["gigab2b", "giga-b2b", "OriginType_Gigab2b"],
  },
];

export const SORT_FIELD_OPTIONS: ChoiceOption[] = [
  {
    name: "create-time",
    value: 1,
    description: "Sort by creation time.",
    aliases: ["create-time", "create_time", "created-at", "created_at"],
  },
  {
    name: "update-time",
    value: 2,
    description: "Sort by update time.",
    aliases: ["update-time", "update_time", "updated-at", "updated_at"],
  },
  {
    name: "finish-time",
    value: 3,
    description: "Sort by finish time.",
    aliases: ["finish-time", "finish_time", "finished-at", "finished_at"],
  },
];

export const SORT_ORDER_OPTIONS: ChoiceOption[] = [
  {
    name: "asc",
    value: 1,
    description: "Ascending order.",
    aliases: ["asc", "ascending"],
  },
  {
    name: "desc",
    value: 2,
    description: "Descending order.",
    aliases: ["desc", "descending"],
  },
];

export function buildCollectionListParams(
  options: CollectionListOptions,
): Record<string, unknown> {
  const page = toPositiveInteger(options.page ?? 1, "page");
  const size = toPositiveInteger(options.size ?? 20, "size");
  const projectId = toOptionalPositiveInteger(options.projectId, "project-id");
  if (projectId !== undefined && options.noProject) {
    throw new CliError("invalid_argument", "--project-id and --no-project cannot be combined");
  }
  if (options.sortOrder && !options.sortField) {
    throw new CliError("invalid_argument", "--sort-order requires --sort-field");
  }

  return omitEmpty({
    page_offset: page - 1,
    page_size: size,
    project_id: projectId,
    is_not_project: options.noProject ? true : undefined,
    workflow: normalizeChoice(options.workflow, "workflow", WORKFLOW_OPTIONS),
    title: options.title,
    spu_serial_num: options.spu,
    creator: options.creator,
    developer: options.developer,
    current_principal: options.currentPrincipal,
    category_id: toOptionalPositiveInteger(options.categoryId, "category-id"),
    origin_type: normalizeChoice(
      options.originType,
      "origin-type",
      ORIGIN_TYPE_OPTIONS,
    ),
    create_time_gt: toOptionalUnixSeconds(options.createdAfter, "created-after"),
    create_time_lt: toOptionalUnixSeconds(options.createdBefore, "created-before"),
    is_repeat_origin_url: options.repeatOriginUrl ? true : undefined,
    is_self_related: options.onlyMine ? true : undefined,
    ai_editing_status: normalizeChoice(
      options.aiEditingStatus,
      "ai-editing-status",
      AI_EDITING_STATUS_OPTIONS,
    ),
    confirmer: options.confirmer,
    sort_field: normalizeChoice(
      options.sortField,
      "sort-field",
      SORT_FIELD_OPTIONS,
    ),
    sort_order: normalizeChoice(
      options.sortOrder,
      "sort-order",
      SORT_ORDER_OPTIONS,
    ),
  });
}

export function buildCollectionListRequest(
  options: CollectionListOptions,
): { path: string; params: Record<string, unknown> } {
  return {
    path: "/api/v1/develop/collection/get_list_by_workflow",
    params: buildCollectionListParams(options),
  };
}

export async function listCollections(
  client: ApiClient,
  options: CollectionListOptions,
): Promise<CollectionListMetadata> {
  if (options.id !== undefined && options.id !== "") {
    return listCollectionById(client, options);
  }

  const request = buildCollectionListRequest(options);
  return client.request<CollectionListMetadata>("GET", request.path, {
    params: request.params,
    requireAuth: true,
  });
}

async function listCollectionById(
  client: ApiClient,
  options: CollectionListOptions,
): Promise<CollectionListMetadata> {
  if (options.spu) {
    throw new CliError("invalid_argument", "--id and --spu cannot be combined");
  }

  const id = String(toPositiveInteger(options.id ?? "", "id"));
  const detail = await getCollection(client, id);
  const detailRecord = asRecord(detail);
  const spu = pick(detailRecord, ["spu_serial_num", "spu"]);
  if (spu === "") {
    throw new CliError("invalid_response", "Collection detail did not include spu_serial_num.");
  }

  const result = await listCollections(client, {
    ...options,
    id: undefined,
    page: 1,
    spu: String(spu),
  });
  const collection_list = result.collection_list.filter((collection) => {
    const collectionId = pick(collection, ["id", "collection_id"]);
    return String(collectionId) === id;
  });

  return {
    ...result,
    collection_list,
    total: collection_list.length,
  };
}

export async function getCollection(
  client: ApiClient,
  id: string,
): Promise<unknown> {
  return client.request("GET", "/api/v1/develop/collection/get_by_id", {
    params: { id },
    requireAuth: true,
  });
}

export function buildSubmitCollectionAiEditingRequest(
  collectionId: string,
  options: SubmitCollectionAiEditingOptions = {},
): { path: string; data: Record<string, unknown> } {
  return {
    path: "/api/v1/develop/collection/submit_ai_editing",
    data: {
      collectionIds: [toPositiveInteger(collectionId, "collection id")],
      ...normalizeSubmitCollectionAiEditingOptions(options),
    },
  };
}

export function normalizeSubmitCollectionAiEditingOptions(
  options: SubmitCollectionAiEditingOptions = {},
): Record<string, unknown> {
  const processMode = normalizeStringChoice(
    options.processMode ?? "text-and-image",
    "process-mode",
    AI_EDITING_PROCESS_MODE_OPTIONS,
  );
  const collectionFinishMode = normalizeStringChoice(
    options.collectionFinishMode ?? "intelligent",
    "finish-mode",
    COLLECTION_FINISH_MODE_OPTIONS,
  );
  if (
    processMode === "PROCESS_MODE_TEXT_ONLY" &&
    options.requireMainImgWhiteBg !== undefined
  ) {
    throw new CliError(
      "invalid_argument",
      "--require-main-img-white-bg is only valid when --process-mode is text-and-image or image-only",
    );
  }

  return omitEmpty({
    targetWorkflow: normalizeChoice(
      options.targetWorkflow,
      "target-workflow",
      WORKFLOW_OPTIONS,
    ),
    market: normalizeMarket(options.market),
    priority: toPositiveInteger(options.priority ?? 1, "priority"),
    processMode,
    requireMainImgWhiteBg:
      processMode === "PROCESS_MODE_TEXT_ONLY"
        ? undefined
        : options.requireMainImgWhiteBg ?? false,
    enableAutoPricing: options.enableAutoPricing ?? false,
    collectionFinishMode,
  });
}

export async function submitCollectionAiEditing(
  client: ApiClient,
  collectionId: string,
  options: SubmitCollectionAiEditingOptions = {},
): Promise<unknown> {
  const request = buildSubmitCollectionAiEditingRequest(collectionId, options);
  return client.request("POST", request.path, {
    data: request.data,
    requireAuth: true,
  });
}

export function buildSetCollectionProjectRequest(
  collectionId: string,
  options: SetCollectionProjectOptions,
): { path: string; data: Record<string, unknown> } {
  return {
    path: `/api/v1/develop/collection/${encodeURIComponent(collectionId)}/project`,
    data: {
      project_id: toPositiveInteger(options.projectId, "project-id"),
    },
  };
}

export async function setCollectionProject(
  client: ApiClient,
  collectionId: string,
  projectId: string | number,
): Promise<unknown> {
  const request = buildSetCollectionProjectRequest(collectionId, { projectId });
  return client.request("PUT", request.path, {
    data: request.data,
    requireAuth: true,
  });
}

export function buildPatchCollectionContentRequest(
  collectionId: string,
  options: PatchCollectionContentOptions,
): { path: string; data: Record<string, unknown> } {
  const data = omitEmpty({
    english_title: options.englishTitle,
    search_terms: options.searchTerms,
    description: options.description,
    bullet_point_list: options.bulletPointList,
    if_match_updated_at: options.ifMatchUpdatedAt,
  });
  const updateMask = [
    ["english_title", options.englishTitle],
    ["search_terms", options.searchTerms],
    ["description", options.description],
    ["bullet_point_list", options.bulletPointList],
  ]
    .filter(([, value]) => value !== undefined)
    .map(([field]) => field);

  if (updateMask.length === 0) {
    throw new CliError(
      "invalid_argument",
      "At least one content field flag is required.",
      {
        hint: "Use --english-title, --search-terms, --description, or --bullet-point.",
      },
    );
  }
  if (options.englishTitle !== undefined && options.englishTitle.trim() === "") {
    throw new CliError("invalid_argument", "english-title cannot be empty");
  }

  return {
    path: `/api/v1/develop/collection/${encodeURIComponent(collectionId)}/content`,
    data: {
      ...data,
      update_mask: updateMask,
    },
  };
}

export async function patchCollectionContent(
  client: ApiClient,
  collectionId: string,
  options: PatchCollectionContentOptions,
): Promise<unknown> {
  const request = buildPatchCollectionContentRequest(collectionId, options);
  return client.request("PATCH", request.path, {
    data: request.data,
    requireAuth: true,
  });
}

export function buildSetCollectionSourceRequest(
  collectionId: string,
  options: SetCollectionSourceOptions,
): { path: string; data: Record<string, unknown> } {
  const originUrl = options.originUrl.trim();
  validateHttpUrl(originUrl, "origin-url");
  return {
    path: `/api/v1/develop/collection/${encodeURIComponent(collectionId)}/source`,
    data: omitEmpty({
      origin_url: originUrl,
      allow_duplicate: options.allowDuplicate ?? false,
      if_match_updated_at: options.ifMatchUpdatedAt,
    }),
  };
}

export async function setCollectionSource(
  client: ApiClient,
  collectionId: string,
  options: SetCollectionSourceOptions,
): Promise<unknown> {
  const request = buildSetCollectionSourceRequest(collectionId, options);
  return client.request("PUT", request.path, {
    data: request.data,
    requireAuth: true,
  });
}

export function buildSetCollectionDeveloperRequest(
  collectionId: string,
  options: SetCollectionDeveloperOptions,
): { path: string; data: Record<string, unknown> } {
  const developer = options.developer.trim();
  if (!developer) {
    throw new CliError("invalid_argument", "developer cannot be empty");
  }
  return {
    path: `/api/v1/develop/collection/${encodeURIComponent(collectionId)}/developer`,
    data: omitEmpty({
      developer,
      if_match_updated_at: options.ifMatchUpdatedAt,
    }),
  };
}

export async function setCollectionDeveloper(
  client: ApiClient,
  collectionId: string,
  options: SetCollectionDeveloperOptions,
): Promise<unknown> {
  const request = buildSetCollectionDeveloperRequest(collectionId, options);
  return client.request("PUT", request.path, {
    data: request.data,
    requireAuth: true,
  });
}

export function buildSetCollectionKeywordsRequest(
  collectionId: string,
  options: SetCollectionKeywordsOptions,
): { path: string; data: Record<string, unknown> } {
  if (!isPlainRecord(options.keywords)) {
    throw new CliError("invalid_argument", "keywords must be a JSON object");
  }
  return {
    path: `/api/v1/develop/collection/${encodeURIComponent(collectionId)}/keywords`,
    data: omitEmpty({
      keywords: {
        core_main: normalizeStringArray(options.keywords.core_main, "core_main"),
        feature_attribute: normalizeStringArray(
          options.keywords.feature_attribute,
          "feature_attribute",
        ),
        scenario_audience_purpose: normalizeStringArray(
          options.keywords.scenario_audience_purpose,
          "scenario_audience_purpose",
        ),
        appearance_visual: normalizeStringArray(
          options.keywords.appearance_visual,
          "appearance_visual",
        ),
        long_tail: normalizeStringArray(options.keywords.long_tail, "long_tail"),
      },
      if_match_updated_at: options.ifMatchUpdatedAt,
    }),
  };
}

export async function setCollectionKeywords(
  client: ApiClient,
  collectionId: string,
  options: SetCollectionKeywordsOptions,
): Promise<unknown> {
  const request = buildSetCollectionKeywordsRequest(collectionId, options);
  return client.request("PUT", request.path, {
    data: request.data,
    requireAuth: true,
  });
}

export function collectionTableRows(
  collections: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  return collections.map((collection) => ({
    ID: pick(collection, ["id", "collection_id"]),
    SPU: pick(collection, ["spu_serial_num", "spu"]),
    Title: pick(collection, ["title", "english_title", "chinese_title", "name"]),
    Workflow: formatChoiceValue(
      pick(collection, ["workflow", "current_workflow"]),
      WORKFLOW_OPTIONS,
    ),
    AI: formatChoiceValue(
      pick(collection, ["ai_editing_status"]),
      AI_EDITING_STATUS_OPTIONS,
    ),
    Project: pick(collection, ["project_name", "project_id"]),
    Principal: pick(collection, ["current_principal"]),
    Creator: pick(collection, ["creator", "creator_name"]),
    Developer: pick(collection, ["developer", "developer_name"]),
    Category: pick(collection, ["category", "category_name", "category_tree"]),
    SKU: pick(collection, ["sku_count", "sku"]),
    Price: rangeOrPick(collection, "min_price", "max_price", [
      "price",
      "reference_price",
      "min_reference_price",
    ]),
    Weight: rangeOrPick(collection, "min_weight", "max_weight", ["weight"]),
    UpdatedAt: pick(collection, ["updated_at", "update_time"]),
  }));
}

export function choiceTableRows(
  options: ChoiceOption[],
): Array<Record<string, unknown>> {
  return options.map((option) => ({
    Name: option.name,
    Value: option.value,
    Description: option.description,
    Aliases: option.aliases.join(", "),
  }));
}

function toPositiveInteger(value: string | number, name: string): number {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) {
    throw new CliError("invalid_argument", `${name} must be a positive integer`);
  }
  return number;
}

function toOptionalPositiveInteger(
  value: string | number | undefined,
  name: string,
): number | undefined {
  if (value === undefined || value === "") {
    return undefined;
  }
  return toPositiveInteger(value, name);
}

function toOptionalUnixSeconds(
  value: string | number | undefined,
  name: string,
): number | undefined {
  if (value === undefined || value === "") {
    return undefined;
  }

  if (typeof value === "number" || /^\d+$/.test(value)) {
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number < 0) {
      throw new CliError("invalid_argument", `${name} must be a valid timestamp`);
    }
    return number > 10_000_000_000 ? Math.floor(number / 1000) : number;
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    throw new CliError(
      "invalid_argument",
      `${name} must be a timestamp or ISO date`,
    );
  }
  return Math.floor(timestamp / 1000);
}

function normalizeChoice(
  value: string | undefined,
  name: string,
  options: ChoiceOption[],
): number | undefined {
  if (value === undefined || value === "") {
    return undefined;
  }

  const numeric = Number(value);
  const knownValues = new Set(options.map((option) => option.value));
  if (Number.isInteger(numeric)) {
    if (knownValues.has(numeric)) {
      return numeric;
    }
  }

  const normalized = normalizeKey(value);
  const option = options.find(
    (candidate) =>
      normalizeKey(candidate.name) === normalized ||
      candidate.aliases.some((alias) => normalizeKey(alias) === normalized),
  );
  if (!option) {
    throw new CliError("invalid_argument", `Unsupported ${name}: ${value}`, {
      hint: `Use one of: ${options.map((candidate) => candidate.name).join(", ")}`,
    });
  }
  return option.value;
}

function normalizeStringChoice(
  value: string | undefined,
  name: string,
  options: StringChoiceOption[],
): string {
  if (value === undefined || value === "") {
    throw new CliError("invalid_argument", `${name} is required`);
  }

  const normalized = normalizeKey(value);
  const option = options.find(
    (candidate) =>
      normalizeKey(candidate.name) === normalized ||
      normalizeKey(candidate.value) === normalized ||
      candidate.aliases.some((alias) => normalizeKey(alias) === normalized),
  );
  if (!option) {
    throw new CliError("invalid_argument", `Unsupported ${name}: ${value}`, {
      hint: `Use one of: ${options.map((candidate) => candidate.name).join(", ")}`,
    });
  }
  return option.value;
}

function normalizeMarket(value: string | undefined): string {
  const market = (value ?? "US").trim().toUpperCase();
  if (!market) {
    throw new CliError("invalid_argument", "market cannot be empty");
  }
  return market;
}

function formatChoiceValue(
  value: unknown,
  options: ChoiceOption[],
): unknown {
  if (value === "" || value === undefined || value === null) {
    return "";
  }

  let normalized: number | undefined;
  if (typeof value === "string") {
    const numeric = Number(value);
    if (Number.isInteger(numeric)) {
      normalized = numeric;
    } else {
      const key = normalizeKey(value);
      normalized = options.find(
        (option) =>
          normalizeKey(option.name) === key ||
          option.aliases.some((alias) => normalizeKey(alias) === key),
      )?.value;
    }
  } else {
    const numeric = Number(value);
    normalized = Number.isInteger(numeric) ? numeric : undefined;
  }

  if (normalized === undefined) {
    return value;
  }
  return options.find((option) => option.value === normalized)?.name ?? value;
}

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function omitEmpty(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== ""),
  );
}

function validateHttpUrl(value: string, name: string): void {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new CliError("invalid_argument", `${name} must be a valid URL`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new CliError("invalid_argument", `${name} must use http or https`);
  }
}

function normalizeStringArray(value: unknown, name: string): string[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new CliError("invalid_argument", `${name} must be an array of strings`);
  }
  return value;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pick(
  source: Record<string, unknown>,
  keys: string[],
): unknown {
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null) {
      return source[key];
    }
  }
  return "";
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function rangeOrPick(
  source: Record<string, unknown>,
  minKey: string,
  maxKey: string,
  fallbackKeys: string[],
): unknown {
  const min = source[minKey];
  const max = source[maxKey];
  if (min !== undefined && min !== null && max !== undefined && max !== null) {
    return min === max ? min : `${String(min)}-${String(max)}`;
  }
  return pick(source, fallbackKeys);
}
