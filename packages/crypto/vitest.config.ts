import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    // libsodium-wrappers-sumo 0.7.16 has broken ESM exports (missing .mjs file)
    // Force CJS resolution via absolute path alias
    alias: {
      "libsodium-wrappers-sumo": resolve(
        __dirname,
        "../../node_modules/.pnpm/libsodium-wrappers-sumo@0.7.16/node_modules/libsodium-wrappers-sumo/dist/modules-sumo/libsodium-wrappers.js",
      ),
    },
  },
});
