import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CODE_EXTENSIONS, DEFAULT_IGNORE_PATTERNS } from "./config.js";
import { CodeIndexer } from "./indexer.js";
import type { CodeConfig } from "./types.js";

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

const tempPaths: string[] = [];

const config: CodeConfig = {
  chunkSize: 2500,
  chunkOverlap: 300,
  enableASTChunking: true,
  supportedExtensions: DEFAULT_CODE_EXTENSIONS,
  ignorePatterns: DEFAULT_IGNORE_PATTERNS,
  batchSize: 100,
  defaultSearchLimit: 5,
  enableHybridSearch: false,
};

function collectionNameFor(value: string): string {
  const hash = createHash("md5").update(value).digest("hex");
  return `code_${hash.substring(0, 8)}`;
}

afterEach(async () => {
  for (const path of tempPaths.splice(0)) {
    await rm(path, { recursive: true, force: true });
  }
});

describe("CodeIndexer collection compatibility", () => {
  it("creates a remote-name alias for an existing legacy path-based collection", async () => {
    const repoPath = await mkdtemp(join(tmpdir(), "qdrant-mcp-indexer-"));
    tempPaths.push(repoPath);
    execFileSync("git", ["init"], { cwd: repoPath, stdio: "ignore" });
    execFileSync("git", ["remote", "add", "origin", "git@github.com:owner/repo.git"], {
      cwd: repoPath,
      stdio: "ignore",
    });

    const realRepoPath = await realpath(repoPath);
    const legacyCollection = collectionNameFor(realRepoPath);
    const remoteCollection = collectionNameFor("owner/repo");

    const existingCollections = new Set([legacyCollection]);
    const qdrant = {
      collectionExists: vi.fn(async (name: string) => existingCollections.has(name)),
      createCollectionAlias: vi.fn(async (aliasName: string) => {
        existingCollections.add(aliasName);
      }),
      getPoint: vi.fn().mockResolvedValue(null),
      getCollectionInfo: vi.fn().mockResolvedValue({
        name: remoteCollection,
        vectorSize: 768,
        pointsCount: 4,
        distance: "Cosine",
        hybridEnabled: false,
      }),
    };
    const embeddings = {
      getDimensions: vi.fn(() => 768),
    };

    const indexer = new CodeIndexer(qdrant as any, embeddings as any, config);
    const status = await indexer.getIndexStatus(realRepoPath);

    expect(qdrant.collectionExists).toHaveBeenCalledWith(remoteCollection);
    expect(qdrant.collectionExists).toHaveBeenCalledWith(legacyCollection);
    expect(qdrant.createCollectionAlias).toHaveBeenCalledWith(remoteCollection, legacyCollection);
    expect(status).toMatchObject({
      isIndexed: true,
      status: "indexed",
      collectionName: remoteCollection,
      chunksCount: 4,
    });
  });
});
