import assert from "node:assert/strict"
import { dirname, resolve } from "node:path"
import { describe, test } from "node:test"
import { fileURLToPath, pathToFileURL } from "node:url"

import { type Plugin, format, getSupportInfo } from "prettier"
import merge from "prettier-plugin-merge"
import * as tailwind from "prettier-plugin-tailwindcss"

import padding from "../../prettier-plugin-block-padding/src/index"

import braces from "../../prettier-plugin-remove-braces/src/index"

import { createPlugin } from "../../prettier-plugin-sort-imports/src/index"

interface PrettierModule {
    default: Plugin
}

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const tailwindProjectDir = resolve(packageDir, "tests/fixtures/tailwind-project")
const pluginUrl = pathToFileURL(resolve(packageDir, "src/index.ts")).href
const rootConfigUrl = pathToFileURL(resolve(packageDir, "../../prettier.config.mjs")).href

let pluginPromise: Promise<Plugin> | undefined

async function loadPlugin() {
    if (pluginPromise) return pluginPromise

    pluginPromise = import(`${pluginUrl}?integration-test`).then(module => (module as PrettierModule).default)
    return pluginPromise
}

const recommendedOptions = {
    arrowFunctionVoid: true,
    arrowParens: "avoid" as const,
    controlStatementBraces: "add",
    endOfLine: "lf" as const,
    markTypeOnlyImports: true,
    multiLineBraces: "add",
    nodeProtocol: "add",
    printWidth: 160,
    semi: false,
    tabWidth: 4,
}

async function formatCode(code: string, options: Record<string, unknown> = {}) {
    const plugin = await loadPlugin()

    return format(code, {
        filepath: resolve(tailwindProjectDir, "src/App.tsx"),
        parser: "typescript",
        plugins: [plugin],
        ...recommendedOptions,
        ...options,
    })
}

describe("bundled plugin pipeline", () => {
    test("keeps the integration matrix synchronized with the root Prettier config", async () => {
        const rootConfig = (await import(`${rootConfigUrl}?integration-test`)).default
        const { plugins, ...rootOptions } = rootConfig

        assert.deepEqual(plugins, ["@1adybug/prettier"])
        assert.deepEqual(rootOptions, recommendedOptions)
    })

    test("applies import, padding, braces, void-arrow, and Tailwind transforms together", async () => {
        const result = await formatCode(`
import { TypeOnly, runtime } from "./module"
import { join } from "path"
import React from "react"
const callback = () => { console.log(runtime) }
if (runtime) while (pending) console.log(join("", ""))
type Alias = TypeOnly
const view = <div className="w-full h-full flex bg-red-500 p-4" />
`)

        assert.equal(
            result,
            `import React from "react"

import { join } from "node:path"

import { type TypeOnly, runtime } from "./module"

const callback = () => void console.log(runtime)

if (runtime) {
    while (pending) console.log(join("", ""))
}

type Alias = TypeOnly

const view = <div className="flex h-full w-full bg-red-500 p-4" />
`,
        )
    })

    test("is idempotent with all recommended options enabled", async () => {
        const first = await formatCode(`
import { TypeOnly, runtime } from "./module"
import React from "react"
const callback = () => { runtime() }
type Alias = TypeOnly
const view = <div className="p-4 flex" />
`)
        const second = await formatCode(first)

        assert.equal(second, first)
    })

    test("remains idempotent when printWidth creates a multiline control body", async () => {
        const source = `if (ready) execute(firstArgument, secondArgument, thirdArgument)`
        const first = await formatCode(source, { printWidth: 40 })
        const second = await formatCode(first, { printWidth: 40 })

        assert.equal(
            first,
            `if (ready) {
    execute(
        firstArgument,
        secondArgument,
        thirdArgument,
    )
}
`,
        )

        assert.equal(second, first)
    })

    test("groups React, builtins, packages, aliases, relative directories, and exports", async () => {
        const result = await formatCode(`
export { value as exported } from "./module"
import sibling from "../shared"
import local from "./module"
import Counter from "@/components/Counter"
import packageValue from "zod"
import { readFile } from "fs/promises"
import React from "react"
console.log(React, readFile, packageValue, Counter, local, sibling)
`)

        assert.equal(
            result,
            `import React from "react"

import { readFile } from "node:fs/promises"

import packageValue from "zod"

import Counter from "@/components/Counter"

import sibling from "../shared"

import local from "./module"

export { value as exported } from "./module"

console.log(React, readFile, packageValue, Counter, local, sibling)
`,
        )
    })

    test("preserves block-padding printer behavior through the composed plugin", async () => {
        const result = await formatCode(`class Example { static { const before = 1; const value = { a: 1 }; const after = 2 } }`)

        assert.equal(
            result,
            `class Example {
    static {
        const before = 1

        const value = { a: 1 }

        const after = 2
    }
}
`,
        )
    })
})

describe("option composition", () => {
    test("preserves side-effect order by default and sorts it only when requested", async () => {
        const source = `
import "./z.css"
import "./a.css"
`

        assert.equal(await formatCode(source), `import "./z.css"\nimport "./a.css"\n`)
        assert.equal(await formatCode(source, { sortSideEffect: true }), `import "./a.css"\nimport "./z.css"\n`)
    })

    test("separates regular and side-effect import groups without reordering side effects", async () => {
        const source = `
import type { FC } from "react"
import { Registry } from "@/components/Registry"
import "@fontsource-variable/noto-sans-sc/wght.css"
import "./globals.css"
`

        assert.equal(
            await formatCode(source),
            `import type { FC } from "react"

import { Registry } from "@/components/Registry"

import "@fontsource-variable/noto-sans-sc/wght.css"

import "./globals.css"
`,
        )
    })

    test("allows individual bundled transforms to be disabled or overridden", async () => {
        const result = await formatCode(
            `
const callback = value => { consume(value) }
if (ready) { execute() }
`,
            {
                arrowFunctionVoid: false,
                controlStatementBraces: "remove",
                multiLineBraces: "remove",
            },
        )

        assert.equal(
            result,
            `const callback = value => {
    consume(value)
}

if (ready) execute()
`,
        )
    })
})

describe("padding option composition", () => {
    test("exposes the standalone padding options through the aggregate plugin", async () => {
        const plugin = await loadPlugin()
        const { options } = await getSupportInfo({ plugins: [plugin] })

        assert.deepEqual(
            options
                .filter(option => option.name?.startsWith("blockPadding"))
                .map(option => option.name)
                .sort(),
            ["blockPaddingClassMode", "blockPaddingLines", "blockPaddingMode", "blockPaddingRules", "blockPaddingScope"],
        )
    })

    test("pads only consecutive selected top-level declarations with two blank lines", async () => {
        const source = "const before = 1\nexport type A = string\nexport interface B {}\nexport const enum C { Active }\nclass D {}\nconst after = 2"

        const options = {
            blockPaddingRules: ["types", "interfaces", "enums", "classes"],
            blockPaddingScope: "top-level",
            blockPaddingMode: "between",
            blockPaddingLines: 2,
            blockPaddingClassMode: "always",
        }

        const expected =
            "const before = 1\nexport type A = string\n\n\nexport interface B {}\n\n\nexport const enum C {\n    Active,\n}\n\n\nclass D {}\nconst after = 2\n"

        for (const parser of ["typescript", "babel-ts"]) {
            const output = await formatCode(source, { ...options, parser })
            assert.equal(output, expected, parser)
            assert.equal(await formatCode(output, { ...options, parser }), output, parser)
        }
    })

    test("disabling padding preserves the other bundled transforms", async () => {
        const source = `import { z, a } from "./module"
const callback = value => { console.log(a, z, value) }
const view = <div className="p-4 flex" />`

        const output = await formatCode(source, { blockPaddingRules: [] })

        assert.equal(
            output,
            `import { a, z } from "./module"

const callback = value => void console.log(a, z, value)
const view = <div className="flex p-4" />
`,
        )

        assert.equal(await formatCode(output, { blockPaddingRules: [] }), output)
    })

    test("configures empty class declarations consistently in every parser", async () => {
        const options = { blockPaddingRules: ["classes"], blockPaddingScope: "top-level", blockPaddingMode: "between", blockPaddingLines: 2 }

        for (const parser of ["babel", "babel-ts", "typescript"]) {
            assert.equal(await formatCode("class A {}\nclass B {}", { ...options, parser }), "class A {}\nclass B {}\n", parser)
            assert.equal(
                await formatCode("class A {}\nclass B {}", { ...options, blockPaddingClassMode: "always", parser }),
                "class A {}\n\n\nclass B {}\n",
                parser,
            )
        }
    })

    test("disabled class declaration padding does not disable member spacing", async () => {
        const output = await formatCode("const before = 1\nclass Value { first = 1; method() { execute() }; second = 2 }\nconst after = 2", {
            blockPaddingRules: ["multiline-blocks", "multiline-class-members", "property-method-boundaries"],
        })
        assert.equal(
            output,
            "const before = 1\nclass Value {\n    first = 1\n\n    method() {\n        execute()\n    }\n\n    second = 2\n}\nconst after = 2\n",
        )
    })
})

describe("corner-case isolation", () => {
    test("skips unsafe import rewrites without disabling unrelated plugins", async () => {
        const result = await formatCode(`
import data from "./data.json" with { type: "json" }
import { readFile } from "fs"
const view = <div className="p-4 flex" />
console.log(data, readFile, view)
`)

        assert.equal(
            result,
            `import data from "./data.json" with { type: "json" }
import { readFile } from "fs"
const view = <div className="flex p-4" />
console.log(data, readFile, view)
`,
        )
    })

    test("preserves commented empty namespaces and decorator metadata imports", async () => {
        const result = await formatCode(`
import { Service } from "./service"
function dec(value: unknown) {}
@dec
class Controller { constructor(service: Service) {} }
namespace Empty { /* keep */ }
`)

        assert.equal(
            result,
            `import { Service } from "./service"

function dec(value: unknown) {}

@dec
class Controller {
    constructor(service: Service) {}
}

namespace Empty {
    /* keep */
}
`,
        )
    })

    test("keeps incompatible imports and commented control blocks losslessly", async () => {
        const result = await formatCode(`
import first from "pkg"
import second from "pkg"
if (ready) {
    execute()
} else {
    // keep fallback reason
    fallback()
}
console.log(first, second)
`)

        assert.equal(
            result,
            `import first from "pkg"
import second from "pkg"

if (ready) execute()
else {
    // keep fallback reason
    fallback()
}

console.log(first, second)
`,
        )
    })

    test("keeps TypeScript runtime imports while removing only unused neighbors", async () => {
        const result = await formatCode(
            `
import { unused, value } from "./runtime"
namespace Runtime { console.log(value) }
const view = <div className="p-4 flex" />
`,
            { removeUnusedImports: true },
        )

        assert.equal(
            result,
            `import { value } from "./runtime"

namespace Runtime {
    console.log(value)
}

const view = <div className="flex p-4" />
`,
        )
    })

    test("preserves directive prologues while unrelated transforms continue", async () => {
        const source = `
"use client"
import { z, a } from "./module"
function run() { "use strict"; const config = { value: a }; console.log(config, z) }
const callback = () => { run() }
const view = <div className="p-4 flex" />
`

        for (const parser of ["babel", "babel-ts", "typescript"]) {
            const result = await formatCode(source, { parser })
            const second = await formatCode(result, { parser })

            assert.equal(result.match(/"use (?:client|strict)"/g)?.length, 2, parser)
            assert.match(result, /import \{ a, z \} from "\.\/module"/)
            assert.match(result, /const callback = \(\) => void run\(\)/)
            assert.match(result, /className="flex p-4"/)
            assert.equal(second, result, parser)
        }
    })
})

test("exposes a working parser pipeline for babel, babel-ts, and typescript", async () => {
    const source = `import { z, a } from "./module"\nconst run = () => { console.log(a, z) }`

    for (const parser of ["babel", "babel-ts", "typescript"]) {
        const result = await formatCode(source, { parser })

        assert.equal(result, `import { a, z } from "./module"\n\nconst run = () => void console.log(a, z)\n`)
    }
})

test("keeps a representative composed pipeline valid and idempotent in every parser", async () => {
    const source = `
import { z, a } from "./module"
import "./z.css"
import "./a.css"
const callback = () => { console.log(a, z) }
if (ready) void execute(firstArgument, secondArgument, thirdArgument)
const view = <div className="p-4 flex" />
`

    for (const parser of ["babel", "babel-ts", "typescript"]) {
        const options = { parser, printWidth: 40 }

        const first = await formatCode(source, options)
        const second = await formatCode(first, options)

        await format(first, { parser, semi: false })
        assert.equal(second, first, parser)
    }
})

describe("merge plugin interoperability", () => {
    test("preserves native layout for large type unions with and without merge", async () => {
        const plugin = await loadPlugin()
        const source = `export type Value = ${Array.from({ length: 12 }, (_, index) => JSON.stringify(`some-long-value-${index}`)).join(" | ")}`

        for (const parser of ["babel-ts", "typescript"]) {
            const options = { ...recommendedOptions, parser }

            const expected = await format(source, options)

            for (const plugins of [[plugin], [plugin, merge]]) {
                for (const extra of [{}, { blockPaddingRules: [] }]) {
                    const config = { ...options, ...extra, plugins }

                    const output = await format(source, config)
                    assert.equal(output, expected)
                    assert.equal(await format(output, config), output)
                }
            }
        }
    })

    test("keeps nested controls identical and idempotent in direct and merge pipelines", async () => {
        const plugin = await loadPlugin()
        const source =
            "for (const discriminator of tsDiscriminators) if (!kotlinDiscriminators.has(discriminator)) throw new Error(`Kotlin contract is missing discriminator ${discriminator}`)"

        const expected = `for (const discriminator of tsDiscriminators) {
    if (!kotlinDiscriminators.has(discriminator)) throw new Error(\`Kotlin contract is missing discriminator \${discriminator}\`)
}
`

        for (const parser of ["babel", "babel-ts", "typescript"]) {
            for (const plugins of [[plugin], [plugin, merge]]) {
                const options = { ...recommendedOptions, parser, plugins }

                const output = await format(source, options)
                assert.equal(output, expected)
                assert.equal(await format(output, options), output)
            }
        }
    })

    for (const parser of ["babel", "babel-ts", "typescript"]) {
        test(`preserves padding and the other transforms through merge with ${parser}`, async () => {
            const plugin = await loadPlugin()
            const declarations = parser === "babel" ? "export class A {}\nexport default class {}" : "export type A = string\nexport interface B {}"
            const source = `import z from "z"\nimport a from "a"\n${declarations}\nconst view = <div className="text-sm p-4 flex" />\nif (ready) { execute() }`

            const options = {
                ...recommendedOptions,
                parser,
                filepath: resolve(tailwindProjectDir, "src/App.tsx"),
                controlStatementBraces: "remove",
                blockPaddingRules: ["types", "interfaces", "classes"],
                blockPaddingScope: "top-level",
                blockPaddingMode: "between",
                blockPaddingLines: 2,
                blockPaddingClassMode: "always",
            }

            const expected = await format(source, { ...options, plugins: [plugin] })
            assert(expected.includes("\n\n\nexport"))
            assert(expected.includes('className="flex p-4 text-sm"'))
            assert(expected.includes("if (ready) execute()"))
            assert(expected.indexOf('from "a"') < expected.indexOf('from "z"'))
            const output = await format(source, { ...options, plugins: [plugin, merge] })
            assert.equal(output, expected)
            assert.equal(await format(output, { ...options, plugins: [plugin, merge] }), output)
            assert.equal(
                await format(source, { ...options, blockPaddingRules: [], plugins: [plugin, merge] }),
                await format(source, { ...options, blockPaddingRules: [], plugins: [plugin] }),
            )
        })

        test(`preserves direct and factory compositions in different orders with ${parser}`, async () => {
            const declarations = parser === "babel" ? "class A {}\nclass B {}" : "type A = string\ninterface B {}"
            const source = `${declarations}\nconst view = <div className="text-sm p-4 flex" />\nif (ready) { execute() }`

            const options = {
                parser,
                filepath: resolve(tailwindProjectDir, "src/App.tsx"),
                semi: false,
                tabWidth: 4,
                controlStatementBraces: "remove",
                blockPaddingRules: ["types", "interfaces", "classes"],
                blockPaddingScope: "top-level",
                blockPaddingMode: "between",
                blockPaddingLines: 2,
                blockPaddingClassMode: "always",
            }

            const companions: Plugin[][] = [
                [tailwind as unknown as Plugin, braces, padding],
                [padding, tailwind as unknown as Plugin, braces],
                [braces, padding, tailwind as unknown as Plugin],
            ]

            for (const otherPlugins of companions) {
                const previousPlugins = otherPlugins.map(plugin => (plugin === padding ? { ...padding, parsers: undefined } : plugin))
                assert.equal(await format(source, { ...options, plugins: otherPlugins }), await format(source, { ...options, plugins: previousPlugins }))

                for (const plugins of [[createPlugin({ otherPlugins })], [...otherPlugins, merge]]) {
                    const output = await format(source, { ...options, plugins })
                    assert(output.includes("\n\n\n"))
                    assert(output.includes('className="flex p-4 text-sm"'))
                    assert(output.includes("if (ready) execute()"))
                    assert.equal(await format(output, { ...options, plugins }), output)
                }
            }

            for (const plugins of [
                [tailwind as unknown as Plugin, padding],
                [padding, tailwind as unknown as Plugin],
            ]) {
                const output = await format(source, { ...options, plugins })
                assert(output.includes("\n\n\n"))
                assert(output.includes('className="flex p-4 text-sm"'))
            }

            for (const plugins of [
                [braces, padding],
                [padding, braces],
            ]) {
                const output = await format(source, { ...options, plugins })
                assert(output.includes("\n\n\n"))
                assert(output.includes("if (ready) execute()"))
            }
        })
    }

    test("loads aggregate and merge using string plugin paths", async () => {
        const options = {
            parser: "typescript",
            semi: false,
            blockPaddingRules: ["types"],
            blockPaddingScope: "top-level",
            blockPaddingMode: "between",
            blockPaddingLines: 2,
            plugins: [resolve(packageDir, "dist/index.js"), resolve(packageDir, "node_modules/prettier-plugin-merge/dist/index.js")],
        }

        assert.equal(await format("type A = string\ntype B = number", options), "type A = string\n\n\ntype B = number\n")
    })
})
