import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveIds, toPositiveIntegerId } from "../src/ids.js";

test("resolveIds accepts a single positional id", () => {
  assert.deepEqual(resolveIds("collection", "123", undefined), ["123"]);
});

test("resolveIds parses comma-separated ids and preserves deduped order", () => {
  assert.deepEqual(resolveIds("collection", undefined, "123, 124,123,125"), [
    "123",
    "124",
    "125",
  ]);
});

test("resolveIds rejects conflicting positional and option ids", () => {
  assert.throws(
    () => resolveIds("collection", "123", "124"),
    /Conflicting collection ids/,
  );
});

test("resolveIds rejects missing and empty ids", () => {
  assert.throws(() => resolveIds("collection", undefined, undefined), /id is required/);
  assert.throws(() => resolveIds("collection", undefined, "123,,124"), /cannot be empty/);
});

test("resolveIds rejects non-positive integer ids", () => {
  assert.throws(() => resolveIds("collection", "abc", undefined), /positive integer/);
  assert.throws(() => resolveIds("collection", undefined, "123,0"), /positive integer/);
});

test("toPositiveIntegerId validates id-like values", () => {
  assert.equal(toPositiveIntegerId("456", "project-id"), 456);
  assert.throws(() => toPositiveIntegerId("0", "project-id"), /positive integer/);
  assert.throws(() => toPositiveIntegerId("abc", "project-id"), /positive integer/);
});
