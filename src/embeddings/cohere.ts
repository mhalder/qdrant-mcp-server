import { CohereClient } from "cohere-ai";
import Bottleneck from "bottleneck";
import { EmbeddingProvider, EmbeddingResult, RateLimitConfig } from "./base.js";

interface CohereError {
  status?: number;
  statusCode?: number;
  message?: string;
}

export class CohereEmbeddings implements EmbeddingProvider {
  private client: CohereClient;
  private model: string;
  private dimensions: number;
  private limiter: Bottleneck;
  private retryAttempts: number;
  private retryDelayMs: number;
  private inputType:
    | "search_document"
    | "search_query"
    | "classification"
    | "clustering";

  constructor(
    apiKey: string,
    model: string = "embed-english-v3.0",
    dimensions?: number,
    rateLimitConfig?: RateLimitConfig,
    inputType:
      | "search_document"
      | "search_query"
      | "classification"
      | "clustering" = "search_document",
  ) {
    this.client = new CohereClient({ token: apiKey });
    this.model = model;
    this.inputType = inputType;

    // Default dimensions for different models
    const defaultDimensions: Record<string, number> = {
      "embed-english-v3.0": 1024,
      "embed-multilingual-v3.0": 1024,
      "embed-english-light-v3.0": 384,
      "embed-multilingual-light-v3.0": 384,
    };

    this.dimensions = dimensions || defaultDimensions[model] || 1024;

    // Rate limiting configuration
    const maxRequestsPerMinute = rateLimitConfig?.maxRequestsPerMinute || 100;
    this.retryAttempts = rateLimitConfig?.retryAttempts || 3;
    this.retryDelayMs = rateLimitConfig?.retryDelayMs || 1000;

    this.limiter = new Bottleneck({
      reservoir: maxRequestsPerMinute,
      reservoirRefreshAmount: maxRequestsPerMinute,
      reservoirRefreshInterval: 60 * 1000,
      maxConcurrent: 5,
      minTime: Math.floor((60 * 1000) / maxRequestsPerMinute),
    });
  }

  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    attempt: number = 0,
  ): Promise<T> {
    try {
      return await fn();
    } catch (error: unknown) {
      const apiError = error as CohereError;
      const isRateLimitError =
        apiError?.status === 429 ||
        apiError?.statusCode === 429 ||
        apiError?.message?.toLowerCase().includes("rate limit");

      if (isRateLimitError && attempt < this.retryAttempts) {
        const delayMs = this.retryDelayMs * Math.pow(2, attempt);
        const waitTimeSeconds = (delayMs / 1000).toFixed(1);
        console.error(
          `Rate limit reached. Retrying in ${waitTimeSeconds}s (attempt ${attempt + 1}/${this.retryAttempts})...`,
        );

        await new Promise((resolve) => setTimeout(resolve, delayMs));
        return this.retryWithBackoff(fn, attempt + 1);
      }

      if (isRateLimitError) {
        throw new Error(
          `Cohere API rate limit exceeded after ${this.retryAttempts} retry attempts. Please try again later or reduce request frequency.`,
        );
      }

      throw error;
    }
  }

  async embed(text: string): Promise<EmbeddingResult> {
    return this.limiter.schedule(() =>
      this.retryWithBackoff(async () => {
        const response = await this.client.embed({
          texts: [text],
          model: this.model,
          inputType: this.inputType,
          embeddingTypes: ["float"],
        });

        // Cohere v7+ returns embeddings as number[][]
        const embeddings = response.embeddings as number[][];
        if (!embeddings || embeddings.length === 0) {
          throw new Error("No embedding returned from Cohere API");
        }

        return {
          embedding: embeddings[0],
          dimensions: this.dimensions,
        };
      }),
    );
  }

  async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    return this.limiter.schedule(() =>
      this.retryWithBackoff(async () => {
        const response = await this.client.embed({
          texts,
          model: this.model,
          inputType: this.inputType,
          embeddingTypes: ["float"],
        });

        // Cohere v7+ returns embeddings as number[][]
        const embeddings = response.embeddings as number[][];
        if (!embeddings) {
          throw new Error("No embeddings returned from Cohere API");
        }

        return embeddings.map((embedding: number[]) => ({
          embedding,
          dimensions: this.dimensions,
        }));
      }),
    );
  }

  getDimensions(): number {
    return this.dimensions;
  }

  getModel(): string {
    return this.model;
  }
}
