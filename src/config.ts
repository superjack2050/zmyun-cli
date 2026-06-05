import os from "node:os";
import path from "node:path";
import { DEFAULT_ENDPOINT, DEFAULT_PROFILE_NAME } from "./constants.js";
import { CliError } from "./errors.js";

export interface Profile {
  endpoint: string;
}

export function getCliHome(env: NodeJS.ProcessEnv = process.env): string {
  return env.ZMY_CLI_HOME ?? path.join(os.homedir(), ".zmy-cli");
}

export function normalizeEndpoint(endpoint: string): string {
  const trimmed = endpoint.trim().replace(/\/+$/, "");
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("unsupported protocol");
    }
    return url.toString().replace(/\/+$/, "");
  } catch {
    throw new CliError(
      "invalid_endpoint",
      `Invalid endpoint: ${endpoint}`,
      { hint: "Use a full URL such as http://127.0.0.1:8120" },
    );
  }
}

export async function getRuntimeProfile(
  _env: NodeJS.ProcessEnv = process.env,
): Promise<{ name: string; profile: Profile }> {
  return {
    name: DEFAULT_PROFILE_NAME,
    profile: { endpoint: normalizeEndpoint(DEFAULT_ENDPOINT) },
  };
}
