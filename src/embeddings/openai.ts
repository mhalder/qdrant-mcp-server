import OpenAI from "openai";
import Bottleneck from "bottleneck";

export interface EmbeddingResult {
  embedding: number[];
  dimensions: number;
}

export interface RateLimitConfig {
  maxRequestsPerMinute?: number;
  retryAttempts?: number;
  retryDelayMs?: number;
}

export class OpenAIEmbeddings {
  private client: OpenAI;
  private model: string;
  private dimensions: number;
  private limiter: Bottleneck;
  private retryAttempts: number;
  private retryDelayMs: number;

  constructor(
    apiKey: string,
    model: string = "text-embedding-3-small",
    dimensions?: number,
    rateLimitConfig?: RateLimitConfig,
  ) {
    this.client = new OpenAI({ apiKey });
    this.model = model;

    // Default dimensions for different models
    const defaultDimensions: Record<string, number> = {
      "text-embedding-3-small": 1536,
      "text-embedding-3-large": 3072,
      "text-embedding-ada-002": 1536,
    };

    this.dimensions = dimensions || defaultDimensions[model] || 1536;

    // Rate limiting configuration
    const maxRequestsPerMinute = rateLimitConfig?.maxRequestsPerMinute || 3500;
    this.retryAttempts = rateLimitConfig?.retryAttempts || 3;
    this.retryDelayMs = rateLimitConfig?.retryDelayMs || 1000;

    // Initialize bottleneck limiter
    this.limiter = new Bottleneck({
      reservoir: maxRequestsPerMinute,
      reservoirRefreshAmount: maxRequestsPerMinute,
      reservoirRefreshInterval: 60 * 1000, // 1 minute
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
    } catch (error: any) {
      const isRateLimitError =
        error?.status === 429 ||
        error?.code === "rate_limit_exceeded" ||
        error?.message?.toLowerCase().includes("rate limit");

      if (isRateLimitError && attempt < this.retryAttempts) {
        // Check for Retry-After header
        const retryAfter = error?.headers?.["retry-after"];
        let delayMs: number;

        if (retryAfter) {
          // Use Retry-After header if available (in seconds)
          delayMs = parseInt(retryAfter) * 1000;
        } else {
          // Exponential backoff: 1s, 2s, 4s, 8s...
          delayMs = this.retryDelayMs * Math.pow(2, attempt);
        }

        const waitTimeSeconds = (delayMs / 1000).toFixed(1);
        console.error(
          `Rate limit reached. Retrying in ${waitTimeSeconds}s (attempt ${attempt + 1}/${this.retryAttempts})...`,
        );

        await new Promise((resolve) => setTimeout(resolve, delayMs));
        return this.retryWithBackoff(fn, attempt + 1);
      }

      // If not a rate limit error or max retries exceeded, throw
      if (isRateLimitError) {
        throw new Error(
          `OpenAI API rate limit exceeded after ${this.retryAttempts} retry attempts. Please try again later or reduce request frequency.`,
        );
      }

      throw error;
    }
  }

  async embed(text: string): Promise<EmbeddingResult> {
    return this.limiter.schedule(() =>
      this.retryWithBackoff(async () => {
        const response = await this.client.embeddings.create({
          model: this.model,
          input: text,
          dimensions: this.dimensions,
        });

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
        const response = await this.client.embeddings.create({
          model: this.model,
          input: texts,
          dimensions: this.dimensions,
        });

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
