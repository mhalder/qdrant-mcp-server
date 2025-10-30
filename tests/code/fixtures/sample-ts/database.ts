export interface Database<T> {
  get(id: string): Promise<T | null>;
  set(id: string, value: T): Promise<void>;
  delete(id: string): Promise<boolean>;
  list(): Promise<T[]>;
}

export class InMemoryDatabase<T extends { id: string }> implements Database<T> {
  private store: Map<string, T> = new Map();

  async get(id: string): Promise<T | null> {
    return this.store.get(id) || null;
  }

  async set(id: string, value: T): Promise<void> {
    this.store.set(id, value);
  }

  async delete(id: string): Promise<boolean> {
    return this.store.delete(id);
  }

  async list(): Promise<T[]> {
    return Array.from(this.store.values());
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}

export type ConnectionConfig = {
  host: string;
  port: number;
  username?: string;
  password?: string;
  database: string;
  ssl?: boolean;
};

export async function connect(config: ConnectionConfig): Promise<Database<any>> {
  console.log(`Connecting to ${config.host}:${config.port}`);
  return new InMemoryDatabase();
}

export default InMemoryDatabase;
