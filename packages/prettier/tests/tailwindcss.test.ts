import { resolve } from "node:path"
import { pathToFileURL } from "node:url"

import { describe, expect, test } from "bun:test"
import { type Plugin, format } from "prettier"

export interface PrettierModule {
    default: Plugin
}

const playgroundDir = resolve("../playground")
const pluginUrl = pathToFileURL(resolve("src/index.ts")).href

async function loadPlugin() {
    const cwd = process.cwd()
    process.chdir(playgroundDir)

    try {
        const module = (await import(`${pluginUrl}?tailwindcss-test=${Date.now()}`)) as PrettierModule
        return module.default
    } finally {
        process.chdir(cwd)
    }
}

async function formatCode(code: string) {
    const plugin = await loadPlugin()

    return format(code, {
        filepath: resolve(playgroundDir, "src/App.tsx"),
        parser: "typescript",
        plugins: [plugin],
        semi: false,
    })
}

describe("tailwindcss", () => {
    test("sorts className through the bundled tailwindcss plugin", async () => {
        const result = await formatCode(`<div className="w-full h-full flex bg-red-500 p-4"></div>`)

        expect(result).toBe(`;<div className="flex h-full w-full bg-red-500 p-4"></div>\n`)
    })

    test("keeps leading semicolon protection idempotent", async () => {
        const first = await formatCode(`[]`)
        const second = await formatCode(first)

        expect(first).toBe(`;[]\n`)
        expect(second).toBe(first)
    })
})
