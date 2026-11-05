import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { Client } from "pg";

const PORT = 54329;
const MIGRATIONS = resolve(__dirname, "../../../supabase/migrations");

function pgBin(name: string) {
  for (const dir of ["/opt/homebrew/bin", "/usr/local/bin", "/usr/lib/postgresql/18/bin", "/usr/lib/postgresql/17/bin", "/usr/lib/postgresql/16/bin", "/usr/lib/postgresql/15/bin"]) {
    try {
      execFileSync(join(dir, name), ["--version"], { stdio: "ignore" });
      return join(dir, name);
    } catch {}
  }
  return name;
}

/** Runs the real migrations on a throwaway Postgres. Set TEST_DATABASE_URL to use your own. */
export default async function setup() {
  let stop = async () => {};
  let url = process.env.TEST_DATABASE_URL;

  if (!url) {
    const dataDir = mkdtempSync(join(tmpdir(), "lumora-money-pg-"));
    execFileSync(pgBin("initdb"), ["-D", dataDir, "-U", "postgres", "--auth=trust", "--no-sync", "-E", "UTF8"], { stdio: "ignore" });
    const server = spawn(pgBin("postgres"), ["-D", dataDir, "-p", String(PORT), "-k", dataDir, "-c", "fsync=off", "-c", "max_connections=60"], { stdio: "ignore" });
    stop = async () => {
      server.kill("SIGINT");
      await new Promise((done) => server.once("exit", done));
      rmSync(dataDir, { recursive: true, force: true });
    };
    url = `postgres://postgres@127.0.0.1:${PORT}/postgres`;
    for (let attempt = 0; ; attempt++) {
      const probe = new Client({ connectionString: url });
      try {
        await probe.connect();
        await probe.end();
        break;
      } catch (error) {
        if (attempt > 100) throw error;
        await new Promise((done) => setTimeout(done, 100));
      }
    }
  }

  const client = new Client({ connectionString: url });
  await client.connect();
  await client.query(readFileSync(resolve(__dirname, "supabase-stub.sql"), "utf8"));
  for (const file of readdirSync(MIGRATIONS).filter((name) => name.endsWith(".sql")).sort()) {
    try {
      await client.query(readFileSync(join(MIGRATIONS, file), "utf8"));
    } catch (error) {
      await client.end();
      await stop();
      throw new Error(`${file}: ${(error as Error).message}`);
    }
  }
  await client.end();
  process.env.TEST_DATABASE_URL = url;

  return stop;
}
