/**
 * @fileoverview Low-level executor for running AppleScript via osascript.
 *
 * This module provides the core functionality for executing AppleScript
 * code using Node.js child_process. It handles process spawning, timeout
 * management, and basic error handling.
 *
 * Security: We use execFile instead of exec to avoid shell interpretation.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { RawResponse } from "./protocol/parser.js";
import { hasProperty, getObjectProperty } from "../shared/unsafe-type-casts.js";

const execFileAsync = promisify(execFile);

/**
 * Options for executing AppleScript
 */
export interface ExecuteOptions {
  /**
   * Timeout in milliseconds for the Node.js process
   */
  timeoutMs?: number;

  /**
   * Working directory for the process
   */
  cwd?: string;

  /**
   * Environment variables
   */
  env?: NodeJS.ProcessEnv;

  /**
   * Maximum buffer size for stdout/stderr in bytes
   */
  maxBuffer?: number;
}

/**
 * Result from AppleScript execution
 */
export interface ExecuteResult extends RawResponse {
  /**
   * Execution time in milliseconds
   */
  durationMs: number;
}

/**
 * Error thrown when osascript execution fails
 */
export class OSAScriptError extends Error {
  constructor(
    message: string,
    public readonly code: string | number,
    public readonly stdout: string,
    public readonly stderr: string,
    public readonly exitCode: number | null,
  ) {
    super(message);
    this.name = "OSAScriptError";
  }
}

/**
 * Executes AppleScript code using osascript.
 *
 * This is the lowest-level execution function. It doesn't parse
 * the response or handle the protocol - it just runs the script
 * and returns the raw output.
 *
 * @param script - AppleScript code to execute
 * @param options - Execution options
 * @returns Raw response from osascript
 * @throws OSAScriptError on execution failure
 */
export async function executeAppleScript(
  script: string,
  options: ExecuteOptions = {},
): Promise<ExecuteResult> {
  const {
    timeoutMs = 30000,
    maxBuffer = 10 * 1024 * 1024, // 10MB default
    cwd,
    env = process.env,
  } = options;

  const startTime = Date.now();

  try {
    const { stdout, stderr } = await execFileAsync(
      "osascript",
      ["-e", script],
      {
        timeout: timeoutMs,
        maxBuffer,
        cwd,
        env,
        windowsHide: true,
      },
    );
    return {
      stdout: stdout || "",
      stderr: stderr || "",
      exitCode: 0,
      durationMs: Date.now() - startTime,
    };
  } catch (e: unknown) {
    // Use centralized helpers for property access
    const code = hasProperty(e, "code") ? getObjectProperty<number | string>(e as Record<string, unknown>, "code") : undefined;
    const signal = hasProperty(e, "signal") ? getObjectProperty<string>(e as Record<string, unknown>, "signal") : undefined;
    const message = hasProperty(e, "message") ? getObjectProperty<string>(e as Record<string, unknown>, "message") : "Unknown osascript error";
    const stdout = hasProperty(e, "stdout") ? getObjectProperty<string>(e as Record<string, unknown>, "stdout") : "";
    const stderr = hasProperty(e, "stderr") ? getObjectProperty<string>(e as Record<string, unknown>, "stderr") : "";
    const exitCode = typeof code === "number" ? code : null;

    // Handle timeout specifically
    if (code === "ETIMEDOUT" || signal === "SIGTERM") {
      throw new OSAScriptError(
        "osascript timed out",
        code ?? "ETIMEDOUT",
        stdout,
        stderr,
        exitCode,
      );
    }

    // Handle other execution errors
    throw new OSAScriptError(
      message,
      code ?? "UNKNOWN",
      stdout,
      stderr,
      exitCode,
    );
  }
}
