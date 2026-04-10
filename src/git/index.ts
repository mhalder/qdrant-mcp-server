/**
 * Git history indexing module - barrel export
 */

export { CommitChunker } from "./chunker.js";

// Config
export { COMMIT_TYPE_PATTERNS, DEFAULT_GIT_CONFIG } from "./config.js";
export { GitExtractor } from "./extractor.js";
// Main classes
export { GitHistoryIndexer } from "./indexer.js";
export { GitSynchronizer } from "./sync/synchronizer.js";
// Types
export type {
  CommitChunk,
  CommitType,
  GitChangeStats,
  GitConfig,
  GitExtractOptions,
  GitIndexingStatus,
  GitIndexOptions,
  GitIndexStats,
  GitIndexStatus,
  GitProgressCallback,
  GitProgressUpdate,
  GitSearchOptions,
  GitSearchResult,
  GitSnapshot,
  RawCommit,
} from "./types.js";
