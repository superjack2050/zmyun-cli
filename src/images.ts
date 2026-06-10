import { promises as fs } from "node:fs";
import { basename, extname } from "node:path";
import { CliError } from "./errors.js";

export const MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MASTER_IMAGE_UPLOAD_CONTENT_TYPES = ["image/jpeg", "image/png"];

export interface LocalImageFile {
  blob: Blob;
  filename: string;
  contentType: string;
  size: number;
}

export interface ReadLocalImageFileOptions {
  allowedContentTypes?: string[];
  typeHint?: string;
  maxBytes?: number;
}

const IMAGE_CONTENT_TYPES = new Map([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
]);

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function readLocalImageFile(
  filePath: string,
  options: ReadLocalImageFileOptions = {},
): Promise<LocalImageFile> {
  const filename = basename(filePath);
  const contentType = IMAGE_CONTENT_TYPES.get(extname(filePath).toLowerCase());
  const allowedContentTypes = new Set(
    options.allowedContentTypes ?? IMAGE_CONTENT_TYPES.values(),
  );
  if (!contentType || !allowedContentTypes.has(contentType)) {
    throw new CliError("invalid_argument", "Unsupported image type.", {
      hint: options.typeHint ?? "Use a jpg, jpeg, png, or webp file.",
    });
  }

  let stat;
  try {
    stat = await fs.stat(filePath);
  } catch (error) {
    throw new CliError("invalid_argument", `Unable to read image file: ${filePath}`, {
      details: error,
    });
  }

  if (!stat.isFile()) {
    throw new CliError("invalid_argument", `Image path is not a file: ${filePath}`);
  }
  if (stat.size <= 0) {
    throw new CliError("invalid_argument", "Image file is empty.");
  }
  const maxBytes = options.maxBytes ?? MAX_IMAGE_UPLOAD_BYTES;
  if (stat.size > maxBytes) {
    throw new CliError("invalid_argument", "Image file is too large.", {
      hint: "Use an image up to 10 MB.",
    });
  }

  const buffer = await fs.readFile(filePath);
  const arrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
  return {
    blob: new Blob([arrayBuffer], { type: contentType }),
    filename,
    contentType,
    size: stat.size,
  };
}
