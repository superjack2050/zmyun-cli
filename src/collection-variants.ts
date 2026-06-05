import { CliError } from "./errors.js";

export interface CollectionVariantAttribute {
  attr_key: string;
  attr_value_list: string[];
}

export interface CollectionVariantSku {
  sku_id?: string | number;
  sku_attributes?: Record<string, string>;
  cost_price?: number;
  reference_price?: number;
  stock?: number;
  carriage?: number;
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
  package_length?: number;
  package_width?: number;
  package_height?: number;
  min_purchase_amount?: number;
  master_image?: string;
  master_thumbnail?: string;
  affiliate_images?: string[];
  [key: string]: unknown;
}

export interface CollectionVariantsMetadata {
  collection_id: string;
  updated_at: string;
  attributes: CollectionVariantAttribute[];
  sku_list: CollectionVariantSku[];
  price_calc_settings: Record<string, unknown>;
}

export interface VariantsSetPayload {
  attributes: unknown[];
  sku_list: unknown[];
  reprice?: boolean;
  if_match_updated_at?: string;
  [key: string]: unknown;
}

export interface SkuPatchItem {
  sku_id: string | number;
  update_mask: string[];
  cost_price?: number;
  reference_price?: number;
  stock?: number;
  carriage?: number;
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
  package_length?: number;
  package_width?: number;
  package_height?: number;
  min_purchase_amount?: number;
  master_image?: string;
  master_thumbnail?: string;
  affiliate_images?: string[];
  [key: string]: unknown;
}

export interface SkuPatchBatchPayload {
  items: SkuPatchItem[];
  reprice?: boolean;
  if_match_updated_at?: string;
  [key: string]: unknown;
}

export type AttributeOperationType =
  | "rename_key"
  | "rename_value"
  | "merge_value"
  | "remove_value"
  | "remove_key";

export interface AttributeOperationPayload {
  operation: AttributeOperationType;
  key?: string;
  from?: string;
  to?: string;
  if_match_updated_at?: string;
}

export interface CollectionVariantsIssue {
  field: string;
  code: string;
  message: string;
}

export interface VariantsPreviewResult {
  dry_run: true;
  valid: boolean;
  errors: CollectionVariantsIssue[];
  warnings: CollectionVariantsIssue[];
  created_sku_count: number;
  updated_sku_count: number;
  deleted_sku_count: number;
  affected_sku_count: number;
  updated_fields: string[];
  current_updated_at: string;
}

export interface VariantsWriteResult {
  ok: true;
  collection_id: string;
  updated_fields: string[];
  updated_sku_ids: string[];
  created_sku_count: number;
  updated_sku_count: number;
  deleted_sku_count: number;
  affected_sku_count: number;
  updated_at: string;
}

export const VARIANT_SKU_PATCH_FIELDS = [
  "cost_price",
  "reference_price",
  "stock",
  "carriage",
  "weight",
  "length",
  "width",
  "height",
  "package_length",
  "package_width",
  "package_height",
  "min_purchase_amount",
  "master_image",
  "master_thumbnail",
  "affiliate_images",
] as const;

export type VariantSkuPatchField = (typeof VARIANT_SKU_PATCH_FIELDS)[number];

export const VARIANT_REPRICE_FIELDS = [
  "cost_price",
  "carriage",
  "weight",
  "length",
  "width",
  "height",
  "package_length",
  "package_width",
  "package_height",
] as const;

export const VARIANT_ATTRIBUTE_OPERATIONS = [
  "rename_key",
  "rename_value",
  "merge_value",
  "remove_value",
  "remove_key",
] as const;

const SKU_PATCH_FIELD_SET = new Set<string>(VARIANT_SKU_PATCH_FIELDS);
const REPRICE_FIELD_SET = new Set<string>(VARIANT_REPRICE_FIELDS);
const ATTRIBUTE_OPERATION_SET = new Set<string>(VARIANT_ATTRIBUTE_OPERATIONS);

export function parseVariantsJsonObject(
  raw: string,
  sourceName: string,
): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isPlainRecord(parsed)) {
      throw new Error("not object");
    }
    return parsed;
  } catch {
    throw new CliError("invalid_json", `${sourceName} must contain one JSON object.`);
  }
}

export function validateVariantsSetPayload(
  payload: unknown,
): CollectionVariantsIssue[] {
  if (!isPlainRecord(payload)) {
    return [issue("$", "INVALID_TYPE", "payload must be one JSON object")];
  }

  const errors: CollectionVariantsIssue[] = [];
  if (!Array.isArray(payload.attributes)) {
    errors.push(issue("attributes", "REQUIRED", "attributes must be an array"));
  }
  if (!Array.isArray(payload.sku_list)) {
    errors.push(issue("sku_list", "REQUIRED", "sku_list must be an array"));
  }
  if (payload.reprice !== undefined && typeof payload.reprice !== "boolean") {
    errors.push(issue("reprice", "INVALID_TYPE", "reprice must be boolean"));
  }
  if (
    payload.if_match_updated_at !== undefined &&
    typeof payload.if_match_updated_at !== "string"
  ) {
    errors.push(
      issue(
        "if_match_updated_at",
        "INVALID_TYPE",
        "if_match_updated_at must be a string",
      ),
    );
  }
  return errors;
}

export function assertValidVariantsSetPayload(
  payload: Record<string, unknown>,
): void {
  const errors = validateVariantsSetPayload(payload);
  if (errors.length > 0) {
    throw new CliError(
      "invalid_argument",
      "collection variants set payload validation failed",
      { details: { errors } },
    );
  }
}

export function validateSkuPatchBatchPayload(
  payload: unknown,
): CollectionVariantsIssue[] {
  if (!isPlainRecord(payload)) {
    return [issue("$", "INVALID_TYPE", "payload must be one JSON object")];
  }

  const errors: CollectionVariantsIssue[] = [];
  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    errors.push(issue("items", "REQUIRED", "items must be a non-empty array"));
    return errors;
  }

  payload.items.forEach((item, index) => {
    const field = `items[${index}]`;
    if (!isPlainRecord(item)) {
      errors.push(issue(field, "INVALID_TYPE", "item must be an object"));
      return;
    }
    if (!hasUsableId(item.sku_id)) {
      errors.push(issue(`${field}.sku_id`, "REQUIRED", "sku_id is required"));
    }
    validateUpdateMask(item.update_mask, `${field}.update_mask`, errors);
  });

  if (payload.reprice !== undefined && typeof payload.reprice !== "boolean") {
    errors.push(issue("reprice", "INVALID_TYPE", "reprice must be boolean"));
  }
  return errors;
}

export function assertValidSkuPatchBatchPayload(
  payload: Record<string, unknown>,
): void {
  const errors = validateSkuPatchBatchPayload(payload);
  if (errors.length > 0) {
    throw new CliError(
      "invalid_argument",
      "collection variants SKU patch payload validation failed",
      { details: { errors } },
    );
  }
}

export function validateSkuPatchItem(item: unknown): CollectionVariantsIssue[] {
  if (!isPlainRecord(item)) {
    return [issue("$", "INVALID_TYPE", "patch item must be an object")];
  }
  const errors: CollectionVariantsIssue[] = [];
  validateUpdateMask(item.update_mask, "update_mask", errors);
  return errors;
}

export function normalizeVariantsMetadata(
  metadata: unknown,
): CollectionVariantsMetadata {
  const record = asRecord(metadata);
  return {
    collection_id: normalizeVariantId(record.collection_id),
    updated_at: stringify(record.updated_at),
    attributes: normalizeAttributes(record.attributes),
    sku_list: normalizeSkuList(record.sku_list),
    price_calc_settings: asRecord(record.price_calc_settings),
  };
}

export function normalizeVariantsPreviewMetadata(
  metadata: unknown,
): VariantsPreviewResult {
  const record = asRecord(metadata);
  return {
    dry_run: true,
    valid: record.valid === true,
    errors: normalizeIssueArray(record.errors),
    warnings: normalizeIssueArray(record.warnings),
    created_sku_count: toCount(record.created_sku_count),
    updated_sku_count: toCount(record.updated_sku_count),
    deleted_sku_count: toCount(record.deleted_sku_count),
    affected_sku_count: toCount(record.affected_sku_count),
    updated_fields: normalizeStringArray(record.updated_fields),
    current_updated_at: stringify(record.current_updated_at),
  };
}

export function normalizeVariantsWriteMetadata(
  metadata: unknown,
): VariantsWriteResult {
  const record = asRecord(metadata);
  const collectionId = normalizeVariantId(record.collection_id);
  if (!collectionId) {
    throw new CliError(
      "invalid_response",
      "variants write response metadata is missing collection_id",
      { details: metadata },
    );
  }
  return {
    ok: true,
    collection_id: collectionId,
    updated_fields: normalizeStringArray(record.updated_fields),
    updated_sku_ids: normalizeIdArray(record.updated_sku_ids),
    created_sku_count: toCount(record.created_sku_count),
    updated_sku_count: toCount(record.updated_sku_count),
    deleted_sku_count: toCount(record.deleted_sku_count),
    affected_sku_count: toCount(record.affected_sku_count),
    updated_at: stringify(record.updated_at),
  };
}

export function parseCollectionVariantsBackendErrors(
  error: unknown,
): CollectionVariantsIssue[] | undefined {
  if (!(error instanceof CliError)) {
    return undefined;
  }

  const details = asRecord(error.details);
  const reason = stringify(details.reason || error.code);
  if (reason !== "INVALID_ARGUMENT" && error.code !== "INVALID_ARGUMENT") {
    return undefined;
  }

  const metadata = asRecord(details.metadata);
  const rawErrors = metadata.errors;
  if (Array.isArray(rawErrors)) {
    return normalizeIssueArray(rawErrors);
  }
  if (typeof rawErrors === "string") {
    try {
      const parsed = JSON.parse(rawErrors) as unknown;
      if (Array.isArray(parsed)) {
        return normalizeIssueArray(parsed);
      }
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export function isStaleWriteError(error: unknown): boolean {
  return backendReason(error) === "STALE_WRITE";
}

export function isNotFoundError(error: unknown): boolean {
  return backendReason(error) === "NOT_FOUND";
}

export function staleWriteError(): CliError {
  return new CliError(
    "STALE_WRITE",
    "Collection variants were changed after the CLI fetched them.",
    { hint: "Run: zmy collection variants get <collection-id>, then apply the change again." },
  );
}

export function notFoundError(resource: "collection" | "sku" | "collection or sku"): CliError {
  return new CliError("NOT_FOUND", `${resource} not found.`);
}

export function resolveRepriceDefault(
  updateMasks: string[][],
  options: { reprice?: boolean; noReprice?: boolean } = {},
): boolean {
  if (options.reprice && options.noReprice) {
    throw new CliError("invalid_argument", "--reprice and --no-reprice cannot be combined");
  }
  if (containsField(updateMasks, "reference_price") && options.reprice) {
    throw new CliError(
      "invalid_argument",
      "--reference-price and --reprice cannot be combined",
    );
  }
  if (options.reprice !== undefined) {
    return true;
  }
  if (options.noReprice !== undefined) {
    return false;
  }
  if (containsField(updateMasks, "reference_price")) {
    return false;
  }
  return updateMasks.some((mask) => mask.some((field) => REPRICE_FIELD_SET.has(field)));
}

export function normalizeAttributeOperation(
  operation: string,
  options: { key?: string; from?: string; to?: string },
): AttributeOperationPayload {
  const normalized = normalizeOperationName(operation);
  if (!ATTRIBUTE_OPERATION_SET.has(normalized)) {
    throw new CliError("invalid_argument", `Unsupported attribute operation: ${operation}`, {
      hint: `Use one of: ${VARIANT_ATTRIBUTE_OPERATIONS.join(", ")}`,
    });
  }

  const payload: AttributeOperationPayload = {
    operation: normalized as AttributeOperationType,
  };

  if (normalized === "rename_key") {
    payload.from = requiredText(options.from, "--from");
    payload.key = payload.from;
    payload.to = requiredText(options.to, "--to");
  } else if (normalized === "remove_key") {
    payload.key = requiredText(options.key, "--key");
    payload.from = payload.key;
  } else if (normalized === "rename_value" || normalized === "merge_value") {
    payload.key = requiredText(options.key, "--key");
    payload.from = requiredText(options.from, "--from");
    payload.to = requiredText(options.to, "--to");
  } else if (normalized === "remove_value") {
    payload.key = requiredText(options.key, "--key");
    payload.from = requiredText(options.from, "--from");
  }

  return payload;
}

export function shouldConfirmVariantsMutation(options: {
  preview: VariantsPreviewResult;
  operation?: AttributeOperationType;
}): boolean {
  if (options.preview.deleted_sku_count > 0) {
    return true;
  }
  return options.operation === "remove_value" || options.operation === "remove_key";
}

export function variantsIssueTableRows(result: {
  valid: boolean;
  errors: CollectionVariantsIssue[];
  warnings: CollectionVariantsIssue[];
}): Array<Record<string, unknown>> {
  const rows = [
    ...result.errors.map((entry) => issueTableRow("error", entry)),
    ...result.warnings.map((entry) => issueTableRow("warning", entry)),
  ];
  if (rows.length > 0) {
    return rows;
  }
  return [
    {
      Type: "status",
      Field: "",
      Code: result.valid ? "VALID" : "INVALID",
      Message: result.valid ? "validation passed" : "validation failed",
    },
  ];
}

export function variantsPreviewTableRows(
  result: VariantsPreviewResult,
): Array<Record<string, unknown>> {
  if (!result.valid || result.errors.length > 0 || result.warnings.length > 0) {
    return variantsIssueTableRows(result);
  }
  return [
    {
      Status: result.valid ? "valid" : "invalid",
      Created: result.created_sku_count,
      Updated: result.updated_sku_count,
      Deleted: result.deleted_sku_count,
      Affected: result.affected_sku_count,
      Fields: result.updated_fields.join(", "),
      UpdatedAt: result.current_updated_at,
    },
  ];
}

export function variantsWriteTableRows(
  result: VariantsWriteResult,
): Array<Record<string, unknown>> {
  return [
    {
      Collection: result.collection_id,
      Status: result.ok ? "ok" : "failed",
      Created: result.created_sku_count,
      Updated: result.updated_sku_count,
      Deleted: result.deleted_sku_count,
      Affected: result.affected_sku_count,
      Fields: result.updated_fields.join(", "),
      UpdatedAt: result.updated_at,
    },
  ];
}

export function variantsGetTableRows(
  result: CollectionVariantsMetadata,
): Array<Record<string, unknown>> {
  return result.sku_list.map((sku) => ({
    Collection: result.collection_id,
    SKU: normalizeVariantId(sku.sku_id),
    Attributes: formatSkuAttributes(sku.sku_attributes),
    Cost: sku.cost_price ?? "",
    Reference: sku.reference_price ?? "",
    Stock: sku.stock ?? "",
    Weight: sku.weight ?? "",
    Images: Array.isArray(sku.affiliate_images) ? sku.affiliate_images.length : 0,
    UpdatedAt: result.updated_at,
  }));
}

export function buildSkuPatchItemFromOptions(
  options: Record<string, unknown>,
): SkuPatchItem {
  const item: Record<string, unknown> = {};
  const fieldOptionPairs: Array<[VariantSkuPatchField, string]> = [
    ["cost_price", "costPrice"],
    ["reference_price", "referencePrice"],
    ["stock", "stock"],
    ["carriage", "carriage"],
    ["weight", "weight"],
    ["length", "length"],
    ["width", "width"],
    ["height", "height"],
    ["package_length", "packageLength"],
    ["package_width", "packageWidth"],
    ["package_height", "packageHeight"],
    ["min_purchase_amount", "minPurchaseAmount"],
    ["master_image", "masterImage"],
    ["master_thumbnail", "masterThumbnail"],
    ["affiliate_images", "affiliateImages"],
  ];

  const updateMask: string[] = [];
  for (const [field, optionName] of fieldOptionPairs) {
    const value = options[optionName];
    if (value === undefined) {
      continue;
    }
    item[field] = coerceSkuPatchValue(field, value);
    updateMask.push(field);
  }

  if (updateMask.length === 0) {
    throw new CliError("invalid_argument", "At least one SKU patch field is required.");
  }

  item.update_mask = updateMask;
  return item as SkuPatchItem;
}

export function normalizeSkuPatchBatchPayload(
  payload: Record<string, unknown>,
): SkuPatchBatchPayload {
  assertValidSkuPatchBatchPayload(payload);
  return payload as unknown as SkuPatchBatchPayload;
}

export function normalizeVariantsSetPayload(
  payload: Record<string, unknown>,
): VariantsSetPayload {
  assertValidVariantsSetPayload(payload);
  return payload as unknown as VariantsSetPayload;
}

function validateUpdateMask(
  value: unknown,
  field: string,
  errors: CollectionVariantsIssue[],
): void {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push(issue(field, "REQUIRED", "update_mask must be a non-empty array"));
    return;
  }

  value.forEach((entry, index) => {
    const entryField = `${field}[${index}]`;
    if (typeof entry !== "string" || entry.trim() === "") {
      errors.push(issue(entryField, "INVALID_TYPE", "update_mask field must be a string"));
      return;
    }
    if (!SKU_PATCH_FIELD_SET.has(entry)) {
      errors.push(issue(entryField, "UNSUPPORTED_FIELD", `${entry} cannot be patched`));
    }
  });
}

function coerceSkuPatchValue(field: VariantSkuPatchField, value: unknown): unknown {
  if (field === "master_image" || field === "master_thumbnail") {
    return String(value);
  }
  if (field === "affiliate_images") {
    if (Array.isArray(value)) {
      if (!value.every((entry) => typeof entry === "string")) {
        throw new CliError("invalid_argument", "--affiliate-images must contain strings");
      }
      return value;
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.startsWith("[")) {
        try {
          const parsed = JSON.parse(trimmed) as unknown;
          if (Array.isArray(parsed) && parsed.every((entry) => typeof entry === "string")) {
            return parsed;
          }
        } catch {
          // Fall through to comma splitting below.
        }
      }
      return trimmed
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
    }
    throw new CliError("invalid_argument", "--affiliate-images must be a JSON array or comma list");
  }

  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new CliError("invalid_argument", `${field} must be a non-negative number`);
  }
  if (field === "stock" || field === "weight" || field === "min_purchase_amount") {
    if (!Number.isInteger(number)) {
      throw new CliError("invalid_argument", `${field} must be an integer`);
    }
  }
  return number;
}

function backendReason(error: unknown): string {
  if (!(error instanceof CliError)) {
    return "";
  }
  const details = asRecord(error.details);
  return stringify(details.reason || error.code);
}

function normalizeOperationName(value: string): string {
  return value.trim().toLowerCase().replace(/-/g, "_");
}

function requiredText(value: string | undefined, option: string): string {
  const text = value?.trim() ?? "";
  if (!text) {
    throw new CliError("invalid_argument", `${option} is required`);
  }
  return text;
}

function hasUsableId(value: unknown): boolean {
  if (typeof value === "number") {
    return Number.isInteger(value) && value > 0;
  }
  if (typeof value === "string") {
    return value.trim() !== "" && Number.isInteger(Number(value)) && Number(value) > 0;
  }
  return false;
}

function containsField(updateMasks: string[][], field: string): boolean {
  return updateMasks.some((mask) => mask.includes(field));
}

function normalizeAttributes(value: unknown): CollectionVariantAttribute[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((entry) => {
    const record = asRecord(entry);
    return {
      attr_key: stringify(record.attr_key),
      attr_value_list: normalizeStringArray(record.attr_value_list),
    };
  });
}

function normalizeSkuList(value: unknown): CollectionVariantSku[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((entry) => {
    const record = asRecord(entry);
    return {
      ...record,
      sku_id: normalizeVariantId(record.sku_id),
      sku_attributes: normalizeSkuAttributes(record.sku_attributes),
      affiliate_images: normalizeStringArray(record.affiliate_images),
    };
  });
}

function normalizeSkuAttributes(value: unknown): Record<string, string> {
  const record = asRecord(value);
  return Object.fromEntries(
    Object.entries(record).map(([key, entry]) => [key, stringify(entry)]),
  );
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((entry) => stringify(entry)).filter((entry) => entry !== "");
}

function normalizeIssueArray(value: unknown): CollectionVariantsIssue[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((entry) => {
    const record = asRecord(entry);
    return issue(
      stringify(record.field),
      stringify(record.code) || "VALIDATION_ERROR",
      stringify(record.message) || "validation failed",
    );
  });
}

function normalizeIdArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => normalizeVariantId(entry))
    .filter((entry) => entry !== "");
}

export function normalizeVariantId(value: unknown): string {
  if (value === undefined || value === null || value === "") {
    return "";
  }
  return String(value);
}

function toCount(value: unknown): number {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number) || number < 0) {
    return 0;
  }
  return Math.trunc(number);
}

function issueTableRow(
  type: "error" | "warning",
  entry: CollectionVariantsIssue,
): Record<string, unknown> {
  return {
    Type: type,
    Field: entry.field,
    Code: entry.code,
    Message: entry.message,
  };
}

function issue(
  field: string,
  code: string,
  message: string,
): CollectionVariantsIssue {
  return { field, code, message };
}

function formatSkuAttributes(value: unknown): string {
  const record = asRecord(value);
  return Object.entries(record)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${key}=${String(entry)}`)
    .join(", ");
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  return isPlainRecord(value) ? value : {};
}

function stringify(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }
  return String(value);
}
