# Queue behavior and semantics

Operations targeting the same app are serialized via an internal FIFO queue. Each `appId` has its own queue managed by the QueueManager.

## Overview

- Processing is deferred to a microtask after you enqueue a task. This gives you a synchronous window to call `clear()` immediately after enqueuing if desired, without a race where the task starts first.
- `clear(error?)` rejects all pending tasks. It also uses an internal epoch to ensure any task dequeued concurrently but not yet started is rejected with the same error instead of running. The currently executing task is not interrupted.
- The queue `length` property returns the number of pending tasks and intentionally excludes a task that has its processing scheduled (via microtask) but hasn't started yet. This matches the user-facing notion of "pending". For raw internal size, use `getStats().currentLength`.

## Length vs stats example

Consider enqueuing three tasks A, B, C in quick succession:

- Immediately after enqueuing A:
  - processing is scheduled via a microtask, but not started yet
  - `length` reports 0 (pending excludes the scheduled A)
  - `getStats().currentLength` is 1 (raw internal size)
- After enqueuing B and C (still before the microtask runs):
  - `length` reports 2 (B and C are pending; A is scheduled to start)
  - `getStats().currentLength` is 3 (A, B, C in the internal queue)

Once the microtask runs and A actually starts executing, both `length` and `getStats().currentLength` will drop accordingly.

## Per-app queueing

The runner serializes operations per `appId` using an internal QueueManager. Each `appId` has its own FIFO queue. These semantics (microtask scheduling, clear() epoch cut-off, and the length property) apply per `appId` queue.

See also: Runner configuration in the top-level README.