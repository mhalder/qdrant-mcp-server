/**
 * GitHistoryIndexer - Main orchestrator for git history indexing
 */

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import { resolve } from "node:path";
import logger from "../logger.js";
import type { EmbeddingProvider } from "../embeddings/base.js";
import { BM25SparseVectorGenerator } from "../embeddings/sparse.js";
import type { QdrantManager } from "../qdrant/client.js";
import { CommitChunker } from "./chunker.js";
import { GIT_INDEXING_METADATA_ID } from "./config.js";
import { GitExtractor, normalizeRemoteUrl } from "./extractor.js";
import { GitSynchronizer } from "./sync/synchronizer.js";
import type {
  CommitChunk,
  GitChangeStats,
  GitConfig,
  GitIndexOptions,
  GitIndexStats,
  GitIndexStatus,
  GitProgressCallback,
  GitSearchOptions,
  GitSearchResult,
} from "./types.js";

export class GitHistoryIndexer {
  private log = logger.child({ component: "git-indexer" });

  constructor(
    private qdrant: QdrantManager,
    private embeddings: EmbeddingProvider,
    private config: GitConfig,
  ) {}

  /**
   * Validate that a path doesn't attempt directory traversal
   */
  private async validatePath(path: string): Promise<string> {
    const absolutePath = resolve(path);

    try {
      const realPath = await fs.realpath(absolutePath);
      return realPath;
    } catch {
      return absolutePath;
    }
  }

  /**
   * Index git history for a repository
   */
  async indexHistory(
    path: string,
    options?: GitIndexOptions,
    progressCallback?: GitProgressCallback,
  ): Promise<GitIndexStats> {
    const startTime = Date.now();
    const stats: GitIndexStats = {
      commitsScanned: 0,
      commitsIndexed: 0,
      chunksCreated: 0,
      durationMs: 0,
      status: "completed",
      errors: [],
    };

    const absolutePath = await this.validatePath(path);
    const collectionName = await this.getCollectionName(absolutePath);

    this.log.info(
      { path: absolutePath, collectionName },
      "Git indexing started",
    );

    try {
      // 1. Validate repository
      const extractor = new GitExtractor(absolutePath, this.config);

      progressCallback?.({
        phase: "extracting",
        current: 0,
        total: 100,
        percentage: 0,
        message: "Validating git repository...",
      });

      const isValid = await extractor.validateRepository();
      if (!isValid) {
        throw new Error(`Not a valid git repository: ${path}`);
      }

      // 2. Create or verify collection
      const collectionExists =
        await this.qdrant.collectionExists(collectionName);

      if (options?.forceReindex && collectionExists) {
        await this.qdrant.deleteCollection(collectionName);
      }

      if (!collectionExists || options?.forceReindex) {
        const vectorSize = this.embeddings.getDimensions();
        await this.qdrant.createCollection(
          collectionName,
          vectorSize,
          "Cosine",
          this.config.enableHybridSearch,
        );
      }

      // Store "indexing in progress" marker
      await this.storeIndexingMarker(collectionName, false);

      // 3. Extract commits
      progressCallback?.({
        phase: "extracting",
        current: 0,
        total: 100,
        percentage: 5,
        message: "Extracting git commits...",
      });

      const commits = await extractor.getCommits({
        sinceDate: options?.sinceDate,
        maxCommits: options?.maxCommits ?? this.config.maxCommits,
      });

      stats.commitsScanned = commits.length;
      this.log.info({ commitsExtracted: commits.length }, "Commits extracted");

      if (commits.length === 0) {
        await this.storeIndexingMarker(collectionName, true);
        stats.status = "completed";
        stats.durationMs = Date.now() - startTime;
        return stats;
      }

      // 4. Create chunks
      const chunker = new CommitChunker(this.config);
      const allChunks: Array<{ chunk: CommitChunk; id: string }> = [];

      for (const [index, commit] of commits.entries()) {
        try {
          progressCallback?.({
            phase: "chunking",
            current: index + 1,
            total: commits.length,
            percentage: 10 + Math.round(((index + 1) / commits.length) * 30),
            message: `Creating chunks ${index + 1}/${commits.length}`,
          });

          // Get diff if configured
          let diff: string | undefined;
          if (this.config.includeDiff) {
            diff = await extractor.getCommitDiff(commit.hash);
          }

          const chunks = chunker.createChunks(commit, absolutePath, diff);

          for (const chunk of chunks) {
            const id = chunker.generateChunkId(chunk);
            allChunks.push({ chunk, id });
          }

          stats.commitsIndexed++;
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          stats.errors?.push(
            `Failed to process commit ${commit.shortHash}: ${errorMessage}`,
          );
        }
      }

      stats.chunksCreated = allChunks.length;

      if (allChunks.length === 0) {
        await this.storeIndexingMarker(collectionName, true);
        stats.status = "completed";
        stats.durationMs = Date.now() - startTime;
        return stats;
      }

      // 5. Generate embeddings and store in batches
      const batchSize = this.config.batchSize;
      this.log.debug(
        { totalChunks: allChunks.length, batchSize },
        "Starting embedding generation",
      );
      for (let i = 0; i < allChunks.length; i += batchSize) {
        const batch = allChunks.slice(i, i + batchSize);

        progressCallback?.({
          phase: "embedding",
          current: i + batch.length,
          total: allChunks.length,
          percentage:
            40 + Math.round(((i + batch.length) / allChunks.length) * 30),
          message: `Generating embeddings ${i + batch.length}/${allChunks.length}`,
        });

        // Retry logic for batch processing
        let lastError: Error | null = null;
        let success = false;

        for (
          let attempt = 1;
          attempt <= this.config.batchRetryAttempts;
          attempt++
        ) {
          try {
            const texts = batch.map((b) => b.chunk.content);
            const embeddings = await this.embeddings.embedBatch(texts);

            progressCallback?.({
              phase: "storing",
              current: i + batch.length,
              total: allChunks.length,
              percentage:
                70 + Math.round(((i + batch.length) / allChunks.length) * 30),
              message: `Storing chunks ${i + batch.length}/${allChunks.length}`,
            });

            const points = batch.map((b, idx) => ({
              id: b.id,
              vector: embeddings[idx].embedding,
              payload: {
                content: b.chunk.content,
                commitHash: b.chunk.metadata.commitHash,
                shortHash: b.chunk.metadata.shortHash,
                author: b.chunk.metadata.author,
                authorEmail: b.chunk.metadata.authorEmail,
                date: b.chunk.metadata.date,
                subject: b.chunk.metadata.subject,
                commitType: b.chunk.metadata.commitType,
                files: b.chunk.metadata.files,
                insertions: b.chunk.metadata.insertions,
                deletions: b.chunk.metadata.deletions,
                repoPath: absolutePath,
              },
            }));

            if (this.config.enableHybridSearch) {
              const sparseGenerator = new BM25SparseVectorGenerator();
              const hybridPoints = points.map((point, idx) => ({
                ...point,
                sparseVector: sparseGenerator.generate(
                  batch[idx].chunk.content,
                ),
              }));
              await this.qdrant.addPointsWithSparse(
                collectionName,
                hybridPoints,
              );
            } else {
              await this.qdrant.addPoints(collectionName, points);
            }

            success = true;
            break;
          } catch (error) {
            lastError =
              error instanceof Error ? error : new Error(String(error));
            if (attempt < this.config.batchRetryAttempts) {
              // Exponential backoff: 1s, 2s, 4s...
              const delay = Math.pow(2, attempt - 1) * 1000;
              await new Promise((resolve) => setTimeout(resolve, delay));
            }
          }
        }

        if (!success && lastError) {
          stats.errors?.push(
            `Failed to process batch at index ${i} after ${this.config.batchRetryAttempts} attempts: ${lastError.message}`,
          );
          stats.status = "partial";
        }
      }

      // 6. Save snapshot for incremental updates
      try {
        const latestHash = await extractor.getLatestCommitHash();
        const synchronizer = new GitSynchronizer(absolutePath, collectionName);
        await synchronizer.updateSnapshot(latestHash, stats.commitsIndexed);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.log.error({ err: error }, "Failed to save snapshot");
        stats.errors?.push(`Snapshot save failed: ${errorMessage}`);
      }

      // Store completion marker
      await this.storeIndexingMarker(collectionName, true);

      stats.durationMs = Date.now() - startTime;
      this.log.info(
        {
          commitsIndexed: stats.commitsIndexed,
          chunksCreated: stats.chunksCreated,
          durationMs: stats.durationMs,
        },
        "Git indexing complete",
      );
      return stats;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      stats.status = "failed";
      stats.errors?.push(`Indexing failed: ${errorMessage}`);
      stats.durationMs = Date.now() - startTime;
      return stats;
    }
  }

  /**
   * Search indexed git history
   */
  async searchHistory(
    path: string,
    query: string,
    options?: GitSearchOptions,
  ): Promise<GitSearchResult[]> {
    // Validate date range if both dates are provided
    if (options?.dateFrom && options?.dateTo) {
      const fromDate = new Date(options.dateFrom);
      const toDate = new Date(options.dateTo);
      if (fromDate > toDate) {
        throw new Error(
          `Invalid date range: dateFrom (${options.dateFrom}) must be before dateTo (${options.dateTo})`,
        );
      }
    }

    const absolutePath = await this.validatePath(path);
    const collectionName = await this.getCollectionName(absolutePath);

    // Check if collection exists
    const exists = await this.qdrant.collectionExists(collectionName);
    if (!exists) {
      throw new Error(`Git history not indexed: ${path}`);
    }

    // Check if collection has hybrid search enabled
    const collectionInfo = await this.qdrant.getCollectionInfo(collectionName);
    const useHybrid =
      (options?.useHybrid ?? this.config.enableHybridSearch) &&
      collectionInfo.hybridEnabled;

    // Generate query embedding
    const { embedding } = await this.embeddings.embed(query);

    // Build filter
    const filter = this.buildSearchFilter(options);

    // Search
    let results;
    if (useHybrid) {
      const sparseGenerator = new BM25SparseVectorGenerator();
      const sparseVector = sparseGenerator.generate(query);
      results = await this.qdrant.hybridSearch(
        collectionName,
        embedding,
        sparseVector,
        options?.limit || this.config.defaultSearchLimit,
        filter,
      );
    } else {
      results = await this.qdrant.search(
        collectionName,
        embedding,
        options?.limit || this.config.defaultSearchLimit,
        filter,
      );
    }

    // Apply score threshold if specified
    const filteredResults = options?.scoreThreshold
      ? results.filter((r) => r.score >= (options.scoreThreshold || 0))
      : results;

    // Format results
    return filteredResults.map((r) => ({
      content: r.payload?.content || "",
      commitHash: r.payload?.commitHash || "",
      shortHash: r.payload?.shortHash || "",
      author: r.payload?.author || "",
      date: r.payload?.date || "",
      subject: r.payload?.subject || "",
      commitType: r.payload?.commitType || "other",
      files: r.payload?.files || [],
      score: r.score,
    }));
  }

  /**
   * Get indexing status for a repository
   */
  async getIndexStatus(path: string): Promise<GitIndexStatus> {
    const absolutePath = await this.validatePath(path);
    const collectionName = await this.getCollectionName(absolutePath);
    const exists = await this.qdrant.collectionExists(collectionName);

    if (!exists) {
      return { isIndexed: false, status: "not_indexed" };
    }

    // Check for indexing marker
    const indexingMarker = await this.qdrant.getPoint(
      collectionName,
      GIT_INDEXING_METADATA_ID,
    );
    const info = await this.qdrant.getCollectionInfo(collectionName);

    const isComplete = indexingMarker?.payload?.indexingComplete === true;
    const isInProgress = indexingMarker?.payload?.indexingComplete === false;

    // Subtract 1 from points count if marker exists
    const actualChunksCount = indexingMarker
      ? Math.max(0, info.pointsCount - 1)
      : info.pointsCount;

    // Load snapshot for additional info
    const synchronizer = new GitSynchronizer(absolutePath, collectionName);
    const hasSnapshot = await synchronizer.initialize();

    if (isInProgress) {
      return {
        isIndexed: false,
        status: "indexing",
        collectionName,
        chunksCount: actualChunksCount,
      };
    }

    if (isComplete) {
      return {
        isIndexed: true,
        status: "indexed",
        collectionName,
        chunksCount: actualChunksCount,
        commitsCount: hasSnapshot
          ? synchronizer.getCommitsIndexed()
          : undefined,
        lastCommitHash: hasSnapshot
          ? (synchronizer.getLastCommitHash() ?? undefined)
          : undefined,
        lastIndexedAt: hasSnapshot
          ? (synchronizer.getLastIndexedAt() ?? undefined)
          : indexingMarker?.payload?.completedAt
            ? new Date(indexingMarker.payload.completedAt)
            : undefined,
      };
    }

    // Legacy collection (no marker) - check if it has content
    if (actualChunksCount > 0) {
      return {
        isIndexed: true,
        status: "indexed",
        collectionName,
        chunksCount: actualChunksCount,
        commitsCount: hasSnapshot
          ? synchronizer.getCommitsIndexed()
          : undefined,
        lastCommitHash: hasSnapshot
          ? (synchronizer.getLastCommitHash() ?? undefined)
          : undefined,
      };
    }

    return {
      isIndexed: false,
      status: "not_indexed",
      collectionName,
      chunksCount: 0,
    };
  }

  /**
   * Index only new commits since last indexing
   */
  async indexNewCommits(
    path: string,
    progressCallback?: GitProgressCallback,
  ): Promise<GitChangeStats> {
    const startTime = Date.now();
    const stats: GitChangeStats = {
      newCommits: 0,
      chunksAdded: 0,
      durationMs: 0,
    };

    const absolutePath = await this.validatePath(path);
    const collectionName = await this.getCollectionName(absolutePath);

    // Check if collection exists
    const exists = await this.qdrant.collectionExists(collectionName);
    if (!exists) {
      throw new Error(
        `Git history not indexed: ${path}. Use index_git_history first.`,
      );
    }

    // Initialize synchronizer
    const synchronizer = new GitSynchronizer(absolutePath, collectionName);
    const hasSnapshot = await synchronizer.initialize();

    if (!hasSnapshot) {
      throw new Error(
        "No previous snapshot found. Use index_git_history for initial indexing.",
      );
    }

    const lastCommitHash = synchronizer.getLastCommitHash();
    if (!lastCommitHash) {
      throw new Error("Invalid snapshot: no last commit hash.");
    }

    // Extract new commits
    const extractor = new GitExtractor(absolutePath, this.config);

    progressCallback?.({
      phase: "extracting",
      current: 0,
      total: 100,
      percentage: 0,
      message: "Checking for new commits...",
    });

    const newCommits = await extractor.getCommits({
      sinceCommit: lastCommitHash,
    });

    stats.newCommits = newCommits.length;
    this.log.info({ newCommits: newCommits.length }, "New commits found");

    if (newCommits.length === 0) {
      stats.durationMs = Date.now() - startTime;
      return stats;
    }

    // Process new commits
    const chunker = new CommitChunker(this.config);
    const allChunks: Array<{ chunk: CommitChunk; id: string }> = [];

    for (const [index, commit] of newCommits.entries()) {
      progressCallback?.({
        phase: "chunking",
        current: index + 1,
        total: newCommits.length,
        percentage: Math.round(((index + 1) / newCommits.length) * 40),
        message: `Processing commit ${index + 1}/${newCommits.length}`,
      });

      let diff: string | undefined;
      if (this.config.includeDiff) {
        diff = await extractor.getCommitDiff(commit.hash);
      }

      const chunks = chunker.createChunks(commit, absolutePath, diff);
      for (const chunk of chunks) {
        const id = chunker.generateChunkId(chunk);
        allChunks.push({ chunk, id });
      }
    }

    stats.chunksAdded = allChunks.length;

    // Generate embeddings and store
    const batchSize = this.config.batchSize;
    for (let i = 0; i < allChunks.length; i += batchSize) {
      const batch = allChunks.slice(i, i + batchSize);

      progressCallback?.({
        phase: "embedding",
        current: i + batch.length,
        total: allChunks.length,
        percentage:
          40 + Math.round(((i + batch.length) / allChunks.length) * 30),
        message: `Generating embeddings ${i + batch.length}/${allChunks.length}`,
      });

      const texts = batch.map((b) => b.chunk.content);
      const embeddings = await this.embeddings.embedBatch(texts);

      progressCallback?.({
        phase: "storing",
        current: i + batch.length,
        total: allChunks.length,
        percentage:
          70 + Math.round(((i + batch.length) / allChunks.length) * 30),
        message: `Storing chunks ${i + batch.length}/${allChunks.length}`,
      });

      const points = batch.map((b, idx) => ({
        id: b.id,
        vector: embeddings[idx].embedding,
        payload: {
          content: b.chunk.content,
          commitHash: b.chunk.metadata.commitHash,
          shortHash: b.chunk.metadata.shortHash,
          author: b.chunk.metadata.author,
          authorEmail: b.chunk.metadata.authorEmail,
          date: b.chunk.metadata.date,
          subject: b.chunk.metadata.subject,
          commitType: b.chunk.metadata.commitType,
          files: b.chunk.metadata.files,
          insertions: b.chunk.metadata.insertions,
          deletions: b.chunk.metadata.deletions,
          repoPath: absolutePath,
        },
      }));

      if (this.config.enableHybridSearch) {
        const sparseGenerator = new BM25SparseVectorGenerator();
        const hybridPoints = points.map((point, idx) => ({
          ...point,
          sparseVector: sparseGenerator.generate(batch[idx].chunk.content),
        }));
        await this.qdrant.addPointsWithSparse(collectionName, hybridPoints);
      } else {
        await this.qdrant.addPoints(collectionName, points);
      }
    }

    // Update snapshot
    const latestHash = await extractor.getLatestCommitHash();
    const totalCommits = synchronizer.getCommitsIndexed() + newCommits.length;
    await synchronizer.updateSnapshot(latestHash, totalCommits);

    stats.durationMs = Date.now() - startTime;
    return stats;
  }

  /**
   * Clear all indexed data for a repository
   */
  async clearIndex(path: string): Promise<void> {
    this.log.info({ path }, "Clearing git index");
    const absolutePath = await this.validatePath(path);
    const collectionName = await this.getCollectionName(absolutePath);
    const exists = await this.qdrant.collectionExists(collectionName);

    if (exists) {
      await this.qdrant.deleteCollection(collectionName);
    }

    // Also delete snapshot
    try {
      const synchronizer = new GitSynchronizer(absolutePath, collectionName);
      await synchronizer.deleteSnapshot();
    } catch {
      // Ignore snapshot deletion errors
    }
  }

  /**
   * Store indexing status marker in the collection
   */
  private async storeIndexingMarker(
    collectionName: string,
    complete: boolean,
  ): Promise<void> {
    try {
      const vectorSize = this.embeddings.getDimensions();
      const zeroVector = new Array(vectorSize).fill(0);

      const collectionInfo =
        await this.qdrant.getCollectionInfo(collectionName);

      const payload = {
        _type: "git_indexing_metadata",
        indexingComplete: complete,
        ...(complete
          ? { completedAt: new Date().toISOString() }
          : { startedAt: new Date().toISOString() }),
      };

      if (collectionInfo.hybridEnabled) {
        await this.qdrant.addPointsWithSparse(collectionName, [
          {
            id: GIT_INDEXING_METADATA_ID,
            vector: zeroVector,
            sparseVector: { indices: [], values: [] },
            payload,
          },
        ]);
      } else {
        await this.qdrant.addPoints(collectionName, [
          {
            id: GIT_INDEXING_METADATA_ID,
            vector: zeroVector,
            payload,
          },
        ]);
      }
    } catch (error) {
      this.log.error({ err: error }, "Failed to store indexing marker");
    }
  }

  /**
   * Build search filter from options
   */
  private buildSearchFilter(options?: GitSearchOptions): any {
    if (
      !options?.commitTypes?.length &&
      !options?.authors?.length &&
      !options?.dateFrom &&
      !options?.dateTo
    ) {
      return undefined;
    }

    const must: any[] = [];

    // Filter by commit types
    if (options.commitTypes && options.commitTypes.length > 0) {
      must.push({
        key: "commitType",
        match: { any: options.commitTypes },
      });
    }

    // Filter by authors
    if (options.authors && options.authors.length > 0) {
      must.push({
        should: options.authors.map((author) => ({
          key: "author",
          match: { text: author },
        })),
      });
    }

    // Filter by date range
    if (options.dateFrom) {
      must.push({
        key: "date",
        range: { gte: options.dateFrom },
      });
    }

    if (options.dateTo) {
      must.push({
        key: "date",
        range: { lte: options.dateTo },
      });
    }

    return must.length > 0 ? { must } : undefined;
  }

  /**
   * Generate deterministic collection name from repository path.
   * Uses git remote URL for consistent naming across machines, with fallback to full path.
   */
  private async getCollectionName(path: string): Promise<string> {
    const absolutePath = resolve(path);
    const extractor = new GitExtractor(absolutePath, this.config);

    // Try to get remote URL for consistent naming across machines
    const remoteUrl = await extractor.getRemoteUrl();
    const normalized = normalizeRemoteUrl(remoteUrl);

    // Use normalized remote URL if available, otherwise fall back to full absolute path
    const identifier = normalized || absolutePath;
    const hash = createHash("md5").update(identifier).digest("hex");
    return `git_${hash.substring(0, 8)}`;
  }
}
