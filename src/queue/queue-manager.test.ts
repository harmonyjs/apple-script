/**
 * @fileoverview Unit tests for queue-manager module.
 * 
 * Tests the queue manager that handles multiple queues per appId,
 * including queue creation, task execution, and management operations.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { QueueManager } from "./queue-manager.js";

test("queue-manager", async (t) => {
  await t.test("QueueManager construction", async (t) => {
    await t.test("creates empty queue manager", () => {
      const manager = new QueueManager();
      
      assert.equal(manager.getTotalPendingTasks(), 0);
      assert.equal(manager.isAnyQueueProcessing(), false);
    });
  });

  await t.test("Queue creation and management", async (t) => {
    await t.test("creates queue on first use", async () => {
      const manager = new QueueManager();
      
      const result = await manager.execute("com.apple.Safari", async () => "test");
      
      assert.equal(result, "test");
      
      const stats = manager.getQueueStats("com.apple.Safari");
      assert.ok(stats);
      assert.equal(stats.totalProcessed, 1);
    });

    await t.test("reuses existing queue", async () => {
      const manager = new QueueManager();
      
      await manager.execute("com.apple.Safari", async () => "first");
      await manager.execute("com.apple.Safari", async () => "second");
      
      const stats = manager.getQueueStats("com.apple.Safari");
      assert.ok(stats);
      assert.equal(stats.totalProcessed, 2);
    });

    await t.test("creates separate queues for different appIds", async () => {
      const manager = new QueueManager();
      
      await manager.execute("com.apple.Safari", async () => "safari");
      await manager.execute("com.google.Chrome", async () => "chrome");
      
      const safariStats = manager.getQueueStats("com.apple.Safari");
      const chromeStats = manager.getQueueStats("com.google.Chrome");
      
      assert.ok(safariStats);
      assert.ok(chromeStats);
      assert.equal(safariStats.totalProcessed, 1);
      assert.equal(chromeStats.totalProcessed, 1);
    });
  });

  await t.test("Task execution", async (t) => {
    await t.test("executes tasks with different return types", async () => {
      const manager = new QueueManager();
      
      const stringResult = await manager.execute("app1", async () => "string");
      const numberResult = await manager.execute("app1", async () => 42);
      const objectResult = await manager.execute("app1", async () => ({ key: "value" }));
      const arrayResult = await manager.execute("app1", async () => [1, 2, 3]);
      
      assert.equal(stringResult, "string");
      assert.equal(numberResult, 42);
      assert.deepEqual(objectResult, { key: "value" });
      assert.deepEqual(arrayResult, [1, 2, 3]);
    });

    await t.test("executes tasks with metadata", async () => {
      const manager = new QueueManager();
      
      const result = await manager.execute(
        "com.apple.Safari",
        async () => "success",
        { operation: "test", retry: 0 }
      );
      
      assert.equal(result, "success");
    });

    await t.test("maintains execution order per appId", async () => {
      const manager = new QueueManager();
      const results: string[] = [];
      
      const promises = [
        manager.execute("app1", async () => {
          await new Promise(r => setTimeout(r, 50));
          results.push("app1-first");
          return "app1-first";
        }),
        manager.execute("app1", async () => {
          await new Promise(r => setTimeout(r, 10));
          results.push("app1-second");
          return "app1-second";
        }),
        manager.execute("app2", async () => {
          await new Promise(r => setTimeout(r, 30));
          results.push("app2-first");
          return "app2-first";
        }),
      ];
      
      await Promise.all(promises);
      
      // app1 tasks should be in order, app2 can be anywhere
      const app1Results = results.filter(r => r.startsWith("app1"));
      assert.deepEqual(app1Results, ["app1-first", "app1-second"]);
      assert.ok(results.includes("app2-first"));
    });

    await t.test("handles task errors", async () => {
      const manager = new QueueManager();
      
      await assert.rejects(
        manager.execute("app1", async () => {
          throw new Error("Task failed");
        }),
        /Task failed/
      );
      
      // Queue should continue working after error
      const result = await manager.execute("app1", async () => "success");
      assert.equal(result, "success");
    });
  });

  await t.test("Statistics", async (t) => {
    await t.test("getQueueStats returns null for non-existent queue", () => {
      const manager = new QueueManager();
      
      const stats = manager.getQueueStats("non-existent");
      assert.equal(stats, null);
    });

    await t.test("getQueueStats returns correct stats", async () => {
      const manager = new QueueManager();
      
      await manager.execute("app1", async () => "task1");
      await manager.execute("app1", async () => "task2");
      
      const stats = manager.getQueueStats("app1");
      assert.ok(stats);
      assert.equal(stats.totalProcessed, 2);
      assert.equal(stats.totalFailed, 0);
      assert.equal(stats.currentLength, 0);
      assert.equal(stats.isProcessing, false);
    });

    await t.test("getAllStats returns all queue statistics", async () => {
      const manager = new QueueManager();
      
      await manager.execute("app1", async () => "task1");
      await manager.execute("app2", async () => "task2");
      await manager.execute("app1", async () => "task3");
      
      const allStats = manager.getAllStats();
      
      assert.equal(allStats.size, 2);
      assert.ok(allStats.has("app1"));
      assert.ok(allStats.has("app2"));
      
      const app1Stats = allStats.get("app1");
      const app2Stats = allStats.get("app2");
      
      assert.ok(app1Stats);
      assert.ok(app2Stats);
      assert.equal(app1Stats.totalProcessed, 2);
      assert.equal(app2Stats.totalProcessed, 1);
    });

    await t.test("getTotalPendingTasks counts across all queues", async () => {
      const manager = new QueueManager();
      
      // Add blocking tasks
      let resolveBlocker1: () => void;
      let resolveBlocker2: () => void;
      
      const blocker1Promise = new Promise<void>(resolve => {
        resolveBlocker1 = resolve;
      });
      const blocker2Promise = new Promise<void>(resolve => {
        resolveBlocker2 = resolve;
      });
      
      const task1 = manager.execute("app1", async () => {
        await blocker1Promise;
        return "app1-blocker";
      });
      
      const task2 = manager.execute("app2", async () => {
        await blocker2Promise;
        return "app2-blocker";
      });
      
      // Add pending tasks
      const pending1 = manager.execute("app1", async () => "app1-pending");
      const pending2 = manager.execute("app1", async () => "app1-pending2");
      const pending3 = manager.execute("app2", async () => "app2-pending");
      
      // Wait for processing to start
      await new Promise(r => setTimeout(r, 10));
      
      // Should have 3 pending tasks (2 for app1, 1 for app2)
      assert.equal(manager.getTotalPendingTasks(), 3);
      
      // Resolve blockers
      resolveBlocker1!();
      resolveBlocker2!();
      
      await Promise.all([task1, task2, pending1, pending2, pending3]);
      
      assert.equal(manager.getTotalPendingTasks(), 0);
    });

    await t.test("isAnyQueueProcessing detects processing state", async () => {
      const manager = new QueueManager();
      
      assert.equal(manager.isAnyQueueProcessing(), false);
      
      let resolveTask: () => void;
      const taskPromise = new Promise<void>(resolve => {
        resolveTask = resolve;
      });
      
      const queuePromise = manager.execute("app1", async () => {
        await taskPromise;
        return "done";
      });
      
      // Wait for processing to start
      await new Promise(r => setTimeout(r, 10));
      assert.equal(manager.isAnyQueueProcessing(), true);
      
      resolveTask!();
      await queuePromise;
      assert.equal(manager.isAnyQueueProcessing(), false);
    });
  });

  await t.test("Queue management operations", async (t) => {
    await t.test("clearQueue clears specific queue", async () => {
      const manager = new QueueManager();
      
      // Add blocking task to app1
      let resolveBlocker: () => void;
      const blockerPromise = new Promise<void>(resolve => {
        resolveBlocker = resolve;
      });
      
      const blockingTask = manager.execute("app1", async () => {
        await blockerPromise;
        return "blocker";
      });
      
      // Add pending tasks to both apps
      const app1Task = manager.execute("app1", async () => "app1-task");
      const app2Task = manager.execute("app2", async () => "app2-task");
      
      // Wait for processing to start
      await new Promise(r => setTimeout(r, 10));
      
      // Clear app1 queue
      manager.clearQueue("app1");
      
      // app1 pending task should be rejected
      await assert.rejects(app1Task, /Queue cleared/);
      
      // app2 task should complete normally
      const app2Result = await app2Task;
      assert.equal(app2Result, "app2-task");
      
      // Currently executing app1 task should complete
      resolveBlocker!();
      const blockerResult = await blockingTask;
      assert.equal(blockerResult, "blocker");
    });

    await t.test("clearQueue with custom error", async () => {
      const manager = new QueueManager();
      
      const task = manager.execute("app1", async () => "task");
      const customError = new Error("Custom clear error");
      
      manager.clearQueue("app1", customError);
      
      await assert.rejects(task, /Custom clear error/);
    });

    await t.test("clearAll clears all queues", async () => {
      const manager = new QueueManager();
      
      const app1Task = manager.execute("app1", async () => "app1-task");
      const app2Task = manager.execute("app2", async () => "app2-task");
      const app3Task = manager.execute("app3", async () => "app3-task");
      
      manager.clearAll();
      
      await assert.rejects(app1Task, /Queue cleared/);
      await assert.rejects(app2Task, /Queue cleared/);
      await assert.rejects(app3Task, /Queue cleared/);
    });

    await t.test("clearAll with custom error", async () => {
      const manager = new QueueManager();
      
      const task1 = manager.execute("app1", async () => "task1");
      const task2 = manager.execute("app2", async () => "task2");
      const customError = new Error("Global clear error");
      
      manager.clearAll(customError);
      
      await assert.rejects(task1, /Global clear error/);
      await assert.rejects(task2, /Global clear error/);
    });

    await t.test("drainQueue waits for specific queue", async () => {
      const manager = new QueueManager();
      const results: string[] = [];
      
      // Add tasks to app1
      manager.execute("app1", async () => {
        await new Promise(r => setTimeout(r, 30));
        results.push("app1-task1");
        return "app1-task1";
      });
      
      manager.execute("app1", async () => {
        await new Promise(r => setTimeout(r, 20));
        results.push("app1-task2");
        return "app1-task2";
      });
      
      // Add task to app2 (should not be waited for)
      manager.execute("app2", async () => {
        await new Promise(r => setTimeout(r, 100));
        results.push("app2-task");
        return "app2-task";
      });
      
      // Drain only app1
      await manager.drainQueue("app1");
      
      // app1 tasks should be complete
      assert.ok(results.includes("app1-task1"));
      assert.ok(results.includes("app1-task2"));
      
      // app2 task might not be complete yet
      // (we don't wait for it to complete to avoid test flakiness)
    });

    await t.test("drainQueue handles non-existent queue", async () => {
      const manager = new QueueManager();
      
      // Should complete immediately without error
      await manager.drainQueue("non-existent");
    });

    await t.test("drainAll waits for all queues", async () => {
      const manager = new QueueManager();
      const results: string[] = [];
      
      // Add tasks to multiple apps
      manager.execute("app1", async () => {
        await new Promise(r => setTimeout(r, 30));
        results.push("app1-task");
        return "app1-task";
      });
      
      manager.execute("app2", async () => {
        await new Promise(r => setTimeout(r, 20));
        results.push("app2-task");
        return "app2-task";
      });
      
      manager.execute("app3", async () => {
        await new Promise(r => setTimeout(r, 10));
        results.push("app3-task");
        return "app3-task";
      });
      
      // Drain all queues
      await manager.drainAll();
      
      // All tasks should be complete
      assert.deepEqual(results.sort(), ["app1-task", "app2-task", "app3-task"]);
    });
  });

  await t.test("Queue pruning", async (t) => {
    await t.test("pruneQueue removes empty idle queue", async () => {
      const manager = new QueueManager();
      
      // Execute a task to create the queue
      await manager.execute("app1", async () => "task");
      
      // Queue should exist
      assert.ok(manager.getQueueStats("app1"));
      
      // Prune the queue
      const removed = manager.pruneQueue("app1");
      assert.equal(removed, true);
      
      // Queue should be gone
      assert.equal(manager.getQueueStats("app1"), null);
    });

    await t.test("pruneQueue does not remove processing queue", async () => {
      const manager = new QueueManager();
      
      let resolveTask: () => void;
      const taskPromise = new Promise<void>(resolve => {
        resolveTask = resolve;
      });
      
      const queuePromise = manager.execute("app1", async () => {
        await taskPromise;
        return "done";
      });
      
      // Wait for processing to start
      await new Promise(r => setTimeout(r, 10));
      
      // Try to prune - should not remove
      const removed = manager.pruneQueue("app1");
      assert.equal(removed, false);
      
      // Queue should still exist
      assert.ok(manager.getQueueStats("app1"));
      
      resolveTask!();
      await queuePromise;
    });

    await t.test("pruneQueue does not remove queue with pending tasks", async () => {
      const manager = new QueueManager();
      
      let resolveBlocker: () => void;
      const blockerPromise = new Promise<void>(resolve => {
        resolveBlocker = resolve;
      });
      
      const blockingTask = manager.execute("app1", async () => {
        await blockerPromise;
        return "blocker";
      });
      
      const pendingTask = manager.execute("app1", async () => "pending");
      
      // Wait for processing to start
      await new Promise(r => setTimeout(r, 10));
      
      // Try to prune - should not remove (has pending task)
      const removed = manager.pruneQueue("app1");
      assert.equal(removed, false);
      
      resolveBlocker!();
      await Promise.all([blockingTask, pendingTask]);
    });

    await t.test("pruneQueue returns false for non-existent queue", () => {
      const manager = new QueueManager();
      
      const removed = manager.pruneQueue("non-existent");
      assert.equal(removed, false);
    });

    await t.test("pruneAll removes all empty idle queues", async () => {
      const manager = new QueueManager();
      
      // Create several queues
      await manager.execute("app1", async () => "task1");
      await manager.execute("app2", async () => "task2");
      await manager.execute("app3", async () => "task3");
      
      // All queues should exist
      assert.ok(manager.getQueueStats("app1"));
      assert.ok(manager.getQueueStats("app2"));
      assert.ok(manager.getQueueStats("app3"));
      
      // Prune all
      const removed = manager.pruneAll();
      assert.equal(removed, 3);
      
      // All queues should be gone
      assert.equal(manager.getQueueStats("app1"), null);
      assert.equal(manager.getQueueStats("app2"), null);
      assert.equal(manager.getQueueStats("app3"), null);
    });

    await t.test("pruneAll skips active queues", async () => {
      const manager = new QueueManager();
      
      // Create idle queue
      await manager.execute("idle-app", async () => "task");
      
      // Create active queue
      let resolveTask: () => void;
      const taskPromise = new Promise<void>(resolve => {
        resolveTask = resolve;
      });
      
      const activePromise = manager.execute("active-app", async () => {
        await taskPromise;
        return "active";
      });
      
      // Wait for processing to start
      await new Promise(r => setTimeout(r, 10));
      
      // Prune all - should only remove idle queue
      const removed = manager.pruneAll();
      assert.equal(removed, 1);
      
      // Idle queue should be gone, active queue should remain
      assert.equal(manager.getQueueStats("idle-app"), null);
      assert.ok(manager.getQueueStats("active-app"));
      
      resolveTask!();
      await activePromise;
    });
  });

  await t.test("Debug functionality", async (t) => {
    await t.test("debug returns information about all queues", async () => {
      const manager = new QueueManager();
      
      await manager.execute("app1", async () => "task1");
      await manager.execute("app2", async () => "task2");
      
      const debugInfo = manager.debug();
      
      assert.ok(debugInfo.includes("app1"));
      assert.ok(debugInfo.includes("app2"));
      assert.ok(debugInfo.includes("length="));
      assert.ok(debugInfo.includes("processing="));
    });

    await t.test("debug handles empty manager", () => {
      const manager = new QueueManager();
      
      const debugInfo = manager.debug();
      assert.equal(debugInfo, "");
    });

    await t.test("debug reflects current queue states", async () => {
      const manager = new QueueManager();
      
      let resolveTask: () => void;
      const taskPromise = new Promise<void>(resolve => {
        resolveTask = resolve;
      });
      
      const activePromise = manager.execute("active-app", async () => {
        await taskPromise;
        return "active";
      });
      
      manager.execute("active-app", async () => "pending1");
      manager.execute("active-app", async () => "pending2");
      
      // Wait for processing to start
      await new Promise(r => setTimeout(r, 10));
      
      const debugInfo = manager.debug();
      assert.ok(debugInfo.includes("active-app"));
      assert.ok(debugInfo.includes("length=2"));
      assert.ok(debugInfo.includes("processing=true"));
      
      resolveTask!();
      await activePromise;
    });
  });

  await t.test("Edge cases and error handling", async (t) => {
    await t.test("handles tasks that return undefined", async () => {
      const manager = new QueueManager();
      
      const result = await manager.execute("app1", async () => undefined);
      assert.equal(result, undefined);
    });

    await t.test("handles tasks that return null", async () => {
      const manager = new QueueManager();
      
      const result = await manager.execute("app1", async () => null);
      assert.equal(result, null);
    });

    await t.test("handles concurrent operations on same appId", async () => {
      const manager = new QueueManager();
      const results: number[] = [];
      
      // Add many tasks concurrently to same app
      const promises = Array.from({ length: 20 }, (_, i) =>
        manager.execute("app1", async () => {
          await new Promise(r => setTimeout(r, Math.random() * 5));
          results.push(i);
          return i;
        })
      );
      
      await Promise.all(promises);
      
      // Results should be in order
      assert.deepEqual(results, Array.from({ length: 20 }, (_, i) => i));
    });

    await t.test("handles concurrent operations on different appIds", async () => {
      const manager = new QueueManager();
      
      const promises = Array.from({ length: 10 }, (_, i) =>
        manager.execute(`app${i}`, async () => `result${i}`)
      );
      
      const results = await Promise.all(promises);
      const expected = Array.from({ length: 10 }, (_, i) => `result${i}`);
      
      assert.deepEqual(results, expected);
    });

    await t.test("handles special characters in appId", async () => {
      const manager = new QueueManager();
      
      const specialAppIds = [
        "com.company.app-name",
        "com.company.app_name",
        "com.company.app.v2",
        "bundle.id.with.dots",
      ];
      
      for (const appId of specialAppIds) {
        const result = await manager.execute(appId, async () => `result-${appId}`);
        assert.equal(result, `result-${appId}`);
        
        const stats = manager.getQueueStats(appId);
        assert.ok(stats);
        assert.equal(stats.totalProcessed, 1);
      }
    });
  });
});
