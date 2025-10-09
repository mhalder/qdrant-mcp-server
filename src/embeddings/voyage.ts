import Bottleneck from "bottleneck";
import { EmbeddingProvider, EmbeddingResult, RateLimitConfig } from "./base.js";

interface VoyageError {
  status?: number;
  message?: string;
}

interface VoyageEmbedResponse {
  data: Array<{ embedding: number[] }>;
  model: string;
  usage: {
    total_tokens: number;
  };
}

export class VoyageEmbeddings implements EmbeddingProvider {
  private apiKey: string;
  private model: string;
  private dimensions: number;
  private limiter: Bottleneck;
  private retryAttempts: number;
  private retryDelayMs: number;
  private baseUrl: string;
  private inputType?: "query" | "document";

  constructor(
    apiKey: string,
    model: string = "voyage-2",
    dimensions?: number,
    rateLimitConfig?: RateLimitConfig,
    baseUrl: string = "https://api.voyageai.com/v1",
    inputType?: "query" | "document",
  ) {
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = baseUrl;
    this.inputType = inputType;

    // Default dimensions for different models
    const defaultDimensions: Record<string, number> = {
      "voyage-2": 1024,
      "voyage-large-2": 1536,
      "voyage-code-2": 1536,
      "voyage-lite-02-instruct": 1024,
    };

    this.dimensions = dimensions || defaultDimensions[model] || 1024;

    // Rate limiting configuration
    const maxRequestsPerMinute = rateLimitConfig?.maxRequestsPerMinute || 300;
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
      const apiError = error as VoyageError;
      const isRateLimitError =
        apiError?.status === 429 ||
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
          `Voyage AI API rate limit exceeded after ${this.retryAttempts} retry attempts. Please try again later or reduce request frequency.`,
        );
      }

      throw error;
    }
  }

  private async callApi(texts: string[]): Promise<VoyageEmbedResponse> {
    const body: any = {
      input: texts,
      model: this.model,
    };

    if (this.inputType) {
      body.input_type = this.inputType;
    }

    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error: VoyageError = {
        status: response.status,
        message: await response.text(),
      };
      throw error;
    }

    return response.json();
  }

  async embed(text: string): Promise<EmbeddingResult> {
    return this.limiter.schedule(() =>
      this.retryWithBackoff(async () => {
        const response = await this.callApi([text]);

        if (!response.data || response.data.length === 0) {
          throw new Error("No embedding returned from Voyage AI API");
        }

        return {
          embedding: response.data[0].embedding,
          dimensions: this.dimensions,
        };
      }),
    );
  }

  async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    return this.limiter.schedule(() =>
      this.retryWithBackoff(async () => {
        const response = await this.callApi(texts);

        if (!response.data) {
          throw new Error("No embeddings returned from Voyage AI API");
        }

        return response.data.map((item) => ({
          embedding: item.embedding,
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
