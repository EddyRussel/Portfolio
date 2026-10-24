import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    fileParallelism: false, // les fichiers de test partagent la même base : un à la fois
    testTimeout: 20000, // la génération de PDF et bcrypt prennent un peu de temps
  },
});
