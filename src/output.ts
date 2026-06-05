import { CliError } from "./errors.js";

export type OutputFormat = "json" | "table";

export function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

export function printByFormat(
  value: unknown,
  format: OutputFormat,
  tableRows?: Array<Record<string, unknown>>,
): void {
  if (format === "table") {
    console.table(tableRows ?? value);
    return;
  }
  printJson(value);
}

export function parseJsonObject(value: string, optionName: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("not an object");
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new CliError(
      "invalid_json",
      `${optionName} must be a JSON object.`,
      { hint: `${optionName} example: '{"page_size":10}'` },
    );
  }
}

export function assertFormat(format: string): OutputFormat {
  if (format === "json" || format === "table") {
    return format;
  }
  throw new CliError("invalid_format", `Unsupported format: ${format}`, {
    hint: "Use json or table.",
  });
}
