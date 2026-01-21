/**
 * Type definitions for git history indexing module
 */

/**
 * Commit type classification based on conventional commits
 */
export type CommitType =
  | "feat"
  | "fix"
  | "refactor"
  | "docs"
  | "test"
  | "chore"
  | "style"
  | "perf"
  | "build"
  | "ci"
  | "revert"
  | "other";

/**
 * Configuration for git history indexing
 */
export interface GitConfig {
  // Commit extraction
  maxCommits: number; // Max commits to index per run
  includeFileList: boolean; // Include changed file list in chunks
  includeDiff: boolean; // Include truncated diff in chunks
  maxDiffSize: number; // Max bytes of diff per commit

  // Chunking
  maxChunkSize: number; // Max characters per chunk

  // Indexing
  batchSize: number; // Embeddings per batch

  // Search
  defaultSearchLimit: number; // Default search results
  enableHybridSearch: boolean; // Enable hybrid search
}

/**
 * Raw commit data parsed from git log
 */
export interface RawCommit {
  hash: string; // Full commit hash
  shortHash: string; // Short hash (7 chars)
  author: string; // Author name
  authorEmail: string; // Author email
  date: Date; // Commit date
  subject: string; // First line of commit message
  body: string; // Full commit message body
  files: string[]; // Changed files
  insertions: number; // Lines added
  deletions: number; // Lines deleted
}

/**
 * Embeddable chunk created from a commit
 */
export interface CommitChunk {
  content: string; // Text content for embedding
  metadata: {
    commitHash: string;
    shortHash: string;
    author: string;
    authorEmail: string;
    date: string; // ISO date string
    subject: string;
    commitType: CommitType;
    files: string[];
    insertions: number;
    deletions: number;
    repoPath: string;
  };
}

/**
 * Options for indexing git history
 */
export interface GitIndexOptions {
  forceReindex?: boolean; // Delete existing and re-index
  sinceDate?: string; // ISO date string - only index commits after this date
  maxCommits?: number; // Override config maxCommits
}

/**
 * Statistics from indexing operation
 */
export interface GitIndexStats {
  commitsScanned: number;
  commitsIndexed: number;
  chunksCreated: number;
  durationMs: number;
  status: "completed" | "partial" | "failed";
  errors?: string[];
}

/**
 * Statistics from incremental update operation
 */
export interface GitChangeStats {
  newCommits: number;
  chunksAdded: number;
  durationMs: number;
}

/**
 * Search result from git history
 */
export interface GitSearchResult {
  content: string;
  commitHash: string;
  shortHash: string;
  author: string;
  date: string;
  subject: string;
  commitType: CommitType;
  files: string[];
  score: number;
}

/**
 * Search options for git history
 */
export interface GitSearchOptions {
  limit?: number;
  useHybrid?: boolean;
  commitTypes?: CommitType[]; // Filter by commit type
  authors?: string[]; // Filter by author name/email
  dateFrom?: string; // ISO date string - only commits after
  dateTo?: string; // ISO date string - only commits before
  scoreThreshold?: number;
}

/**
 * Indexing status for a repository
 */
export type GitIndexingStatus = "not_indexed" | "indexing" | "indexed";

/**
 * Status information for a git history index
 */
export interface GitIndexStatus {
  /** @deprecated Use `status` instead. True only when status is 'indexed'. */
  isIndexed: boolean;
  /** Current indexing status: 'not_indexed', 'indexing', or 'indexed' */
  status: GitIndexingStatus;
  collectionName?: string;
  commitsCount?: number;
  chunksCount?: number;
  lastCommitHash?: string;
  lastIndexedAt?: Date;
}

/**
 * Progress callback for indexing operations
 */
export type GitProgressCallback = (progress: GitProgressUpdate) => void;

/**
 * Progress update during indexing
 */
export interface GitProgressUpdate {
  phase: "extracting" | "chunking" | "embedding" | "storing";
  current: number;
  total: number;
  percentage: number;
  message: string;
}

/**
 * Snapshot for tracking last indexed commit
 */
export interface GitSnapshot {
  repoPath: string;
  lastCommitHash: string;
  lastIndexedAt: number; // Unix timestamp
  commitsIndexed: number;
}

/**
 * Options for extracting commits from git
 */
export interface GitExtractOptions {
  sinceCommit?: string; // Only commits after this hash
  sinceDate?: string; // Only commits after this date (ISO string)
  maxCommits?: number; // Limit number of commits
}
