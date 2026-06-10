#!/usr/bin/env node

import { promises as fs, realpathSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Command } from "commander";
import { batchHasFailures, batchTableRows } from "./batch.js";
import {
  COLLECTION_CREATE_SCHEMA,
  collectionCreateResultTableRows,
  collectionCreateSchemaTableRows,
  collectionCreateValidationTableRows,
  parseCollectionCreateBackendErrors,
  parseCollectionCreatePayloadJson,
  validateCollectionCreatePayload,
} from "./collection-create.js";
import {
  buildSkuPatchItemFromOptions,
  affiliateImageNotFoundError,
  ambiguousImageMatchError,
  duplicateImageError,
  isAmbiguousImageMatchError,
  isDuplicateImageError,
  isImageNotFoundError,
  isNotFoundError,
  isStaleWriteError,
  normalizeAttributeOperation,
  normalizeAffiliateImageReplaceOptions,
  normalizeSkuPatchBatchPayload,
  normalizeVariantsSetPayload,
  notFoundError,
  parseCollectionVariantsBackendErrors,
  parseVariantsJsonObject,
  resolveRepriceDefault,
  shouldConfirmVariantsMutation,
  staleWriteError,
  validateSkuPatchBatchPayload,
  validateVariantsSetPayload,
  variantsGetTableRows,
  variantsIssueTableRows,
  variantsPreviewTableRows,
  variantsWriteTableRows,
} from "./collection-variants.js";
import type {
  AttributeOperationPayload,
  AttributeOperationType,
  AffiliateImageReplaceDryRunResult,
  AffiliateImageReplacePlan,
  AffiliateImageReplaceResult,
  SkuPatchBatchPayload,
  SkuPatchItem,
  VariantsPreviewResult,
  VariantsSetPayload,
} from "./collection-variants.js";
import {
  runSetCollectionProjectAction,
  runSubmitCollectionAiEditingAction,
} from "./collection-actions.js";
import { getRuntimeProfile } from "./config.js";
import { CLI_VERSION } from "./constants.js";
import { getCredential } from "./credentials.js";
import { errorToPayload } from "./errors.js";
import { CliError } from "./errors.js";
import { ApiClient } from "./http.js";
import {
  isHttpUrl,
  MASTER_IMAGE_UPLOAD_CONTENT_TYPES,
  readLocalImageFile,
} from "./images.js";
import { resolveIds, toPositiveIntegerId } from "./ids.js";
import { loginWithDeviceFlow, logout, whoami } from "./auth.js";
import {
  AI_EDITING_STATUS_OPTIONS,
  buildReplaceCollectionVariantSkuAffiliateImageFileRequest,
  buildReplaceCollectionVariantSkuAffiliateImageJsonRequest,
  collectionTableRows,
  commitCollectionVariantAttributeOperation,
  choiceTableRows,
  createCollection,
  getCollection,
  getCollectionVariants,
  listCollections,
  ORIGIN_TYPE_OPTIONS,
  patchCollectionVariantSku,
  patchCollectionVariantSkuMasterImage,
  patchCollectionVariantSkus,
  patchCollectionContent,
  previewCollectionVariantAttributeOperation,
  previewCollectionVariants,
  previewCollectionCreate,
  replaceCollectionVariantSkuAffiliateImageFile,
  replaceCollectionVariantSkuAffiliateImageJson,
  replaceCollectionVariants,
  SORT_FIELD_OPTIONS,
  SORT_ORDER_OPTIONS,
  setCollectionDeveloper,
  setCollectionKeywords,
  setCollectionSource,
  WORKFLOW_OPTIONS,
} from "./collections.js";
import type {
  CollectionKeywords,
  CollectionListOptions,
  PatchCollectionContentOptions,
  SubmitCollectionAiEditingOptions,
} from "./collections.js";
import { assertFormat, printByFormat, printJson } from "./output.js";
import {
  createProject,
  getProject,
  listProjects,
  projectStatusTableRows,
  projectTableRows,
  projectWriteTableRows,
  updateProject,
} from "./projects.js";
import type {
  CreateProjectOptions,
  ProjectKeywords,
  ProjectListOptions,
  UpdateProjectOptions,
} from "./projects.js";
import { normalizeProjectKeywords } from "./projects.js";

export function buildProgram(): Command {
  const program = new Command();

  program
    .name("zmy")
    .description("Agent-friendly CLI for ZMY collection and project workflows.")
    .version(CLI_VERSION)
    .showHelpAfterError();

  const auth = program.command("auth").description("Authorize zmyun-cli.");

  auth
    .command("login")
    .description("Authorize or re-authorize zmyun-cli through the browser.")
    .action(async () => {
      const context = await createContext();
      const credential = await loginWithDeviceFlow({
        client: context.client,
        profileName: context.profileName,
      });
      printJson({
        ok: true,
        scope: credential.scope,
        expires_at: credential.expires_at,
      });
    });

  auth
    .command("status")
    .description("Show authenticated user status.")
    .action(async () => {
      const context = await createContext();
      const me = await whoami(context.client);
      printJson({
        ok: true,
        user: me,
      });
    });

  auth
    .command("logout")
    .description("Revoke current token and delete local credentials.")
    .action(async () => {
      const context = await createContext();
      const result = await logout({
        client: context.client,
        profileName: context.profileName,
      });
      printJson(result);
    });

  program
    .command("status")
    .description("Show auth status.")
    .action(async () => {
      const context = await createContext();
      const credential = await getCredential(context.profileName);
      const me = credential ? await whoami(context.client) : undefined;
      printJson({
        authenticated: Boolean(credential),
        user: me,
        expires_at: credential?.expires_at,
        scope: credential?.scope,
      });
    });

  program
    .command("doctor")
    .description("Check auth and backend connectivity.")
    .action(async () => {
      const checks: Array<Record<string, unknown>> = [];
      try {
        const context = await createContext();
        checks.push({
          name: "endpoint",
          ok: true,
        });

        const credential = await getCredential(context.profileName);
        checks.push({ name: "credentials", ok: Boolean(credential) });

        if (credential) {
          const me = await whoami(context.client);
          checks.push({ name: "whoami", ok: true, username: me.username });
        }
      } catch (error) {
        checks.push({ name: "error", ok: false, ...errorToPayload(error) });
      }

      printJson({
        ok: checks.every((check) => check.ok === true),
        checks,
      });
    });

  const collection = program
    .command("collection")
    .description("Read and operate on collection data.");

  collection
    .command("schema")
    .option("--operation <operation>", "Operation payload schema to print.", "create")
    .option("--format <format>", "json or table", "json")
    .description("Print a Collection operation payload schema.")
    .action((options: CollectionSchemaCommandOptions) => {
      const operation = options.operation.trim().toLowerCase();
      if (operation !== "create") {
        throw new CliError(
          "invalid_argument",
          `Unsupported collection schema operation: ${options.operation}`,
          { hint: "Use --operation create." },
        );
      }
      printByFormat(
        COLLECTION_CREATE_SCHEMA,
        assertFormat(options.format),
        collectionCreateSchemaTableRows(),
      );
    });

  collection
    .command("create")
    .option("--file <path>", "JSON file containing one Collection create payload.")
    .option("--stdin", "Read one Collection create payload JSON object from standard input.")
    .option("--dry-run", "Validate through the backend preview API without creating.")
    .option("--format <format>", "json or table", "json")
    .description("Create one Collection from a standard create payload.")
    .action(async (options: CollectionCreateCommandOptions) => {
      const format = assertFormat(options.format);
      const payload = await readCollectionCreatePayload(options);
      const localErrors = validateCollectionCreatePayload(payload);
      if (localErrors.length > 0) {
        process.exitCode = 1;
        const result = {
          dry_run: Boolean(options.dryRun),
          valid: false,
          errors: localErrors,
          warnings: [],
        };
        printByFormat(
          result,
          format,
          collectionCreateValidationTableRows(result),
        );
        return;
      }

      const context = await createContext();
      if (options.dryRun) {
        const result = await previewCollectionCreate(context.client, payload);
        if (!result.valid) {
          process.exitCode = 1;
        }
        printByFormat(
          result,
          format,
          collectionCreateValidationTableRows(result),
        );
        return;
      }

      try {
        const result = await createCollection(context.client, payload);
        printByFormat(result, format, collectionCreateResultTableRows(result));
      } catch (error) {
        const backendErrors = parseCollectionCreateBackendErrors(error);
        if (!backendErrors) {
          throw error;
        }
        process.exitCode = 1;
        const result = {
          ok: false,
          valid: false,
          errors: backendErrors,
          warnings: [],
        };
        printByFormat(
          result,
          format,
          collectionCreateValidationTableRows(result),
        );
      }
    });

  collection
    .command("list")
    .option("--id <id>", "Collection id. Resolves through detail then list state.")
    .option("--page <number>", "Page number, starting at 1.", "1")
    .option("--size <number>", "Page size.", "20")
    .option("--project-id <id>")
    .option("--no-project", "Filter collections without a project.")
    .option("--workflow <value>", "Workflow name or value.")
    .option("--title <text>")
    .option("--spu <spu>")
    .option("--creator <name>")
    .option("--developer <name>")
    .option("--principal <name>", "Filter by current principal.")
    .option("--category-id <id>")
    .option("--origin-type <value>", "Origin type name or value.")
    .option("--created-after <time>", "Unix timestamp or ISO date.")
    .option("--created-before <time>", "Unix timestamp or ISO date.")
    .option("--repeat-origin-url")
    .option("--only-mine")
    .option("--ai-editing-status <value>", "AI editing status name or value.")
    .option("--confirmer <value>")
    .option("--sort-field <value>", "create-time, update-time, or finish-time.")
    .option("--sort-order <value>", "asc or desc.")
    .option("--format <format>", "json or table", "json")
    .description("List collections.")
    .action(async (options: CollectionListCommandOptions) => {
      const context = await createContext();
      const result = await listCollections(
        context.client,
        collectionListOptionsFromCommand(options),
      );
      printByFormat(
        result,
        assertFormat(options.format),
        collectionTableRows(result.collection_list ?? []),
      );
    });

  collection
    .command("get")
    .argument("[id]")
    .option("--id <id>", "Collection id. Positional id is preferred.")
    .option("--format <format>", "json or table", "json")
    .description("Get collection detail by id.")
    .action(async (id: string | undefined, options: { id?: string; format: string }) => {
      const context = await createContext();
      const result = await getCollection(
        context.client,
        resolveId("collection", id, options.id),
      );
      printByFormat(result, assertFormat(options.format));
    });

  const collectionVariants = collection
    .command("variants")
    .description("Collection variants and SKU helpers.");

  collectionVariants
    .command("get")
    .argument("<collection-id>")
    .option("--format <format>", "json or table", "json")
    .description("Get collection variants by collection id.")
    .action(async (collectionId: string, options: { format: string }) => {
      const context = await createContext();
      const result = await getCollectionVariants(context.client, collectionId);
      printByFormat(result, assertFormat(options.format), variantsGetTableRows(result));
    });

  collectionVariants
    .command("set")
    .argument("<collection-id>")
    .requiredOption("--file <path>", "JSON file containing attributes and sku_list.")
    .option("--preview", "Validate and show impact without committing.")
    .option("--reprice", "Force reference price recalculation.")
    .option("--no-reprice", "Force no reference price recalculation.")
    .option("--yes", "Skip destructive confirmation after preview.")
    .option("--format <format>", "json or table", "json")
    .description("Replace variants attributes and sku_list.")
    .action(async (collectionId: string, options: CollectionVariantsSetCommandOptions) => {
      const format = assertFormat(options.format);
      const rawPayload = await readVariantsJsonFile(options.file, "variants set file");
      const localErrors = validateVariantsSetPayload(rawPayload);
      if (localErrors.length > 0) {
        process.exitCode = 1;
        printByFormat(
          { valid: false, errors: localErrors, warnings: [] },
          format,
          variantsIssueTableRows({ valid: false, errors: localErrors, warnings: [] }),
        );
        return;
      }

      const context = await createContext();
      const current = await getCollectionVariants(context.client, collectionId);
      const payload = withWriteGuards(
        normalizeVariantsSetPayload(rawPayload),
        current.updated_at,
        resolveSetReprice(rawPayload, options),
      );

      try {
        const preview = await previewCollectionVariants(context.client, collectionId, payload);
        if (!preview.valid) {
          process.exitCode = 1;
          printByFormat(preview, format, variantsPreviewTableRows(preview));
          return;
        }
        if (options.preview) {
          printByFormat(preview, format, variantsPreviewTableRows(preview));
          return;
        }
        await confirmVariantsMutation({
          operation: "variants set",
          preview,
          yes: options.yes,
        });
        const result = await replaceCollectionVariants(context.client, collectionId, payload);
        printByFormat(result, format, variantsWriteTableRows(result));
      } catch (error) {
        if (handleVariantsFieldErrors(error, format)) {
          return;
        }
        throw normalizeVariantsCommandError(error, "collection");
      }
    });

  const collectionVariantSku = collectionVariants
    .command("sku")
    .description("Collection variant SKU helpers.");

  collectionVariantSku
    .command("patch")
    .argument("<collection-id>")
    .option("--sku-id <sku-id>", "Patch one SKU.")
    .option("--file <path>", "JSON file containing batch patch items.")
    .option("--cost-price <number>")
    .option("--reference-price <number>")
    .option("--stock <number>")
    .option("--carriage <number>")
    .option("--weight <number>")
    .option("--length <number>")
    .option("--width <number>")
    .option("--height <number>")
    .option("--package-length <number>")
    .option("--package-width <number>")
    .option("--package-height <number>")
    .option("--min-purchase-amount <number>")
    .option("--master-image <url>")
    .option("--master-thumbnail <url>")
    .option("--affiliate-images <list>", "Comma-separated list or JSON string array.")
    .option("--reprice", "Force reference price recalculation.")
    .option("--no-reprice", "Force no reference price recalculation.")
    .option("--format <format>", "json or table", "json")
    .description("Patch one SKU or batch patch many SKUs.")
    .action(async (collectionId: string, options: CollectionVariantsSkuPatchCommandOptions) => {
      const format = assertFormat(options.format);
      if (options.skuId && options.file) {
        throw new CliError("invalid_argument", "--sku-id and --file cannot be combined");
      }
      if (!options.skuId && !options.file) {
        throw new CliError("invalid_argument", "SKU patch target is required.", {
          hint: "Use --sku-id <sku-id> for one SKU or --file sku-patch.json for batch.",
        });
      }

      try {
        if (options.file) {
          const payload = await readSkuPatchBatchPayload(options.file, options);
          const context = await createContext();
          const current = await getCollectionVariants(context.client, collectionId);
          payload.if_match_updated_at = current.updated_at;
          const result = await patchCollectionVariantSkus(
            context.client,
            collectionId,
            payload,
          );
          printByFormat(result, format, variantsWriteTableRows(result));
          return;
        }

        const item = buildSkuPatchItemFromOptions(options as unknown as Record<string, unknown>);
        item.reprice = resolveRepriceDefault(
          [item.update_mask],
          repriceOptionsFromCommand(options),
        );
        const context = await createContext();
        const current = await getCollectionVariants(context.client, collectionId);
        item.if_match_updated_at = current.updated_at;
        if (shouldUploadMasterImage(item)) {
          const localImage = await readLocalImageFile(String(item.master_image).trim(), {
            allowedContentTypes: MASTER_IMAGE_UPLOAD_CONTENT_TYPES,
            typeHint: "Use a jpg, jpeg, or png file.",
          });
          const result = await patchCollectionVariantSkuMasterImage(
            context.client,
            collectionId,
            options.skuId ?? "",
            {
              file: localImage.blob,
              filename: localImage.filename,
              ifMatchUpdatedAt: current.updated_at,
            },
          );
          printByFormat(result, format, variantsWriteTableRows(result));
          return;
        }
        const result = await patchCollectionVariantSku(
          context.client,
          collectionId,
          options.skuId ?? "",
          item,
        );
        printByFormat(result, format, variantsWriteTableRows(result));
      } catch (error) {
        if (handleVariantsFieldErrors(error, format)) {
          return;
        }
        throw normalizeVariantsCommandError(error, options.skuId ? "sku" : "collection or sku");
      }
    });

  const collectionVariantSkuAffiliateImage = collectionVariantSku
    .command("affiliate-image")
    .description("Collection variant SKU affiliate image helpers.");

  collectionVariantSkuAffiliateImage
    .command("replace")
    .argument("<collection-id>")
    .requiredOption("--sku-id <sku-id>", "SKU id containing the affiliate image.")
    .requiredOption("--old-url <url>", "Existing affiliate image URL to replace.")
    .option("--new-url <url>", "Replacement affiliate image URL. Uses JSON mode.")
    .option("--new-file <path>", "Replacement local image file. Uses multipart mode.")
    .option("--asset-id <asset-id>", "Uploaded asset id. Uses JSON mode.")
    .option("--if-match-updated-at <time>", "Advanced optimistic concurrency override.")
    .option("--dry-run", "Validate CLI inputs and show the planned backend request.")
    .option("--format <format>", "json or table", "json")
    .description("Replace one SKU affiliate image.")
    .action(
      async (
        collectionId: string,
        options: CollectionVariantsSkuAffiliateImageReplaceCommandOptions,
      ) => {
        const format = assertFormat(options.format);
        const plan = normalizeAffiliateImageReplaceOptions({
          oldUrl: options.oldUrl,
          newUrl: options.newUrl,
          newFile: options.newFile,
          assetId: options.assetId,
          ifMatchUpdatedAt: options.ifMatchUpdatedAt,
          dryRun: options.dryRun,
        });
        const localImage =
          plan.mode === "file" ? await readLocalImageFile(plan.newFile ?? "") : undefined;

        if (plan.dryRun) {
          const result = affiliateImageReplaceDryRunResult(
            collectionId,
            options.skuId,
            plan,
            localImage?.filename,
            localImage?.blob,
          );
          printByFormat(result, format, affiliateImageReplaceDryRunTableRows(result));
          return;
        }

        try {
          const context = await createContext();
          const current = await getCollectionVariants(context.client, collectionId);
          const ifMatchUpdatedAt = plan.ifMatchUpdatedAt ?? current.updated_at;
          let result: AffiliateImageReplaceResult;
          if (plan.mode === "file") {
            if (!localImage) {
              throw new CliError("invalid_argument", "--new-file is required");
            }
            result = await replaceCollectionVariantSkuAffiliateImageFile(
              context.client,
              collectionId,
              options.skuId,
              {
                oldUrl: plan.oldUrl,
                file: localImage.blob,
                filename: localImage.filename,
                ifMatchUpdatedAt,
              },
            );
          } else {
            result = await replaceCollectionVariantSkuAffiliateImageJson(
              context.client,
              collectionId,
              options.skuId,
              {
                oldUrl: plan.oldUrl,
                newUrl: plan.newUrl,
                assetId: plan.assetId,
                ifMatchUpdatedAt,
              },
            );
          }
          printByFormat(result, format, affiliateImageReplaceTableRows(result));
        } catch (error) {
          if (handleVariantsFieldErrors(error, format)) {
            return;
          }
          throw normalizeAffiliateImageReplaceCommandError(error);
        }
      },
    );

  const collectionVariantAttr = collectionVariants
    .command("attr")
    .description("Collection variant attribute operations.");

  addCollectionVariantAttrCommand(collectionVariantAttr, "rename-key");
  addCollectionVariantAttrCommand(collectionVariantAttr, "rename-value");
  addCollectionVariantAttrCommand(collectionVariantAttr, "merge-value");
  addCollectionVariantAttrCommand(collectionVariantAttr, "remove-value");
  addCollectionVariantAttrCommand(collectionVariantAttr, "remove-key");

  collection
    .command("submit-ai-editing")
    .argument("[id]")
    .option("--ids <ids>", "Comma-separated collection ids.")
    .option(
      "--process-mode <mode>",
      "text-and-image, text-only, or image-only.",
      "text-and-image",
    )
    .option("--require-main-img-white-bg", "Require a white background for the main image.")
    .option("--auto-pricing", "Enable automatic pricing.")
    .option("--finish-mode <mode>", "auto, manual, or intelligent.", "intelligent")
    .option("--target-workflow <workflow>", "Target workflow after AI editing.")
    .option("--market <market>", "AI editing target market.", "US")
    .option("--priority <number>", "AI editing task priority.", "1")
    .option("--force", "Resubmit when the item would otherwise be skipped.")
    .option("--dry-run", "Preview without sending write requests.")
    .option("--yes", "Skip multi-id confirmation.")
    .option("--format <format>", "json or table", "json")
    .description("Submit collections to AI auto-editing.")
    .action(async (id: string | undefined, options: CollectionAiSubmitCommandOptions) => {
      const ids = resolveIds("collection", id, options.ids);
      await confirmBatchWrite({
        operation: "submit-ai-editing",
        ids,
        dryRun: options.dryRun,
        yes: options.yes,
      });

      const context = await createContext();
      const result = await runSubmitCollectionAiEditingAction(context.client, {
        ids,
        ...submitAiEditingOptionsFromCommand(options),
        dryRun: options.dryRun,
        force: options.force,
      });
      if (batchHasFailures(result)) {
        process.exitCode = 1;
      }
      printByFormat(result, assertFormat(options.format), batchTableRows(result));
    });

  const collectionContent = collection
    .command("content")
    .description("Collection content write helpers.");

  collectionContent
    .command("patch")
    .argument("<id>")
    .option("--english-title <text>")
    .option("--search-terms <text>")
    .option("--description <html>")
    .option(
      "--bullet-point <text>",
      "Bullet point item. Repeat to send the full replacement list.",
      collectOption,
      [] as string[],
    )
    .option("--if-match-updated-at <time>")
    .option("--format <format>", "json or table", "json")
    .description("Patch editable collection content fields.")
    .action(async (id: string, options: CollectionContentPatchCommandOptions) => {
      const context = await createContext();
      const result = await patchCollectionContent(
        context.client,
        id,
        contentPatchOptionsFromCommand(options),
      );
      printByFormat(result, assertFormat(options.format));
    });

  const collectionSource = collection
    .command("source")
    .description("Collection source link write helpers.");

  collectionSource
    .command("set")
    .argument("<id>")
    .argument("<origin-url>")
    .option("--allow-duplicate")
    .option("--if-match-updated-at <time>")
    .option("--format <format>", "json or table", "json")
    .description("Set a collection source URL.")
    .action(
      async (
        id: string,
        originUrl: string,
        options: CollectionSourceSetCommandOptions,
      ) => {
        const context = await createContext();
        const result = await setCollectionSource(context.client, id, {
          originUrl,
          allowDuplicate: options.allowDuplicate,
          ifMatchUpdatedAt: options.ifMatchUpdatedAt,
        });
        printByFormat(result, assertFormat(options.format));
      },
    );

  const collectionDeveloper = collection
    .command("developer")
    .description("Collection developer write helpers.");

  collectionDeveloper
    .command("set")
    .argument("<id>")
    .argument("<developer>")
    .option("--if-match-updated-at <time>")
    .option("--format <format>", "json or table", "json")
    .description("Set a collection developer.")
    .action(
      async (
        id: string,
        developer: string,
        options: CollectionDeveloperSetCommandOptions,
      ) => {
        const context = await createContext();
        const result = await setCollectionDeveloper(context.client, id, {
          developer,
          ifMatchUpdatedAt: options.ifMatchUpdatedAt,
        });
        printByFormat(result, assertFormat(options.format));
      },
    );

  const collectionKeywords = collection
    .command("keywords")
    .description("Collection keyword write helpers.");

  collectionKeywords
    .command("set")
    .argument("<id>")
    .requiredOption("--file <path>", "JSON file containing keyword groups.")
    .option("--if-match-updated-at <time>")
    .option("--format <format>", "json or table", "json")
    .description("Replace collection keyword groups.")
    .action(async (id: string, options: CollectionKeywordsSetCommandOptions) => {
      const context = await createContext();
      const result = await setCollectionKeywords(context.client, id, {
        keywords: await readKeywordsFile(options.file),
        ifMatchUpdatedAt: options.ifMatchUpdatedAt,
      });
      printByFormat(result, assertFormat(options.format));
    });

  const collectionWorkflow = collection
    .command("workflow")
    .description("Collection workflow helpers.");

  collectionWorkflow
    .command("list")
    .option("--format <format>", "json or table", "json")
    .description("List collection workflow values.")
    .action((options: { format: string }) => {
      const workflows = WORKFLOW_OPTIONS.map(({ aliases: _aliases, ...workflow }) => workflow);
      printByFormat(
        { workflows },
        assertFormat(options.format),
        choiceTableRows(WORKFLOW_OPTIONS),
      );
    });

  const collectionAiStatus = collection
    .command("ai-status")
    .description("Collection AI editing status helpers.");

  collectionAiStatus
    .command("list")
    .option("--format <format>", "json or table", "json")
    .description("List AI editing status values.")
    .action((options: { format: string }) => {
      const statuses = AI_EDITING_STATUS_OPTIONS.map(({ aliases: _aliases, ...status }) => status);
      printByFormat(
        { statuses },
        assertFormat(options.format),
        choiceTableRows(AI_EDITING_STATUS_OPTIONS),
      );
    });

  const collectionOrigin = collection
    .command("origin")
    .description("Collection origin type helpers.");

  collectionOrigin
    .command("list")
    .option("--format <format>", "json or table", "json")
    .description("List origin type values.")
    .action((options: { format: string }) => {
      const origin_types = ORIGIN_TYPE_OPTIONS.map(({ aliases: _aliases, ...origin }) => origin);
      printByFormat(
        { origin_types },
        assertFormat(options.format),
        choiceTableRows(ORIGIN_TYPE_OPTIONS),
      );
    });

  const collectionSort = collection
    .command("sort")
    .description("Collection sort helpers.");

  collectionSort
    .command("list")
    .option("--format <format>", "json or table", "json")
    .description("List sort field and order values.")
    .action((options: { format: string }) => {
      const fields = SORT_FIELD_OPTIONS.map(({ aliases: _aliases, ...field }) => field);
      const orders = SORT_ORDER_OPTIONS.map(({ aliases: _aliases, ...order }) => order);
      printByFormat(
        { fields, orders },
        assertFormat(options.format),
        [
          ...choiceTableRows(SORT_FIELD_OPTIONS).map((row) => ({ Type: "field", ...row })),
          ...choiceTableRows(SORT_ORDER_OPTIONS).map((row) => ({ Type: "order", ...row })),
        ],
      );
    });

  collection
    .command("set-project")
    .argument("[id]")
    .option("--ids <ids>", "Comma-separated collection ids.")
    .requiredOption("--project-id <id>", "Target project id.")
    .option("--force", "Replace an existing different project.")
    .option("--dry-run", "Preview without sending write requests.")
    .option("--yes", "Skip multi-id confirmation.")
    .option("--format <format>", "json or table", "json")
    .description("Set collections' development project.")
    .action(async (id: string | undefined, options: CollectionSetProjectCommandOptions) => {
      const ids = resolveIds("collection", id, options.ids);
      const projectId = toPositiveIntegerId(options.projectId, "project-id");
      await confirmBatchWrite({
        operation: "set-project",
        ids,
        dryRun: options.dryRun,
        yes: options.yes,
        detail: `project ${projectId}`,
      });

      const context = await createContext();
      const result = await runSetCollectionProjectAction(context.client, {
        ids,
        projectId,
        dryRun: options.dryRun,
        force: options.force,
      });
      if (batchHasFailures(result)) {
        process.exitCode = 1;
      }
      printByFormat(result, assertFormat(options.format), batchTableRows(result));
    });

  const project = program.command("project").description("Read and operate on project data.");

  project
    .command("create")
    .requiredOption("--name <name>", "Project name.")
    .option("--remark <text>", "Project remark.")
    .option("--format <format>", "json or table", "json")
    .description("Create a project.")
    .action(async (options: ProjectCreateCommandOptions) => {
      const context = await createContext();
      const result = await createProject(
        context.client,
        projectCreateOptionsFromCommand(options),
      );
      printByFormat(
        result,
        assertFormat(options.format),
        projectWriteTableRows([result]),
      );
    });

  project
    .command("update")
    .argument("<id>")
    .option("--name <name>", "Project name.")
    .option("--remark <text>", "Project remark. Use an empty value to clear.")
    .option("--owner <name>", "Project owner. Use an empty value to clear.")
    .option("--keywords-file <path>", "JSON file containing the full keywords snapshot.")
    .option("--format <format>", "json or table", "json")
    .description("Update project metadata.")
    .action(async (id: string, options: ProjectUpdateCommandOptions) => {
      const keywords = options.keywordsFile
        ? await readProjectKeywordsFile(options.keywordsFile)
        : undefined;
      const context = await createContext();
      const result = await updateProject(
        context.client,
        id,
        projectUpdateOptionsFromCommand(options, keywords),
      );
      printByFormat(
        result,
        assertFormat(options.format),
        projectWriteTableRows([result]),
      );
    });

  project
    .command("list")
    .option("--page <number>", "Page number, starting at 1.", "1")
    .option("--size <number>", "Page size.", "20")
    .option("--name <text>")
    .option("--status <value>", "progressing, completed, or discard.")
    .option("--member <name>", "Filter by project member.")
    .option("--creator <name>")
    .option("--format <format>", "json or table", "json")
    .description("List projects.")
    .action(async (options: ProjectListCommandOptions) => {
      const context = await createContext();
      const result = await listProjects(context.client, projectListOptionsFromCommand(options));
      printByFormat(
        result,
        assertFormat(options.format),
        projectTableRows(result.projects ?? []),
      );
    });

  project
    .command("get")
    .argument("[id]")
    .option("--id <id>", "Project id. Positional id is preferred.")
    .option("--format <format>", "json or table", "json")
    .description("Get project detail by id.")
    .action(async (id: string | undefined, options: { id?: string; format: string }) => {
      const context = await createContext();
      const result = await getProject(context.client, resolveId("project", id, options.id));
      printByFormat(result, assertFormat(options.format));
    });

  const projectStatus = project.command("status").description("Project status helpers.");

  projectStatus
    .command("list")
    .option("--format <format>", "json or table", "json")
    .description("List project status values.")
    .action((options: { format: string }) => {
      printByFormat(
        { statuses: projectStatusTableRows() },
        assertFormat(options.format),
        projectStatusTableRows(),
      );
    });

  return program;
}

export interface CollectionListCommandOptions {
  id?: string;
  page?: string;
  size?: string;
  projectId?: string;
  project?: boolean;
  noProject?: boolean;
  workflow?: string;
  title?: string;
  spu?: string;
  creator?: string;
  developer?: string;
  principal?: string;
  categoryId?: string;
  originType?: string;
  createdAfter?: string;
  createdBefore?: string;
  repeatOriginUrl?: boolean;
  onlyMine?: boolean;
  aiEditingStatus?: string;
  confirmer?: string;
  sortField?: string;
  sortOrder?: string;
  format: string;
}

export interface CollectionCreateCommandOptions {
  file?: string;
  stdin?: boolean;
  dryRun?: boolean;
  format: string;
}

export interface CollectionSchemaCommandOptions {
  operation: string;
  format: string;
}

export interface CollectionAiSubmitCommandOptions {
  ids?: string;
  processMode?: string;
  requireMainImgWhiteBg?: boolean;
  autoPricing?: boolean;
  finishMode?: string;
  targetWorkflow?: string;
  market?: string;
  priority?: string;
  force?: boolean;
  dryRun?: boolean;
  yes?: boolean;
  format: string;
}

export interface CollectionSetProjectCommandOptions {
  ids?: string;
  projectId: string;
  force?: boolean;
  dryRun?: boolean;
  yes?: boolean;
  format: string;
}

export interface CollectionContentPatchCommandOptions {
  englishTitle?: string;
  searchTerms?: string;
  description?: string;
  bulletPoint?: string[];
  ifMatchUpdatedAt?: string;
  format: string;
}

export interface CollectionSourceSetCommandOptions {
  allowDuplicate?: boolean;
  ifMatchUpdatedAt?: string;
  format: string;
}

export interface CollectionDeveloperSetCommandOptions {
  ifMatchUpdatedAt?: string;
  format: string;
}

export interface CollectionKeywordsSetCommandOptions {
  file: string;
  ifMatchUpdatedAt?: string;
  format: string;
}

export interface CollectionVariantsSetCommandOptions {
  file: string;
  preview?: boolean;
  reprice?: boolean;
  yes?: boolean;
  format: string;
}

export interface CollectionVariantsSkuPatchCommandOptions {
  skuId?: string;
  file?: string;
  costPrice?: string;
  referencePrice?: string;
  stock?: string;
  carriage?: string;
  weight?: string;
  length?: string;
  width?: string;
  height?: string;
  packageLength?: string;
  packageWidth?: string;
  packageHeight?: string;
  minPurchaseAmount?: string;
  masterImage?: string;
  masterThumbnail?: string;
  affiliateImages?: string;
  reprice?: boolean;
  format: string;
}

export interface CollectionVariantsSkuAffiliateImageReplaceCommandOptions {
  skuId: string;
  oldUrl: string;
  newUrl?: string;
  newFile?: string;
  assetId?: string;
  ifMatchUpdatedAt?: string;
  dryRun?: boolean;
  format: string;
}

export interface CollectionVariantsAttrCommandOptions {
  key?: string;
  from?: string;
  to?: string;
  preview?: boolean;
  yes?: boolean;
  format: string;
}

export interface ProjectListCommandOptions {
  page?: string;
  size?: string;
  name?: string;
  status?: string;
  member?: string;
  creator?: string;
  format: string;
}

export interface ProjectCreateCommandOptions {
  name: string;
  remark?: string;
  format: string;
}

export interface ProjectUpdateCommandOptions {
  name?: string;
  remark?: string;
  owner?: string;
  keywordsFile?: string;
  format: string;
}

export function collectionListOptionsFromCommand(
  options: CollectionListCommandOptions,
): CollectionListOptions {
  return {
    id: options.id,
    page: options.page,
    size: options.size,
    projectId: options.projectId,
    noProject: options.noProject ?? (options.project === false ? true : undefined),
    workflow: options.workflow,
    title: options.title,
    spu: options.spu,
    creator: options.creator,
    developer: options.developer,
    currentPrincipal: options.principal,
    categoryId: options.categoryId,
    originType: options.originType,
    createdAfter: options.createdAfter,
    createdBefore: options.createdBefore,
    repeatOriginUrl: options.repeatOriginUrl,
    onlyMine: options.onlyMine,
    aiEditingStatus: options.aiEditingStatus,
    confirmer: options.confirmer,
    sortField: options.sortField,
    sortOrder: options.sortOrder,
  };
}

export function projectListOptionsFromCommand(
  options: ProjectListCommandOptions,
): ProjectListOptions {
  return {
    page: options.page,
    size: options.size,
    name: options.name,
    status: options.status,
    member: options.member,
    creator: options.creator,
  };
}

export function projectCreateOptionsFromCommand(
  options: ProjectCreateCommandOptions,
): CreateProjectOptions {
  return {
    name: options.name,
    remark: options.remark,
  };
}

export function projectUpdateOptionsFromCommand(
  options: ProjectUpdateCommandOptions,
  keywords?: ProjectKeywords,
): UpdateProjectOptions {
  return {
    name: options.name,
    remark: options.remark,
    owner: options.owner,
    keywords,
  };
}

export function submitAiEditingOptionsFromCommand(
  options: CollectionAiSubmitCommandOptions,
): SubmitCollectionAiEditingOptions {
  return {
    processMode: options.processMode,
    requireMainImgWhiteBg: options.requireMainImgWhiteBg,
    enableAutoPricing: options.autoPricing,
    collectionFinishMode: options.finishMode,
    targetWorkflow: options.targetWorkflow,
    market: options.market,
    priority: options.priority,
  };
}

export function contentPatchOptionsFromCommand(
  options: CollectionContentPatchCommandOptions,
): PatchCollectionContentOptions {
  return {
    englishTitle: options.englishTitle,
    searchTerms: options.searchTerms,
    description: options.description,
    bulletPointList:
      options.bulletPoint && options.bulletPoint.length > 0
        ? options.bulletPoint
        : undefined,
    ifMatchUpdatedAt: options.ifMatchUpdatedAt,
  };
}

export async function main(argv = process.argv): Promise<void> {
  await buildProgram().parseAsync(argv);
}

async function createContext(): Promise<{
  profileName: string;
  endpoint: string;
  client: ApiClient;
}> {
  const current = await getRuntimeProfile();
  return {
    profileName: current.name,
    endpoint: current.profile.endpoint,
    client: new ApiClient({
      endpoint: current.profile.endpoint,
      profileName: current.name,
    }),
  };
}

async function readKeywordsFile(filePath: string): Promise<CollectionKeywords> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch (error) {
    throw new CliError("invalid_argument", `Unable to read keywords file: ${filePath}`, {
      details: error,
    });
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("not object");
    }
    return parsed as CollectionKeywords;
  } catch {
    throw new CliError("invalid_argument", "keywords file must contain a JSON object");
  }
}

async function readProjectKeywordsFile(filePath: string): Promise<ProjectKeywords> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch (error) {
    throw new CliError("invalid_argument", `Unable to read project keywords file: ${filePath}`, {
      details: error,
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new CliError("invalid_argument", "project keywords file must contain one JSON object");
  }
  return normalizeProjectKeywords(parsed);
}

async function readCollectionCreatePayload(
  options: CollectionCreateCommandOptions,
): Promise<Record<string, unknown>> {
  if (options.file && options.stdin) {
    throw new CliError("invalid_argument", "--file and --stdin cannot be combined");
  }
  if (!options.file && !options.stdin) {
    throw new CliError("invalid_argument", "Collection create input is required.", {
      hint: "Use --file collection.json or --stdin.",
    });
  }

  if (options.file) {
    let raw: string;
    try {
      raw = await fs.readFile(options.file, "utf8");
    } catch (error) {
      throw new CliError(
        "invalid_argument",
        `Unable to read collection create file: ${options.file}`,
        { details: error },
      );
    }
    return parseCollectionCreatePayloadJson(raw, options.file);
  }

  return parseCollectionCreatePayloadJson(await readAllStdin(), "stdin");
}

async function readAllStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let raw = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk: string) => {
      raw += chunk;
    });
    process.stdin.on("end", () => {
      resolve(raw);
    });
    process.stdin.on("error", reject);
  });
}

function collectOption(value: string, previous: string[]): string[] {
  return [...previous, value];
}

function addCollectionVariantAttrCommand(parent: Command, operation: string): void {
  parent
    .command(operation)
    .argument("<collection-id>")
    .option("--key <key>")
    .option("--from <value>")
    .option("--to <value>")
    .option("--preview", "Validate and show impact without committing.")
    .option("--yes", "Skip destructive confirmation after preview.")
    .option("--format <format>", "json or table", "json")
    .description(`Run variants attribute ${operation}.`)
    .action(async (collectionId: string, options: CollectionVariantsAttrCommandOptions) => {
      const format = assertFormat(options.format);
      const payload = normalizeAttributeOperation(operation, {
        key: options.key,
        from: options.from,
        to: options.to,
      });
      const context = await createContext();
      const current = await getCollectionVariants(context.client, collectionId);
      payload.if_match_updated_at = current.updated_at;

      try {
        const preview = await previewCollectionVariantAttributeOperation(
          context.client,
          collectionId,
          payload,
        );
        if (!preview.valid) {
          process.exitCode = 1;
          printByFormat(preview, format, variantsPreviewTableRows(preview));
          return;
        }
        if (options.preview) {
          printByFormat(preview, format, variantsPreviewTableRows(preview));
          return;
        }
        await confirmVariantsMutation({
          operation: `attr ${operation}`,
          preview,
          attributeOperation: payload.operation,
          yes: options.yes,
        });
        const result = await commitCollectionVariantAttributeOperation(
          context.client,
          collectionId,
          payload,
        );
        printByFormat(result, format, variantsWriteTableRows(result));
      } catch (error) {
        if (handleVariantsFieldErrors(error, format)) {
          return;
        }
        throw normalizeVariantsCommandError(error, "collection");
      }
    });
}

async function readVariantsJsonFile(
  filePath: string,
  sourceName: string,
): Promise<Record<string, unknown>> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch (error) {
    throw new CliError("invalid_argument", `Unable to read ${sourceName}: ${filePath}`, {
      details: error,
    });
  }
  return parseVariantsJsonObject(raw, filePath);
}

async function readSkuPatchBatchPayload(
  filePath: string,
  options: CollectionVariantsSkuPatchCommandOptions,
): Promise<SkuPatchBatchPayload> {
  const rawPayload = await readVariantsJsonFile(filePath, "SKU patch file");
  const localErrors = validateSkuPatchBatchPayload(rawPayload);
  if (localErrors.length > 0) {
    throw new CliError(
      "invalid_argument",
      "collection variants SKU patch payload validation failed",
      { details: { errors: localErrors } },
    );
  }
  const payload = normalizeSkuPatchBatchPayload(rawPayload);
  const masks = payload.items.map((item) => item.update_mask);
  const explicitReprice =
    options.reprice === undefined
      ? typeof rawPayload.reprice === "boolean"
        ? rawPayload.reprice
        : undefined
      : options.reprice;
  payload.reprice =
    explicitReprice === undefined
      ? resolveRepriceDefault(masks)
      : resolveRepriceDefault(masks, repriceOptionsFromValue(explicitReprice));
  return payload;
}

function shouldUploadMasterImage(item: SkuPatchItem): boolean {
  const masterImage =
    typeof item.master_image === "string" ? item.master_image.trim() : "";
  if (!masterImage || isHttpUrl(masterImage)) {
    return false;
  }
  if (
    item.update_mask.length !== 1 ||
    item.update_mask[0] !== "master_image"
  ) {
    throw new CliError(
      "invalid_argument",
      "Local --master-image file upload cannot be combined with other SKU patch fields.",
      {
        hint: "Run the local image upload separately, or use an http(s) URL when combining fields.",
      },
    );
  }
  return true;
}

function affiliateImageReplaceDryRunResult(
  collectionId: string,
  skuId: string,
  plan: AffiliateImageReplacePlan,
  filename?: string,
  file?: Blob,
): AffiliateImageReplaceDryRunResult {
  const ifMatchUpdatedAt =
    plan.ifMatchUpdatedAt ?? "<fetched-from-collection-updated-at>";
  if (plan.mode === "url" || plan.mode === "asset") {
    const request = buildReplaceCollectionVariantSkuAffiliateImageJsonRequest(
      collectionId,
      skuId,
      {
        oldUrl: plan.oldUrl,
        newUrl: plan.newUrl,
        assetId: plan.assetId,
        ifMatchUpdatedAt,
      },
    );
    return {
      dry_run: true,
      backend_connected: false,
      collection_id: collectionId,
      sku_id: skuId,
      field: "affiliate_images",
      mode: plan.mode,
      method: "PATCH",
      path: request.path,
      content_type: "application/json",
      old_url: String(request.data.old_url),
      new_url:
        request.data.new_url === undefined ? undefined : String(request.data.new_url),
      asset_id:
        request.data.asset_id === undefined ? undefined : String(request.data.asset_id),
      if_match_updated_at: String(request.data.if_match_updated_at),
    };
  }

  if (!file || !filename || !plan.newFile) {
    throw new CliError("invalid_argument", "new-file is required for multipart mode");
  }
  const request = buildReplaceCollectionVariantSkuAffiliateImageFileRequest(
    collectionId,
    skuId,
    {
      oldUrl: plan.oldUrl,
      file,
      filename,
      ifMatchUpdatedAt,
    },
  );
  return {
    dry_run: true,
    backend_connected: false,
    collection_id: collectionId,
    sku_id: skuId,
    field: "affiliate_images",
    mode: "file",
    method: "PATCH",
    path: request.path,
    content_type: "multipart/form-data",
    old_url: String(request.formData.get("old_url")),
    new_file: plan.newFile,
    filename,
    if_match_updated_at: String(request.formData.get("if_match_updated_at")),
  };
}

function affiliateImageReplaceDryRunTableRows(
  result: AffiliateImageReplaceDryRunResult,
): Array<Record<string, unknown>> {
  return [
    {
      Collection: result.collection_id,
      SKU: result.sku_id,
      Field: result.field,
      Mode: result.mode,
      Method: result.method,
      Path: result.path,
      OldURL: result.old_url,
      New: result.new_url ?? result.new_file ?? result.asset_id ?? "",
      IfMatch: result.if_match_updated_at ?? "",
      Backend: result.backend_connected ? "connected" : "pending",
    },
  ];
}

function affiliateImageReplaceTableRows(
  result: AffiliateImageReplaceResult,
): Array<Record<string, unknown>> {
  return [
    {
      Collection: result.collection_id,
      SKU: result.sku_id,
      Status: result.ok ? "ok" : "failed",
      OldURL: result.old_url,
      New: result.new_url ?? result.asset_id ?? "",
      Images: result.affiliate_images.length,
      UpdatedAt: result.updated_at,
    },
  ];
}

function resolveSetReprice(
  payload: Record<string, unknown>,
  options: CollectionVariantsSetCommandOptions,
): boolean {
  if (options.reprice === true) {
    return true;
  }
  if (options.reprice === false) {
    return false;
  }
  if (typeof payload.reprice === "boolean") {
    return payload.reprice;
  }
  return false;
}

function withWriteGuards<T extends Record<string, unknown>>(
  payload: T,
  updatedAt: string,
  reprice: boolean,
): T {
  return {
    ...payload,
    reprice,
    if_match_updated_at: updatedAt,
  };
}

function repriceOptionsFromCommand(
  options: { reprice?: boolean },
): { reprice?: boolean; noReprice?: boolean } {
  return repriceOptionsFromValue(options.reprice);
}

function repriceOptionsFromValue(
  value: boolean | undefined,
): { reprice?: boolean; noReprice?: boolean } {
  if (value === true) {
    return { reprice: true };
  }
  if (value === false) {
    return { noReprice: true };
  }
  return {};
}

async function confirmVariantsMutation(options: {
  operation: string;
  preview: VariantsPreviewResult;
  attributeOperation?: AttributeOperationType;
  yes?: boolean;
}): Promise<void> {
  if (
    options.yes ||
    !shouldConfirmVariantsMutation({
      preview: options.preview,
      operation: options.attributeOperation,
    })
  ) {
    return;
  }

  if (!process.stdin.isTTY) {
    throw new CliError(
      "confirmation_required",
      `${options.operation} requires confirmation because it may delete SKUs.`,
      { hint: "Pass --yes to run non-interactively." },
    );
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stderr,
  });
  try {
    const answer = await rl.question(
      `Run ${options.operation}? deleted_sku_count=${options.preview.deleted_sku_count}. [y/N] `,
    );
    if (!["y", "yes"].includes(answer.trim().toLowerCase())) {
      throw new CliError("cancelled", "Operation cancelled.");
    }
  } finally {
    rl.close();
  }
}

function handleVariantsFieldErrors(error: unknown, format: ReturnType<typeof assertFormat>): boolean {
  const backendErrors = parseCollectionVariantsBackendErrors(error);
  if (!backendErrors) {
    return false;
  }
  process.exitCode = 1;
  const result = {
    valid: false,
    errors: backendErrors,
    warnings: [],
  };
  printByFormat(result, format, variantsIssueTableRows(result));
  return true;
}

function normalizeVariantsCommandError(
  error: unknown,
  notFoundResource: "collection" | "sku" | "collection or sku",
): unknown {
  if (isStaleWriteError(error)) {
    return staleWriteError();
  }
  if (isNotFoundError(error)) {
    return notFoundError(notFoundResource);
  }
  return error;
}

function normalizeAffiliateImageReplaceCommandError(error: unknown): unknown {
  if (isImageNotFoundError(error)) {
    return affiliateImageNotFoundError();
  }
  if (isAmbiguousImageMatchError(error)) {
    return ambiguousImageMatchError();
  }
  if (isDuplicateImageError(error)) {
    return duplicateImageError();
  }
  return normalizeVariantsCommandError(error, "collection or sku");
}

function resolveId(
  resource: string,
  positionalId: string | undefined,
  optionId: string | undefined,
): string {
  if (positionalId && optionId && positionalId !== optionId) {
    throw new CliError("invalid_argument", `Conflicting ${resource} ids.`, {
      hint: `Use either: zmy ${resource} get ${positionalId} or --id ${optionId}.`,
    });
  }

  const id = positionalId ?? optionId;
  if (!id) {
    throw new CliError("invalid_argument", `${resource} id is required.`, {
      hint: `Use: zmy ${resource} get <id>`,
    });
  }
  return id;
}

async function confirmBatchWrite(options: {
  operation: string;
  ids: string[];
  dryRun?: boolean;
  yes?: boolean;
  detail?: string;
}): Promise<void> {
  if (options.ids.length <= 1 || options.dryRun || options.yes) {
    return;
  }

  if (!process.stdin.isTTY) {
    throw new CliError("confirmation_required", "Multi-id write requires confirmation.", {
      hint: "Pass --yes to run non-interactively.",
    });
  }

  const preview = options.ids.slice(0, 5).join(", ");
  const suffix = options.ids.length > 5 ? `, ... +${options.ids.length - 5}` : "";
  const detail = options.detail ? ` ${options.detail}` : "";
  const rl = createInterface({
    input: process.stdin,
    output: process.stderr,
  });
  try {
    const answer = await rl.question(
      `Run ${options.operation}${detail} on ${options.ids.length} collections (${preview}${suffix})? [y/N] `,
    );
    if (!["y", "yes"].includes(answer.trim().toLowerCase())) {
      throw new CliError("cancelled", "Operation cancelled.");
    }
  } finally {
    rl.close();
  }
}

export function isDirectCliInvocation(
  moduleUrl = import.meta.url,
  argv1 = process.argv[1],
): boolean {
  if (!argv1) {
    return false;
  }

  try {
    return realpathSync(fileURLToPath(moduleUrl)) === realpathSync(argv1);
  } catch {
    return moduleUrl === pathToFileURL(argv1).href;
  }
}

if (isDirectCliInvocation()) {
  main().catch((error: unknown) => {
    console.error(JSON.stringify(errorToPayload(error), null, 2));
    process.exitCode = 1;
  });
}
