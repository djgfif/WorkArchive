import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      react: fileURLToPath(new URL("../../node_modules/react", import.meta.url)),
      "react-dom": fileURLToPath(
        new URL("../../node_modules/react-dom", import.meta.url),
      ),
    },
  },
  test: {
    environment: "jsdom",
    include: ["app/**/*.test.tsx"],
    setupFiles: "./tests/setup.ts",
  },
});
