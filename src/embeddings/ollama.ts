import Bottleneck from "bottleneck";
import { EmbeddingProvider, EmbeddingResult, RateLimitConfig } from "./base.js";

interface OllamaError {
  status?: number;
  message?: string;
}

interface OllamaEmbedResponse {
  embedding: number[];
}

export class OllamaEmbeddings implements EmbeddingProvider {
  private model: string;
  private dimensions: number;
  private limiter: Bottleneck;
  private retryAttempts: number;
  private retryDelayMs: number;
  private baseUrl: string;

  constructor(
    model: string = "nomic-embed-text",
    dimensions?: number,
    rateLimitConfig?: RateLimitConfig,
    baseUrl: string = "http://localhost:11434",
  ) {
    this.model = model;
    this.baseUrl = baseUrl;

    // Default dimensions for different models
    const defaultDimensions: Record<string, number> = {
      "nomic-embed-text": 768,
      "mxbai-embed-large": 1024,
      "all-minilm": 384,
    };

    this.dimensions = dimensions || defaultDimensions[model] || 768;

    // Rate limiting configuration (more lenient for local models)
    const maxRequestsPerMinute = rateLimitConfig?.maxRequestsPerMinute || 1000;
    this.retryAttempts = rateLimitConfig?.retryAttempts || 3;
    this.retryDelayMs = rateLimitConfig?.retryDelayMs || 500;

    this.limiter = new Bottleneck({
      reservoir: maxRequestsPerMinute,
      reservoirRefreshAmount: maxRequestsPerMinute,
      reservoirRefreshInterval: 60 * 1000,
      maxConcurrent: 10,
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
      const apiError = error as OllamaError;
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
          `Ollama API rate limit exceeded after ${this.retryAttempts} retry attempts. Please try again later or reduce request frequency.`,
        );
      }

      throw error;
    }
  }

  private async callApi(text: string): Promise<OllamaEmbedResponse> {
    const response = await fetch(`${this.baseUrl}/api/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        prompt: text,
      }),
    });

    if (!response.ok) {
      const error: OllamaError = {
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
        const response = await this.callApi(text);

        if (!response.embedding) {
          throw new Error("No embedding returned from Ollama API");
        }

        return {
          embedding: response.embedding,
          dimensions: this.dimensions,
        };
      }),
    );
  }

  async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    // Ollama doesn't support batch embeddings natively, so we process in parallel
    // The Bottleneck limiter will handle rate limiting and concurrency (maxConcurrent: 10)
    return Promise.all(texts.map((text) => this.embed(text)));
  }

  getDimensions(): number {
    return this.dimensions;
  }

  getModel(): string {
    return this.model;
  }
}
