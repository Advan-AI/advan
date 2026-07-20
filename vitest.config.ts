import path from "node:path"
import { defineConfig } from "vitest/config"
import dotenv from "dotenv"

// Load env variables for unit and integration tests
dotenv.config()

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "lib/**/*.integration.test.ts", "app/**/*.test.ts"],
    testTimeout: 60000,
    hookTimeout: 60000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
})
