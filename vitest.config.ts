import path from "node:path";
import { defineConfig } from "vitest/config";

const root = import.meta.dirname;

export default defineConfig({
  root,
  resolve: {
    alias: {
      "@": path.resolve(root, "client", "src"),
    },
  },
  test: {
    environment: "node",
    include: ["server/**/*.test.ts"],
  },
});
