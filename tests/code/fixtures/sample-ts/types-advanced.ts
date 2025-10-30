/**
 * Advanced TypeScript type features
 */

// Generic constraints
export interface Identifiable {
  id: string | number;
}

export class Repository<T extends Identifiable> {
  private items: Map<string | number, T> = new Map();

  add(item: T): void {
    this.items.set(item.id, item);
  }

  get(id: string | number): T | undefined {
    return this.items.get(id);
  }

  getAll(): T[] {
    return Array.from(this.items.values());
  }

  remove(id: string | number): boolean {
    return this.items.delete(id);
  }
}

// Conditional types
export type Awaited<T> = T extends Promise<infer U> ? U : T;
export type NonNullable<T> = T extends null | undefined ? never : T;
export type ReturnTypeOf<T> = T extends (...args: any[]) => infer R ? R : never;

// Mapped types
export type Readonly<T> = {
  readonly [P in keyof T]: T[P];
};

export type Partial<T> = {
  [P in keyof T]?: T[P];
};

export type Required<T> = {
  [P in keyof T]-?: T[P];
};

// Type guards
export function isString(value: unknown): value is string {
  return typeof value === "string";
}

export function isNumber(value: unknown): value is number {
  return typeof value === "number";
}

export function isArray<T>(value: unknown): value is T[] {
  return Array.isArray(value);
}

export function hasProperty<K extends string>(obj: unknown, key: K): obj is Record<K, unknown> {
  return typeof obj === "object" && obj !== null && key in obj;
}

// Generic factory
export class Factory<T> {
  constructor(private creator: () => T) {}

  create(): T {
    return this.creator();
  }

  createMany(count: number): T[] {
    return Array.from({ length: count }, () => this.create());
  }
}

// Builder pattern with fluent interface
export class QueryBuilder<T> {
  private filters: Array<(item: T) => boolean> = [];
  private sortFn?: (a: T, b: T) => number;
  private limitValue?: number;

  where(predicate: (item: T) => boolean): this {
    this.filters.push(predicate);
    return this;
  }

  orderBy(compareFn: (a: T, b: T) => number): this {
    this.sortFn = compareFn;
    return this;
  }

  limit(count: number): this {
    this.limitValue = count;
    return this;
  }

  execute(items: T[]): T[] {
    let result = items;

    // Apply filters
    for (const filter of this.filters) {
      result = result.filter(filter);
    }

    // Apply sorting
    if (this.sortFn) {
      result = result.sort(this.sortFn);
    }

    // Apply limit
    if (this.limitValue !== undefined) {
      result = result.slice(0, this.limitValue);
    }

    return result;
  }
}

// Utility types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type PickByType<T, ValueType> = {
  [K in keyof T as T[K] extends ValueType ? K : never]: T[K];
};

export type OmitByType<T, ValueType> = {
  [K in keyof T as T[K] extends ValueType ? never : K]: T[K];
};
