/**
 * @fileoverview FIFO queue implementation for serializing operations.
 *
 * This module provides a promise-based queue that ensures operations
 * are executed sequentially. This is critical for AppleScript operations
 * targeting the same application, as parallel Apple Events can cause
 * conflicts and errors.
 */

/**
 * Task to be executed in the queue
 */
export interface QueueTask<T = unknown> {
  /**
   * Unique identifier for the task
   */
  id: string;

  /**
   * Function that performs the actual work
   */
  execute: () => Promise<T>;

  /**
   * Promise resolver for the task result
   */
  resolve: (value: T) => void;

  /**
   * Promise rejector for task errors
   */
  reject: (error: unknown) => void;

  /**
   * Timestamp when task was enqueued
   */
  enqueuedAt: number;

  /**
   * Queue clear epoch when task was enqueued
   */
  epoch: number;

  /**
   * Optional metadata about the task
   */
  metadata?: Record<string, unknown>;
}

/**
 * Statistics about queue operations
 */
export interface QueueStats {
  /**
   * Total tasks processed
   */
  totalProcessed: number;

  /**
   * Total tasks failed
   */
  totalFailed: number;

  /**
   * Current queue length
   */
  currentLength: number;

  /**
   * Is queue currently processing
   */
  isProcessing: boolean;

  /**
   * Average wait time in ms
   */
  averageWaitTime: number;

  /**
   * Average execution time in ms
   */
  averageExecutionTime: number;
}

/**
 * FIFO queue for serializing async operations.
 *
 * Behavior highlights:
 * - Tasks are executed strictly in FIFO order, one at a time.
 * - Task processing is deferred to a microtask after add(), so consumers can
 *   synchronously call clear() immediately after add() without a race where
 *   the task starts first.
 * - clear() increments an internal epoch and rejects any pending tasks that
 *   were enqueued prior to the clear, even if they were already dequeued for
 *   execution but haven't started running yet.
 * - The `length` getter reflects the number of pending tasks and intentionally
 *   excludes a task whose processing has been scheduled but not started yet.
 *   This aligns with the user-facing notion of "pending" work.
 */
export class Queue {
  private tasks: QueueTask<any>[] = [];
  private isProcessing = false;
  private nextTaskId = 1;
  /**
   * Whether a processing microtask has been scheduled but not started yet
   */
  private processingScheduled = false;
  /**
   * Monotonic counter incremented on each clear to mark cut-off for pending tasks
   */
  private clearEpoch = 0;
  /**
   * Error used for the last clear() invocation
   */
  private lastClearError: Error | null = null;

  // Statistics
  private stats = {
    totalProcessed: 0,
    totalFailed: 0,
    totalWaitTime: 0,
    totalExecutionTime: 0,
  };

  constructor(
    /**
     * Name of the queue for debugging
     */
    public readonly name: string,
  ) {}

  /**
   * Adds a task to the queue.
   */
  async add<T>(
    execute: () => Promise<T>,
    metadata?: Record<string, unknown>,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const id = `${this.name}-${this.nextTaskId++}`;
      const resolveTask = (value: T) => resolve(value);
      const task: QueueTask<unknown> = {
        id,
        execute: async () => execute(),
        resolve: (value) => resolveTask(value as T),
        reject,
        enqueuedAt: Date.now(),
        epoch: this.clearEpoch,
        metadata,
      };
      this.tasks.push(task);
      // Defer processing to the microtask queue so callers can synchronously
      // call clear() right after add() without races where the task starts first.
      if (!this.isProcessing && !this.processingScheduled) {
        this.processingScheduled = true;
        queueMicrotask(() => {
          this.processingScheduled = false;
          void this.process();
        });
      }
    });
  }

  /**
   * Processes the queue.
   */
  private async process(): Promise<void> {
    // If already processing or queue is empty, return
    if (this.isProcessing || this.tasks.length === 0) return;

    this.isProcessing = true;

    while (this.tasks.length > 0) {
      const task = this.tasks.shift()!;
      const start = Date.now();
      const wait = start - task.enqueuedAt;
      try {
        // If the task was enqueued before the most recent clear(), reject it instead of executing
        if (task.epoch < this.clearEpoch) {
          const err = this.lastClearError ?? new Error("Queue cleared");
          task.reject(err);
          continue;
        }
        const result = await task.execute();
        const execTime = Date.now() - start;
        this.stats.totalProcessed += 1;
        this.stats.totalWaitTime += wait;
        this.stats.totalExecutionTime += execTime;
        task.resolve(result);
      } catch (err) {
        this.stats.totalFailed += 1;
        task.reject(err);
      }
    }
    this.isProcessing = false;
  }

  /**
   * Gets the current queue length.
   *
   * Semantics: returns the number of pending tasks waiting to run and excludes
   * a task whose processing is scheduled (via microtask) but not started yet.
   * This matches the typical expectation that the in-flight (or imminently
   * in-flight) task is not counted as "pending".
   *
   * Note: `getStats().currentLength` reports the raw internal queue size
   * without this adjustment.
   */
  get length(): number {
    // If processing is scheduled but not started, one task will imminently be
    // taken for execution; for user-facing semantics this matches the previous
    // eager-processing behavior where length excluded the in-flight task.
    return Math.max(0, this.tasks.length - (this.processingScheduled ? 1 : 0));
  }

  /**
   * Checks if the queue is currently processing a task.
   */
  get processing(): boolean {
    return this.isProcessing;
  }

  /**
   * Gets queue statistics.
   */
  getStats(): QueueStats {
    const total = this.stats.totalProcessed || 1;
    return {
      totalProcessed: this.stats.totalProcessed,
      totalFailed: this.stats.totalFailed,
      currentLength: this.tasks.length,
      isProcessing: this.isProcessing,
      averageWaitTime: this.stats.totalWaitTime / total,
      averageExecutionTime: this.stats.totalExecutionTime / total,
    };
  }

  /**
   * Clears all pending tasks from the queue.
   *
   * - Rejects all tasks that are still enqueued.
   * - Also marks an internal epoch so that any task dequeued concurrently but
   *   not yet executed is rejected with the provided error instead of running.
   * - Does not interrupt the currently executing task.
   */
  clear(rejectWith?: Error): void {
    const err = rejectWith ?? new Error("Queue cleared");
    // Advance the epoch so any task popped concurrently but not yet executed is rejected
    this.clearEpoch += 1;
    this.lastClearError = err;
    while (this.tasks.length > 0) {
      const t = this.tasks.shift()!;
      t.reject(err);
    }
  }

  /**
   * Waits for all current tasks to complete.
   * Does not wait for tasks added after this call.
   */
  async drain(): Promise<void> {
    while (this.isProcessing || this.tasks.length > 0) {
      // Sleep briefly
      await new Promise((r) => setTimeout(r, 10));
    }
  }

  /**
   * Gets debug information about the queue state.
   */
  debug(): string {
    return `Queue(${this.name}): length=${this.tasks.length}, processing=${this.isProcessing}`;
  }
}
