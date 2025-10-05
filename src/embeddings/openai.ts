import OpenAI from 'openai';

export interface EmbeddingResult {
  embedding: number[];
  dimensions: number;
}

export class OpenAIEmbeddings {
  private client: OpenAI;
  private model: string;
  private dimensions: number;

  constructor(
    apiKey: string,
    model: string = 'text-embedding-3-small',
    dimensions?: number
  ) {
    this.client = new OpenAI({ apiKey });
    this.model = model;

    // Default dimensions for different models
    const defaultDimensions: Record<string, number> = {
      'text-embedding-3-small': 1536,
      'text-embedding-3-large': 3072,
      'text-embedding-ada-002': 1536,
    };

    this.dimensions = dimensions || defaultDimensions[model] || 1536;
  }

  async embed(text: string): Promise<EmbeddingResult> {
    const response = await this.client.embeddings.create({
      model: this.model,
      input: text,
      dimensions: this.dimensions,
    });

    return {
      embedding: response.data[0].embedding,
      dimensions: this.dimensions,
    };
  }

  async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    const response = await this.client.embeddings.create({
      model: this.model,
      input: texts,
      dimensions: this.dimensions,
    });

    return response.data.map((item) => ({
      embedding: item.embedding,
      dimensions: this.dimensions,
    }));
  }

  getDimensions(): number {
    return this.dimensions;
  }

  getModel(): string {
    return this.model;
  }
}
