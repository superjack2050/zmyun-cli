import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getCliHome,
  getRuntimeProfile,
  normalizeEndpoint,
} from "../src/config.js";

test("runtime profile uses the built-in public endpoint", async () => {
  const current = await getRuntimeProfile({
    ...process.env,
    ZMY_CLI_HOME: "/tmp/ignored-zmy-cli-home",
  });

  assert.equal(current.name, "default");
  assert.equal(current.profile.endpoint, "https://dev.kjdzerp.com");
});

test("CLI home can be isolated for credential tests", () => {
  assert.equal(
    getCliHome({ ...process.env, ZMY_CLI_HOME: "/tmp/zmy-cli-test-home" }),
    "/tmp/zmy-cli-test-home",
  );
});

test("endpoint normalization accepts HTTP URLs and rejects invalid values", () => {
  assert.equal(normalizeEndpoint(" http://127.0.0.1:8120/ "), "http://127.0.0.1:8120");
  assert.equal(normalizeEndpoint("https://example.test///"), "https://example.test");
  assert.throws(() => normalizeEndpoint("ftp://example.test"), /Invalid endpoint/);
  assert.throws(() => normalizeEndpoint("not a url"), /Invalid endpoint/);
});
