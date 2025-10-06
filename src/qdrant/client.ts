import { QdrantClient } from '@qdrant/js-client-rest';
import { createHash } from 'crypto';

export interface CollectionInfo {
  name: string;
  vectorSize: number;
  pointsCount: number;
  distance: 'Cosine' | 'Euclid' | 'Dot';
}

export interface SearchResult {
  id: string | number;
  score: number;
  payload?: Record<string, any>;
}

export class QdrantManager {
  private client: QdrantClient;

  constructor(url: string = 'http://localhost:6333') {
    this.client = new QdrantClient({ url });
  }

  /**
   * Converts a string ID to UUID format if it's not already a UUID.
   * Qdrant requires string IDs to be in UUID format.
   */
  private normalizeId(id: string | number): string | number {
    if (typeof id === 'number') {
      return id;
    }

    // Check if already a valid UUID (8-4-4-4-12 format)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(id)) {
      return id;
    }

    // Convert arbitrary string to deterministic UUID v5-like format
    const hash = createHash('sha256').update(id).digest('hex');
    return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
  }

  async createCollection(
    name: string,
    vectorSize: number,
    distance: 'Cosine' | 'Euclid' | 'Dot' = 'Cosine'
  ): Promise<void> {
    await this.client.createCollection(name, {
      vectors: {
        size: vectorSize,
        distance,
      },
    });
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
    let distance: 'Cosine' | 'Euclid' | 'Dot' = 'Cosine';

    if (typeof vectorConfig === 'object' && vectorConfig !== null && 'size' in vectorConfig) {
      size = typeof vectorConfig.size === 'number' ? vectorConfig.size : 0;
      distance = vectorConfig.distance as 'Cosine' | 'Euclid' | 'Dot';
    }

    return {
      name,
      vectorSize: size,
      pointsCount: info.points_count || 0,
      distance,
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
    }>
  ): Promise<void> {
    try {
      // Normalize all IDs to ensure string IDs are in UUID format
      const normalizedPoints = points.map(point => ({
        ...point,
        id: this.normalizeId(point.id),
      }));

      await this.client.upsert(collectionName, {
        wait: true,
        points: normalizedPoints,
      });
    } catch (error: any) {
      const errorMessage = error?.data?.status?.error || error?.message || String(error);
      throw new Error(`Failed to add points to collection "${collectionName}": ${errorMessage}`);
    }
  }

  async search(
    collectionName: string,
    vector: number[],
    limit: number = 5,
    filter?: Record<string, any>
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

    const results = await this.client.search(collectionName, {
      vector,
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
    id: string | number
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
    ids: (string | number)[]
  ): Promise<void> {
    // Normalize IDs to ensure string IDs are in UUID format
    const normalizedIds = ids.map(id => this.normalizeId(id));

    await this.client.delete(collectionName, {
      wait: true,
      points: normalizedIds,
    });
  }
}
