import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import assert from "node:assert/strict";
import {
  isHttpUrl,
  MASTER_IMAGE_UPLOAD_CONTENT_TYPES,
  readLocalImageFile,
} from "../src/images.js";

const tempDirs: string[] = [];

after(async () => {
  await Promise.all(
    tempDirs.map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
});

test("http URL detection only accepts http and https", () => {
  assert.equal(isHttpUrl("https://cdn.example.test/main.jpg"), true);
  assert.equal(isHttpUrl("http://cdn.example.test/main.jpg"), true);
  assert.equal(isHttpUrl("./main.jpg"), false);
  assert.equal(isHttpUrl("oss://bucket/main.jpg"), false);
});

test("local image files produce upload metadata", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "zmy-cli-image-"));
  tempDirs.push(dir);
  const filePath = path.join(dir, "main.jpg");
  await fs.writeFile(filePath, Buffer.from([0xff, 0xd8, 0xff]));

  const image = await readLocalImageFile(filePath);

  assert.equal(image.filename, "main.jpg");
  assert.equal(image.contentType, "image/jpeg");
  assert.equal(image.size, 3);
  assert.equal(image.blob.type, "image/jpeg");
  assert.equal(image.blob.size, 3);
});

test("local image files reject unsupported extensions", async () => {
  await assert.rejects(
    () => readLocalImageFile("main.gif"),
    /Unsupported image type/,
  );
});

test("master image uploads reject webp before calling the backend", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "zmy-cli-image-webp-"));
  tempDirs.push(dir);
  const filePath = path.join(dir, "main.webp");
  await fs.writeFile(filePath, Buffer.from([0x52, 0x49, 0x46, 0x46]));

  await assert.rejects(
    () =>
      readLocalImageFile(filePath, {
        allowedContentTypes: MASTER_IMAGE_UPLOAD_CONTENT_TYPES,
        typeHint: "Use a jpg, jpeg, or png file.",
      }),
    /Unsupported image type/,
  );
});
