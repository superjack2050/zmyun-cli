import { readFileSync } from "node:fs";

export const CLIENT_ID = "zmy-cli";
export const CLI_VERSION = readPackageVersion();
export const DEFAULT_ENDPOINT = "https://dev.kjdzerp.com";
export const DEFAULT_PROFILE_NAME = "default";
export const DEFAULT_SCOPE =
  "collection:read collection:write project:read project:write";
export const DEVICE_CODE_GRANT =
  "urn:ietf:params:oauth:grant-type:device_code";

function readPackageVersion(): string {
  try {
    const raw = readFileSync(new URL("../package.json", import.meta.url), "utf8");
    const metadata = JSON.parse(raw) as { version?: unknown };
    if (typeof metadata.version === "string" && metadata.version.trim()) {
      return metadata.version;
    }
  } catch {
    // Version reporting should not prevent the CLI from starting.
  }
  return "0.0.0";
}
