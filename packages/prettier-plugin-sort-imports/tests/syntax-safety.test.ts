import assert from "node:assert/strict"
import { describe, test } from "node:test"

import { type Parser, type Plugin, format } from "prettier"
import * as estree from "prettier/plugins/estree"
import * as typescriptPlugin from "prettier/plugins/typescript"

import { createPlugin } from "../src/index"

async function formatCode(code: string, options: Record<string, unknown> = {}) {
    return format(code, {
        parser: "typescript",
        plugins: [createPlugin()],
        semi: false,
        ...options,
    })
}

describe("lossless safety fallbacks", () => {
    test("skips all import rewrites when import attributes are present", async () => {
        const result = await formatCode(
            `
import data from "./data.json" with { type: "json" }
import { readFile } from "fs"
console.log(data, readFile)
`,
            { nodeProtocol: "add", markTypeOnlyImports: true },
        )

        assert.equal(
            result,
            `import data from "./data.json" with { type: "json" }
import { readFile } from "fs"
console.log(data, readFile)
`,
        )
    })

    test("skips all import rewrites when legacy import assertions are present", async () => {
        const result = await formatCode(
            `
import data from "./data.json" assert { type: "json" }
import { readFile } from "fs"
console.log(data, readFile)
`,
            { nodeProtocol: "add" },
        )

        assert.equal(
            result,
            `import data from "./data.json" assert { type: "json" }
import { readFile } from "fs"
console.log(data, readFile)
`,
        )
    })

    test("keeps value imports in decorated files while applying safe rewrites", async () => {
        const result = await formatCode(
            `
import { readFile } from "fs"
import { Service } from "./service"
function dec(value: unknown) {}
@dec
class Controller {
    constructor(service: Service) { readFile }
}
`,
            { nodeProtocol: "add", markTypeOnlyImports: true },
        )

        assert.equal(
            result,
            `import { readFile } from "node:fs"
import { Service } from "./service"

function dec(value: unknown) {}
@dec
class Controller {
  constructor(service: Service) {
    readFile
  }
}
`,
        )
    })

    test("skips syntax and comments that the normalized import model cannot reproduce", async () => {
        const cases = [
            `import { "external-name" as localName } from "pkg"`,
            `export { "external-name" as localName } from "pkg"`,
            `export type * from "pkg"`,
            `export * as namespace from "pkg"`,
            `import type DefaultType from "pkg"`,
            `import type * as Types from "pkg"`,
            `import {} from "pkg"`,
            `import /* keep default */ value from "pkg"`,
            `import * as /* keep namespace */ namespace from "pkg"`,
            `import value, /* keep separator */ { named } from "pkg"`,
        ]

        for (const syntax of cases) {
            const source = `${syntax}\nimport { readFile } from "fs"\nconsole.log(readFile)\n`
            const expected = await format(source, { parser: "typescript", semi: false })
            const result = await formatCode(source, { nodeProtocol: "add" })

            assert.equal(result, expected, syntax)
        }
    })
})

describe("comment preservation", () =>
    void test("preserves headers, statement comments, specifier comments, and trailing comments", async () => {
        const result = await formatCode(`
// file header

// z import
import {
    // b comment
    b,
    a,
} from "./z" // trailing z
// a import
import value from "./a"
console.log(value, a, b)
`)

        assert.equal(
            result,
            `// file header

// a import
import value from "./a"
// z import
import {
  a,
  // b comment
  b,
} from "./z" // trailing z

console.log(value, a, b)
`,
        )
    }))

test("honors trailingComma when rebuilding commented specifiers", async () => {
    const result = await formatCode(
        `
import {
    // keep
    b,
    a,
} from "./module"
console.log(a, b)
`,
        { trailingComma: "none" },
    )

    assert.equal(
        result,
        `import {
  a,
  // keep
  b
} from "./module"

console.log(a, b)
`,
    )
})

test("supports every JavaScript and TypeScript parser exposed by the plugin", async () => {
    const source = `import { z, a } from "./module"\nconsole.log(a, z)`

    for (const parser of ["babel", "babel-ts", "typescript"]) {
        const result = await format(source, {
            parser,
            plugins: [createPlugin()],
            semi: false,
        })

        assert.equal(result, `import { a, z } from "./module"\n\nconsole.log(a, z)\n`)
    }
})

test("preserves shebangs and directive prologues while sorting imports", async () => {
    const source = `#!/usr/bin/env node
"use strict"
import { z } from "./z"
import { a } from "./a"
console.log(a, z)
`

    const expected = `#!/usr/bin/env node
"use strict"
import { a } from "./a"
import { z } from "./z"

console.log(a, z)
`

    for (const parser of ["babel", "babel-ts", "typescript"]) {
        assert.equal(
            await format(source, {
                parser,
                plugins: [createPlugin()],
                semi: false,
            }),
            expected,
            parser,
        )
    }
})

test("passes prettierOptions to every composed parser stage", async () => {
    const observedPreprocessOptions: unknown[] = []

    const observedParseOptions: unknown[] = []

    const observedTransformOptions: unknown[] = []

    const baseParser = typescriptPlugin.parsers.typescript
    const composedPlugin = {
        options: {
            fixtureOption: {
                type: "boolean",
                default: false,
                description: "Test-only composed plugin option",
            },
        },
        parsers: {
            typescript: {
                preprocess(text: string, options: Record<string, unknown>) {
                    observedPreprocessOptions.push(options.fixtureOption)
                    return text
                },
            },
        },
    } as Plugin

    const parsePlugin = {
        parsers: {
            typescript: {
                ...baseParser,
                async parse(text: string, options: Record<string, unknown>) {
                    observedParseOptions.push(options.fixtureOption)
                    return baseParser.parse(text, options as never)
                },
            },
        },
    } as Plugin

    const transformPlugin = {
        parsers: {
            typescript: {
                __transformAST(ast: unknown, options: Record<string, unknown>) {
                    observedTransformOptions.push(options.fixtureOption)
                    return ast
                },
            },
        },
    } as Plugin

    await format(`const value = 1`, {
        parser: "typescript",
        plugins: [
            createPlugin({
                otherPlugins: [composedPlugin, parsePlugin, transformPlugin],
                prettierOptions: { fixtureOption: true },
            }),
        ],
        semi: false,
    })

    assert.deepEqual(observedPreprocessOptions, [true])
    assert.deepEqual(observedParseOptions, [true])
    assert.deepEqual(observedTransformOptions, [true])
})

const PARSER_ADAPTER = Symbol.for("@1adybug/prettier.parser-adapter")
const base = typescriptPlugin.parsers.typescript

for (const lazy of [false, true]) {
    test(`preserves options and printers while excluding ${lazy ? "lazy" : "static"} adapters from parser stages`, async () => {
        const calls = { factory: 0, preprocess: 0, parse: 0, transform: 0, printer: 0 }

        const fail = () => {
            throw new Error("Pure adapters must not run in composed parser stages")
        }

        const adapterParser = { ...base, astFormat: "adapter-only", [PARSER_ADAPTER]: true, preprocess: fail, parse: fail, __transformAST: fail }

        const basePrinter = estree.printers.estree
        const adapter = {
            options: { fixtureOption: { type: "boolean", default: true, description: "Fixture option" } },
            parsers: { typescript: lazy ? async () => adapterParser : adapterParser },
            printers: {
                estree: {
                    ...basePrinter,
                    print(...args: Parameters<typeof basePrinter.print>) {
                        if (args[0].node.type === "Program") calls.printer++
                        return basePrinter.print(...args)
                    },
                },
            },
        } as unknown as Plugin
        const provider = {
            parsers: {
                typescript: async () => {
                    calls.factory++
                    return {
                        ...base,
                        preprocess(text: string, options: Record<string, unknown>) {
                            calls.preprocess++
                            assert.equal(options.fixtureOption, true)
                            return text
                        },
                        parse(text: string, options: Parameters<Parser["parse"]>[1]) {
                            calls.parse++
                            assert.equal((options as unknown as Record<string, unknown>).fixtureOption, true)
                            return base.parse(text, options)
                        },
                    }
                },
            },
        } as unknown as Plugin
        const transformer = {
            parsers: {
                typescript: {
                    __transformAST(ast: unknown) {
                        calls.transform++
                        return ast
                    },
                },
            },
        } as unknown as Plugin
        const composed = createPlugin({ otherPlugins: [adapter, provider, transformer] })
        assert.equal(composed.parsers?.typescript.astFormat, "estree")
        assert.equal((composed.parsers?.typescript as unknown as Record<symbol, unknown>)[PARSER_ADAPTER], undefined)
        const source = 'import z from "z"\nimport a from "a"\nconsole.log(z, a)'

        const options = { parser: "typescript", plugins: [composed], semi: false }

        const output = await format(source, options)
        assert(output.indexOf('from "a"') < output.indexOf('from "z"'))
        assert.deepEqual(calls, { factory: 1, preprocess: 1, parse: 1, transform: 1, printer: 1 })

        const nested = createPlugin({ otherPlugins: [composed] })
        assert.equal(await format(output, { ...options, plugins: [nested] }), output)
        assert.deepEqual(calls, { factory: 2, preprocess: 2, parse: 2, transform: 2, printer: 2 })
    })
}
