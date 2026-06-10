import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildCreateCollectionPreviewRequest,
  buildCreateCollectionRequest,
  buildCollectionListParams,
  buildCollectionListRequest,
  buildCommitCollectionVariantAttributeOperationRequest,
  buildGetCollectionVariantsRequest,
  buildPatchCollectionVariantSkuRequest,
  buildPatchCollectionVariantSkuMasterImageRequest,
  buildPatchCollectionVariantSkusRequest,
  buildPreviewCollectionVariantAttributeOperationRequest,
  buildPreviewCollectionVariantsRequest,
  buildReplaceCollectionVariantSkuAffiliateImageFileRequest,
  buildReplaceCollectionVariantSkuAffiliateImageJsonRequest,
  buildReplaceCollectionVariantsRequest,
  buildSetCollectionProjectRequest,
  buildSubmitCollectionAiEditingRequest,
  collectionTableRows,
} from "../src/collections.js";
import {
  collectionListOptionsFromCommand,
  projectCreateOptionsFromCommand,
  projectListOptionsFromCommand,
  projectUpdateOptionsFromCommand,
  submitAiEditingOptionsFromCommand,
} from "../src/cli.js";
import {
  buildCreateProjectRequest,
  buildProjectDetailRequest,
  buildProjectListParams,
  buildProjectListRequest,
  buildUpdateProjectRequest,
  normalizeProjectKeywords,
  normalizeProjectMetadata,
  projectTableRows,
  projectWriteTableRows,
} from "../src/projects.js";

test("collection list maps CLI options to workflow endpoint params", () => {
  const request = buildCollectionListRequest({
    page: 2,
    size: 20,
    projectId: "123",
    workflow: "ai_editing",
    onlyMine: true,
    title: "phone",
    spu: "2408",
    currentPrincipal: "bob",
    categoryId: "456",
    originType: "1688",
    createdAfter: "1780272000",
    createdBefore: "1780358400000",
    repeatOriginUrl: true,
    aiEditingStatus: "pending",
    confirmer: "alice",
    sortField: "update-time",
    sortOrder: "desc",
  });

  assert.equal(
    request.path,
    "/api/v1/develop/collection/get_list_by_workflow",
  );
  assert.deepEqual(request.params, {
    page_offset: 1,
    page_size: 20,
    project_id: 123,
    workflow: 8,
    title: "phone",
    spu_serial_num: "2408",
    current_principal: "bob",
    category_id: 456,
    origin_type: 1,
    create_time_gt: 1780272000,
    create_time_lt: 1780358400,
    is_repeat_origin_url: true,
    is_self_related: true,
    ai_editing_status: 1,
    confirmer: "alice",
    sort_field: 2,
    sort_order: 2,
  });
});

test("collection list supports no-project and rejects project conflicts", () => {
  assert.deepEqual(buildCollectionListParams({ noProject: true }), {
    page_offset: 0,
    page_size: 20,
    is_not_project: true,
  });

  assert.throws(
    () => buildCollectionListParams({ projectId: "123", noProject: true }),
    /cannot be combined/,
  );
});

test("collection list omits absent workflow and defaults pagination", () => {
  const params = buildCollectionListParams({});

  assert.deepEqual(params, {
    page_offset: 0,
    page_size: 20,
  });
});

test("collection command options map public list filters", () => {
  assert.deepEqual(
    collectionListOptionsFromCommand({
      onlyMine: true,
      page: "1",
      size: "20",
      projectId: "123",
      noProject: true,
      format: "json",
    }),
    {
      id: undefined,
      page: "1",
      size: "20",
      projectId: "123",
      noProject: true,
      workflow: undefined,
      title: undefined,
      spu: undefined,
      creator: undefined,
      developer: undefined,
      currentPrincipal: undefined,
      categoryId: undefined,
      originType: undefined,
      createdAfter: undefined,
      createdBefore: undefined,
      repeatOriginUrl: undefined,
      onlyMine: true,
      aiEditingStatus: undefined,
      confirmer: undefined,
      sortField: undefined,
      sortOrder: undefined,
    },
  );
});

test("collection command options support commander no-project flag", () => {
  assert.equal(
    collectionListOptionsFromCommand({
      project: false,
      format: "json",
    }).noProject,
    true,
  );
});

test("collection table rows use live backend field names", () => {
  const rows = collectionTableRows([
    {
      id: "46395",
      spu_serial_num: "2606021132ppsQ0",
      english_title: "Floating Vanity",
      workflow: 8,
      ai_editing_status: 2,
      project_name: "June launch",
      current_principal: "bob",
      creator: "admin",
      developer: "admin",
      category_name: "Furniture",
      sku_count: 16,
      min_price: 2049,
      max_price: 3259,
      min_weight: 33000,
      max_weight: 80000,
      update_time: "2026-06-02 11:48:45",
    },
  ]);

  assert.deepEqual(rows[0], {
    ID: "46395",
    SPU: "2606021132ppsQ0",
    Title: "Floating Vanity",
    Workflow: "ai-editing",
    AI: "processing",
    Project: "June launch",
    Principal: "bob",
    Creator: "admin",
    Developer: "admin",
    Category: "Furniture",
    SKU: 16,
    Price: "2049-3259",
    Weight: "33000-80000",
    UpdatedAt: "2026-06-02 11:48:45",
  });
});

test("collection write endpoints map ids to request bodies", () => {
  assert.deepEqual(buildSetCollectionProjectRequest("123", { projectId: "456" }), {
    path: "/api/v1/develop/collection/123/project",
    data: { project_id: 456 },
  });

  assert.deepEqual(buildSubmitCollectionAiEditingRequest("123"), {
    path: "/api/v1/develop/collection/submit_ai_editing",
    data: {
      collectionIds: [123],
      market: "US",
      priority: 1,
      processMode: "PROCESS_MODE_TEXT_AND_IMAGE",
      requireMainImgWhiteBg: false,
      enableAutoPricing: false,
      collectionFinishMode: "COLLECTION_FINISH_SMART",
    },
  });
});

test("collection create endpoints preserve snake_case payload", () => {
  const payload = {
    title: "Product title",
    origin_url: "https://detail.1688.com/offer/123.html",
    project_id: 622,
    bullet_point_list: ["One"],
    sku_list: [{ sku_attributes: { Color: "Black" } }],
  };

  assert.deepEqual(buildCreateCollectionPreviewRequest(payload), {
    path: "/api/v1/develop/collection/create_preview",
    data: payload,
  });
  assert.deepEqual(buildCreateCollectionRequest(payload), {
    path: "/api/v1/develop/collection/create",
    data: payload,
  });
});

test("collection variants endpoints use variants-specific paths", () => {
  assert.deepEqual(buildGetCollectionVariantsRequest("46398"), {
    path: "/api/v1/develop/collection/46398/variants",
  });

  const setPayload = {
    attributes: [{ attr_key: "Color", attr_value_list: ["Black"] }],
    sku_list: [{ sku_id: 123, sku_attributes: { Color: "Black" } }],
    reprice: false,
    if_match_updated_at: "2026-06-04 10:00:00",
  };
  assert.deepEqual(buildPreviewCollectionVariantsRequest("46398", setPayload), {
    path: "/api/v1/develop/collection/46398/variants/preview",
    data: setPayload,
  });
  assert.deepEqual(buildReplaceCollectionVariantsRequest("46398", setPayload), {
    path: "/api/v1/develop/collection/46398/variants",
    data: setPayload,
  });
});

test("collection variant SKU patch endpoints preserve update masks", () => {
  const singlePayload = {
    update_mask: ["cost_price", "weight"],
    cost_price: 12.5,
    weight: 500,
    reprice: true,
    if_match_updated_at: "2026-06-04 10:00:00",
  };
  assert.deepEqual(
    buildPatchCollectionVariantSkuRequest("46398", "123", singlePayload),
    {
      path: "/api/v1/develop/collection/46398/variants/skus/123",
      data: singlePayload,
    },
  );

  const batchPayload = {
    items: [
      {
        sku_id: 123,
        update_mask: ["stock"],
        stock: 20,
      },
    ],
    reprice: false,
    if_match_updated_at: "2026-06-04 10:00:00",
  };
  assert.deepEqual(buildPatchCollectionVariantSkusRequest("46398", batchPayload), {
    path: "/api/v1/develop/collection/46398/variants/skus",
    data: batchPayload,
  });
});

test("collection variant SKU master image upload uses multipart endpoint", () => {
  const request = buildPatchCollectionVariantSkuMasterImageRequest("46398", "123", {
    file: new Blob(["image"], { type: "image/jpeg" }),
    filename: "main.jpg",
    ifMatchUpdatedAt: "2026-06-04 10:00:00",
  });

  assert.equal(
    request.path,
    "/api/v1/develop/collection/46398/variants/skus/123/master-image",
  );
  assert.equal(request.formData.get("if_match_updated_at"), "2026-06-04 10:00:00");
  assert.equal((request.formData.get("file") as File).name, "main.jpg");
});

test("collection variant SKU affiliate image replacement maps JSON and multipart modes", () => {
  const jsonRequest = buildReplaceCollectionVariantSkuAffiliateImageJsonRequest(
    "46398",
    "123",
    {
      oldUrl: "https://cdn.example.test/old.jpg",
      newUrl: "https://cdn.example.test/new.jpg",
      ifMatchUpdatedAt: "2026-06-10 12:00:00",
    },
  );

  assert.deepEqual(jsonRequest, {
    path: "/api/v1/develop/collection/46398/variants/skus/123/affiliate-images/replace",
    data: {
      old_url: "https://cdn.example.test/old.jpg",
      new_url: "https://cdn.example.test/new.jpg",
      if_match_updated_at: "2026-06-10 12:00:00",
    },
  });

  const assetRequest = buildReplaceCollectionVariantSkuAffiliateImageJsonRequest(
    "46398",
    "123",
    {
      oldUrl: "https://cdn.example.test/old.jpg",
      assetId: "minio://bucket/image/fixed.jpg",
      ifMatchUpdatedAt: "2026-06-10 12:00:00",
    },
  );

  assert.deepEqual(assetRequest, {
    path: "/api/v1/develop/collection/46398/variants/skus/123/affiliate-images/replace",
    data: {
      old_url: "https://cdn.example.test/old.jpg",
      asset_id: "minio://bucket/image/fixed.jpg",
      if_match_updated_at: "2026-06-10 12:00:00",
    },
  });

  const fileRequest = buildReplaceCollectionVariantSkuAffiliateImageFileRequest(
    "46398",
    "123",
    {
      oldUrl: "https://cdn.example.test/old.jpg",
      file: new Blob(["image"], { type: "image/webp" }),
      filename: "fixed.webp",
      ifMatchUpdatedAt: "2026-06-10 12:00:00",
    },
  );

  assert.equal(
    fileRequest.path,
    "/api/v1/develop/collection/46398/variants/skus/123/affiliate-images/replace",
  );
  assert.equal(fileRequest.formData.get("old_url"), "https://cdn.example.test/old.jpg");
  assert.equal(fileRequest.formData.get("if_match_updated_at"), "2026-06-10 12:00:00");
  assert.equal(fileRequest.formData.get("dry_run"), null);
  assert.equal(fileRequest.formData.get("file"), null);
  assert.equal((fileRequest.formData.get("new_file") as File).name, "fixed.webp");
});

test("collection variant attribute operation preview and commit use separate paths", () => {
  const payload = {
    operation: "merge_value" as const,
    key: "Color",
    from: "Off White",
    to: "White",
    if_match_updated_at: "2026-06-04 10:00:00",
  };

  assert.deepEqual(
    buildPreviewCollectionVariantAttributeOperationRequest("46398", payload),
    {
      path: "/api/v1/develop/collection/46398/variants/attributes/operation/preview",
      data: payload,
    },
  );
  assert.deepEqual(
    buildCommitCollectionVariantAttributeOperationRequest("46398", payload),
    {
      path: "/api/v1/develop/collection/46398/variants/attributes/operation",
      data: payload,
    },
  );
});

test("submit-ai-editing maps optional AI editing parameters", () => {
  assert.deepEqual(
    buildSubmitCollectionAiEditingRequest("123", {
      market: "uk",
      priority: "3",
      processMode: "text-only",
      enableAutoPricing: true,
      collectionFinishMode: "manual",
      targetWorkflow: "pending-review",
    }),
    {
      path: "/api/v1/develop/collection/submit_ai_editing",
      data: {
        collectionIds: [123],
        targetWorkflow: 5,
        market: "UK",
        priority: 3,
        processMode: "PROCESS_MODE_TEXT_ONLY",
        enableAutoPricing: true,
        collectionFinishMode: "COLLECTION_FINISH_MANUAL",
      },
    },
  );

  assert.deepEqual(
    buildSubmitCollectionAiEditingRequest("123", {
      processMode: "image-only",
      requireMainImgWhiteBg: true,
      collectionFinishMode: "auto",
    }).data,
    {
      collectionIds: [123],
      market: "US",
      priority: 1,
      processMode: "PROCESS_MODE_IMAGE_ONLY",
      requireMainImgWhiteBg: true,
      enableAutoPricing: false,
      collectionFinishMode: "COLLECTION_FINISH_AUTO",
    },
  );
});

test("submit-ai-editing rejects invalid AI editing parameters", () => {
  assert.throws(
    () => buildSubmitCollectionAiEditingRequest("123", { processMode: "video" }),
    /Unsupported process-mode/,
  );
  assert.throws(
    () =>
      buildSubmitCollectionAiEditingRequest("123", {
        processMode: "text-only",
        requireMainImgWhiteBg: true,
      }),
    /only valid/,
  );
});

test("submit-ai-editing command options map to action options", () => {
  assert.deepEqual(
    submitAiEditingOptionsFromCommand({
      ids: "123",
      processMode: "image-only",
      requireMainImgWhiteBg: true,
      autoPricing: true,
      finishMode: "auto",
      targetWorkflow: "finished",
      market: "ca",
      priority: "2",
      format: "json",
    }),
    {
      processMode: "image-only",
      requireMainImgWhiteBg: true,
      enableAutoPricing: true,
      collectionFinishMode: "auto",
      targetWorkflow: "finished",
      market: "ca",
      priority: "2",
    },
  );
});

test("project endpoints use confirmed paths and id param", () => {
  assert.deepEqual(buildProjectListRequest({}), {
    path: "/api/v1/develop/project/get_all_list",
    params: {
      page_offset: 0,
      page_size: 20,
    },
  });
  assert.deepEqual(buildProjectDetailRequest("123"), {
    path: "/api/v1/develop/project/get_info_by_id",
    params: { id: "123" },
  });
});

test("project create maps public fields to resource endpoint", () => {
  assert.deepEqual(buildCreateProjectRequest({ name: " Launch ", remark: "" }), {
    path: "/api/v1/develop/project",
    data: {
      name: "Launch",
      remark: "",
    },
  });

  assert.deepEqual(buildCreateProjectRequest({ name: "Launch" }), {
    path: "/api/v1/develop/project",
    data: {
      name: "Launch",
    },
  });

  assert.throws(
    () => buildCreateProjectRequest({ name: "  " }),
    /project name cannot be empty/,
  );
});

test("project update maps partial fields and stable update masks", () => {
  assert.deepEqual(buildUpdateProjectRequest("123", { name: " Launch " }), {
    path: "/api/v1/develop/project/123",
    data: {
      name: "Launch",
      update_mask: ["name"],
    },
  });

  assert.deepEqual(buildUpdateProjectRequest("123", { remark: "" }), {
    path: "/api/v1/develop/project/123",
    data: {
      remark: "",
      update_mask: ["remark"],
    },
  });

  assert.deepEqual(buildUpdateProjectRequest("123", { owner: "" }), {
    path: "/api/v1/develop/project/123",
    data: {
      owner: "",
      update_mask: ["owner"],
    },
  });

  assert.deepEqual(
    buildUpdateProjectRequest("123", {
      name: "Next",
      remark: "",
      owner: " alice ",
      keywords: { core_main: ["Solid Wood Bedside Table"] },
    }),
    {
      path: "/api/v1/develop/project/123",
      data: {
        name: "Next",
        remark: "",
        owner: "alice",
        keywords: {
          core_main: ["Solid Wood Bedside Table"],
          feature_attribute: [],
          scenario_audience_purpose: [],
          appearance_visual: [],
          long_tail: [],
        },
        update_mask: ["name", "remark", "owner", "keywords"],
      },
    },
  );

  assert.throws(() => buildUpdateProjectRequest("0", { name: "Launch" }), /positive integer/);
  assert.throws(() => buildUpdateProjectRequest("123", {}), /At least one/);
  assert.throws(() => buildUpdateProjectRequest("123", { name: "" }), /cannot be empty/);
});

test("project keywords normalize public shape and reject legacy fields", () => {
  assert.deepEqual(
    normalizeProjectKeywords({
      core_main: ["Solid Wood Bedside Table"],
      feature_attribute: ["with Drawers"],
    }),
    {
      core_main: ["Solid Wood Bedside Table"],
      feature_attribute: ["with Drawers"],
      scenario_audience_purpose: [],
      appearance_visual: [],
      long_tail: [],
    },
  );

  assert.throws(
    () => normalizeProjectKeywords({ longTail: [] }),
    /legacy field names/,
  );
  assert.throws(
    () => normalizeProjectKeywords({ extra: [] }),
    /unknown fields/,
  );
  assert.throws(
    () => normalizeProjectKeywords({ core_main: ["ok", 1] }),
    /array of strings/,
  );
});

test("project metadata normalizes legacy keyword output", () => {
  assert.deepEqual(
    normalizeProjectMetadata({
      id: "123",
      keywords: {
        core_main: ["A"],
        longTail: ["B"],
      },
    }),
    {
      id: "123",
      keywords: {
        core_main: ["A"],
        feature_attribute: [],
        scenario_audience_purpose: [],
        appearance_visual: [],
        long_tail: ["B"],
      },
    },
  );
});

test("project list maps filters and command options", () => {
  assert.deepEqual(
    buildProjectListParams({
      page: 3,
      size: 10,
      name: "launch",
      status: "progressing",
      member: "alice",
      creator: "admin",
    }),
    {
      page_offset: 2,
      page_size: 10,
      name: "launch",
      status: 1,
      project_member: "alice",
      creator: "admin",
    },
  );

  assert.deepEqual(
    projectCreateOptionsFromCommand({
      name: "launch",
      remark: "",
      format: "json",
    }),
    {
      name: "launch",
      remark: "",
    },
  );

  assert.deepEqual(
    projectUpdateOptionsFromCommand(
      {
        name: "launch",
        remark: "",
        owner: "",
        keywordsFile: "keywords.json",
        format: "json",
      },
      {
        core_main: ["A"],
      },
    ),
    {
      name: "launch",
      remark: "",
      owner: "",
      keywords: {
        core_main: ["A"],
      },
    },
  );

  assert.deepEqual(
    projectListOptionsFromCommand({
      page: "2",
      size: "5",
      name: "launch",
      status: "completed",
      member: "alice",
      creator: "admin",
      format: "json",
    }),
    {
      page: "2",
      size: "5",
      name: "launch",
      status: "completed",
      member: "alice",
      creator: "admin",
    },
  );
});

test("project table rows separate owner and creator fields", () => {
  const rows = projectTableRows([
    {
      id: "624",
      name: "缎布餐巾-历史",
      owner: "",
      creator: "admin",
      status: "Progressing",
      collection_total: 12,
      finished_count: 8,
      update_time: "2024-08-17 16:54:14",
    },
  ]);

  assert.deepEqual(rows[0], {
    ID: "624",
    Name: "缎布餐巾-历史",
    Owner: "",
    Creator: "admin",
    Status: "progressing",
    Collections: 12,
    Finished: 8,
    UpdatedAt: "2024-08-17 16:54:14",
  });
});

test("project write table rows prioritize changed metadata", () => {
  const rows = projectWriteTableRows([
    {
      id: "624",
      name: "Launch",
      owner: "alice",
      creator: "admin",
      status: "Progressing",
      remark: "",
      update_time: "2026-06-04 12:00:00",
    },
  ]);

  assert.deepEqual(rows[0], {
    ID: "624",
    Name: "Launch",
    Owner: "alice",
    Creator: "admin",
    Status: "progressing",
    Remark: "",
    UpdatedAt: "2026-06-04 12:00:00",
  });
});
