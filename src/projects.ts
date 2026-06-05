import { ApiClient } from "./http.js";
import { CliError } from "./errors.js";
import type { ChoiceOption } from "./collections.js";

export interface ProjectListMetadata {
  total: string | number;
  projects: Array<Record<string, unknown>>;
}

export interface ProjectListOptions {
  page?: string | number;
  size?: string | number;
  name?: string;
  status?: string;
  member?: string;
  creator?: string;
}

export interface ProjectKeywords {
  core_main?: string[];
  feature_attribute?: string[];
  scenario_audience_purpose?: string[];
  appearance_visual?: string[];
  long_tail?: string[];
}

export interface NormalizedProjectKeywords {
  core_main: string[];
  feature_attribute: string[];
  scenario_audience_purpose: string[];
  appearance_visual: string[];
  long_tail: string[];
}

export interface CreateProjectOptions {
  name: string;
  remark?: string;
}

export interface UpdateProjectOptions {
  name?: string;
  remark?: string;
  owner?: string;
  keywords?: ProjectKeywords;
}

export const PROJECT_STATUS_OPTIONS: ChoiceOption[] = [
  {
    name: "progressing",
    value: 1,
    description: "Project is in progress.",
    aliases: ["progressing", "Progressing", "active"],
  },
  {
    name: "completed",
    value: 2,
    description: "Project is completed.",
    aliases: ["completed", "Completed", "done"],
  },
  {
    name: "discard",
    value: 3,
    description: "Project is discarded.",
    aliases: ["discard", "discarded", "Discard"],
  },
];

const PROJECT_KEYWORD_FIELDS = [
  "core_main",
  "feature_attribute",
  "scenario_audience_purpose",
  "appearance_visual",
  "long_tail",
] as const;

const LEGACY_KEYWORD_FIELDS = new Set([
  "longTail",
  "coreKeywords",
  "featureKeywords",
  "audienceKeywords",
  "shapeStyleAppearance",
  "longTailCombinations",
]);

export function buildProjectListParams(
  options: ProjectListOptions = {},
): Record<string, unknown> {
  const page = toPositiveInteger(options.page ?? 1, "page");
  const size = toPositiveInteger(options.size ?? 20, "size");

  return omitEmpty({
    page_offset: page - 1,
    page_size: size,
    name: options.name,
    status: normalizeProjectStatus(options.status),
    project_member: options.member,
    creator: options.creator,
  });
}

export function buildProjectListRequest(
  options: ProjectListOptions = {},
): { path: string; params: Record<string, unknown> } {
  return {
    path: "/api/v1/develop/project/get_all_list",
    params: buildProjectListParams(options),
  };
}

export function buildProjectDetailRequest(id: string): {
  path: string;
  params: Record<string, unknown>;
} {
  return {
    path: "/api/v1/develop/project/get_info_by_id",
    params: { id },
  };
}

export function buildCreateProjectRequest(
  options: CreateProjectOptions,
): { path: string; data: Record<string, unknown> } {
  const name = normalizeProjectName(options.name);
  const data: Record<string, unknown> = { name };
  if (options.remark !== undefined) {
    data.remark = options.remark;
  }
  return {
    path: "/api/v1/develop/project",
    data,
  };
}

export async function createProject(
  client: ApiClient,
  options: CreateProjectOptions,
): Promise<Record<string, unknown>> {
  const request = buildCreateProjectRequest(options);
  const metadata = await client.request("POST", request.path, {
    data: request.data,
    requireAuth: true,
  });
  return normalizeProjectMetadata(metadata);
}

export function buildUpdateProjectRequest(
  projectId: string,
  options: UpdateProjectOptions,
): { path: string; data: Record<string, unknown> } {
  const id = String(toPositiveInteger(projectId, "project id"));
  const data: Record<string, unknown> = {};
  const updateMask: string[] = [];

  if (options.name !== undefined) {
    data.name = normalizeProjectName(options.name);
    updateMask.push("name");
  }
  if (options.remark !== undefined) {
    data.remark = options.remark;
    updateMask.push("remark");
  }
  if (options.owner !== undefined) {
    data.owner = options.owner.trim();
    updateMask.push("owner");
  }
  if (options.keywords !== undefined) {
    data.keywords = normalizeProjectKeywords(options.keywords);
    updateMask.push("keywords");
  }

  if (updateMask.length === 0) {
    throw new CliError("invalid_argument", "At least one project update field is required.", {
      hint: "Use --name, --remark, --owner, or --keywords-file.",
    });
  }

  return {
    path: `/api/v1/develop/project/${encodeURIComponent(id)}`,
    data: {
      ...data,
      update_mask: updateMask,
    },
  };
}

export async function updateProject(
  client: ApiClient,
  projectId: string,
  options: UpdateProjectOptions,
): Promise<Record<string, unknown>> {
  const request = buildUpdateProjectRequest(projectId, options);
  const metadata = await client.request("PATCH", request.path, {
    data: request.data,
    requireAuth: true,
  });
  return normalizeProjectMetadata(metadata);
}

export async function listProjects(
  client: ApiClient,
  options: ProjectListOptions = {},
): Promise<ProjectListMetadata> {
  const request = buildProjectListRequest(options);
  const result = await client.request<ProjectListMetadata>("GET", request.path, {
    params: request.params,
    requireAuth: true,
  });
  return {
    ...result,
    projects: (result.projects ?? []).map(normalizeProjectMetadata),
  };
}

export async function getProject(
  client: ApiClient,
  id: string,
): Promise<Record<string, unknown>> {
  const request = buildProjectDetailRequest(id);
  const metadata = await client.request("GET", request.path, {
    params: request.params,
    requireAuth: true,
  });
  return normalizeProjectMetadata(metadata);
}

export function projectTableRows(
  projects: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  return projects.map((project) => ({
    ID: pick(project, ["id", "project_id"]),
    Name: pick(project, ["name", "project_name", "title"]),
    Owner: pickOwner(project),
    Creator: pick(project, ["creator", "creator_name"]),
    Status: formatProjectStatus(pick(project, ["status", "project_status"])),
    Collections: pick(project, ["collection_total"]),
    Finished: pick(project, ["finished_count"]),
    UpdatedAt: pick(project, ["updated_at", "update_time"]),
  }));
}

export function projectWriteTableRows(
  projects: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  return projects.map((project) => ({
    ID: pick(project, ["id", "project_id"]),
    Name: pick(project, ["name", "project_name", "title"]),
    Owner: pickOwner(project),
    Creator: pick(project, ["creator", "creator_name"]),
    Status: formatProjectStatus(pick(project, ["status", "project_status"])),
    Remark: pick(project, ["remark"]),
    UpdatedAt: pick(project, ["updated_at", "update_time"]),
  }));
}

export function projectStatusTableRows(): Array<Record<string, unknown>> {
  return PROJECT_STATUS_OPTIONS.map((option) => ({
    Name: option.name,
    Value: option.value,
    Description: option.description,
    Aliases: option.aliases.join(", "),
  }));
}

export function normalizeProjectKeywords(value: unknown): NormalizedProjectKeywords {
  const source = asRecord(value, "keywords");
  const unknownFields = Object.keys(source).filter(
    (key) => !PROJECT_KEYWORD_FIELDS.includes(key as (typeof PROJECT_KEYWORD_FIELDS)[number]),
  );
  if (unknownFields.length > 0) {
    const legacyFields = unknownFields.filter((field) => LEGACY_KEYWORD_FIELDS.has(field));
    throw new CliError(
      "invalid_argument",
      legacyFields.length > 0
        ? `Project keywords use legacy field names: ${legacyFields.join(", ")}`
        : `Project keywords contain unknown fields: ${unknownFields.join(", ")}`,
      {
        hint: `Use only: ${PROJECT_KEYWORD_FIELDS.join(", ")}`,
      },
    );
  }

  const keywords = emptyProjectKeywords();
  for (const field of PROJECT_KEYWORD_FIELDS) {
    const value = source[field];
    if (value === undefined) {
      continue;
    }
    if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
      throw new CliError("invalid_argument", `keywords.${field} must be an array of strings`);
    }
    keywords[field] = value;
  }
  return keywords;
}

export function normalizeProjectMetadata(value: unknown): Record<string, unknown> {
  const project = asRecord(value, "project metadata");
  const normalized: Record<string, unknown> = { ...project };
  if (project.keywords !== undefined) {
    normalized.keywords = normalizeProjectKeywordsForOutput(project.keywords);
  }
  return normalized;
}

function pick(
  source: Record<string, unknown>,
  keys: string[],
): unknown {
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null) {
      return source[key];
    }
  }
  return "";
}

function pickOwner(source: Record<string, unknown>): unknown {
  const owner = pick(source, ["owner", "owner_name"]);
  if (owner !== "") {
    return owner;
  }

  const member = pick(source, ["project_member", "project_members"]);
  if (Array.isArray(member)) {
    return member[0] ?? "";
  }
  return member;
}

function normalizeProjectName(value: string | undefined): string {
  const name = (value ?? "").trim();
  if (!name) {
    throw new CliError("invalid_argument", "project name cannot be empty");
  }
  return name;
}

function asRecord(value: unknown, name: string): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  throw new CliError("invalid_argument", `${name} must be a JSON object`);
}

function emptyProjectKeywords(): NormalizedProjectKeywords {
  return {
    core_main: [],
    feature_attribute: [],
    scenario_audience_purpose: [],
    appearance_visual: [],
    long_tail: [],
  };
}

function normalizeProjectKeywordsForOutput(value: unknown): NormalizedProjectKeywords {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return emptyProjectKeywords();
  }
  const source = value as Record<string, unknown>;
  return {
    core_main: pickStringArray(source, ["core_main", "coreKeywords"]),
    feature_attribute: pickStringArray(source, ["feature_attribute", "featureKeywords"]),
    scenario_audience_purpose: pickStringArray(source, [
      "scenario_audience_purpose",
      "audienceKeywords",
    ]),
    appearance_visual: pickStringArray(source, [
      "appearance_visual",
      "shapeStyleAppearance",
    ]),
    long_tail: pickStringArray(source, [
      "long_tail",
      "longTail",
      "longTailCombinations",
    ]),
  };
}

function pickStringArray(source: Record<string, unknown>, keys: string[]): string[] {
  const value = pick(source, keys);
  if (value === "") {
    return [];
  }
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

function toPositiveInteger(value: string | number, name: string): number {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) {
    throw new CliError("invalid_argument", `${name} must be a positive integer`);
  }
  return number;
}

function normalizeProjectStatus(value: string | undefined): number | undefined {
  if (value === undefined || value === "") {
    return undefined;
  }

  const numeric = Number(value);
  const knownValues = new Set(PROJECT_STATUS_OPTIONS.map((option) => option.value));
  if (Number.isInteger(numeric)) {
    if (knownValues.has(numeric)) {
      return numeric;
    }
    throw new CliError("invalid_argument", `Unsupported project status: ${value}`, {
      hint: `Use one of: ${PROJECT_STATUS_OPTIONS.map((option) => option.name).join(", ")}`,
    });
  }

  const normalized = normalizeKey(value);
  const option = PROJECT_STATUS_OPTIONS.find(
    (candidate) =>
      normalizeKey(candidate.name) === normalized ||
      candidate.aliases.some((alias) => normalizeKey(alias) === normalized),
  );
  if (!option) {
    throw new CliError("invalid_argument", `Unsupported project status: ${value}`, {
      hint: `Use one of: ${PROJECT_STATUS_OPTIONS.map((candidate) => candidate.name).join(", ")}`,
    });
  }
  return option.value;
}

function formatProjectStatus(value: unknown): unknown {
  if (value === "" || value === undefined || value === null) {
    return "";
  }

  let normalized: number | undefined;
  if (typeof value === "string") {
    const numeric = Number(value);
    if (Number.isInteger(numeric)) {
      normalized = numeric;
    } else {
      const key = normalizeKey(value);
      normalized = PROJECT_STATUS_OPTIONS.find(
        (option) =>
          normalizeKey(option.name) === key ||
          option.aliases.some((alias) => normalizeKey(alias) === key),
      )?.value;
    }
  } else {
    const numeric = Number(value);
    normalized = Number.isInteger(numeric) ? numeric : undefined;
  }

  if (normalized === undefined) {
    return value;
  }
  return PROJECT_STATUS_OPTIONS.find((option) => option.value === normalized)?.name ?? value;
}

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function omitEmpty(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== ""),
  );
}
