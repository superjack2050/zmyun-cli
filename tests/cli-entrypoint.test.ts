import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { isDirectCliInvocation } from "../src/cli.js";

const tempDirs: string[] = [];

after(async () => {
  await Promise.all(
    tempDirs.map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
});

test("CLI direct invocation detection follows npm bin symlinks", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "zmy-cli-entrypoint-"));
  tempDirs.push(dir);
  const target = path.join(dir, "cli.js");
  const symlink = path.join(dir, "zmy");

  await fs.writeFile(target, "#!/usr/bin/env node\n");
  await fs.symlink(target, symlink);

  assert.equal(isDirectCliInvocation(pathToFileURL(target).href, symlink), true);
});
