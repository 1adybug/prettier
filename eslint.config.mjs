import { defineConfig } from "@1adybug/eslint"

const defaultProjectFiles = ["packages/*/*.config.ts", "packages/*/tests/*.test.ts"]

const config = defineConfig({
    target: "both",
    next: false,
    react: false,
    ignores: ["**/dist/**", "packages/eslint/test/fixtures/**", "packages/prettier-plugin-remove-braces/example.js"],
})

export default config.map(item => {
    const parserOptions = item.languageOptions?.parserOptions

    if (parserOptions?.projectService !== true) return item

    return {
        ...item,
        languageOptions: {
            ...item.languageOptions,
            parserOptions: {
                ...parserOptions,
                projectService: {
                    allowDefaultProject: defaultProjectFiles,
                    maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: 16,
                },
            },
        },
    }
})
