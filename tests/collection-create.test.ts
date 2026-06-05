import { test } from "node:test";
import assert from "node:assert/strict";
import {
  COLLECTION_CREATE_SCHEMA,
  collectionCreateSchemaTableRows,
  normalizeCreateMetadata,
  normalizeCreatePreviewMetadata,
  parseCollectionCreateBackendErrors,
  parseCollectionCreatePayloadJson,
  validateCollectionCreatePayload,
} from "../src/collection-create.js";
import { CliError } from "../src/errors.js";

test("collection create schema exposes required title and table rows", () => {
  assert.equal(COLLECTION_CREATE_SCHEMA.schema, "collection_create");
  assert.deepEqual(COLLECTION_CREATE_SCHEMA.required, ["title"]);
  assert.equal(
    collectionCreateSchemaTableRows().some((row) => row.Field === "title"),
    true,
  );
});

test("collection create payload parser requires one JSON object", () => {
  assert.deepEqual(parseCollectionCreatePayloadJson('{"title":"Desk"}', "file"), {
    title: "Desk",
  });
  assert.throws(
    () => parseCollectionCreatePayloadJson('[{"title":"Desk"}]', "file"),
    /one JSON object/,
  );
});

test("collection create validation rejects missing title and backend-owned fields", () => {
  const errors = validateCollectionCreatePayload({
    developer: "alice",
    projectId: 622,
  });

  assert.deepEqual(
    errors.map((error) => [error.field, error.code]),
    [
      ["developer", "RESERVED_FIELD"],
      ["projectId", "UNSUPPORTED_FIELD_NAME"],
      ["title", "REQUIRED"],
    ],
  );
});

test("collection create validation checks positive integer fields and string arrays", () => {
  const errors = validateCollectionCreatePayload({
    title: "Desk",
    project_id: 0,
    category_id: "123",
    bullet_point_list: ["ok", 1],
  });

  assert.deepEqual(
    errors.map((error) => error.field),
    ["project_id", "category_id", "bullet_point_list"],
  );
});

test("collection create validation rejects nested camelCase aliases", () => {
  const errors = validateCollectionCreatePayload({
    title: "Desk",
    attributes: [{ attrKey: "Color", attr_value_list: ["Black"] }],
    sku_list: [{ sku_attributes: { Color: "Black" }, costPrice: 12 }],
    price_calc_settings: { marketCode: "US" },
  });

  assert.deepEqual(
    errors
      .filter((error) => error.code === "UNSUPPORTED_FIELD_NAME")
      .map((error) => error.field),
    [
      "attributes[0].attrKey",
      "sku_list[0].costPrice",
      "price_calc_settings.marketCode",
    ],
  );
});

test("collection create validation checks attributes and SKU combinations", () => {
  const errors = validateCollectionCreatePayload({
    title: "Desk",
    attributes: [
      { attr_key: "Color", attr_value_list: ["Black", "Black"] },
      { attr_key: "Color", attr_value_list: ["White"] },
    ],
    sku_list: [
      { sku_attributes: { Color: "Black" } },
      { sku_attributes: { Color: "Black" } },
      { sku_attributes: { Color: "Blue" } },
      { sku_attributes: {} },
    ],
  });

  assert.equal(errors.some((error) => error.code === "DUPLICATE"), true);
  assert.equal(
    errors.some(
      (error) =>
        error.field === "sku_list[2].sku_attributes.Color" &&
        error.code === "ATTRIBUTE_MISMATCH",
    ),
    true,
  );
  assert.equal(
    errors.some(
      (error) =>
        error.field === "sku_list[3].sku_attributes" &&
        error.code === "REQUIRED",
    ),
    true,
  );
});

test("collection create validation allows empty attributes and sku_list", () => {
  assert.deepEqual(
    validateCollectionCreatePayload({
      title: "Desk",
      attributes: [],
      sku_list: [],
    }),
    [],
  );
});

test("collection create validation allows sku_list without attributes", () => {
  assert.deepEqual(
    validateCollectionCreatePayload({
      title: "Desk",
      sku_list: [
        { sku_attributes: { Color: "Black" }, cost_price: 12.5 },
        { sku_attributes: { Color: "White" }, stock: 0 },
      ],
    }),
    [],
  );
});

test("collection create metadata normalization reads metadata and defaults warnings", () => {
  assert.deepEqual(
    normalizeCreatePreviewMetadata({
      valid: true,
      errors: [],
    }),
    {
      dry_run: true,
      valid: true,
      errors: [],
      warnings: [],
    },
  );

  assert.deepEqual(
    normalizeCreateMetadata({
      collection_id: 46396,
      spu_serial_num: "260603xxxx",
    }),
    {
      ok: true,
      collection_id: "46396",
      spu_serial_num: "260603xxxx",
      warnings: [],
    },
  );
});

test("collection create backend errors parse JSON string and array forms", () => {
  const stringError = new CliError(
    "INVALID_ARGUMENT",
    "collection create validation failed",
    {
      status: 400,
      details: {
        reason: "INVALID_ARGUMENT",
        metadata: {
          errors:
            '[{"field":"title","code":"REQUIRED","message":"title is required"}]',
        },
      },
    },
  );

  assert.deepEqual(parseCollectionCreateBackendErrors(stringError), [
    {
      field: "title",
      code: "REQUIRED",
      message: "title is required",
    },
  ]);

  const arrayError = new CliError("INVALID_ARGUMENT", "failed", {
    details: {
      metadata: {
        errors: [{ field: "origin_url", code: "INVALID_URL", message: "bad url" }],
      },
    },
  });

  assert.deepEqual(parseCollectionCreateBackendErrors(arrayError), [
    {
      field: "origin_url",
      code: "INVALID_URL",
      message: "bad url",
    },
  ]);
});

test("collection create backend errors ignore malformed metadata", () => {
  assert.equal(
    parseCollectionCreateBackendErrors(
      new CliError("INVALID_ARGUMENT", "failed", {
        details: {
          reason: "INVALID_ARGUMENT",
          metadata: { errors: "not json" },
        },
      }),
    ),
    undefined,
  );
});
