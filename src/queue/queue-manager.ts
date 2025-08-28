/**
 * @fileoverview Queue manager for handling multiple queues per appId.
 */
import { Queue } from "./queue";
import type { QueueStats } from "./queue";

/** Manager for multiple queues indexed by application ID. */
export class QueueManager {
  /** Map of appId to Queue instance */
  private queues = new Map<string, Queue>();

  /** Gets or creates a queue for the given application ID. */
  private getQueue(appId: string): Queue {
    let q = this.queues.get(appId);
    if (!q) {
      q = new Queue(appId);
      this.queues.set(appId, q);
    }
    return q;
  }

  /** Executes a task in the queue for the given application. */
  async execute<T>(
    appId: string,
    task: () => Promise<T>,
    metadata?: Record<string, any>,
  ): Promise<T> {
    const q = this.getQueue(appId);
    return q.add(task, metadata);
  }

  /** Gets statistics for a specific application queue. */
  getQueueStats(appId: string): QueueStats | null {
    const q = this.queues.get(appId);
    return q ? q.getStats() : null;
  }

  /** Gets statistics for all queues. */
  getAllStats(): Map<string, QueueStats> {
    const out = new Map<string, QueueStats>();
    for (const [id, q] of this.queues) {
      out.set(id, q.getStats());
    }
    return out;
  }

  /** Gets the total number of pending tasks across all queues. */
  getTotalPendingTasks(): number {
    let total = 0;
    for (const q of this.queues.values()) total += q.length;
    return total;
  }

  /** Checks if any queue is currently processing. */
  isAnyQueueProcessing(): boolean {
    for (const q of this.queues.values()) if (q.processing) return true;
    return false;
  }

  /** Clears all pending tasks for a specific application. */
  clearQueue(appId: string, rejectWith?: Error): void {
    const q = this.queues.get(appId);
    if (q) q.clear(rejectWith);
  }

  /** Clears all pending tasks across all queues. */
  clearAll(rejectWith?: Error): void {
    for (const q of this.queues.values()) q.clear(rejectWith);
  }

  /** Waits for all tasks in a specific queue to complete. */
  async drainQueue(appId: string): Promise<void> {
    const q = this.queues.get(appId);
    if (q) await q.drain();
  }

  /** Waits for all tasks in all queues to complete. */
  async drainAll(): Promise<void> {
    for (const q of this.queues.values()) await q.drain();
  }

  /** Removes a queue if it's empty and not processing. */
  pruneQueue(appId: string): boolean {
    const q = this.queues.get(appId);
    if (q && !q.processing && q.length === 0) {
      this.queues.delete(appId);
      return true;
    }
    return false;
  }

  /** Removes all empty queues that are not processing. */
  pruneAll(): number {
    let removed = 0;
    for (const [id, q] of this.queues) {
      if (!q.processing && q.length === 0) {
        this.queues.delete(id);
        removed += 1;
      }
    }
    return removed;
  }

  /** Gets debug information about all queues. */
  debug(): string {
    const lines: string[] = [];
    for (const [id, q] of this.queues) {
      lines.push(`${id}: ${q.debug()}`);
    }
    return lines.join("\n");
  }
}
