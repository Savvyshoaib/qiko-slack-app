import pg from "pg";
import type { Installation, InstallationQuery } from "@slack/bolt";

const { Pool } = pg;

let pool: pg.Pool | undefined;

function getPool(): pg.Pool {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("DATABASE_URL is not set");
  pool ??= new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
  return pool;
}

export async function ensureInstallationsTable(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS slack_installations (
        id TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  } finally {
    client.release();
  }
}

function storeKey(query: InstallationQuery<boolean>): string {
  if (query.teamId) return `team:${query.teamId}`;
  if (query.enterpriseId) return `enterprise:${query.enterpriseId}`;
  throw new Error("Installation query missing teamId / enterpriseId");
}

function keyFromInstallation(installation: Installation): string {
  if (installation.team?.id) return `team:${installation.team.id}`;
  if (installation.enterprise?.id) return `enterprise:${installation.enterprise.id}`;
  throw new Error("Installation missing team / enterprise id");
}

export const postgresInstallationStore = {
  async storeInstallation(installation: Installation): Promise<void> {
    const id = keyFromInstallation(installation);
    await getPool().query(
      `INSERT INTO slack_installations (id, data, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
      [id, JSON.stringify(installation)]
    );
    console.log(`Stored Slack installation: ${id}`);
  },

  async fetchInstallation(
    query: InstallationQuery<boolean>
  ): Promise<Installation> {
    const key = storeKey(query);
    const result = await getPool().query<{ data: Installation }>(
      `SELECT data FROM slack_installations WHERE id = $1`,
      [key]
    );
    const installation = result.rows[0]?.data;
    if (!installation) {
      throw new Error(`No installation for ${key}`);
    }
    return installation;
  },

  async deleteInstallation(query: InstallationQuery<boolean>): Promise<void> {
    await getPool().query(`DELETE FROM slack_installations WHERE id = $1`, [
      storeKey(query),
    ]);
  },

  async countInstallations(): Promise<number> {
    const result = await getPool().query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM slack_installations`
    );
    return Number(result.rows[0]?.count ?? 0);
  },
};
