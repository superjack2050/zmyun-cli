export type BatchItemStatus =
  | "success"
  | "failed"
  | "skipped"
  | "unchanged"
  | "dry-run";

export interface BatchResultItem {
  id: string;
  status: BatchItemStatus;
  message: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

export interface BatchSummary {
  total: number;
  success: number;
  failed: number;
  skipped: number;
  unchanged: number;
  dry_run: number;
}

export interface BatchResult {
  operation: string;
  summary: BatchSummary;
  results: BatchResultItem[];
}

export function buildBatchResult(
  operation: string,
  results: BatchResultItem[],
): BatchResult {
  return {
    operation,
    summary: summarizeBatchResults(results),
    results,
  };
}

export function summarizeBatchResults(results: BatchResultItem[]): BatchSummary {
  const summary: BatchSummary = {
    total: results.length,
    success: 0,
    failed: 0,
    skipped: 0,
    unchanged: 0,
    dry_run: 0,
  };

  for (const result of results) {
    if (result.status === "dry-run") {
      summary.dry_run += 1;
    } else {
      summary[result.status] += 1;
    }
  }

  return summary;
}

export function batchHasFailures(result: BatchResult): boolean {
  return result.summary.failed > 0;
}

export function batchTableRows(result: BatchResult): Array<Record<string, unknown>> {
  return result.results.map((item) => ({
    ID: item.id,
    Status: item.status,
    Message: item.message,
    Workflow: item.before?.workflow ?? "",
    AI: item.before?.ai_editing_status ?? "",
    Project: item.after?.project_id ?? item.before?.project_id ?? "",
  }));
}
