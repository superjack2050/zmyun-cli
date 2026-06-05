import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildSkuPatchItemFromOptions,
  normalizeAttributeOperation,
  normalizeVariantsMetadata,
  normalizeVariantsPreviewMetadata,
  normalizeVariantsWriteMetadata,
  parseCollectionVariantsBackendErrors,
  parseVariantsJsonObject,
  resolveRepriceDefault,
  shouldConfirmVariantsMutation,
  validateSkuPatchBatchPayload,
  validateVariantsSetPayload,
} from "../src/collection-variants.js";
import { CliError } from "../src/errors.js";

test("variants JSON parser requires one object", () => {
  assert.deepEqual(parseVariantsJsonObject('{"attributes":[]}', "file"), {
    attributes: [],
  });
  assert.throws(
    () => parseVariantsJsonObject('[{"attributes":[]}]', "file"),
    /one JSON object/,
  );
});

test("variants metadata normalizes int64 ids and default arrays", () => {
  assert.deepEqual(
    normalizeVariantsMetadata({
      collection_id: 46398,
      updated_at: "2026-06-04 10:00:00",
      attributes: [{ attr_key: "Color", attr_value_list: ["Black"] }],
      sku_list: [
        {
          sku_id: 9007199254740992,
          sku_attributes: { Color: "Black" },
          affiliate_images: ["a", "b"],
        },
      ],
      price_calc_settings: { formula_id: "12" },
    }),
    {
      collection_id: "46398",
      updated_at: "2026-06-04 10:00:00",
      attributes: [{ attr_key: "Color", attr_value_list: ["Black"] }],
      sku_list: [
        {
          sku_id: "9007199254740992",
          sku_attributes: { Color: "Black" },
          affiliate_images: ["a", "b"],
        },
      ],
      price_calc_settings: { formula_id: "12" },
    },
  );
});

test("variants preview and write metadata normalize counts and warnings", () => {
  assert.deepEqual(
    normalizeVariantsPreviewMetadata({
      valid: true,
      updated_sku_count: "2",
      deleted_sku_count: 1,
      affected_sku_count: 3,
      updated_fields: ["sku_list"],
      current_updated_at: "2026-06-04 10:00:00",
    }),
    {
      dry_run: true,
      valid: true,
      errors: [],
      warnings: [],
      created_sku_count: 0,
      updated_sku_count: 2,
      deleted_sku_count: 1,
      affected_sku_count: 3,
      updated_fields: ["sku_list"],
      current_updated_at: "2026-06-04 10:00:00",
    },
  );

  assert.deepEqual(
    normalizeVariantsWriteMetadata({
      collection_id: 46398,
      updated_sku_ids: [123, "124"],
      updated_sku_count: 2,
      updated_at: "2026-06-04 10:01:00",
    }),
    {
      ok: true,
      collection_id: "46398",
      updated_fields: [],
      updated_sku_ids: ["123", "124"],
      created_sku_count: 0,
      updated_sku_count: 2,
      deleted_sku_count: 0,
      affected_sku_count: 0,
      updated_at: "2026-06-04 10:01:00",
    },
  );
});

test("variants set validation requires attributes and sku_list arrays", () => {
  assert.deepEqual(validateVariantsSetPayload({ attributes: [], sku_list: [] }), []);
  assert.deepEqual(
    validateVariantsSetPayload({ attributes: {}, sku_list: undefined }).map(
      (error) => error.field,
    ),
    ["attributes", "sku_list"],
  );
});

test("batch SKU patch validation requires items sku_id and update_mask", () => {
  assert.deepEqual(
    validateSkuPatchBatchPayload({
      items: [{ sku_id: 123, update_mask: ["stock"], stock: 20 }],
    }),
    [],
  );
  assert.deepEqual(
    validateSkuPatchBatchPayload({
      items: [{ stock: 20 }, { sku_id: 124, update_mask: ["sku_attributes"] }],
    }).map((error) => [error.field, error.code]),
    [
      ["items[0].sku_id", "REQUIRED"],
      ["items[0].update_mask", "REQUIRED"],
      ["items[1].update_mask[0]", "UNSUPPORTED_FIELD"],
    ],
  );
});

test("SKU patch options build snake_case update mask and values", () => {
  assert.deepEqual(
    buildSkuPatchItemFromOptions({
      costPrice: "12.5",
      weight: "500",
      affiliateImages: '["a","b"]',
    }),
    {
      cost_price: 12.5,
      weight: 500,
      affiliate_images: ["a", "b"],
      update_mask: ["cost_price", "weight", "affiliate_images"],
    },
  );
});

test("reprice defaults follow price-impact fields and conflicts", () => {
  assert.equal(resolveRepriceDefault([["stock"]]), false);
  assert.equal(resolveRepriceDefault([["cost_price"]]), true);
  assert.equal(resolveRepriceDefault([["reference_price"]]), false);
  assert.equal(resolveRepriceDefault([["stock"]], { reprice: true }), true);
  assert.equal(resolveRepriceDefault([["cost_price"]], { noReprice: true }), false);
  assert.throws(
    () => resolveRepriceDefault([["reference_price"]], { reprice: true }),
    /reference-price/,
  );
});

test("attribute operation normalization validates required options", () => {
  assert.deepEqual(
    normalizeAttributeOperation("rename-key", {
      from: "Color",
      to: "Shade",
    }),
    {
      operation: "rename_key",
      key: "Color",
      from: "Color",
      to: "Shade",
    },
  );

  assert.deepEqual(
    normalizeAttributeOperation("merge-value", {
      key: "Color",
      from: "Off White",
      to: "White",
    }),
    {
      operation: "merge_value",
      key: "Color",
      from: "Off White",
      to: "White",
    },
  );
  assert.deepEqual(
    normalizeAttributeOperation("remove-key", {
      key: "Size",
    }),
    {
      operation: "remove_key",
      key: "Size",
      from: "Size",
    },
  );
  assert.throws(
    () => normalizeAttributeOperation("remove-value", { key: "Color" }),
    /--from is required/,
  );
});

test("confirmation helper triggers for destructive variants previews", () => {
  const preview = normalizeVariantsPreviewMetadata({
    valid: true,
    deleted_sku_count: 0,
  });
  assert.equal(shouldConfirmVariantsMutation({ preview }), false);
  assert.equal(
    shouldConfirmVariantsMutation({ preview, operation: "remove_key" }),
    true,
  );
  assert.equal(
    shouldConfirmVariantsMutation({
      preview: normalizeVariantsPreviewMetadata({
        valid: true,
        deleted_sku_count: 1,
      }),
    }),
    true,
  );
});

test("variants backend errors parse JSON string and array forms", () => {
  const stringError = new CliError(
    "INVALID_ARGUMENT",
    "collection variants validation failed",
    {
      status: 400,
      details: {
        reason: "INVALID_ARGUMENT",
        metadata: {
          errors:
            '[{"field":"items[1].sku_id","code":"NOT_FOUND","message":"sku not found"}]',
        },
      },
    },
  );

  assert.deepEqual(parseCollectionVariantsBackendErrors(stringError), [
    {
      field: "items[1].sku_id",
      code: "NOT_FOUND",
      message: "sku not found",
    },
  ]);

  const arrayError = new CliError("INVALID_ARGUMENT", "failed", {
    details: {
      metadata: {
        errors: [{ field: "sku_list", code: "DUPLICATE", message: "duplicated" }],
      },
    },
  });

  assert.deepEqual(parseCollectionVariantsBackendErrors(arrayError), [
    {
      field: "sku_list",
      code: "DUPLICATE",
      message: "duplicated",
    },
  ]);
});
