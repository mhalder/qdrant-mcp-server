/**
 * CodeIndexer - Main orchestrator for code vectorization
 */

import { promises as fs } from 'fs';
import { relative, extname, resolve } from 'path';
import { createHash } from 'crypto';
import { QdrantManager } from '../qdrant/client.js';
import { EmbeddingProvider } from '../embeddings/base.js';
import { FileScanner } from './scanner.js';
import { TreeSitterChunker } from './chunker/tree-sitter-chunker.js';
import { MetadataExtractor } from './metadata.js';
import {
  CodeConfig,
  IndexOptions,
  IndexStats,
  IndexStatus,
  SearchOptions,
  CodeSearchResult,
  ProgressCallback,
  CodeChunk,
} from './types.js';

export class CodeIndexer {
  constructor(
    private qdrant: QdrantManager,
    private embeddings: EmbeddingProvider,
    private config: CodeConfig
  ) {}

  /**
   * Index a codebase from scratch or force re-index
   */
  async indexCodebase(
    path: string,
    options?: IndexOptions,
    progressCallback?: ProgressCallback
  ): Promise<IndexStats> {
    const startTime = Date.now();
    const stats: IndexStats = {
      filesScanned: 0,
      filesIndexed: 0,
      chunksCreated: 0,
      durationMs: 0,
      status: 'completed',
      errors: [],
    };

    try {
      const absolutePath = resolve(path);

      // 1. Scan files
      progressCallback?.({
        phase: 'scanning',
        current: 0,
        total: 100,
        percentage: 0,
        message: 'Scanning files...',
      });

      const scanner = new FileScanner({
        supportedExtensions: options?.extensions || this.config.supportedExtensions,
        ignorePatterns: this.config.ignorePatterns,
        customIgnorePatterns: options?.ignorePatterns || this.config.customIgnorePatterns,
      });

      await scanner.loadIgnorePatterns(absolutePath);
      const files = await scanner.scanDirectory(absolutePath);

      stats.filesScanned = files.length;

      if (files.length === 0) {
        stats.status = 'completed';
        stats.durationMs = Date.now() - startTime;
        return stats;
      }

      // 2. Create or verify collection
      const collectionName = this.getCollectionName(absolutePath);
      const collectionExists = await this.qdrant.collectionExists(collectionName);

      if (options?.forceReindex && collectionExists) {
        await this.qdrant.deleteCollection(collectionName);
      }

      if (!collectionExists || options?.forceReindex) {
        const vectorSize = this.embeddings.getDimensions();
        await this.qdrant.createCollection(
          collectionName,
          vectorSize,
          'Cosine',
          this.config.enableHybridSearch
        );
      }

      // 3. Process files and create chunks
      const chunker = new TreeSitterChunker({
        chunkSize: this.config.chunkSize,
        chunkOverlap: this.config.chunkOverlap,
        maxChunkSize: this.config.chunkSize * 2,
      });
      const metadataExtractor = new MetadataExtractor();
      const allChunks: Array<{ chunk: CodeChunk; id: string }> = [];

      for (const [index, filePath] of files.entries()) {
        try {
          progressCallback?.({
            phase: 'chunking',
            current: index + 1,
            total: files.length,
            percentage: Math.round(((index + 1) / files.length) * 40), // 0-40%
            message: `Chunking file ${index + 1}/${files.length}`,
          });

          const code = await fs.readFile(filePath, 'utf-8');

          // Check for secrets (basic detection)
          if (metadataExtractor.containsSecrets(code)) {
            stats.errors?.push(`Skipped ${filePath}: potential secrets detected`);
            continue;
          }

          const language = metadataExtractor.extractLanguage(filePath);
          const chunks = await chunker.chunk(code, filePath, language);

          // Apply chunk limits if configured
          const chunksToAdd = this.config.maxChunksPerFile
            ? chunks.slice(0, this.config.maxChunksPerFile)
            : chunks;

          for (const chunk of chunksToAdd) {
            const id = metadataExtractor.generateChunkId(chunk);
            allChunks.push({ chunk, id });

            // Check total chunk limit
            if (
              this.config.maxTotalChunks &&
              allChunks.length >= this.config.maxTotalChunks
            ) {
              break;
            }
          }

          stats.filesIndexed++;

          // Check total chunk limit
          if (
            this.config.maxTotalChunks &&
            allChunks.length >= this.config.maxTotalChunks
          ) {
            break;
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          stats.errors?.push(`Failed to process ${filePath}: ${errorMessage}`);
        }
      }

      stats.chunksCreated = allChunks.length;

      if (allChunks.length === 0) {
        stats.status = 'completed';
        stats.durationMs = Date.now() - startTime;
        return stats;
      }

      // 4. Generate embeddings and store in batches
      const batchSize = this.config.batchSize;
      for (let i = 0; i < allChunks.length; i += batchSize) {
        const batch = allChunks.slice(i, i + batchSize);

        progressCallback?.({
          phase: 'embedding',
          current: i + batch.length,
          total: allChunks.length,
          percentage: 40 + Math.round(((i + batch.length) / allChunks.length) * 30), // 40-70%
          message: `Generating embeddings ${i + batch.length}/${allChunks.length}`,
        });

        try {
          const texts = batch.map((b) => b.chunk.content);
          const embeddings = await this.embeddings.embedBatch(texts);

          // 5. Store to Qdrant
          const points = batch.map((b, idx) => ({
            id: b.id,
            vector: embeddings[idx].embedding,
            payload: {
              content: b.chunk.content,
              relativePath: relative(absolutePath, b.chunk.metadata.filePath),
              startLine: b.chunk.startLine,
              endLine: b.chunk.endLine,
              fileExtension: extname(b.chunk.metadata.filePath),
              language: b.chunk.metadata.language,
              codebasePath: absolutePath,
              chunkIndex: b.chunk.metadata.chunkIndex,
              ...(b.chunk.metadata.name && { name: b.chunk.metadata.name }),
              ...(b.chunk.metadata.chunkType && { chunkType: b.chunk.metadata.chunkType }),
            },
          }));

          progressCallback?.({
            phase: 'storing',
            current: i + batch.length,
            total: allChunks.length,
            percentage: 70 + Math.round(((i + batch.length) / allChunks.length) * 30), // 70-100%
            message: `Storing chunks ${i + batch.length}/${allChunks.length}`,
          });

          await this.qdrant.addPoints(collectionName, points);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          stats.errors?.push(`Failed to process batch at index ${i}: ${errorMessage}`);
          stats.status = 'partial';
        }
      }

      stats.durationMs = Date.now() - startTime;
      return stats;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      stats.status = 'failed';
      stats.errors?.push(`Indexing failed: ${errorMessage}`);
      stats.durationMs = Date.now() - startTime;
      return stats;
    }
  }

  /**
   * Search code semantically
   */
  async searchCode(
    path: string,
    query: string,
    options?: SearchOptions
  ): Promise<CodeSearchResult[]> {
    const absolutePath = resolve(path);
    const collectionName = this.getCollectionName(absolutePath);

    // Check if collection exists
    const exists = await this.qdrant.collectionExists(collectionName);
    if (!exists) {
      throw new Error(`Codebase not indexed: ${path}`);
    }

    // Generate query embedding
    const { embedding } = await this.embeddings.embed(query);

    // Build filter
    let filter: any = undefined;
    if (options?.fileTypes || options?.pathPattern) {
      filter = { must: [] };

      if (options.fileTypes && options.fileTypes.length > 0) {
        filter.must.push({
          key: 'fileExtension',
          match: { any: options.fileTypes },
        });
      }

      if (options.pathPattern) {
        // Convert glob pattern to regex (simplified)
        const regex = options.pathPattern
          .replace(/\./g, '\\.')
          .replace(/\*/g, '.*')
          .replace(/\?/g, '.');

        filter.must.push({
          key: 'relativePath',
          match: { text: regex },
        });
      }
    }

    // Search
    const results = await this.qdrant.search(
      collectionName,
      embedding,
      options?.limit || this.config.defaultSearchLimit,
      filter
    );

    // Apply score threshold if specified
    const filteredResults = options?.scoreThreshold
      ? results.filter((r) => r.score >= (options.scoreThreshold || 0))
      : results;

    // Format results
    return filteredResults.map((r) => ({
      content: r.payload?.content || '',
      filePath: r.payload?.relativePath || '',
      startLine: r.payload?.startLine || 0,
      endLine: r.payload?.endLine || 0,
      language: r.payload?.language || 'unknown',
      score: r.score,
      fileExtension: r.payload?.fileExtension || '',
    }));
  }

  /**
   * Get indexing status for a codebase
   */
  async getIndexStatus(path: string): Promise<IndexStatus> {
    const absolutePath = resolve(path);
    const collectionName = this.getCollectionName(absolutePath);
    const exists = await this.qdrant.collectionExists(collectionName);

    if (!exists) {
      return { isIndexed: false };
    }

    const info = await this.qdrant.getCollectionInfo(collectionName);

    return {
      isIndexed: true,
      collectionName,
      chunksCount: info.pointsCount,
      // TODO: Extract unique languages and file count from collection
      // This would require scrolling through points or maintaining separate metadata
    };
  }

  /**
   * Clear all indexed data for a codebase
   */
  async clearIndex(path: string): Promise<void> {
    const absolutePath = resolve(path);
    const collectionName = this.getCollectionName(absolutePath);
    const exists = await this.qdrant.collectionExists(collectionName);

    if (exists) {
      await this.qdrant.deleteCollection(collectionName);
    }
  }

  /**
   * Generate deterministic collection name from codebase path
   */
  private getCollectionName(path: string): string {
    const absolutePath = resolve(path);
    const hash = createHash('md5').update(absolutePath).digest('hex');
    return `code_${hash.substring(0, 8)}`;
  }
}
