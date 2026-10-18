// Copies the config and plugins into android/ and ios/. CAP_SERVER_URL must be the https address of the live site.
import { spawnSync } from "node:child_process";

if (!process.env.CAP_SERVER_URL || !/^https:\/\//.test(process.env.CAP_SERVER_URL)) {
  console.error("Setze CAP_SERVER_URL auf die https-Adresse der laufenden Seite, z. B. CAP_SERVER_URL=https://meeqo.example npm run native:sync");
  process.exit(1);
}
const result = spawnSync("npx", ["cap", "sync"], { stdio: "inherit", env: process.env });
process.exit(result.status ?? 1);
