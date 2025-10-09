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

  private isOllamaError(e: unknown): e is OllamaError {
    return (
      typeof e === "object" && e !== null && ("status" in e || "message" in e)
    );
  }

  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    attempt: number = 0,
  ): Promise<T> {
    try {
      return await fn();
    } catch (error: unknown) {
      // Type guard for OllamaError
      const apiError = this.isOllamaError(error)
        ? error
        : { status: 0, message: String(error) };

      const isRateLimitError =
        apiError.status === 429 ||
        apiError.message?.toLowerCase().includes("rate limit");

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
    try {
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
        const errorBody = await response.text();
        const textPreview =
          text.length > 100 ? text.substring(0, 100) + "..." : text;
        const error: OllamaError = {
          status: response.status,
          message: `Ollama API error (${response.status}) for model "${this.model}": ${errorBody}. Text preview: "${textPreview}"`,
        };
        throw error;
      }

      return response.json();
    } catch (error) {
      // Re-throw if it's already an OllamaError from the !response.ok block
      if (error && typeof error === "object" && "status" in error) {
        throw error;
      }

      // Handle network or other errors - preserve the original error structure
      // This ensures objects with 'message' property work correctly in tests
      if (this.isOllamaError(error)) {
        throw error;
      }

      // For Error objects or other types, create a descriptive error message
      const textPreview =
        text.length > 100 ? text.substring(0, 100) + "..." : text;
      const errorMessage =
        error instanceof Error
          ? error.message
          : error &&
              typeof error === "object" &&
              "message" in error &&
              typeof error.message === "string"
            ? error.message
            : JSON.stringify(error);

      throw new Error(
        `Failed to call Ollama API at ${this.baseUrl} with model ${this.model}: ${errorMessage}. Text preview: "${textPreview}"`,
      );
    }
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
    // Process in chunks to avoid overwhelming Ollama and prevent memory issues
    const CHUNK_SIZE = 50;
    const results: EmbeddingResult[] = [];

    for (let i = 0; i < texts.length; i += CHUNK_SIZE) {
      const chunk = texts.slice(i, i + CHUNK_SIZE);
      // The Bottleneck limiter will handle rate limiting and concurrency (maxConcurrent: 10)
      const chunkResults = await Promise.all(
        chunk.map((text) => this.embed(text)),
      );
      results.push(...chunkResults);
    }

    return results;
  }

  getDimensions(): number {
    return this.dimensions;
  }

  getModel(): string {
    return this.model;
  }
}
