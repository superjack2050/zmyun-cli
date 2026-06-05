import { CliError } from "./errors.js";

export interface CollectionCreatePayload {
  [key: string]: unknown;
}

export interface CollectionCreateValidationError {
  field: string;
  code: string;
  message: string;
}

export interface CollectionCreatePreviewResult {
  dry_run: true;
  valid: boolean;
  errors: CollectionCreateValidationError[];
  warnings: CollectionCreateValidationError[];
}

export interface CollectionCreateResult {
  ok: true;
  collection_id: string;
  spu_serial_num: string;
  warnings: CollectionCreateValidationError[];
}

export interface CollectionCreateSchemaField {
  name: string;
  required: boolean;
  type: string;
  notes: string;
}

export const COLLECTION_CREATE_FIELDS: CollectionCreateSchemaField[] = [
  {
    name: "title",
    required: true,
    type: "string",
    notes: "Only required create field. Backend maps it to title storage fields.",
  },
  {
    name: "origin_url",
    required: false,
    type: "string",
    notes: "Optional source URL. Duplicate URLs are allowed.",
  },
  {
    name: "project_id",
    required: false,
    type: "integer",
    notes: "Development project id. Must be positive when provided.",
  },
  {
    name: "category_id",
    required: false,
    type: "integer",
    notes: "Category id. Must be positive when provided.",
  },
  {
    name: "description",
    required: false,
    type: "string",
    notes: "Product description.",
  },
  {
    name: "search_terms",
    required: false,
    type: "string",
    notes: "Listing search terms.",
  },
  {
    name: "bullet_point_list",
    required: false,
    type: "string[]",
    notes: "Listing bullet points.",
  },
  {
    name: "attributes",
    required: false,
    type: "object[]",
    notes: "Optional SPU attribute definitions.",
  },
  {
    name: "sku_list",
    required: false,
    type: "object[]",
    notes: "Optional SKU rows.",
  },
  {
    name: "master_image_gallery",
    required: false,
    type: "string[]",
    notes: "Collection-level main images.",
  },
  {
    name: "affiliate_image_gallery",
    required: false,
    type: "string[]",
    notes: "Collection-level detail or affiliate images.",
  },
  {
    name: "price_calc_settings",
    required: false,
    type: "object",
    notes: "Price calculation settings passed through to backend.",
  },
  {
    name: "keywords",
    required: false,
    type: "object",
    notes: "Listing keyword groups.",
  },
];

export const COLLECTION_CREATE_RESERVED_FIELDS = [
  "english_title",
  "chinese_title",
  "developer",
  "creator",
  "company_id",
  "current_principal",
  "current_workflow",
  "origin_type",
  "spu_serial_num",
  "history_workflow_list",
  "history_principal_list",
];

export const COLLECTION_CREATE_CAMEL_CASE_ALIASES = [
  "originUrl",
  "projectId",
  "categoryId",
  "searchTerms",
  "bulletPointList",
  "skuList",
  "masterImageGallery",
  "affiliateImageGallery",
  "priceCalcSettings",
  "englishTitle",
  "chineseTitle",
  "companyId",
  "currentPrincipal",
  "currentWorkflow",
  "originType",
  "spuSerialNum",
  "historyWorkflowList",
  "historyPrincipalList",
];

const ATTRIBUTE_CAMEL_CASE_ALIASES = ["attrKey", "attrValueList"];

const SKU_CAMEL_CASE_ALIASES = [
  "skuAttributes",
  "costPrice",
  "referencePrice",
  "masterImage",
  "masterThumbnail",
  "affiliateImages",
  "packageLength",
  "packageWidth",
  "packageHeight",
  "minPurchaseAmount",
];

const PRICE_CALC_CAMEL_CASE_ALIASES = [
  "marketCode",
  "formulaId",
  "profitRate",
  "isAutoCalculate",
  "currencyCode",
];

export const COLLECTION_CREATE_SCHEMA = {
  schema: "collection_create",
  version: "0.1.03",
  required: ["title"],
  fields: COLLECTION_CREATE_FIELDS,
  reserved_fields: COLLECTION_CREATE_RESERVED_FIELDS,
  unsupported_aliases: COLLECTION_CREATE_CAMEL_CASE_ALIASES,
};

const STRING_ARRAY_FIELDS = [
  "bullet_point_list",
  "master_image_gallery",
  "affiliate_image_gallery",
];

const SKU_NUMERIC_FIELDS = [
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
];

const KEYWORD_GROUPS = [
  "core_main",
  "feature_attribute",
  "scenario_audience_purpose",
  "appearance_visual",
  "long_tail",
];

export function collectionCreateSchemaTableRows(): Array<Record<string, unknown>> {
  return COLLECTION_CREATE_FIELDS.map((field) => ({
    Field: field.name,
    Required: field.required ? "yes" : "no",
    Type: field.type,
    Notes: field.notes,
  }));
}

export function parseCollectionCreatePayloadJson(
  raw: string,
  sourceName: string,
): CollectionCreatePayload {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isPlainRecord(parsed)) {
      throw new Error("not object");
    }
    return parsed;
  } catch {
    throw new CliError(
      "invalid_json",
      `${sourceName} must contain one JSON object.`,
    );
  }
}

export function validateCollectionCreatePayload(
  payload: unknown,
): CollectionCreateValidationError[] {
  const errors: CollectionCreateValidationError[] = [];
  if (!isPlainRecord(payload)) {
    return [
      issue("$", "INVALID_TYPE", "payload must be one JSON object"),
    ];
  }

  validateReservedFields(payload, errors);
  validateCamelCaseFields(payload, errors);
  validateTitle(payload, errors);
  validatePositiveIntegerField(payload, "project_id", errors);
  validatePositiveIntegerField(payload, "category_id", errors);
  validateStringArrayFields(payload, errors);
  validateAttributes(payload, errors);
  validateSkuList(payload, errors);
  validatePriceCalcSettings(payload, errors);
  validateKeywords(payload, errors);

  return errors;
}

export function assertValidCollectionCreatePayload(
  payload: CollectionCreatePayload,
): void {
  const errors = validateCollectionCreatePayload(payload);
  if (errors.length > 0) {
    throw new CliError(
      "invalid_argument",
      "collection create payload validation failed",
      { details: { errors } },
    );
  }
}

export function normalizeCreatePreviewMetadata(
  metadata: unknown,
): CollectionCreatePreviewResult {
  const record = asRecord(metadata);
  return {
    dry_run: true,
    valid: record.valid === true,
    errors: normalizeIssueArray(record.errors),
    warnings: normalizeIssueArray(record.warnings),
  };
}

export function normalizeCreateMetadata(
  metadata: unknown,
): CollectionCreateResult {
  const record = asRecord(metadata);
  const collectionId = stringify(record.collection_id);
  const spuSerialNum = stringify(record.spu_serial_num);
  if (!collectionId) {
    throw new CliError(
      "invalid_response",
      "create response metadata is missing collection_id",
      { details: metadata },
    );
  }
  if (!spuSerialNum) {
    throw new CliError(
      "invalid_response",
      "create response metadata is missing spu_serial_num",
      { details: metadata },
    );
  }
  return {
    ok: true,
    collection_id: collectionId,
    spu_serial_num: spuSerialNum,
    warnings: normalizeIssueArray(record.warnings),
  };
}

export function parseCollectionCreateBackendErrors(
  error: unknown,
): CollectionCreateValidationError[] | undefined {
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
  if (rawErrors === undefined) {
    return undefined;
  }

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

export function collectionCreateValidationTableRows(
  result: {
    valid: boolean;
    errors: CollectionCreateValidationError[];
    warnings: CollectionCreateValidationError[];
  },
): Array<Record<string, unknown>> {
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

export function collectionCreateResultTableRows(
  result: CollectionCreateResult,
): Array<Record<string, unknown>> {
  return [
    {
      OK: result.ok,
      CollectionID: result.collection_id,
      SPU: result.spu_serial_num,
      Warnings: result.warnings.length,
    },
  ];
}

function validateReservedFields(
  payload: CollectionCreatePayload,
  errors: CollectionCreateValidationError[],
): void {
  for (const field of COLLECTION_CREATE_RESERVED_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(payload, field)) {
      errors.push(
        issue(field, "RESERVED_FIELD", `${field} is generated by the backend`),
      );
    }
  }
}

function validateCamelCaseFields(
  payload: CollectionCreatePayload,
  errors: CollectionCreateValidationError[],
): void {
  for (const field of COLLECTION_CREATE_CAMEL_CASE_ALIASES) {
    if (Object.prototype.hasOwnProperty.call(payload, field)) {
      errors.push(
        issue(
          field,
          "UNSUPPORTED_FIELD_NAME",
          `${field} is not supported; use snake_case request fields`,
        ),
      );
    }
  }
}

function validateTitle(
  payload: CollectionCreatePayload,
  errors: CollectionCreateValidationError[],
): void {
  if (!Object.prototype.hasOwnProperty.call(payload, "title")) {
    errors.push(issue("title", "REQUIRED", "title is required"));
    return;
  }
  if (typeof payload.title !== "string" || payload.title.trim() === "") {
    errors.push(issue("title", "INVALID_TYPE", "title must be a non-empty string"));
  }
}

function validatePositiveIntegerField(
  payload: CollectionCreatePayload,
  field: string,
  errors: CollectionCreateValidationError[],
): void {
  const value = payload[field];
  if (value === undefined || value === null || value === "") {
    return;
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    errors.push(issue(field, "INVALID_TYPE", `${field} must be a positive integer`));
  }
}

function validateStringArrayFields(
  payload: CollectionCreatePayload,
  errors: CollectionCreateValidationError[],
): void {
  for (const field of STRING_ARRAY_FIELDS) {
    const value = payload[field];
    if (value === undefined) {
      continue;
    }
    if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
      errors.push(issue(field, "INVALID_TYPE", `${field} must be an array of strings`));
    }
  }
}

function validateAttributes(
  payload: CollectionCreatePayload,
  errors: CollectionCreateValidationError[],
): void {
  const attributes = payload.attributes;
  if (attributes === undefined) {
    return;
  }
  if (!Array.isArray(attributes)) {
    errors.push(issue("attributes", "INVALID_TYPE", "attributes must be an array"));
    return;
  }
  if (attributes.length === 0) {
    return;
  }

  const seenKeys = new Set<string>();
  attributes.forEach((attribute, index) => {
    const field = `attributes[${index}]`;
    if (!isPlainRecord(attribute)) {
      errors.push(issue(field, "INVALID_TYPE", "attribute must be an object"));
      return;
    }
    validateObjectAliases(attribute, field, ATTRIBUTE_CAMEL_CASE_ALIASES, errors);

    const key = attribute.attr_key;
    if (typeof key !== "string" || key.trim() === "") {
      errors.push(issue(`${field}.attr_key`, "REQUIRED", "attr_key is required"));
    } else {
      const normalizedKey = key.trim();
      if (seenKeys.has(normalizedKey)) {
        errors.push(
          issue(`${field}.attr_key`, "DUPLICATE", "attr_key must be unique"),
        );
      }
      seenKeys.add(normalizedKey);
    }

    const values = attribute.attr_value_list;
    if (!Array.isArray(values) || values.length === 0) {
      errors.push(
        issue(
          `${field}.attr_value_list`,
          "REQUIRED",
          "attr_value_list must be a non-empty array",
        ),
      );
      return;
    }

    const seenValues = new Set<string>();
    values.forEach((value, valueIndex) => {
      const valueField = `${field}.attr_value_list[${valueIndex}]`;
      if (typeof value !== "string" || value.trim() === "") {
        errors.push(issue(valueField, "INVALID_TYPE", "attribute value must be a non-empty string"));
        return;
      }
      const normalizedValue = value.trim();
      if (seenValues.has(normalizedValue)) {
        errors.push(
          issue(valueField, "DUPLICATE", "attribute values must be unique"),
        );
      }
      seenValues.add(normalizedValue);
    });
  });
}

function validateSkuList(
  payload: CollectionCreatePayload,
  errors: CollectionCreateValidationError[],
): void {
  const skuList = payload.sku_list;
  if (skuList === undefined) {
    return;
  }
  if (!Array.isArray(skuList)) {
    errors.push(issue("sku_list", "INVALID_TYPE", "sku_list must be an array"));
    return;
  }
  if (skuList.length === 0) {
    return;
  }

  const attributeDeclarations = attributeDeclarationMap(payload.attributes);
  const seenCombinations = new Set<string>();

  skuList.forEach((sku, index) => {
    const field = `sku_list[${index}]`;
    if (!isPlainRecord(sku)) {
      errors.push(issue(field, "INVALID_TYPE", "SKU must be an object"));
      return;
    }
    validateObjectAliases(sku, field, SKU_CAMEL_CASE_ALIASES, errors);

    const skuAttributes = sku.sku_attributes;
    if (!isPlainRecord(skuAttributes) || Object.keys(skuAttributes).length === 0) {
      errors.push(
        issue(
          `${field}.sku_attributes`,
          "REQUIRED",
          "sku_attributes must be a non-empty object",
        ),
      );
    } else {
      validateSkuAttributes(
        skuAttributes,
        field,
        attributeDeclarations,
        seenCombinations,
        errors,
      );
    }

    for (const numericField of SKU_NUMERIC_FIELDS) {
      validateNonNegativeNumber(sku, `${field}.${numericField}`, numericField, errors);
    }
  });
}

function validateSkuAttributes(
  skuAttributes: Record<string, unknown>,
  skuField: string,
  attributeDeclarations: Map<string, Set<string>>,
  seenCombinations: Set<string>,
  errors: CollectionCreateValidationError[],
): void {
  const entries: Array<[string, string]> = [];
  for (const [rawKey, rawValue] of Object.entries(skuAttributes)) {
    const field = `${skuField}.sku_attributes.${rawKey}`;
    if (rawKey.trim() === "") {
      errors.push(issue(field, "REQUIRED", "sku attribute key cannot be empty"));
      continue;
    }
    if (typeof rawValue !== "string" || rawValue.trim() === "") {
      errors.push(issue(field, "INVALID_TYPE", "sku attribute value must be a non-empty string"));
      continue;
    }

    const key = rawKey.trim();
    const value = rawValue.trim();
    entries.push([key, value]);

    if (attributeDeclarations.size > 0) {
      const declaredValues = attributeDeclarations.get(key);
      if (!declaredValues) {
        errors.push(
          issue(field, "ATTRIBUTE_MISMATCH", "sku attribute key must be declared in attributes"),
        );
      } else if (!declaredValues.has(value)) {
        errors.push(
          issue(
            field,
            "ATTRIBUTE_MISMATCH",
            "sku attribute value must be declared in attributes",
          ),
        );
      }
    }
  }

  if (entries.length > 0) {
    const combination = entries
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key}=${value}`)
      .join("|");
    if (seenCombinations.has(combination)) {
      errors.push(
        issue(`${skuField}.sku_attributes`, "DUPLICATE", "sku attribute combination must be unique"),
      );
    }
    seenCombinations.add(combination);
  }
}

function validateNonNegativeNumber(
  source: Record<string, unknown>,
  field: string,
  key: string,
  errors: CollectionCreateValidationError[],
): void {
  const value = source[key];
  if (value === undefined || value === null || value === "") {
    return;
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    errors.push(issue(field, "INVALID_TYPE", `${key} must be a non-negative number`));
  }
}

function validatePriceCalcSettings(
  payload: CollectionCreatePayload,
  errors: CollectionCreateValidationError[],
): void {
  const value = payload.price_calc_settings;
  if (value === undefined) {
    return;
  }
  if (!isPlainRecord(value)) {
    errors.push(
      issue("price_calc_settings", "INVALID_TYPE", "price_calc_settings must be an object"),
    );
    return;
  }
  validateObjectAliases(
    value,
    "price_calc_settings",
    PRICE_CALC_CAMEL_CASE_ALIASES,
    errors,
  );
}

function validateKeywords(
  payload: CollectionCreatePayload,
  errors: CollectionCreateValidationError[],
): void {
  const keywords = payload.keywords;
  if (keywords === undefined) {
    return;
  }
  if (!isPlainRecord(keywords)) {
    errors.push(issue("keywords", "INVALID_TYPE", "keywords must be an object"));
    return;
  }
  for (const group of KEYWORD_GROUPS) {
    const value = keywords[group];
    if (value === undefined) {
      continue;
    }
    if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
      errors.push(
        issue(`keywords.${group}`, "INVALID_TYPE", "keyword group must be an array of strings"),
      );
    }
  }
}

function validateObjectAliases(
  value: Record<string, unknown>,
  prefix: string,
  aliases: string[],
  errors: CollectionCreateValidationError[],
): void {
  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(value, alias)) {
      errors.push(
        issue(
          `${prefix}.${alias}`,
          "UNSUPPORTED_FIELD_NAME",
          `${alias} is not supported; use snake_case request fields`,
        ),
      );
    }
  }
}

function attributeDeclarationMap(value: unknown): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  if (!Array.isArray(value)) {
    return map;
  }
  for (const item of value) {
    if (!isPlainRecord(item) || typeof item.attr_key !== "string") {
      continue;
    }
    const values = item.attr_value_list;
    if (!Array.isArray(values)) {
      continue;
    }
    map.set(
      item.attr_key.trim(),
      new Set(
        values
          .filter((entry): entry is string => typeof entry === "string")
          .map((entry) => entry.trim()),
      ),
    );
  }
  return map;
}

function normalizeIssueArray(value: unknown): CollectionCreateValidationError[] {
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

function issueTableRow(
  type: "error" | "warning",
  entry: CollectionCreateValidationError,
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
): CollectionCreateValidationError {
  return { field, code, message };
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
