import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildPatchCollectionContentRequest,
  buildSetCollectionDeveloperRequest,
  buildSetCollectionKeywordsRequest,
  buildSetCollectionSourceRequest,
} from "../src/collections.js";

test("content patch builds update mask from provided fields only", () => {
  const request = buildPatchCollectionContentRequest("123", {
    englishTitle: "New title",
    searchTerms: "",
    bulletPointList: ["One", "Two"],
    ifMatchUpdatedAt: "2026-06-03 17:40:00",
  });

  assert.equal(request.path, "/api/v1/develop/collection/123/content");
  assert.deepEqual(request.data, {
    english_title: "New title",
    bullet_point_list: ["One", "Two"],
    if_match_updated_at: "2026-06-03 17:40:00",
    update_mask: ["english_title", "search_terms", "bullet_point_list"],
  });
});

test("content patch requires at least one editable field", () => {
  assert.throws(
    () => buildPatchCollectionContentRequest("123", {}),
    /At least one content field flag is required/,
  );
});

test("source set uses PUT endpoint body shape and validates URL scheme", () => {
  const request = buildSetCollectionSourceRequest("123", {
    originUrl: " https://detail.1688.com/offer/123.html?spm=a ",
    allowDuplicate: true,
  });

  assert.equal(request.path, "/api/v1/develop/collection/123/source");
  assert.deepEqual(request.data, {
    origin_url: "https://detail.1688.com/offer/123.html?spm=a",
    allow_duplicate: true,
  });
  assert.throws(
    () => buildSetCollectionSourceRequest("123", { originUrl: "ftp://example.test/a" }),
    /http or https/,
  );
});

test("developer set trims developer account", () => {
  const request = buildSetCollectionDeveloperRequest("123", {
    developer: " alice ",
  });

  assert.equal(request.path, "/api/v1/develop/collection/123/developer");
  assert.deepEqual(request.data, { developer: "alice" });
});

test("keywords set fills omitted groups with empty arrays", () => {
  const request = buildSetCollectionKeywordsRequest("123", {
    keywords: {
      core_main: ["desk organizer"],
      long_tail: ["wood desk organizer for office"],
    },
    ifMatchUpdatedAt: "2026-06-03T17:40:00+08:00",
  });

  assert.equal(request.path, "/api/v1/develop/collection/123/keywords");
  assert.deepEqual(request.data, {
    keywords: {
      core_main: ["desk organizer"],
      feature_attribute: [],
      scenario_audience_purpose: [],
      appearance_visual: [],
      long_tail: ["wood desk organizer for office"],
    },
    if_match_updated_at: "2026-06-03T17:40:00+08:00",
  });
});
