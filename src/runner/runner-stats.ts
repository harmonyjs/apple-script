import type { PayloadKind } from "../engine/protocol/constants.js";
import type { RunnerStats } from "./types.js";

/**
 * Small helper to track and expose runner statistics.
 */
export class RunnerStatsManager {
  private stats: RunnerStats = {
    totalOperations: 0,
    successfulOperations: 0,
    failedOperations: 0,
    operationsByKind: {
      scalar: 0,
      action: 0,
      rows: 0,
      sections: 0,
    },
    totalExecutionTime: 0,
    totalRetries: 0,
  };

  onStart(kind: PayloadKind): void {
    this.stats.totalOperations += 1;
    this.stats.operationsByKind[kind] += 1;
  }

  onSuccess(tookMs: number): void {
    this.stats.successfulOperations += 1;
    this.stats.totalExecutionTime += tookMs;
  }

  onFailure(tookMs: number): void {
    this.stats.failedOperations += 1;
    this.stats.totalExecutionTime += tookMs;
  }

  onRetryAttempt(): void {
    this.stats.totalRetries += 1;
  }

  getStats(): RunnerStats {
    return {
      ...this.stats,
      operationsByKind: { ...this.stats.operationsByKind },
    };
  }
}