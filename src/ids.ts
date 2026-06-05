import { CliError } from "./errors.js";

export function resolveIds(
  resource: string,
  positionalId: string | undefined,
  idsOption: string | undefined,
): string[] {
  if (positionalId && idsOption) {
    throw new CliError("invalid_argument", `Conflicting ${resource} ids.`, {
      hint: `Use either positional id or --ids, not both.`,
    });
  }

  const rawIds = positionalId ? [positionalId] : splitIds(idsOption);
  if (rawIds.length === 0) {
    throw new CliError("invalid_argument", `${resource} id is required.`, {
      hint: `Use positional id or --ids <ids>.`,
    });
  }

  const ids: string[] = [];
  const seen = new Set<string>();
  for (const rawId of rawIds) {
    const id = rawId.trim();
    if (!id) {
      throw new CliError("invalid_argument", `${resource} id cannot be empty.`);
    }
    toPositiveIntegerId(id, `${resource} id`);
    if (!seen.has(id)) {
      ids.push(id);
      seen.add(id);
    }
  }

  return ids;
}

export function toPositiveIntegerId(value: string, name: string): number {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) {
    throw new CliError("invalid_argument", `${name} must be a positive integer`);
  }
  return number;
}

function splitIds(value: string | undefined): string[] {
  if (value === undefined) {
    return [];
  }
  return value.split(",");
}
