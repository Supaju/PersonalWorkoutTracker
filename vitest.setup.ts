// Creates/updates prisma/test.db before tests. Tests never touch dev.db.
import { execSync } from "node:child_process";

export default function setup() {
  execSync("npx prisma migrate deploy", {
    stdio: "ignore",
    env: { ...process.env, DATABASE_URL: "file:./test.db" },
  });
}
