import { describe, it, expect, vi, beforeEach } from "vitest";
import { withToolLogging } from "./logging.js";

vi.mock("../logger.js", () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    child: vi.fn().mockReturnValue({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
  },
}));

import logger from "../logger.js";

const mockLog = logger.child({ component: "tools" }) as unknown as {
  info: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
};

describe("withToolLogging", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should log completion with durationMs on success", async () => {
    const handler = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: "Success" }],
    });

    const wrapped = withToolLogging("create_collection", handler);
    const result = await wrapped({ name: "test" });

    expect(result.content[0]).toEqual({ type: "text", text: "Success" });
    expect(mockLog.info).toHaveBeenCalledWith(
      expect.objectContaining({
        tool: "create_collection",
        durationMs: expect.any(Number),
      }),
      "Tool completed",
    );
  });

  it("should log error when result has isError: true", async () => {
    const handler = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: "Error: Collection not found" }],
      isError: true,
    });

    const wrapped = withToolLogging("add_documents", handler);
    const result = await wrapped({ collection: "test" });

    expect(result.isError).toBe(true);
    expect(mockLog.error).toHaveBeenCalledWith(
      expect.objectContaining({
        tool: "add_documents",
        durationMs: expect.any(Number),
        error: "Error: Collection not found",
      }),
      "Tool failed",
    );
    expect(mockLog.info).not.toHaveBeenCalled();
  });

  it("should log error and re-throw when handler throws", async () => {
    const testError = new Error("Connection refused");
    const handler = vi.fn().mockRejectedValue(testError);

    const wrapped = withToolLogging("list_collections", handler);

    await expect(wrapped()).rejects.toThrow("Connection refused");
    expect(mockLog.error).toHaveBeenCalledWith(
      expect.objectContaining({
        tool: "list_collections",
        durationMs: expect.any(Number),
        err: testError,
      }),
      "Tool threw an error",
    );
  });

  it('should log warn for search tool with "No results found" response', async () => {
    const handler = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: 'No results found for query: "test"' }],
    });

    const wrapped = withToolLogging("semantic_search", handler);
    await wrapped({ collection: "test", query: "test" });

    expect(mockLog.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        tool: "semantic_search",
        durationMs: expect.any(Number),
      }),
      "Tool completed with no results",
    );
    expect(mockLog.info).not.toHaveBeenCalled();
  });

  it("should log warn for search tool with empty JSON array response", async () => {
    const handler = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: "[]" }],
    });

    const wrapped = withToolLogging("hybrid_search", handler);
    await wrapped({ collection: "test", query: "test" });

    expect(mockLog.warn).toHaveBeenCalledWith(
      expect.objectContaining({ tool: "hybrid_search" }),
      "Tool completed with no results",
    );
  });

  it("should log warn for search tool with Found 0 result(s) response", async () => {
    const handler = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: "Found 0 result(s):\n" }],
    });

    const wrapped = withToolLogging("search_code", handler);
    await wrapped({ path: "/test", query: "test" });

    expect(mockLog.warn).toHaveBeenCalledWith(
      expect.objectContaining({ tool: "search_code" }),
      "Tool completed with no results",
    );
  });

  it("should NOT log warn for non-search tool with empty-looking response", async () => {
    const handler = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: "No results found for query: test" }],
    });

    const wrapped = withToolLogging("get_index_status", handler);
    await wrapped({ path: "/test" });

    // Should log info, not warn, because get_index_status is not a search tool
    expect(mockLog.info).toHaveBeenCalledWith(
      expect.objectContaining({ tool: "get_index_status" }),
      "Tool completed",
    );
    expect(mockLog.warn).not.toHaveBeenCalled();
  });

  it("should log info for search tool with actual results", async () => {
    const handler = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: "Found 5 result(s):\n..." }],
    });

    const wrapped = withToolLogging("search_code", handler);
    await wrapped({ path: "/test", query: "test" });

    expect(mockLog.info).toHaveBeenCalledWith(
      expect.objectContaining({ tool: "search_code" }),
      "Tool completed",
    );
    expect(mockLog.warn).not.toHaveBeenCalled();
  });

  it("should preserve handler return value exactly", async () => {
    const expected = {
      content: [{ type: "text" as const, text: "data" }],
      isError: false,
    };
    const handler = vi.fn().mockResolvedValue(expected);

    const wrapped = withToolLogging("list_collections", handler);
    const result = await wrapped();

    expect(result).toBe(expected);
  });

  it("should pass all arguments through to the handler", async () => {
    const handler = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: "ok" }],
    });

    const wrapped = withToolLogging("index_codebase", handler);
    const args = { path: "/test" };
    const extra = { _meta: {} };
    await wrapped(args, extra);

    expect(handler).toHaveBeenCalledWith(args, extra);
  });

  it("should handle empty content array", async () => {
    const handler = vi.fn().mockResolvedValue({
      content: [],
    });

    const wrapped = withToolLogging("search_git_history", handler);
    await wrapped({ path: "/test", query: "test" });

    expect(mockLog.warn).toHaveBeenCalledWith(
      expect.objectContaining({ tool: "search_git_history" }),
      "Tool completed with no results",
    );
  });
});
