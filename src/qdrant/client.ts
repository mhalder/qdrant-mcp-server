import { createHash } from "node:crypto";
import { QdrantClient } from "@qdrant/js-client-rest";

export interface CollectionInfo {
  name: string;
  vectorSize: number;
  pointsCount: number;
  distance: "Cosine" | "Euclid" | "Dot";
  hybridEnabled?: boolean;
}

export interface SearchResult {
  id: string | number;
  score: number;
  payload?: Record<string, any>;
}

export interface SparseVector {
  indices: number[];
  values: number[];
}

export class QdrantManager {
  private client: QdrantClient;

  constructor(url: string = "http://localhost:6333", apiKey?: string) {
    this.client = new QdrantClient({ url, apiKey });
  }

  /**
   * Converts a string ID to UUID format if it's not already a UUID.
   * Qdrant requires string IDs to be in UUID format.
   */
  private normalizeId(id: string | number): string | number {
    if (typeof id === "number") {
      return id;
    }

    // Check if already a valid UUID (8-4-4-4-12 format)
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(id)) {
      return id;
    }

    // Convert arbitrary string to deterministic UUID v5-like format
    const hash = createHash("sha256").update(id).digest("hex");
    return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
  }

  async createCollection(
    name: string,
    vectorSize: number,
    distance: "Cosine" | "Euclid" | "Dot" = "Cosine",
    enableSparse: boolean = false,
  ): Promise<void> {
    const config: any = {};

    // When hybrid search is enabled, use named vectors
    if (enableSparse) {
      config.vectors = {
        dense: {
          size: vectorSize,
          distance,
        },
      };
      config.sparse_vectors = {
        text: {
          modifier: "idf",
        },
      };
    } else {
      // Standard unnamed vector configuration
      config.vectors = {
        size: vectorSize,
        distance,
      };
    }

    await this.client.createCollection(name, config);
  }

  async collectionExists(name: string): Promise<boolean> {
    try {
      await this.client.getCollection(name);
      return true;
    } catch {
      return false;
    }
  }

  async listCollections(): Promise<string[]> {
    const response = await this.client.getCollections();
    return response.collections.map((c) => c.name);
  }

  async getCollectionInfo(name: string): Promise<CollectionInfo> {
    const info = await this.client.getCollection(name);
    const vectorConfig = info.config.params.vectors;

    // Handle both named and unnamed vector configurations
    let size = 0;
    let distance: "Cosine" | "Euclid" | "Dot" = "Cosine";
    let hybridEnabled = false;

    // Check if sparse vectors are configured
    if (info.config.params.sparse_vectors) {
      hybridEnabled = true;
    }

    if (typeof vectorConfig === "object" && vectorConfig !== null) {
      // Check for unnamed vector config (has 'size' directly)
      if ("size" in vectorConfig) {
        size = typeof vectorConfig.size === "number" ? vectorConfig.size : 0;
        distance = vectorConfig.distance as "Cosine" | "Euclid" | "Dot";
      } else if ("dense" in vectorConfig) {
        // Named vector config for hybrid search
        const denseConfig = vectorConfig.dense as any;
        size = typeof denseConfig.size === "number" ? denseConfig.size : 0;
        distance = denseConfig.distance as "Cosine" | "Euclid" | "Dot";
      }
    }

    return {
      name,
      vectorSize: size,
      pointsCount: info.points_count || 0,
      distance,
      hybridEnabled,
    };
  }

  async deleteCollection(name: string): Promise<void> {
    await this.client.deleteCollection(name);
  }

  async addPoints(
    collectionName: string,
    points: Array<{
      id: string | number;
      vector: number[];
      payload?: Record<string, any>;
    }>,
  ): Promise<void> {
    try {
      // Normalize all IDs to ensure string IDs are in UUID format
      const normalizedPoints = points.map((point) => ({
        ...point,
        id: this.normalizeId(point.id),
      }));

      await this.client.upsert(collectionName, {
        wait: true,
        points: normalizedPoints,
      });
    } catch (error: any) {
      const errorMessage =
        error?.data?.status?.error || error?.message || String(error);
      throw new Error(
        `Failed to add points to collection "${collectionName}": ${errorMessage}`,
      );
    }
  }

  async search(
    collectionName: string,
    vector: number[],
    limit: number = 5,
    filter?: Record<string, any>,
  ): Promise<SearchResult[]> {
    // Convert simple key-value filter to Qdrant filter format
    // Accepts either:
    // 1. Simple format: {"category": "database"}
    // 2. Qdrant format: {must: [{key: "category", match: {value: "database"}}]}
    let qdrantFilter;
    if (filter && Object.keys(filter).length > 0) {
      // Check if already in Qdrant format (has must/should/must_not keys)
      if (filter.must || filter.should || filter.must_not) {
        qdrantFilter = filter;
      } else {
        // Convert simple key-value format to Qdrant format
        qdrantFilter = {
          must: Object.entries(filter).map(([key, value]) => ({
            key,
            match: { value },
          })),
        };
      }
    }

    // Check if collection uses named vectors (hybrid mode)
    const collectionInfo = await this.getCollectionInfo(collectionName);

    const results = await this.client.search(collectionName, {
      vector: collectionInfo.hybridEnabled ? { name: "dense", vector } : vector,
      limit,
      filter: qdrantFilter,
    });

    return results.map((result) => ({
      id: result.id,
      score: result.score,
      payload: result.payload || undefined,
    }));
  }

  async getPoint(
    collectionName: string,
    id: string | number,
  ): Promise<{ id: string | number; payload?: Record<string, any> } | null> {
    try {
      const normalizedId = this.normalizeId(id);
      const points = await this.client.retrieve(collectionName, {
        ids: [normalizedId],
      });

      if (points.length === 0) {
        return null;
      }

      return {
        id: points[0].id,
        payload: points[0].payload || undefined,
      };
    } catch {
      return null;
    }
  }

  async deletePoints(
    collectionName: string,
    ids: (string | number)[],
  ): Promise<void> {
    // Normalize IDs to ensure string IDs are in UUID format
    const normalizedIds = ids.map((id) => this.normalizeId(id));

    await this.client.delete(collectionName, {
      wait: true,
      points: normalizedIds,
    });
  }

  /**
   * Deletes points matching a filter condition.
   * Useful for deleting all chunks associated with a specific file path.
   */
  async deletePointsByFilter(
    collectionName: string,
    filter: Record<string, any>,
  ): Promise<void> {
    await this.client.delete(collectionName, {
      wait: true,
      filter: filter,
    });
  }

  /**
   * Performs hybrid search combining semantic vector search with sparse vector (keyword) search
   * using Reciprocal Rank Fusion (RRF) to combine results
   */
  async hybridSearch(
    collectionName: string,
    denseVector: number[],
    sparseVector: SparseVector,
    limit: number = 5,
    filter?: Record<string, any>,
    _semanticWeight: number = 0.7,
  ): Promise<SearchResult[]> {
    // Convert simple key-value filter to Qdrant filter format
    let qdrantFilter;
    if (filter && Object.keys(filter).length > 0) {
      if (filter.must || filter.should || filter.must_not) {
        qdrantFilter = filter;
      } else {
        qdrantFilter = {
          must: Object.entries(filter).map(([key, value]) => ({
            key,
            match: { value },
          })),
        };
      }
    }

    // Calculate prefetch limits based on weights
    // We fetch more results than needed to ensure good fusion results
    const prefetchLimit = Math.max(20, limit * 4);

    try {
      const results = await this.client.query(collectionName, {
        prefetch: [
          {
            query: denseVector,
            using: "dense",
            limit: prefetchLimit,
            filter: qdrantFilter,
          },
          {
            query: sparseVector,
            using: "text",
            limit: prefetchLimit,
            filter: qdrantFilter,
          },
        ],
        query: {
          fusion: "rrf",
        },
        limit: limit,
        with_payload: true,
      });

      return results.points.map((result: any) => ({
        id: result.id,
        score: result.score,
        payload: result.payload || undefined,
      }));
    } catch (error: any) {
      const errorMessage =
        error?.data?.status?.error || error?.message || String(error);
      throw new Error(
        `Hybrid search failed on collection "${collectionName}": ${errorMessage}`,
      );
    }
  }

  /**
   * Adds points with both dense and sparse vectors for hybrid search
   */
  async addPointsWithSparse(
    collectionName: string,
    points: Array<{
      id: string | number;
      vector: number[];
      sparseVector: SparseVector;
      payload?: Record<string, any>;
    }>,
  ): Promise<void> {
    try {
      // Normalize all IDs to ensure string IDs are in UUID format
      const normalizedPoints = points.map((point) => ({
        id: this.normalizeId(point.id),
        vector: {
          dense: point.vector,
          text: point.sparseVector,
        },
        payload: point.payload,
      }));

      await this.client.upsert(collectionName, {
        wait: true,
        points: normalizedPoints,
      });
    } catch (error: any) {
      const errorMessage =
        error?.data?.status?.error || error?.message || String(error);
      throw new Error(
        `Failed to add points with sparse vectors to collection "${collectionName}": ${errorMessage}`,
      );
    }
  }
}
