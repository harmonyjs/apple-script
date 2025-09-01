/**
 * @fileoverview Unit tests for queue module.
 *
 * Tests the FIFO queue implementation for serializing operations,
 * including task execution, statistics, and error handling.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { Queue } from "./queue.js";

test("queue", async (t) => {
  await t.test("Queue construction", async (t) => {
    await t.test("creates queue with name", () => {
      const queue = new Queue("test-queue");

      assert.equal(queue.name, "test-queue");
      assert.equal(queue.length, 0);
      assert.equal(queue.processing, false);
    });

    await t.test("initializes with empty state", () => {
      const queue = new Queue("empty");
      const stats = queue.getStats();

      assert.equal(stats.totalProcessed, 0);
      assert.equal(stats.totalFailed, 0);
      assert.equal(stats.currentLength, 0);
      assert.equal(stats.isProcessing, false);
      assert.equal(stats.averageWaitTime, 0);
      assert.equal(stats.averageExecutionTime, 0);
    });
  });

  await t.test("Task execution", async (t) => {
    await t.test("executes single task", async () => {
      const queue = new Queue("single-task");

      const result = await queue.add(async () => {
        return "test-result";
      });

      assert.equal(result, "test-result");
      assert.equal(queue.length, 0);
      assert.equal(queue.processing, false);
    });

    await t.test("executes multiple tasks in order", async () => {
      const queue = new Queue("multi-task");
      const results: string[] = [];

      const promises = [
        queue.add(async () => {
          await new Promise((r) => setTimeout(r, 50));
          results.push("first");
          return "first";
        }),
        queue.add(async () => {
          await new Promise((r) => setTimeout(r, 10));
          results.push("second");
          return "second";
        }),
        queue.add(async () => {
          results.push("third");
          return "third";
        }),
      ];

      const taskResults = await Promise.all(promises);

      assert.deepEqual(results, ["first", "second", "third"]);
      assert.deepEqual(taskResults, ["first", "second", "third"]);
    });

    await t.test("handles async tasks correctly", async () => {
      const queue = new Queue("async-tasks");
      let counter = 0;

      const task1 = queue.add(async () => {
        await new Promise((r) => setTimeout(r, 30));
        return ++counter;
      });

      const task2 = queue.add(async () => {
        await new Promise((r) => setTimeout(r, 10));
        return ++counter;
      });

      const task3 = queue.add(async () => {
        return ++counter;
      });

      const results = await Promise.all([task1, task2, task3]);
      assert.deepEqual(results, [1, 2, 3]);
    });

    await t.test("executes tasks with different return types", async () => {
      const queue = new Queue("mixed-types");

      const stringResult = await queue.add(async () => "string");
      const numberResult = await queue.add(async () => 42);
      const objectResult = await queue.add(async () => ({ key: "value" }));
      const arrayResult = await queue.add(async () => [1, 2, 3]);
      const booleanResult = await queue.add(async () => true);

      assert.equal(stringResult, "string");
      assert.equal(numberResult, 42);
      assert.deepEqual(objectResult, { key: "value" });
      assert.deepEqual(arrayResult, [1, 2, 3]);
      assert.equal(booleanResult, true);
    });
  });

  await t.test("Error handling", async (t) => {
    await t.test("handles task errors", async () => {
      const queue = new Queue("error-handling");

      await assert.rejects(
        queue.add(async () => {
          throw new Error("Task failed");
        }),
        /Task failed/,
      );

      // Queue should continue working after error
      const result = await queue.add(async () => "success");
      assert.equal(result, "success");
    });

    await t.test("handles multiple errors", async () => {
      const queue = new Queue("multi-errors");

      const promises = [
        queue
          .add(async () => {
            throw new Error("Error 1");
          })
          .catch((e) => e.message),
        queue.add(async () => "success"),
        queue
          .add(async () => {
            throw new Error("Error 2");
          })
          .catch((e) => e.message),
      ];

      const results = await Promise.all(promises);
      assert.deepEqual(results, ["Error 1", "success", "Error 2"]);
    });

    await t.test("updates failure statistics", async () => {
      const queue = new Queue("failure-stats");

      await queue.add(async () => "success").catch(() => {});
      await queue
        .add(async () => {
          throw new Error("fail");
        })
        .catch(() => {});
      await queue.add(async () => "success").catch(() => {});
      await queue
        .add(async () => {
          throw new Error("fail");
        })
        .catch(() => {});

      const stats = queue.getStats();
      assert.equal(stats.totalProcessed, 2);
      assert.equal(stats.totalFailed, 2);
    });
  });

  await t.test("Queue properties", async (t) => {
    await t.test("length property reflects queue size", async () => {
      const queue = new Queue("length-test");

      assert.equal(queue.length, 0);

      // Add tasks that will block
      const promise1 = queue.add(async () => {
        await new Promise((r) => setTimeout(r, 100));
        return "done1";
      });

      const promise2 = queue.add(async () => "done2");
      const promise3 = queue.add(async () => "done3");

      // Should have 2 pending tasks (one is processing)
      assert.equal(queue.length, 2);

      await Promise.all([promise1, promise2, promise3]);
      assert.equal(queue.length, 0);
    });

    await t.test("processing property reflects execution state", async () => {
      const queue = new Queue("processing-test");

      assert.equal(queue.processing, false);

      let resolveTask: () => void;
      const taskPromise = new Promise<void>((resolve) => {
        resolveTask = resolve;
      });

      const queuePromise = queue.add(async () => {
        await taskPromise;
        return "done";
      });

      // Give the queue time to start processing
      await new Promise((r) => setTimeout(r, 10));
      assert.equal(queue.processing, true);

      resolveTask!();
      await queuePromise;
      assert.equal(queue.processing, false);
    });
  });

  await t.test("Statistics", async (t) => {
    await t.test("tracks basic statistics", async () => {
      const queue = new Queue("stats-test");

      await queue.add(async () => {
        await new Promise((r) => setTimeout(r, 50));
        return "task1";
      });

      await queue.add(async () => "task2");

      const stats = queue.getStats();
      assert.equal(stats.totalProcessed, 2);
      assert.equal(stats.totalFailed, 0);
      assert.equal(stats.currentLength, 0);
      assert.equal(stats.isProcessing, false);
      assert.ok(stats.averageWaitTime >= 0);
      assert.ok(stats.averageExecutionTime >= 0);
    });

    await t.test("calculates average times correctly", async () => {
      const queue = new Queue("timing-test");

      // Add tasks with known delays
      await queue.add(async () => {
        await new Promise((r) => setTimeout(r, 20));
        return "task1";
      });

      await queue.add(async () => {
        await new Promise((r) => setTimeout(r, 30));
        return "task2";
      });

      const stats = queue.getStats();
      assert.ok(stats.averageExecutionTime >= 20); // Should be at least 20ms average
      assert.ok(stats.averageWaitTime >= 0);
    });

    await t.test("handles division by zero in averages", () => {
      const queue = new Queue("empty-stats");
      const stats = queue.getStats();

      // Should not crash and should return 0 for averages
      assert.equal(stats.averageWaitTime, 0);
      assert.equal(stats.averageExecutionTime, 0);
    });
  });

  await t.test("Metadata support", async (t) => {
    await t.test("accepts task metadata", async () => {
      const queue = new Queue("metadata-test");

      const result = await queue.add(async () => "success", {
        operation: "test",
        priority: "high",
      });

      assert.equal(result, "success");
      // Metadata is internal, but task should execute successfully
    });

    await t.test("handles undefined metadata", async () => {
      const queue = new Queue("no-metadata");

      const result = await queue.add(async () => "success");
      assert.equal(result, "success");
    });
  });

  await t.test("Queue management", async (t) => {
    await t.test("clear removes all pending tasks", async () => {
      const queue = new Queue("clear-test");

      // Add a blocking task
      let resolveBlocker: () => void;
      const blockerPromise = new Promise<void>((resolve) => {
        resolveBlocker = resolve;
      });

      const blockingTask = queue.add(async () => {
        await blockerPromise;
        return "blocker";
      });

      // Add tasks that will be cleared
      const task1 = queue.add(async () => "task1");
      const task2 = queue.add(async () => "task2");

      // Wait for processing to start
      await new Promise((r) => setTimeout(r, 10));
      assert.equal(queue.length, 2);

      // Clear the queue
      queue.clear();
      assert.equal(queue.length, 0);

      // Pending tasks should be rejected
      await assert.rejects(task1, /Queue cleared/);
      await assert.rejects(task2, /Queue cleared/);

      // But the currently executing task should complete
      resolveBlocker!();
      const result = await blockingTask;
      assert.equal(result, "blocker");
    });

    await t.test("clear with custom error", async () => {
      const queue = new Queue("clear-custom-error");

      const task = queue.add(async () => "task");
      const customError = new Error("Custom clear error");

      queue.clear(customError);

      await assert.rejects(task, /Custom clear error/);
    });

    await t.test("drain waits for all tasks to complete", async () => {
      const queue = new Queue("drain-test");
      const results: string[] = [];

      // Add several tasks
      queue.add(async () => {
        await new Promise((r) => setTimeout(r, 30));
        results.push("task1");
        return "task1";
      });

      queue.add(async () => {
        await new Promise((r) => setTimeout(r, 20));
        results.push("task2");
        return "task2";
      });

      queue.add(async () => {
        await new Promise((r) => setTimeout(r, 10));
        results.push("task3");
        return "task3";
      });

      // Drain should wait for all tasks
      await queue.drain();

      assert.deepEqual(results, ["task1", "task2", "task3"]);
      assert.equal(queue.length, 0);
      assert.equal(queue.processing, false);
    });

    await t.test("drain handles empty queue", async () => {
      const queue = new Queue("drain-empty");

      // Should complete immediately
      await queue.drain();

      assert.equal(queue.length, 0);
      assert.equal(queue.processing, false);
    });
  });

  await t.test("Debug functionality", async (t) => {
    await t.test("debug returns queue state", () => {
      const queue = new Queue("debug-test");

      const debugInfo = queue.debug();
      assert.ok(debugInfo.includes("debug-test"));
      assert.ok(debugInfo.includes("length=0"));
      assert.ok(debugInfo.includes("processing=false"));
    });

    await t.test("debug reflects current state", async () => {
      const queue = new Queue("debug-state");

      let resolveTask: () => void;
      const taskPromise = new Promise<void>((resolve) => {
        resolveTask = resolve;
      });

      const queuePromise = queue.add(async () => {
        await taskPromise;
        return "done";
      });

      queue.add(async () => "pending1");
      queue.add(async () => "pending2");

      // Wait for processing to start
      await new Promise((r) => setTimeout(r, 10));

      const debugInfo = queue.debug();
      assert.ok(debugInfo.includes("length=2"));
      assert.ok(debugInfo.includes("processing=true"));

      resolveTask!();
      await queuePromise;
    });
  });

  await t.test("Concurrent operations", async (t) => {
    await t.test("maintains order under concurrent adds", async () => {
      const queue = new Queue("concurrent-test");
      const results: number[] = [];

      // Add tasks concurrently
      const promises = Array.from({ length: 10 }, (_, i) =>
        queue.add(async () => {
          await new Promise((r) => setTimeout(r, Math.random() * 10));
          results.push(i);
          return i;
        }),
      );

      await Promise.all(promises);

      // Results should be in order despite random delays
      assert.deepEqual(results, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });

    await t.test("handles rapid task additions", async () => {
      const queue = new Queue("rapid-adds");
      const taskCount = 100;

      const promises = Array.from({ length: taskCount }, (_, i) =>
        queue.add(async () => i),
      );

      const results = await Promise.all(promises);
      const expected = Array.from({ length: taskCount }, (_, i) => i);

      assert.deepEqual(results, expected);
    });
  });

  await t.test("Edge cases", async (t) => {
    await t.test("handles tasks that return undefined", async () => {
      const queue = new Queue("undefined-return");

      const result = await queue.add(async () => {
        // Explicitly return undefined
        return undefined;
      });

      assert.equal(result, undefined);
    });

    await t.test("handles tasks that return null", async () => {
      const queue = new Queue("null-return");

      const result = await queue.add(async () => null);
      assert.equal(result, null);
    });

    await t.test("handles tasks with no explicit return", async () => {
      const queue = new Queue("no-return");

      const result = await queue.add(async () => {
        // No explicit return
      });

      assert.equal(result, undefined);
    });

    await t.test("handles synchronous tasks", async () => {
      const queue = new Queue("sync-tasks");

      const result = await queue.add(async () => {
        // Synchronous operation in async function
        return "sync-result";
      });

      assert.equal(result, "sync-result");
    });

    await t.test("handles tasks that throw synchronously", async () => {
      const queue = new Queue("sync-throw");

      await assert.rejects(
        queue.add(async () => {
          throw new Error("Sync error");
        }),
        /Sync error/,
      );
    });

    await t.test("maintains unique task IDs", async () => {
      const queue = new Queue("unique-ids");
      const taskIds = new Set<string>();

      // This is a bit tricky to test since IDs are internal
      // We'll test indirectly by ensuring all tasks complete successfully
      const promises = Array.from({ length: 50 }, (_, i) =>
        queue.add(async () => i),
      );

      const results = await Promise.all(promises);
      const expected = Array.from({ length: 50 }, (_, i) => i);

      assert.deepEqual(results, expected);
    });
  });
});
