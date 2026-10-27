import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname) } },
  test: { fileParallelism: false, globalSetup: ["./vitest.setup.ts"], env: { DATABASE_URL: "file:./test.db" }, include: ["**/*.test.ts"], exclude: ["node_modules/**", ".next/**", ".claude/**"] },
});
