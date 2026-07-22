import assert from "node:assert/strict"
import { describe, test } from "node:test"

import { type Options as PrettierOptions, format } from "prettier"

import { createPlugin } from "../src/index"
import type { PluginConfig } from "../src/types"

async function formatCode(code: string, config: PluginConfig = {}, options: Partial<PrettierOptions> = {}) {
    return format(code, {
        parser: "typescript",
        plugins: [createPlugin(config)],
        semi: false,
        ...options,
    })
}

describe("import sorting", () => {
    test("sorts module kinds, paths, and named contents", async () => {
        const result = await formatCode(`
import { z, a } from "./z"
import value from "pkg"
import { b } from "@/alias"
console.log(value, a, z, b)
`)

        assert.equal(
            result,
            `import value from "pkg"
import { b } from "@/alias"
import { a, z } from "./z"

console.log(value, a, z, b)
`,
        )
    })

    test("keeps side-effect imports as separators by default", async () => {
        const result = await formatCode(`
import { z } from "./z"
import "./setup-z"
import { a } from "./a"
import "./setup-a"
import { b } from "./b"
`)

        assert.equal(
            result,
            `import { z } from "./z"
import "./setup-z"
import { a } from "./a"
import "./setup-a"
import { b } from "./b"
`,
        )
    })

    test("sorts side-effect imports only when explicitly enabled", async () => {
        const source = `import "./z.css"\nimport "./a.css"`

        assert.equal(await formatCode(source), `import "./z.css"\nimport "./a.css"\n`)
        assert.equal(await formatCode(source, {}, { sortSideEffect: true } as Partial<PrettierOptions>), `import "./a.css"\nimport "./z.css"\n`)
    })

    test("merges compatible imports without losing type markers", async () => {
        const result = await formatCode(`
import value from "./a"
import { b } from "./a"
import type { A } from "./a"
console.log(value, b)
type B = A
`)

        assert.equal(
            result,
            `import value, { b, type A } from "./a"

console.log(value, b)
type B = A
`,
        )
    })

    test("keeps incompatible default and namespace imports as separate declarations", async () => {
        const result = await formatCode(`
import first from "pkg"
import second from "pkg"
import * as namespace from "pkg"
console.log(first, second, namespace)
`)

        assert.equal(
            result,
            `import first from "pkg"
import second from "pkg"
import * as namespace from "pkg"

console.log(first, second, namespace)
`,
        )
    })

    test("sorts re-exports without merging them with imports", async () => {
        const result = await formatCode(`
export { z, a as b } from "./z"
export * from "./a"
export type { T } from "./t"
`)

        assert.equal(
            result,
            `export { a as b, z } from "./z"
export * from "./a"
export type { T } from "./t"
`,
        )
    })
})

describe("configuration", () => {
    test("adds and removes the node protocol including builtin subpaths", async () => {
        const addResult = await formatCode(
            `
import fs from "fs"
import { readFile } from "fs/promises"
import value from "pkg"
console.log(fs, readFile, value)
`,
            { nodeProtocol: "add" },
        )

        assert.equal(
            addResult,
            `import fs from "node:fs"
import { readFile } from "node:fs/promises"
import value from "pkg"

console.log(fs, readFile, value)
`,
        )

        const removeResult = await formatCode(
            `
import fs from "node:fs"
import { readFile } from "node:fs/promises"
console.log(fs, readFile)
`,
            { nodeProtocol: "remove" },
        )

        assert.equal(removeResult, `import fs from "fs"\nimport { readFile } from "fs/promises"\n\nconsole.log(fs, readFile)\n`)
    })

    test("supports custom groups, sorting, and separators", async () => {
        const result = await formatCode(
            `
import { b } from "./b"
import z from "z"
import a from "a"
import { a as localA } from "./a"
console.log(a, z, b, localA)
`,
            {
                getGroup: ({ path }) => (path.startsWith(".") ? "local" : "external"),
                sortGroup: (a, b) => a.name.localeCompare(b.name),
                groupSeparator: "// group",
            },
        )

        assert.equal(
            result,
            `import a from "a"
import z from "z"

// group
import { a as localA } from "./a"
import { b } from "./b"

console.log(a, z, b, localA)
`,
        )
    })

    test("does not let grouping reorder side-effect separators", async () => {
        const config: PluginConfig = {
            getGroup: ({ path }) => (path.startsWith(".") ? "local" : "external"),
            groupSeparator: "",
        }

        const source = `
import z from "z"
import "./setup-z"
import a from "a"
import "./setup-a"
import { local } from "./local"
console.log(a, z, local)
`

        assert.equal(
            await formatCode(source, config),
            `import z from "z"
import "./setup-z"
import a from "a"
import "./setup-a"
import { local } from "./local"

console.log(a, z, local)
`,
        )

        assert.equal(
            await formatCode(source, { ...config, sortSideEffect: true }),
            `import a from "a"
import z from "z"

import "./setup-a"
import "./setup-z"

import { local } from "./local"

console.log(a, z, local)
`,
        )
    })

    test("supports functional separators and custom statement and content sorting", async () => {
        const result = await formatCode(
            `
import first from "a"
import last from "z"
import { a, c, b } from "./local"
console.log(first, last, a, b, c)
`,
            {
                getGroup: ({ path }) => (path.startsWith(".") ? "local" : "external"),
                groupSeparator: (group, index) => `// ${index}:${group.name}`,
                sortImportStatement: (a, b) => b.path.localeCompare(a.path),
                sortImportContent: (a, b) => (b.alias ?? b.name).localeCompare(a.alias ?? a.name),
            },
        )

        assert.equal(
            result,
            `import last from "z"
import first from "a"

// 1:local
import { c, b, a } from "./local"

console.log(first, last, a, b, c)
`,
        )
    })

    test("gives factory configuration precedence over runtime options", async () => {
        const source = `import "./z.css"\nimport "./a.css"`

        assert.equal(
            await formatCode(source, { sortSideEffect: true }, { sortSideEffect: false } as Partial<PrettierOptions>),
            `import "./a.css"\nimport "./z.css"\n`,
        )
    })
})

test("import sorting is idempotent", async () => {
    const first = await formatCode(`
import { z, a } from "./z"
import value from "pkg"
console.log(value, a, z)
`)
    const second = await formatCode(first)

    assert.equal(second, first)
})
