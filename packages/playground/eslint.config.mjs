// @ts-check

import js from "@eslint/js"
import reactHooks from "eslint-plugin-react-hooks"
import reactRefresh from "eslint-plugin-react-refresh"
import { defineConfig, globalIgnores } from "eslint/config"
import globals from "globals"
import tseslint from "typescript-eslint"

export default defineConfig([
    globalIgnores(["node_modules", "dist", "build", "public"]),
    reactHooks.configs.flat.recommended,
    {
        files: ["**/*.{js,mjs,ts,tsx}"],
        extends: [js.configs.recommended, tseslint.configs.recommended, reactRefresh.configs.vite],
        languageOptions: {
            ecmaVersion: "latest",
            globals: globals.browser,
            parserOptions: {
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            "@typescript-eslint/no-empty-object-type": "off",
            "no-empty": "off",
            "no-extra-boolean-cast": "off",
            "no-unused-vars": "off",
            "react-refresh/only-export-components": "warn",
            "@typescript-eslint/no-unused-vars": [
                "warn",
                {
                    args: "none",
                    caughtErrors: "none",
                    ignoreRestSiblings: true,
                },
            ],
            "prefer-const": [
                "off",
                {
                    destructuring: "any",
                },
            ],
        },
    },
])
