// Configuration d'ESLint (analyse du code) pour le backend
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  { ignores: ["dist", "node_modules"] },
  js.configs.recommended, // règles de base de JavaScript
  ...tseslint.configs.recommended, // règles pour TypeScript
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { globals: globals.node },
    rules: {
      // Une variable inutilisée est une erreur, sauf si son nom commence par "_" (ex. _req)
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  prettier, // désactive les règles de mise en forme : c'est le travail de Prettier
);
