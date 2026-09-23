import {
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  type CompiledQuery,
  type DatabaseConnection,
  type Dialect,
  type Driver,
  type QueryResult,
} from "kysely";
import type { PGlite } from "@electric-sql/pglite";

/**
 * One PGlite database is a single connection. Queries and transactions take
 * turns so a BEGIN cannot interleave with another request.
 */
class PgliteDriver implements Driver {
  private readonly database: PGlite;
  private locked = false;
  private inTransaction = false;
  private readonly waiting: Array<() => void> = [];

  constructor(database: PGlite) {
    this.database = database;
  }

  async init(): Promise<void> {}

  async acquireConnection(): Promise<DatabaseConnection> {
    return {
      executeQuery: (compiled) => this.executeQuery(compiled),
      streamQuery: (compiled) => this.streamQuery(compiled),
    };
  }

  async beginTransaction(): Promise<void> {
    await this.acquire();
    this.inTransaction = true;
    try {
      await this.database.exec("BEGIN");
    } catch (error) {
      this.inTransaction = false;
      this.release();
      throw error;
    }
  }

  async commitTransaction(): Promise<void> {
    try {
      await this.database.exec("COMMIT");
    } finally {
      this.inTransaction = false;
      this.release();
    }
  }

  async rollbackTransaction(): Promise<void> {
    try {
      await this.database.exec("ROLLBACK");
    } finally {
      this.inTransaction = false;
      this.release();
    }
  }

  async releaseConnection(): Promise<void> {}

  async destroy(): Promise<void> {
    await this.database.close();
  }

  private async *streamQuery<R>(
    compiled: CompiledQuery,
  ): AsyncIterableIterator<QueryResult<R>> {
    yield await this.executeQuery<R>(compiled);
  }

  private async executeQuery<R>(compiled: CompiledQuery): Promise<QueryResult<R>> {
    const ownsLock = !this.inTransaction;
    if (ownsLock) {
      await this.acquire();
    }
    try {
      const result = await this.database.query<R>(compiled.sql, [
        ...compiled.parameters,
      ]);
      return { rows: result.rows };
    } finally {
      if (ownsLock) {
        this.release();
      }
    }
  }

  private async acquire(): Promise<void> {
    if (!this.locked) {
      this.locked = true;
      return;
    }
    await new Promise<void>((resolve) => {
      this.waiting.push(resolve);
    });
  }

  private release(): void {
    const next = this.waiting.shift();
    if (next) {
      next();
      return;
    }
    this.locked = false;
  }
}

class PgliteDialect implements Dialect {
  private readonly database: PGlite;

  constructor(database: PGlite) {
    this.database = database;
  }

  createAdapter() {
    return new PostgresAdapter();
  }

  createDriver(): Driver {
    return new PgliteDriver(this.database);
  }

  createIntrospector(db: Kysely<unknown>) {
    return new PostgresIntrospector(db);
  }

  createQueryCompiler() {
    return new PostgresQueryCompiler();
  }
}

export function createPgliteKysely(database: PGlite): Kysely<unknown> {
  return new Kysely({ dialect: new PgliteDialect(database) });
}
