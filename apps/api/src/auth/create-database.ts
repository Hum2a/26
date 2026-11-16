import { outboundTimeoutMs } from "../timeout.ts";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "@neondatabase/serverless";
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
import { localDatabaseId, presentBinding, type AuthBindings } from "./bindings.ts";
import { createPgliteKysely } from "./pglite-dialect.ts";

export type SqlRow = Record<string, unknown>;

export type SqlQuery = (sql: string, params?: readonly unknown[]) => Promise<SqlRow[]>;

export type SqlExecutor = {
  query: SqlQuery;
  transaction<T>(run: (query: SqlQuery) => Promise<T>): Promise<T>;
};

export type AppDatabase = {
  kind: "pglite" | "neon";
  /** Safe to print. Never includes a password or a full connection string. */
  label: string;
  executor: SqlExecutor;
  auth: { db: Kysely<unknown>; type: "postgres"; transaction: false };
  close(): Promise<void>;
};

const openDatabases = new Map<string, Promise<AppDatabase>>();

export function databaseKey(env: AuthBindings & object): string {
  const databaseUrl = presentBinding(env.DATABASE_URL);
  if (databaseUrl) {
    return `neon:${databaseHost(databaseUrl)}`;
  }
  const memoryId = localDatabaseId(env);
  if (memoryId) {
    return `memory:${memoryId}`;
  }
  return "pglite-file";
}

/**
 * PGlite is cached: it is the local database itself and must survive between
 * requests. A Neon pool is never shared. Workers forbid one request or room
 * using I/O that another opened, so a shared pool's next query hangs until
 * Cloudflare cancels the request (error 1101). Each caller gets its own.
 */
export function openDatabase(env: AuthBindings & object): Promise<AppDatabase> {
  const key = databaseKey(env);
  if (key.startsWith("neon:")) {
    return createDatabase(env);
  }
  const existing = openDatabases.get(key);
  if (existing) {
    return existing;
  }
  const created = createDatabase(env).catch((error: unknown) => {
    openDatabases.delete(key);
    throw error;
  });
  openDatabases.set(key, created);
  return created;
}

export async function createDatabase(env: AuthBindings & object): Promise<AppDatabase> {
  const databaseUrl = presentBinding(env.DATABASE_URL);
  if (databaseUrl) {
    return openNeon(databaseUrl);
  }
  if (env.APP_ENV !== "local") {
    throw new Error("DATABASE_URL is required outside local development.");
  }
  const memoryId = localDatabaseId(env);
  if (memoryId) {
    return openPglite(undefined, `in-memory PGlite ${memoryId}`);
  }
  const dataDir = defaultDataDirectory();
  if (dataDir) {
    try {
      return await openPglite(dataDir, "local PGlite at apps/api/.data/local-auth");
    } catch (error) {
      console.error(
        "Local file database unavailable, using in-memory PGlite.",
        error instanceof Error ? error.name : "Error",
      );
    }
  }
  return openPglite(undefined, "in-memory PGlite for this local Worker");
}

export function databaseHost(connectionString: string): string {
  return new URL(connectionString).host;
}

function defaultDataDirectory(): string | undefined {
  const moduleUrl = import.meta.url;
  if (typeof moduleUrl !== "string" || !moduleUrl.startsWith("file:")) {
    return undefined;
  }
  try {
    return path.resolve(
      path.dirname(fileURLToPath(moduleUrl)),
      "../../.data/local-auth",
    );
  } catch {
    return undefined;
  }
}

async function openPglite(
  dataDir: string | undefined,
  label: string,
): Promise<AppDatabase> {
  if (dataDir) {
    mkdirSync(path.dirname(dataDir), { recursive: true });
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const database: PGlite = dataDir ? new PGlite(dataDir) : new PGlite();
  await database.waitReady;
  const kysely = createPgliteKysely(database);
  return {
    kind: "pglite",
    label,
    auth: { db: kysely, type: "postgres", transaction: false },
    executor: {
      async query(sql, params = []) {
        const result = await database.query<SqlRow>(sql, [...params]);
        return result.rows;
      },
      transaction(run) {
        return database.transaction(async (tx) =>
          run(async (sql, params = []) => {
            const result = await tx.query<SqlRow>(sql, [...params]);
            return result.rows;
          }),
        );
      },
    },
    async close() {
      await database.close();
    },
  };
}

function openNeon(connectionString: string): AppDatabase {
  // A stalled connection attempt fails instead of holding a room alarm.
  const pool = new Pool({
    connectionString,
    connectionTimeoutMillis: outboundTimeoutMs,
  });
  let ended = false;
  const end = async () => {
    if (ended) {
      return;
    }
    ended = true;
    await pool.end();
  };
  return {
    kind: "neon",
    label: `postgres host ${databaseHost(connectionString)}`,
    auth: {
      db: new Kysely({ dialect: new NeonDialect(pool) }),
      type: "postgres",
      transaction: false,
    },
    executor: {
      async query(sql, params = []) {
        const result = await pool.query<SqlRow>(sql, [...params]);
        return result.rows;
      },
      async transaction(run) {
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          const value = await run(async (sql, params = []) => {
            const result = await client.query<SqlRow>(sql, [...params]);
            return result.rows;
          });
          await client.query("COMMIT");
          return value;
        } catch (error) {
          await client.query("ROLLBACK").catch(() => undefined);
          throw error;
        } finally {
          client.release();
        }
      },
    },
    close: end,
  };
}

class NeonDialect implements Dialect {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  createAdapter() {
    return new PostgresAdapter();
  }

  createDriver(): Driver {
    return new NeonDriver(this.pool);
  }

  createIntrospector(db: Kysely<unknown>) {
    return new PostgresIntrospector(db);
  }

  createQueryCompiler() {
    return new PostgresQueryCompiler();
  }
}

class NeonDriver implements Driver {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async init(): Promise<void> {}

  async acquireConnection(): Promise<DatabaseConnection> {
    return {
      executeQuery: (compiled) => this.executeQuery(compiled),
      streamQuery: (compiled) => this.streamQuery(compiled),
    };
  }

  async beginTransaction(): Promise<void> {}

  async commitTransaction(): Promise<void> {}

  async rollbackTransaction(): Promise<void> {}

  async releaseConnection(): Promise<void> {}

  async destroy(): Promise<void> {}

  private async *streamQuery<R>(
    compiled: CompiledQuery,
  ): AsyncIterableIterator<QueryResult<R>> {
    yield await this.executeQuery<R>(compiled);
  }

  private async executeQuery<R>(compiled: CompiledQuery): Promise<QueryResult<R>> {
    const result = await this.pool.query(compiled.sql, [...compiled.parameters]);
    return { rows: result.rows as R[] };
  }
}
