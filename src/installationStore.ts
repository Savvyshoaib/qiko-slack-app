import fs from "node:fs";
import path from "node:path";
import type {
  Installation,
  InstallationQuery,
} from "@slack/bolt";

const DATA_DIR = path.resolve(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "slack-installations.json");

function ensureDir(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readAll(): Record<string, Installation> {
  ensureDir();
  if (!fs.existsSync(FILE)) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(FILE, "utf8")) as Record<
      string,
      Installation
    >;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(data: Record<string, Installation>): void {
  ensureDir();
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2), "utf8");
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

export const fileInstallationStore = {
  async storeInstallation(installation: Installation): Promise<void> {
    const all = readAll();
    all[keyFromInstallation(installation)] = installation;
    writeAll(all);
  },

  async fetchInstallation(
    query: InstallationQuery<boolean>
  ): Promise<Installation> {
    const installation = readAll()[storeKey(query)];
    if (!installation) {
      throw new Error(`No installation for ${storeKey(query)}`);
    }
    return installation;
  },

  async deleteInstallation(query: InstallationQuery<boolean>): Promise<void> {
    const all = readAll();
    delete all[storeKey(query)];
    writeAll(all);
  },
};
