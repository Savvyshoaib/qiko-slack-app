import type { InstallationStore } from "@slack/bolt";
import { fileInstallationStore } from "./installationStore.js";
import { postgresInstallationStore } from "./postgresInstallationStore.js";

export function usePostgresInstallStore(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function resolveInstallationStore(): InstallationStore {
  if (usePostgresInstallStore()) {
    console.log("Installation store: Postgres");
    return postgresInstallationStore;
  }
  console.log("Installation store: local file (data/)");
  return fileInstallationStore;
}
