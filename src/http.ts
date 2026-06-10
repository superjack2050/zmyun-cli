import { CLIENT_ID } from "./constants.js";
import { getCredential, saveCredential } from "./credentials.js";
import type { StoredCredential, TokenMetadata } from "./credentials.js";
import { credentialFromTokenMetadata, isExpiringSoon } from "./credentials.js";
import { CliError } from "./errors.js";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface Envelope<T = unknown> {
  code: number;
  message: string;
  reason?: string;
  metadata: T;
}

export interface RequestOptions {
  params?: Record<string, unknown>;
  data?: unknown;
  formData?: FormData;
  auth?: boolean;
  requireAuth?: boolean;
  retryOnUnauthorized?: boolean;
}

export interface FetchResponseLike {
  status: number;
  text(): Promise<string>;
}

export type FetchLike = (
  input: string | URL,
  init?: RequestInit,
) => Promise<FetchResponseLike>;

export interface ApiClientOptions {
  endpoint: string;
  profileName?: string;
  env?: NodeJS.ProcessEnv;
  fetch?: FetchLike;
  requestId?: () => string;
  now?: () => number;
}

export class ApiClient {
  private endpoint: string;
  private profileName?: string;
  private env: NodeJS.ProcessEnv;
  private fetchImpl: FetchLike;
  private requestId: () => string;
  private now: () => number;

  constructor(options: ApiClientOptions) {
    this.endpoint = options.endpoint.replace(/\/+$/, "");
    this.profileName = options.profileName;
    this.env = options.env ?? process.env;
    this.fetchImpl = options.fetch ?? fetch;
    this.requestId = options.requestId ?? defaultRequestId;
    this.now = options.now ?? Date.now;
  }

  resolveUrl(pathOrUrl: string): string {
    return new URL(pathOrUrl, `${this.endpoint}/`).toString();
  }

  async request<T>(
    method: HttpMethod,
    apiPath: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const auth = options.auth ?? true;
    const retry = options.retryOnUnauthorized ?? true;

    if (auth) {
      await this.refreshIfNeeded(options.requireAuth ?? false);
    }

    const first = await this.send<T>(method, apiPath, options);
    if (
      first.status === 401 &&
      auth &&
      retry &&
      this.profileName &&
      (await getCredential(this.profileName, this.env))?.refresh_token
    ) {
      await this.refreshToken();
      return this.sendAndUnwrap<T>(method, apiPath, {
        ...options,
        retryOnUnauthorized: false,
      });
    }

    return unwrapResponse<T>(first.status, first.body);
  }

  async refreshToken(): Promise<StoredCredential> {
    if (!this.profileName) {
      throw new CliError("missing_profile", "No active profile configured.");
    }

    const credential = await getCredential(this.profileName, this.env);
    if (!credential?.refresh_token) {
      throw new CliError("missing_auth", "No refresh token stored.", {
        hint: "Run: zmy auth login",
      });
    }

    const response = await this.send<TokenMetadata>("POST", "/api/v1/oauth/token", {
      auth: false,
      retryOnUnauthorized: false,
      data: {
        grant_type: "refresh_token",
        client_id: CLIENT_ID,
        refresh_token: credential.refresh_token,
      },
    });
    const metadata = unwrapResponse<TokenMetadata | OAuthMetadataError>(
      response.status,
      response.body,
    );

    if (isOAuthMetadataError(metadata)) {
      throw new CliError(
        metadata.error,
        metadata.error_description || "Refresh token failed.",
      );
    }

    const next = credentialFromTokenMetadata(metadata, this.now());
    await saveCredential(this.profileName, next, this.env);
    return next;
  }

  private async refreshIfNeeded(requireAuth: boolean): Promise<void> {
    if (!this.profileName) {
      if (requireAuth) {
        throw new CliError("missing_profile", "No active profile configured.");
      }
      return;
    }

    const credential = await getCredential(this.profileName, this.env);
    if (!credential) {
      if (requireAuth) {
        throw new CliError("missing_auth", "No credentials stored.", {
          hint: "Run: zmy auth login",
        });
      }
      return;
    }

    if (credential.refresh_token && isExpiringSoon(credential, this.now())) {
      await this.refreshToken();
    }
  }

  private async sendAndUnwrap<T>(
    method: HttpMethod,
    apiPath: string,
    options: RequestOptions,
  ): Promise<T> {
    const response = await this.send<T>(method, apiPath, options);
    return unwrapResponse<T>(response.status, response.body);
  }

  private async send<T>(
    method: HttpMethod,
    apiPath: string,
    options: RequestOptions,
  ): Promise<{ status: number; body: unknown }> {
    const url = this.buildUrl(apiPath, options.params);
    const headers: Record<string, string> = {
      Accept: "application/json",
      RequestId: this.requestId(),
    };

    if (options.data !== undefined && options.formData !== undefined) {
      throw new CliError(
        "invalid_argument",
        "Request cannot include both JSON data and form data.",
      );
    }

    if (options.data !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    if (options.auth ?? true) {
      const credential = this.profileName
        ? await getCredential(this.profileName, this.env)
        : undefined;
      if (credential?.access_token) {
        headers.Authorization = `Bearer ${credential.access_token}`;
      }
    }

    const response = await this.fetchImpl(url, {
      method,
      headers,
      body: this.buildRequestBody(options),
    });
    const bodyText = await response.text();
    return {
      status: response.status,
      body: parseResponseBody<T>(bodyText, response.status),
    };
  }

  private buildUrl(apiPath: string, params?: Record<string, unknown>): string {
    const url = new URL(apiPath, `${this.endpoint}/`);
    for (const [key, value] of Object.entries(params ?? {})) {
      if (value === undefined || value === null || value === "") {
        continue;
      }
      url.searchParams.set(key, String(value));
    }
    return url.toString();
  }

  private buildRequestBody(options: RequestOptions): BodyInit | undefined {
    if (options.formData !== undefined) {
      return options.formData;
    }
    if (options.data !== undefined) {
      return JSON.stringify(options.data);
    }
    return undefined;
  }
}

export interface OAuthMetadataError {
  error: string;
  error_description?: string;
}

export function isOAuthMetadataError(
  metadata: unknown,
): metadata is OAuthMetadataError {
  return (
    typeof metadata === "object" &&
    metadata !== null &&
    "error" in metadata &&
    typeof metadata.error === "string" &&
    metadata.error.length > 0
  );
}

export function unwrapEnvelope<T>(body: unknown): T {
  if (
    typeof body === "object" &&
    body !== null &&
    "code" in body &&
    "metadata" in body
  ) {
    const envelope = body as Envelope<T>;
    if (envelope.code !== 200) {
      throw new CliError(
        envelope.reason || "backend_error",
        envelope.message || "Backend returned an error.",
        { details: envelope },
      );
    }
    return envelope.metadata;
  }

  throw new CliError("invalid_response", "Backend response is missing envelope.", {
    details: body,
  });
}

export function unwrapResponse<T>(status: number, body: unknown): T {
  if (status < 200 || status >= 300) {
    const details =
      typeof body === "object" && body !== null ? body : { body: String(body) };
    const message =
      "message" in details && typeof details.message === "string"
        ? details.message
        : `HTTP ${status}`;
    const reason =
      "reason" in details && typeof details.reason === "string"
        ? details.reason
        : "http_error";
    throw new CliError(reason, message, {
      status,
      details,
      hint:
        status === 403 || reason === "FORBIDDEN"
          ? "Run: zmy auth login to request the required scope."
          : undefined,
    });
  }
  return unwrapEnvelope<T>(body);
}

function parseResponseBody<T>(bodyText: string, status: number): T | unknown {
  if (!bodyText) {
    return {};
  }
  try {
    return JSON.parse(bodyText) as T;
  } catch {
    if (status < 200 || status >= 300) {
      return bodyText;
    }
    throw new CliError("invalid_json", "Backend returned invalid JSON.");
  }
}

function defaultRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
