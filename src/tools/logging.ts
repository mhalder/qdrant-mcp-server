/**
 * Tool handler logging wrapper
 *
 * Provides standardized completion, error, and warning logging
 * for all MCP tool handlers.
 */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import logger from "../logger.js";

const log = logger.child({ component: "tools" });

/** Tools that are search operations (empty results trigger a warning) */
const SEARCH_TOOLS = new Set([
  "semantic_search",
  "hybrid_search",
  "search_code",
  "search_git_history",
  "contextual_search",
  "federated_search",
]);

/**
 * Check whether a tool result indicates an empty search (zero results).
 */
function isEmptySearchResult(result: CallToolResult): boolean {
  if (!result.content || result.content.length === 0) return true;
  const first = result.content[0];
  if (first.type === "text") {
    const text = (first as { type: "text"; text: string }).text;
    return (
      text.startsWith("No results found") ||
      text === "[]" ||
      text.includes("Found 0 result(s)")
    );
  }
  return false;
}

/**
 * Wraps a tool handler with standardized logging:
 * - Logs "Tool completed" at info level with durationMs on success
 * - Logs "Tool failed" at error level when result has isError: true
 * - Logs "Tool completed with no results" at warn level for search tools
 * - Logs "Tool threw an error" at error level when handler throws (re-throws)
 */
export function withToolLogging<
  T extends (...args: any[]) => Promise<CallToolResult>,
>(toolName: string, handler: T): T {
  const wrapped = async (...args: Parameters<T>): Promise<CallToolResult> => {
    const startTime = Date.now();
    try {
      const result = await handler(...args);
      const durationMs = Date.now() - startTime;

      if (result.isError) {
        const errorText =
          result.content?.[0]?.type === "text"
            ? (result.content[0] as { type: "text"; text: string }).text
            : "Unknown error";
        log.error(
          { tool: toolName, durationMs, error: errorText },
          "Tool failed",
        );
      } else if (SEARCH_TOOLS.has(toolName) && isEmptySearchResult(result)) {
        log.warn(
          { tool: toolName, durationMs },
          "Tool completed with no results",
        );
      } else {
        log.info({ tool: toolName, durationMs }, "Tool completed");
      }

      return result;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      log.error(
        { tool: toolName, durationMs, err: error },
        "Tool threw an error",
      );
      throw error;
    }
  };
  return wrapped as T;
}
