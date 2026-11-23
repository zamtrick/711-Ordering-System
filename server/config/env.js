// Single place for loading environment variables.
//
// Why not plain `import "dotenv/config"`?
//   1. dotenv never overrides variables that already exist in the shell. A
//      stale DB_URI exported in a terminal session (or inherited from a
//      launcher) would silently win over the value in .env, pointing the
//      app at the wrong database with no error.
//   2. dotenv resolves the .env path from process.cwd(). Scripts run with
//      the repo root as cwd (npm workspaces, pnpm -r, some editors) would
//      load the wrong .env or none at all.
//
// override: true makes server/.env the source of truth. If you deliberately
// want to override a value for one run, do it in .env, not the shell.
//
// Always import this FIRST, before anything that reads process.env at
// module load time (e.g. services that capture SMTP_* to decide
// log-only vs real sending).
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({
  path: path.resolve(__dirname, "..", ".env"),
  override: true,
});
