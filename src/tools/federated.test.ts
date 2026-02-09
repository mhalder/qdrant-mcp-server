import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CodeSearchResult } from "../code/types.js";
import type { GitSearchResult } from "../git/types.js";
import {
  buildCorrelations,
  normalizeScores,
  calculateRRFScore,
  pathsMatch,
} from "./federated.js";

vi.mock("../logger.js", () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    child: vi.fn().mockReturnThis(),
  },
}));

// ============================================================================
// Unit Tests for Helper Functions
// ============================================================================

describe("normalizeScores", () => {
  it("should return empty array for empty input", () => {
    const result = normalizeScores([]);
    expect(result).toEqual([]);
  });

  it("should normalize single result to score of 1", () => {
    const input = [{ score: 0.5, id: "a" }];
    const result = normalizeScores(input);

    expect(result).toHaveLength(1);
    expect(result[0].score).toBe(1);
    expect(result[0].id).toBe("a");
  });

  it("should normalize scores to [0, 1] range", () => {
    const input = [
      { score: 10, id: "a" },
      { score: 5, id: "b" },
      { score: 0, id: "c" },
    ];
    const result = normalizeScores(input);

    expect(result).toHaveLength(3);
    expect(result.find((r) => r.id === "a")?.score).toBe(1); // highest
    expect(result.find((r) => r.id === "b")?.score).toBe(0.5); // middle
    expect(result.find((r) => r.id === "c")?.score).toBe(0); // lowest
  });

  it("should handle identical scores by normalizing all to 1", () => {
    const input = [
      { score: 0.7, id: "a" },
      { score: 0.7, id: "b" },
      { score: 0.7, id: "c" },
    ];
    const result = normalizeScores(input);

    expect(result.every((r) => r.score === 1)).toBe(true);
  });

  it("should handle negative scores", () => {
    const input = [
      { score: -5, id: "a" },
      { score: 5, id: "b" },
    ];
    const result = normalizeScores(input);

    expect(result.find((r) => r.id === "a")?.score).toBe(0);
    expect(result.find((r) => r.id === "b")?.score).toBe(1);
  });

  it("should preserve other properties", () => {
    const input = [
      { score: 1, id: "a", extra: "data1" },
      { score: 0, id: "b", extra: "data2" },
    ];
    const result = normalizeScores(input);

    expect(result[0].extra).toBeDefined();
    expect(result[1].extra).toBeDefined();
  });
});

describe("calculateRRFScore", () => {
  it("should calculate RRF for single rank", () => {
    // RRF with k=60: 1/(60+1) = 0.01639...
    const score = calculateRRFScore([1]);
    expect(score).toBeCloseTo(1 / 61, 5);
  });

  it("should calculate RRF for multiple ranks", () => {
    // RRF with k=60: 1/(60+1) + 1/(60+2) = 0.01639... + 0.01613...
    const score = calculateRRFScore([1, 2]);
    expect(score).toBeCloseTo(1 / 61 + 1 / 62, 5);
  });

  it("should return 0 for empty ranks", () => {
    const score = calculateRRFScore([]);
    expect(score).toBe(0);
  });

  it("should give higher score to lower ranks (better positions)", () => {
    const scoreRank1 = calculateRRFScore([1]);
    const scoreRank10 = calculateRRFScore([10]);

    expect(scoreRank1).toBeGreaterThan(scoreRank10);
  });

  it("should handle high ranks without overflow", () => {
    const score = calculateRRFScore([1000]);
    expect(score).toBeCloseTo(1 / 1060, 5);
    expect(Number.isFinite(score)).toBe(true);
  });
});

describe("pathsMatch", () => {
  it("should match identical paths", () => {
    expect(pathsMatch("src/auth/user.ts", "src/auth/user.ts")).toBe(true);
  });

  it("should match when shorter path is suffix of longer path", () => {
    expect(pathsMatch("app/models/user.ts", "models/user.ts")).toBe(true);
    expect(pathsMatch("models/user.ts", "app/models/user.ts")).toBe(true);
  });

  it("should match filename only against full path", () => {
    expect(pathsMatch("src/components/Button.tsx", "Button.tsx")).toBe(true);
    expect(pathsMatch("Button.tsx", "src/components/Button.tsx")).toBe(true);
  });

  it("should NOT match paths with different parent directories", () => {
    // This was the false positive case
    expect(pathsMatch("app/models/user.ts", "lib/user.ts")).toBe(false);
    expect(pathsMatch("src/auth/middleware.ts", "other/middleware.ts")).toBe(
      false,
    );
  });

  it("should NOT match completely different filenames", () => {
    expect(pathsMatch("src/auth.ts", "src/user.ts")).toBe(false);
  });

  it("should handle Windows-style backslashes", () => {
    expect(pathsMatch("src\\auth\\user.ts", "auth/user.ts")).toBe(true);
  });

  it("should be case-insensitive", () => {
    expect(pathsMatch("src/Auth/User.ts", "auth/user.ts")).toBe(true);
  });

  it("should return false for empty paths", () => {
    expect(pathsMatch("", "src/file.ts")).toBe(false);
    expect(pathsMatch("src/file.ts", "")).toBe(false);
    expect(pathsMatch("", "")).toBe(false);
  });
});

describe("buildCorrelations", () => {
  const createCodeResult = (
    overrides: Partial<CodeSearchResult> = {},
  ): CodeSearchResult => ({
    content: "function test() {}",
    filePath: "src/utils/helper.ts",
    startLine: 10,
    endLine: 20,
    language: "typescript",
    score: 0.85,
    fileExtension: ".ts",
    ...overrides,
  });

  const createGitResult = (
    overrides: Partial<GitSearchResult> = {},
  ): GitSearchResult => ({
    content: "Commit content",
    commitHash: "abc123def456",
    shortHash: "abc123d",
    author: "John Doe",
    date: "2024-01-15T10:30:00Z",
    subject: "feat: add helper function",
    commitType: "feat",
    files: ["src/utils/helper.ts", "src/index.ts"],
    score: 0.9,
    ...overrides,
  });

  it("should find correlations when file paths match", () => {
    const codeResults = [createCodeResult({ filePath: "src/utils/helper.ts" })];
    const gitResults = [
      createGitResult({ files: ["src/utils/helper.ts", "src/index.ts"] }),
    ];

    const correlations = buildCorrelations(codeResults, gitResults);

    expect(correlations).toHaveLength(1);
    expect(correlations[0].codeResult.filePath).toBe("src/utils/helper.ts");
    expect(correlations[0].relatedCommits).toHaveLength(1);
    expect(correlations[0].relatedCommits[0].shortHash).toBe("abc123d");
  });

  it("should match partial paths (relative vs absolute)", () => {
    const codeResults = [
      createCodeResult({ filePath: "/home/user/project/src/utils/helper.ts" }),
    ];
    const gitResults = [createGitResult({ files: ["src/utils/helper.ts"] })];

    const correlations = buildCorrelations(codeResults, gitResults);

    expect(correlations).toHaveLength(1);
    expect(correlations[0].relatedCommits).toHaveLength(1);
  });

  it("should return empty array when no matches found", () => {
    const codeResults = [createCodeResult({ filePath: "src/other/file.ts" })];
    const gitResults = [createGitResult({ files: ["src/different/path.ts"] })];

    const correlations = buildCorrelations(codeResults, gitResults);

    expect(correlations).toHaveLength(0);
  });

  it("should find multiple related commits for one file", () => {
    const codeResults = [createCodeResult({ filePath: "src/utils/helper.ts" })];
    const gitResults = [
      createGitResult({
        shortHash: "abc123d",
        files: ["src/utils/helper.ts"],
      }),
      createGitResult({
        shortHash: "xyz789a",
        files: ["src/utils/helper.ts", "src/other.ts"],
      }),
    ];

    const correlations = buildCorrelations(codeResults, gitResults);

    expect(correlations).toHaveLength(1);
    expect(correlations[0].relatedCommits).toHaveLength(2);
    expect(correlations[0].relatedCommits.map((c) => c.shortHash)).toContain(
      "abc123d",
    );
    expect(correlations[0].relatedCommits.map((c) => c.shortHash)).toContain(
      "xyz789a",
    );
  });

  it("should handle multiple code results with different correlations", () => {
    const codeResults = [
      createCodeResult({ filePath: "src/utils/helper.ts" }),
      createCodeResult({ filePath: "src/services/api.ts" }),
    ];
    const gitResults = [
      createGitResult({
        shortHash: "abc123d",
        files: ["src/utils/helper.ts"],
      }),
      createGitResult({
        shortHash: "xyz789a",
        files: ["src/services/api.ts"],
      }),
    ];

    const correlations = buildCorrelations(codeResults, gitResults);

    expect(correlations).toHaveLength(2);
  });

  it("should handle empty code results", () => {
    const gitResults = [createGitResult()];

    const correlations = buildCorrelations([], gitResults);

    expect(correlations).toHaveLength(0);
  });

  it("should handle empty git results", () => {
    const codeResults = [createCodeResult()];

    const correlations = buildCorrelations(codeResults, []);

    expect(correlations).toHaveLength(0);
  });

  it("should handle case-insensitive path matching", () => {
    const codeResults = [createCodeResult({ filePath: "SRC/Utils/Helper.ts" })];
    const gitResults = [createGitResult({ files: ["src/utils/helper.ts"] })];

    const correlations = buildCorrelations(codeResults, gitResults);

    expect(correlations).toHaveLength(1);
  });

  it("should normalize Windows-style paths", () => {
    const codeResults = [
      createCodeResult({ filePath: "src\\utils\\helper.ts" }),
    ];
    const gitResults = [createGitResult({ files: ["src/utils/helper.ts"] })];

    const correlations = buildCorrelations(codeResults, gitResults);

    expect(correlations).toHaveLength(1);
  });
});

// ============================================================================
// Integration Tests for Tool Implementations
// ============================================================================

describe("contextual_search integration", () => {
  // Mock indexers
  const mockCodeIndexer = {
    getIndexStatus: vi.fn(),
    searchCode: vi.fn(),
    indexCodebase: vi.fn(),
    reindexChanges: vi.fn(),
    clearIndex: vi.fn(),
  };

  const mockGitHistoryIndexer = {
    getIndexStatus: vi.fn(),
    searchHistory: vi.fn(),
    indexHistory: vi.fn(),
    indexNewCommits: vi.fn(),
    clearIndex: vi.fn(),
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should execute code and git searches in parallel", async () => {
    mockCodeIndexer.getIndexStatus.mockResolvedValue({ status: "indexed" });
    mockGitHistoryIndexer.getIndexStatus.mockResolvedValue({
      status: "indexed",
    });
    mockCodeIndexer.searchCode.mockResolvedValue([
      {
        content: "function test() {}",
        filePath: "src/test.ts",
        startLine: 1,
        endLine: 5,
        language: "typescript",
        score: 0.9,
        fileExtension: ".ts",
      },
    ]);
    mockGitHistoryIndexer.searchHistory.mockResolvedValue([
      {
        content: "Commit content",
        commitHash: "abc123",
        shortHash: "abc123d",
        author: "Test Author",
        date: "2024-01-15",
        subject: "feat: add test",
        commitType: "feat",
        files: ["src/test.ts"],
        score: 0.85,
      },
    ]);

    // Import and call performContextualSearch directly
    const { registerFederatedTools } = await import("./federated.js");

    // Create a mock server
    const mockServer = {
      registerTool: vi.fn(),
    };

    registerFederatedTools(mockServer as any, {
      codeIndexer: mockCodeIndexer as any,
      gitHistoryIndexer: mockGitHistoryIndexer as any,
    });

    // Get the handler for contextual_search
    const contextualSearchCall = mockServer.registerTool.mock.calls.find(
      (call) => call[0] === "contextual_search",
    );
    expect(contextualSearchCall).toBeDefined();

    const handler = contextualSearchCall![2];
    const result = await handler({
      path: "/test/repo",
      query: "test function",
      codeLimit: 5,
      gitLimit: 5,
      correlate: true,
    });

    expect(mockCodeIndexer.searchCode).toHaveBeenCalledWith(
      "/test/repo",
      "test function",
      { limit: 5 },
    );
    expect(mockGitHistoryIndexer.searchHistory).toHaveBeenCalledWith(
      "/test/repo",
      "test function",
      { limit: 5 },
    );
    expect(result.content[0].text).toContain("Code Results");
    expect(result.content[0].text).toContain("Git History Results");
    expect(result.content[0].text).toContain("Correlations");
  });

  it("should return error when code index not found", async () => {
    mockCodeIndexer.getIndexStatus.mockResolvedValue({ status: "not_indexed" });
    mockGitHistoryIndexer.getIndexStatus.mockResolvedValue({
      status: "indexed",
    });

    const { registerFederatedTools } = await import("./federated.js");
    const mockServer = { registerTool: vi.fn() };

    registerFederatedTools(mockServer as any, {
      codeIndexer: mockCodeIndexer as any,
      gitHistoryIndexer: mockGitHistoryIndexer as any,
    });

    const contextualSearchCall = mockServer.registerTool.mock.calls.find(
      (call) => call[0] === "contextual_search",
    );
    const handler = contextualSearchCall![2];
    const result = await handler({
      path: "/test/repo",
      query: "test",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Code index not found");
  });

  it("should return error when git index not found", async () => {
    mockCodeIndexer.getIndexStatus.mockResolvedValue({ status: "indexed" });
    mockGitHistoryIndexer.getIndexStatus.mockResolvedValue({
      status: "not_indexed",
    });

    const { registerFederatedTools } = await import("./federated.js");
    const mockServer = { registerTool: vi.fn() };

    registerFederatedTools(mockServer as any, {
      codeIndexer: mockCodeIndexer as any,
      gitHistoryIndexer: mockGitHistoryIndexer as any,
    });

    const contextualSearchCall = mockServer.registerTool.mock.calls.find(
      (call) => call[0] === "contextual_search",
    );
    const handler = contextualSearchCall![2];
    const result = await handler({
      path: "/test/repo",
      query: "test",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Git history index not found");
  });

  it("should skip correlations when correlate=false", async () => {
    mockCodeIndexer.getIndexStatus.mockResolvedValue({ status: "indexed" });
    mockGitHistoryIndexer.getIndexStatus.mockResolvedValue({
      status: "indexed",
    });
    mockCodeIndexer.searchCode.mockResolvedValue([
      {
        content: "code",
        filePath: "src/test.ts",
        startLine: 1,
        endLine: 5,
        language: "typescript",
        score: 0.9,
        fileExtension: ".ts",
      },
    ]);
    mockGitHistoryIndexer.searchHistory.mockResolvedValue([
      {
        content: "commit",
        commitHash: "abc123",
        shortHash: "abc123d",
        author: "Author",
        date: "2024-01-15",
        subject: "feat: test",
        commitType: "feat",
        files: ["src/test.ts"],
        score: 0.85,
      },
    ]);

    const { registerFederatedTools } = await import("./federated.js");
    const mockServer = { registerTool: vi.fn() };

    registerFederatedTools(mockServer as any, {
      codeIndexer: mockCodeIndexer as any,
      gitHistoryIndexer: mockGitHistoryIndexer as any,
    });

    const contextualSearchCall = mockServer.registerTool.mock.calls.find(
      (call) => call[0] === "contextual_search",
    );
    const handler = contextualSearchCall![2];
    const result = await handler({
      path: "/test/repo",
      query: "test",
      correlate: false,
    });

    expect(result.content[0].text).not.toContain("Correlations (Code");
    expect(result.content[0].text).toContain("0 correlation(s)");
  });
});

describe("federated_search integration", () => {
  const mockCodeIndexer = {
    getIndexStatus: vi.fn(),
    searchCode: vi.fn(),
    indexCodebase: vi.fn(),
    reindexChanges: vi.fn(),
    clearIndex: vi.fn(),
  };

  const mockGitHistoryIndexer = {
    getIndexStatus: vi.fn(),
    searchHistory: vi.fn(),
    indexHistory: vi.fn(),
    indexNewCommits: vi.fn(),
    clearIndex: vi.fn(),
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should search across multiple repositories", async () => {
    mockCodeIndexer.getIndexStatus.mockResolvedValue({ status: "indexed" });
    mockGitHistoryIndexer.getIndexStatus.mockResolvedValue({
      status: "indexed",
    });
    mockCodeIndexer.searchCode.mockResolvedValue([
      {
        content: "function test() {}",
        filePath: "src/test.ts",
        startLine: 1,
        endLine: 5,
        language: "typescript",
        score: 0.9,
        fileExtension: ".ts",
      },
    ]);
    mockGitHistoryIndexer.searchHistory.mockResolvedValue([
      {
        content: "Commit",
        commitHash: "abc123",
        shortHash: "abc123d",
        author: "Author",
        date: "2024-01-15",
        subject: "feat: add",
        commitType: "feat",
        files: ["src/test.ts"],
        score: 0.85,
      },
    ]);

    const { registerFederatedTools } = await import("./federated.js");
    const mockServer = { registerTool: vi.fn() };

    registerFederatedTools(mockServer as any, {
      codeIndexer: mockCodeIndexer as any,
      gitHistoryIndexer: mockGitHistoryIndexer as any,
    });

    const federatedSearchCall = mockServer.registerTool.mock.calls.find(
      (call) => call[0] === "federated_search",
    );
    const handler = federatedSearchCall![2];
    const result = await handler({
      paths: ["/repo1", "/repo2"],
      query: "test function",
      searchType: "both",
      limit: 20,
    });

    // Each repo gets searched for code and git
    expect(mockCodeIndexer.searchCode).toHaveBeenCalledTimes(2);
    expect(mockGitHistoryIndexer.searchHistory).toHaveBeenCalledTimes(2);
    expect(result.content[0].text).toContain("Federated Search Results");
    expect(result.content[0].text).toContain("Repositories: 2");
  });

  it("should fail fast when any repository is not indexed", async () => {
    mockCodeIndexer.getIndexStatus
      .mockResolvedValueOnce({ status: "indexed" })
      .mockResolvedValueOnce({ status: "not_indexed" });
    mockGitHistoryIndexer.getIndexStatus.mockResolvedValue({
      status: "indexed",
    });

    const { registerFederatedTools } = await import("./federated.js");
    const mockServer = { registerTool: vi.fn() };

    registerFederatedTools(mockServer as any, {
      codeIndexer: mockCodeIndexer as any,
      gitHistoryIndexer: mockGitHistoryIndexer as any,
    });

    const federatedSearchCall = mockServer.registerTool.mock.calls.find(
      (call) => call[0] === "federated_search",
    );
    const handler = federatedSearchCall![2];
    const result = await handler({
      paths: ["/repo1", "/repo2"],
      query: "test",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Index validation failed");
    expect(result.content[0].text).toContain("Code index not found");
    // Should not perform searches when validation fails
    expect(mockCodeIndexer.searchCode).not.toHaveBeenCalled();
  });

  it("should respect searchType=code and only search code", async () => {
    mockCodeIndexer.getIndexStatus.mockResolvedValue({ status: "indexed" });
    mockCodeIndexer.searchCode.mockResolvedValue([]);

    const { registerFederatedTools } = await import("./federated.js");
    const mockServer = { registerTool: vi.fn() };

    registerFederatedTools(mockServer as any, {
      codeIndexer: mockCodeIndexer as any,
      gitHistoryIndexer: mockGitHistoryIndexer as any,
    });

    const federatedSearchCall = mockServer.registerTool.mock.calls.find(
      (call) => call[0] === "federated_search",
    );
    const handler = federatedSearchCall![2];
    await handler({
      paths: ["/repo1"],
      query: "test",
      searchType: "code",
    });

    expect(mockCodeIndexer.searchCode).toHaveBeenCalled();
    expect(mockGitHistoryIndexer.searchHistory).not.toHaveBeenCalled();
  });

  it("should respect searchType=git and only search git history", async () => {
    mockGitHistoryIndexer.getIndexStatus.mockResolvedValue({
      status: "indexed",
    });
    mockGitHistoryIndexer.searchHistory.mockResolvedValue([]);

    const { registerFederatedTools } = await import("./federated.js");
    const mockServer = { registerTool: vi.fn() };

    registerFederatedTools(mockServer as any, {
      codeIndexer: mockCodeIndexer as any,
      gitHistoryIndexer: mockGitHistoryIndexer as any,
    });

    const federatedSearchCall = mockServer.registerTool.mock.calls.find(
      (call) => call[0] === "federated_search",
    );
    const handler = federatedSearchCall![2];
    await handler({
      paths: ["/repo1"],
      query: "test",
      searchType: "git",
    });

    expect(mockCodeIndexer.searchCode).not.toHaveBeenCalled();
    expect(mockGitHistoryIndexer.searchHistory).toHaveBeenCalled();
  });

  it("should apply limit to combined results", async () => {
    mockCodeIndexer.getIndexStatus.mockResolvedValue({ status: "indexed" });
    mockGitHistoryIndexer.getIndexStatus.mockResolvedValue({
      status: "indexed",
    });

    // Return many results from each search
    const codeResults = Array(10)
      .fill(null)
      .map((_, i) => ({
        content: `code ${i}`,
        filePath: `src/file${i}.ts`,
        startLine: 1,
        endLine: 5,
        language: "typescript",
        score: 0.9 - i * 0.05,
        fileExtension: ".ts",
      }));
    const gitResults = Array(10)
      .fill(null)
      .map((_, i) => ({
        content: `commit ${i}`,
        commitHash: `hash${i}`,
        shortHash: `hash${i}`,
        author: "Author",
        date: "2024-01-15",
        subject: `feat: commit ${i}`,
        commitType: "feat",
        files: [`src/file${i}.ts`],
        score: 0.85 - i * 0.05,
      }));

    mockCodeIndexer.searchCode.mockResolvedValue(codeResults);
    mockGitHistoryIndexer.searchHistory.mockResolvedValue(gitResults);

    const { registerFederatedTools } = await import("./federated.js");
    const mockServer = { registerTool: vi.fn() };

    registerFederatedTools(mockServer as any, {
      codeIndexer: mockCodeIndexer as any,
      gitHistoryIndexer: mockGitHistoryIndexer as any,
    });

    const federatedSearchCall = mockServer.registerTool.mock.calls.find(
      (call) => call[0] === "federated_search",
    );
    const handler = federatedSearchCall![2];
    const result = await handler({
      paths: ["/repo1"],
      query: "test",
      limit: 5,
    });

    // Should limit total results
    expect(result.content[0].text).toContain("Total: 5 result(s)");
  });

  it("should return message when no results found", async () => {
    mockCodeIndexer.getIndexStatus.mockResolvedValue({ status: "indexed" });
    mockGitHistoryIndexer.getIndexStatus.mockResolvedValue({
      status: "indexed",
    });
    mockCodeIndexer.searchCode.mockResolvedValue([]);
    mockGitHistoryIndexer.searchHistory.mockResolvedValue([]);

    const { registerFederatedTools } = await import("./federated.js");
    const mockServer = { registerTool: vi.fn() };

    registerFederatedTools(mockServer as any, {
      codeIndexer: mockCodeIndexer as any,
      gitHistoryIndexer: mockGitHistoryIndexer as any,
    });

    const federatedSearchCall = mockServer.registerTool.mock.calls.find(
      (call) => call[0] === "federated_search",
    );
    const handler = federatedSearchCall![2];
    const result = await handler({
      paths: ["/repo1"],
      query: "nonexistent query",
    });

    expect(result.content[0].text).toContain("No results found");
  });
});
