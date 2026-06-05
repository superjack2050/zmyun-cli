import os from "node:os";
import open from "open";
import {
  CLI_VERSION,
  CLIENT_ID,
  DEFAULT_SCOPE,
  DEVICE_CODE_GRANT,
} from "./constants.js";
import {
  credentialFromTokenMetadata,
  getCredential,
  removeCredential,
  saveCredential,
} from "./credentials.js";
import type { StoredCredential, TokenMetadata } from "./credentials.js";
import { CliError } from "./errors.js";
import { ApiClient, isOAuthMetadataError } from "./http.js";
import type { OAuthMetadataError } from "./http.js";

export interface DeviceCodeMetadata {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
}

export interface WhoamiMetadata {
  client_id: string;
  user_id: string;
  username: string;
  company_id: string;
  company_name: string;
  scope: string;
  expires_at: string;
}

export type TokenPollResult =
  | { type: "token"; credential: StoredCredential; metadata: TokenMetadata }
  | { type: "pending"; error: OAuthMetadataError }
  | { type: "slow_down"; error: OAuthMetadataError }
  | { type: "fatal"; error: OAuthMetadataError };

export async function createDeviceCode(
  client: ApiClient,
): Promise<DeviceCodeMetadata> {
  return client.request<DeviceCodeMetadata>("POST", "/api/v1/oauth/device/code", {
    auth: false,
    data: {
      client_id: CLIENT_ID,
      scope: DEFAULT_SCOPE,
      device: {
        name: os.hostname(),
        os: process.platform,
        arch: process.arch,
        cli_version: CLI_VERSION,
      },
    },
  });
}

export async function pollDeviceToken(
  client: ApiClient,
  deviceCode: string,
  now = Date.now(),
): Promise<TokenPollResult> {
  const metadata = await client.request<TokenMetadata | OAuthMetadataError>(
    "POST",
    "/api/v1/oauth/token",
    {
      auth: false,
      data: {
        grant_type: DEVICE_CODE_GRANT,
        client_id: CLIENT_ID,
        device_code: deviceCode,
      },
    },
  );

  return classifyTokenMetadata(metadata, now);
}

export function classifyTokenMetadata(
  metadata: TokenMetadata | OAuthMetadataError,
  now = Date.now(),
): TokenPollResult {
  if (!isOAuthMetadataError(metadata)) {
    return {
      type: "token",
      credential: credentialFromTokenMetadata(metadata, now),
      metadata,
    };
  }

  if (metadata.error === "authorization_pending") {
    return { type: "pending", error: metadata };
  }
  if (metadata.error === "slow_down") {
    return { type: "slow_down", error: metadata };
  }
  return { type: "fatal", error: metadata };
}

export async function loginWithDeviceFlow(options: {
  client: ApiClient;
  profileName: string;
  env?: NodeJS.ProcessEnv;
  openBrowser?: (url: string) => Promise<unknown>;
  write?: (message: string) => void;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}): Promise<StoredCredential> {
  const env = options.env ?? process.env;
  const write = options.write ?? console.log;
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? Date.now;
  const openBrowser = options.openBrowser ?? ((url: string) => open(url));
  const device = await createDeviceCode(options.client);
  const verificationUrl = options.client.resolveUrl(device.verification_uri_complete);

  write(`Open this URL to authorize zmy-cli: ${verificationUrl}`);
  write(`User code: ${device.user_code}`);

  try {
    await openBrowser(verificationUrl);
  } catch {
    write("Browser open failed. Use the URL above.");
  }

  let intervalSeconds = Math.max(1, Number(device.interval) || 2);
  const deadline = now() + Number(device.expires_in) * 1000;

  while (now() < deadline) {
    await sleep(intervalSeconds * 1000);
    const result = await pollDeviceToken(options.client, device.device_code, now());

    if (result.type === "token") {
      await saveCredential(options.profileName, result.credential, env);
      return result.credential;
    }

    if (result.type === "pending") {
      continue;
    }

    if (result.type === "slow_down") {
      intervalSeconds += 2;
      continue;
    }

    throw new CliError(
      result.error.error,
      result.error.error_description || "OAuth authorization failed.",
    );
  }

  throw new CliError("expired_token", "Device authorization expired.", {
    hint: "Run: zmy auth login",
  });
}

export async function whoami(client: ApiClient): Promise<WhoamiMetadata> {
  return client.request<WhoamiMetadata>("GET", "/api/v1/oauth/whoami", {
    requireAuth: true,
  });
}

export async function logout(options: {
  client: ApiClient;
  profileName: string;
  env?: NodeJS.ProcessEnv;
}): Promise<{ ok: boolean; revoked: boolean; warning?: string }> {
  const existing = await getCredential(options.profileName, options.env);
  if (!existing) {
    await removeCredential(options.profileName, options.env);
    return { ok: true, revoked: false };
  }

  try {
    const metadata = await options.client.request<{ ok?: boolean }>(
      "POST",
      "/api/v1/oauth/revoke",
      {
        requireAuth: true,
        data: { token: "" },
      },
    );
    await removeCredential(options.profileName, options.env);
    return { ok: true, revoked: metadata.ok !== false };
  } catch (error) {
    await removeCredential(options.profileName, options.env);
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: true,
      revoked: false,
      warning: `Local credentials were removed, but server revoke failed: ${message}`,
    };
  }
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
