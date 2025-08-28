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
  /** Unique identifier for the task */
  id: string;

  /** Function that performs the actual work */
  execute: () => Promise<T>;

  /** Promise resolver for the task result */
  resolve: (value: T) => void;

  /** Promise rejector for task errors */
  reject: (error: any) => void;

  /** Timestamp when task was enqueued */
  enqueuedAt: number;

  /** Optional metadata about the task */
  metadata?: Record<string, any>;
}

/**
 * Statistics about queue operations
 */
export interface QueueStats {
  /** Total tasks processed */
  totalProcessed: number;

  /** Total tasks failed */
  totalFailed: number;

  /** Current queue length */
  currentLength: number;

  /** Is queue currently processing */
  isProcessing: boolean;

  /** Average wait time in ms */
  averageWaitTime: number;

  /** Average execution time in ms */
  averageExecutionTime: number;
}

/**
 * FIFO queue for serializing async operations.
 */
export class Queue {
  private tasks: QueueTask<any>[] = [];
  private isProcessing = false;
  private nextTaskId = 1;

  // Statistics
  private stats = {
    totalProcessed: 0,
    totalFailed: 0,
    totalWaitTime: 0,
    totalExecutionTime: 0,
  };

  constructor(
    /** Name of the queue for debugging */
    public readonly name: string,
  ) {}

  /**
   * Adds a task to the queue.
   */
  async add<T>(
    execute: () => Promise<T>,
    metadata?: Record<string, any>,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const id = `${this.name}-${this.nextTaskId++}`;
      const task: QueueTask<any> = {
        id,
        execute: execute as any,
        resolve: resolve as any,
        reject,
        enqueuedAt: Date.now(),
        metadata,
      };
      this.tasks.push(task);
      void this.process();
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

  /** Gets the current queue length. */
  get length(): number {
    return this.tasks.length;
  }

  /** Checks if the queue is currently processing a task. */
  get processing(): boolean {
    return this.isProcessing;
  }

  /** Gets queue statistics. */
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
   * Does not affect the currently executing task.
   */
  clear(rejectWith?: Error): void {
    const err = rejectWith ?? new Error("Queue cleared");
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

  /** Gets debug information about the queue state. */
  debug(): string {
    return `Queue(${this.name}): length=${this.tasks.length}, processing=${this.isProcessing}`;
  }
}
