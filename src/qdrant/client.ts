import { QdrantClient } from '@qdrant/js-client-rest';

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
    await this.client.upsert(collectionName, {
      wait: true,
      points,
    });
  }

  async search(
    collectionName: string,
    vector: number[],
    limit: number = 5,
    filter?: Record<string, any>
  ): Promise<SearchResult[]> {
    const results = await this.client.search(collectionName, {
      vector,
      limit,
      filter,
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
      const points = await this.client.retrieve(collectionName, {
        ids: [id],
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
    await this.client.delete(collectionName, {
      wait: true,
      points: ids,
    });
  }
}
