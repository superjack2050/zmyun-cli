import path from "node:path";
import { getCliHome } from "./config.js";
import { readJsonFile, writeJsonFile } from "./json-store.js";

export interface StoredCredential {
  access_token: string;
  refresh_token: string;
  token_type: string;
  scope: string;
  expires_at: string;
  updated_at: string;
}

export interface CredentialsFile {
  profiles: Record<string, StoredCredential>;
}

export function getCredentialsPath(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(getCliHome(env), "credentials.json");
}

export async function readCredentials(
  env: NodeJS.ProcessEnv = process.env,
): Promise<CredentialsFile> {
  return readJsonFile<CredentialsFile>(getCredentialsPath(env), { profiles: {} });
}

export async function writeCredentials(
  credentials: CredentialsFile,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  await writeJsonFile(getCredentialsPath(env), credentials);
}

export async function getCredential(
  profileName: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<StoredCredential | undefined> {
  const credentials = await readCredentials(env);
  return credentials.profiles[profileName];
}

export async function saveCredential(
  profileName: string,
  credential: StoredCredential,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const credentials = await readCredentials(env);
  credentials.profiles[profileName] = credential;
  await writeCredentials(credentials, env);
}

export async function removeCredential(
  profileName: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const credentials = await readCredentials(env);
  delete credentials.profiles[profileName];
  await writeCredentials(credentials, env);
}

export function credentialFromTokenMetadata(
  metadata: TokenMetadata,
  now = Date.now(),
): StoredCredential {
  return {
    access_token: metadata.access_token,
    refresh_token: metadata.refresh_token,
    token_type: metadata.token_type || "Bearer",
    scope: metadata.scope || "",
    expires_at: new Date(now + metadata.expires_in * 1000).toISOString(),
    updated_at: new Date(now).toISOString(),
  };
}

export function isExpiringSoon(
  credential: StoredCredential,
  now = Date.now(),
  skewMs = 60_000,
): boolean {
  return Date.parse(credential.expires_at) - now <= skewMs;
}

export function redactToken(token: string): string {
  if (token.length <= 12) {
    return "***";
  }
  return `${token.slice(0, 10)}...${token.slice(-4)}`;
}

export interface TokenMetadata {
  access_token: string;
  refresh_token: string;
  token_type?: string;
  expires_in: number;
  scope?: string;
}
