/**
 * Demonstrates various async/await patterns
 */

export class AsyncOperations {
  /**
   * Parallel async operations
   */
  async fetchMultiple(urls: string[]): Promise<any[]> {
    const promises = urls.map((url) => this.fetchData(url));
    return await Promise.all(promises);
  }

  /**
   * Sequential async operations
   */
  async fetchSequential(urls: string[]): Promise<any[]> {
    const results = [];
    for (const url of urls) {
      const data = await this.fetchData(url);
      results.push(data);
    }
    return results;
  }

  /**
   * Async operation with timeout
   */
  async fetchWithTimeout(url: string, timeout: number): Promise<any> {
    return Promise.race([
      this.fetchData(url),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), timeout)),
    ]);
  }

  /**
   * Async generator function
   */
  async *streamData(count: number): AsyncGenerator<number> {
    for (let i = 0; i < count; i++) {
      await this.delay(100);
      yield i;
    }
  }

  /**
   * Process items with concurrency limit
   */
  async processWithConcurrency<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    concurrency: number
  ): Promise<R[]> {
    const results: R[] = [];
    const executing: Promise<void>[] = [];

    for (const item of items) {
      const promise = processor(item).then((result) => {
        results.push(result);
      });

      executing.push(promise);

      if (executing.length >= concurrency) {
        await Promise.race(executing);
        const index = executing.indexOf(promise);
        if (index !== -1) {
          executing.splice(index, 1);
        }
      }
    }

    await Promise.all(executing);
    return results;
  }

  /**
   * Retry with exponential backoff
   */
  async retryWithBackoff<T>(fn: () => Promise<T>, maxRetries: number = 3): Promise<T> {
    let lastError: Error;

    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        if (i < maxRetries) {
          await this.delay(2 ** i * 1000);
        }
      }
    }

    throw lastError!;
  }

  private async fetchData(url: string): Promise<any> {
    await this.delay(100);
    return { url, data: "mock data" };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export async function parallelMap<T, R>(items: T[], mapper: (item: T) => Promise<R>): Promise<R[]> {
  return Promise.all(items.map(mapper));
}

export async function sequentialMap<T, R>(
  items: T[],
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (const item of items) {
    results.push(await mapper(item));
  }
  return results;
}
