import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

// SWC (not esbuild) so decorator metadata is emitted: Nest's dependency injection relies on it.
export default defineConfig({
  plugins: [swc.vite({ module: { type: "es6" } })],
  test: { include: ["test/**/*.spec.ts", "src/**/*.spec.ts"], testTimeout: 20_000 },
});
