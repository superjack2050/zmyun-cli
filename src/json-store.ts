import { promises as fs } from "node:fs";
import path from "node:path";

export async function ensurePrivateDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  await fs.chmod(dir, 0o700);
}

export async function readJsonFile<T>(
  filePath: string,
  fallback: T,
): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return fallback;
    }
    throw error;
  }
}

export async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  const dir = path.dirname(filePath);
  await ensurePrivateDir(dir);
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  const json = `${JSON.stringify(value, null, 2)}\n`;
  await fs.writeFile(tempPath, json, { mode: 0o600 });
  await fs.chmod(tempPath, 0o600);
  await fs.rename(tempPath, filePath);
  await fs.chmod(filePath, 0o600);
}
