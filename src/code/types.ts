/**
 * Type definitions for code vectorization module
 */

export interface CodeConfig {
  // Chunking
  chunkSize: number;
  chunkOverlap: number;
  enableASTChunking: boolean;

  // File discovery
  supportedExtensions: string[];
  ignorePatterns: string[];
  customExtensions?: string[];
  customIgnorePatterns?: string[];

  // Indexing
  batchSize: number; // Embeddings per batch
  maxChunksPerFile?: number;
  maxTotalChunks?: number;

  // Search
  defaultSearchLimit: number;
  enableHybridSearch: boolean;
}

export interface ScannerConfig {
  supportedExtensions: string[];
  ignorePatterns: string[];
  customIgnorePatterns?: string[];
}

export interface ChunkerConfig {
  chunkSize: number;
  chunkOverlap: number;
  maxChunkSize: number;
}

export interface IndexOptions {
  forceReindex?: boolean;
  extensions?: string[];
  ignorePatterns?: string[];
}

export interface IndexStats {
  filesScanned: number;
  filesIndexed: number;
  chunksCreated: number;
  durationMs: number;
  status: "completed" | "partial" | "failed";
  errors?: string[];
}

export interface ChangeStats {
  filesAdded: number;
  filesModified: number;
  filesDeleted: number;
  chunksAdded: number;
  chunksDeleted: number;
  durationMs: number;
}

export interface CodeSearchResult {
  content: string;
  filePath: string;
  startLine: number;
  endLine: number;
  language: string;
  score: number;
  fileExtension: string;
}

export interface SearchOptions {
  limit?: number;
  useHybrid?: boolean;
  fileTypes?: string[];
  pathPattern?: string;
  scoreThreshold?: number;
}

export interface IndexStatus {
  isIndexed: boolean;
  collectionName?: string;
  filesCount?: number;
  chunksCount?: number;
  lastUpdated?: Date;
  languages?: string[];
}

export type ProgressCallback = (progress: ProgressUpdate) => void;

export interface ProgressUpdate {
  phase: "scanning" | "chunking" | "embedding" | "storing";
  current: number;
  total: number;
  percentage: number;
  message: string;
}

export interface CodeChunk {
  content: string;
  startLine: number;
  endLine: number;
  metadata: {
    filePath: string;
    language: string;
    chunkIndex: number;
    chunkType?: "function" | "class" | "interface" | "block";
    name?: string; // Function/class name if applicable
  };
}

export interface FileChanges {
  added: string[];
  modified: string[];
  deleted: string[];
}
