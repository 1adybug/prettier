import assert from "node:assert/strict"
import { describe, test } from "node:test"

import { format, getSupportInfo } from "prettier"

import plugin, { type BlockPaddingRule, type Options } from "../src/index"

const style = { semi: false, tabWidth: 4 }

const declarationRules: BlockPaddingRule[] = ["types", "interfaces", "enums", "classes"]

async function formatCode(source: string, options: Partial<Options> = {}, parser = "typescript") {
    return format(source, { ...style, parser, plugins: [plugin], ...options })
}

describe("padding configuration", () => {
    test("registers all five options with backward-compatible defaults", async () => {
        const { options } = await getSupportInfo({ plugins: [plugin] })
        const padding = Object.fromEntries(options.filter(option => option.name?.startsWith("blockPadding")).map(option => [option.name, option]))

        assert.equal(Object.keys(padding).length, 5)
        assert.deepEqual(padding.blockPaddingRules.default, [
            ...declarationRules,
            "object-array-literals",
            "multiline-blocks",
            "multiline-expressions",
            "multiline-class-members",
            "property-method-boundaries",
        ])
        assert.equal(padding.blockPaddingScope.default, "all")
        assert.equal(padding.blockPaddingMode.default, "around")
        assert.equal(padding.blockPaddingLines.default, 1)
        assert.equal(padding.blockPaddingClassMode.default, "multiline")
    })

    test("keeps two empty lines only between consecutive selected top-level declarations", async () => {
        const source = `const before = 1
type A = string
interface B { value: number }
const enum C { Active }
class D {}
const values = { value: 1 }
function run() {
    type Inner = string
    type Other = number
    const first = 1
    const object = { value: 1 }
    const last = 2
}
`

        const expected = `const before = 1
type A = string


interface B {
    value: number
}


const enum C {
    Active,
}


class D {}
const values = { value: 1 }
function run() {
    type Inner = string
    type Other = number
    const first = 1
    const object = { value: 1 }
    const last = 2
}
`

        for (const parser of ["typescript", "babel-ts"]) {
            const options: Partial<Options> = {
                blockPaddingRules: declarationRules,
                blockPaddingScope: "top-level",
                blockPaddingMode: "between",
                blockPaddingLines: 2,
                blockPaddingClassMode: "always",
            }

            const output = await formatCode(source, options, parser)
            assert.equal(output, expected, parser)
            assert.equal(await formatCode(output, options, parser), output, parser)
        }
    })

    test("distinguishes around and between without treating types as a combined declaration rule", async () => {
        const source = "const before = 1\ntype A = string\ntype B = number\ninterface C {}\nconst after = 2"

        const options: Partial<Options> = { blockPaddingRules: ["types"], blockPaddingLines: 2 }

        assert.equal(await formatCode(source, options), "const before = 1\n\n\ntype A = string\n\n\ntype B = number\n\n\ninterface C {}\nconst after = 2\n")
        assert.equal(
            await formatCode(source, { ...options, blockPaddingMode: "between" }),
            "const before = 1\ntype A = string\n\n\ntype B = number\ninterface C {}\nconst after = 2\n",
        )
    })

    const statementCases: Array<{ rule: BlockPaddingRule; source: string; printed: string }> = [
        { rule: "types", source: "type Value = string | number", printed: "type Value = string | number" },
        { rule: "interfaces", source: "interface Value {}", printed: "interface Value {}" },
        { rule: "enums", source: "enum Value { Active }", printed: "enum Value {\n    Active,\n}" },
        { rule: "classes", source: "class Value {}", printed: "class Value {}" },
        { rule: "object-array-literals", source: "const values = [1, 2]", printed: "const values = [1, 2]" },
        { rule: "multiline-blocks", source: "if (ready) { execute() }", printed: "if (ready) {\n    execute()\n}" },
        { rule: "multiline-expressions", source: "const callback = () => { execute() }", printed: "const callback = () => {\n    execute()\n}" },
    ]

    for (const { rule, source, printed } of statementCases) {
        test(`selects ${rule} independently`, async () => {
            const options: Partial<Options> = { blockPaddingRules: [rule], blockPaddingClassMode: "always" }

            assert.equal(await formatCode(`const before = 1\n${source}\nconst after = 2`, options), `const before = 1\n\n${printed}\n\nconst after = 2\n`)
            assert.equal(await formatCode("const first = 1\nconst second = 2", options), "const first = 1\nconst second = 2\n")
        })
    }

    test("selects multiline members and property/method boundaries independently", async () => {
        const source = "class Value { first = 1; method() {}; second = 2 }"
        assert.equal(
            await formatCode(source, { blockPaddingRules: ["multiline-class-members"] }),
            "class Value {\n    first = 1\n    method() {}\n    second = 2\n}\n",
        )
        assert.equal(
            await formatCode(source, { blockPaddingRules: ["property-method-boundaries"], blockPaddingMode: "between", blockPaddingLines: 2 }),
            "class Value {\n    first = 1\n\n\n    method() {}\n\n\n    second = 2\n}\n",
        )
        assert.equal(
            await formatCode("class Value { first = 1; method() { execute() }; second = 2 }", { blockPaddingRules: ["multiline-class-members"] }),
            "class Value {\n    first = 1\n\n    method() {\n        execute()\n    }\n\n    second = 2\n}\n",
        )
    })

    test("matches enabled expression rules in declarations that also contain disabled literals", async () => {
        const source = "const before = 1\nconst values = [], callback = () => { execute() }\nconst after = 2"
        const output = await formatCode(source, { blockPaddingRules: ["multiline-expressions"] })

        assert.equal(output, "const before = 1\n\nconst values = [],\n    callback = () => {\n        execute()\n    }\n\nconst after = 2\n")
        assert.equal(await formatCode(output, { blockPaddingRules: ["multiline-expressions"] }), output)
    })

    test("delegates class bodies when only statement rules are selected", async () => {
        const source = "class Value { first = 1; method() { execute() }; second = 2 }"
        assert.equal(await formatCode(source, { blockPaddingRules: ["classes"] }), await format(source, { ...style, parser: "typescript" }))
    })

    test("handles export, declare, abstract, generic, and anonymous default declarations", async () => {
        const sources = [
            "declare type A<T> = { value: T }\nexport type B = string",
            "declare interface A<T> { value: T }\nexport default interface B {}",
            "declare enum A { First }\nexport const enum B { Second }",
            "declare class A {}\nexport abstract class B {}\nexport default class {}",
        ]

        for (const parser of ["typescript", "babel-ts"]) {
            for (const source of sources) {
                const options: Partial<Options> = { blockPaddingRules: declarationRules, blockPaddingMode: "between", blockPaddingClassMode: "always" }

                const output = await formatCode(source, options, parser)
                assert.equal((output.match(/\n\n/g) ?? []).length, source.includes("abstract class") ? 2 : 1, source)
                assert.equal(await formatCode(output, options, parser), output, source)
            }
        }
    })

    test("preserves old multiline class behavior and optionally includes empty classes", async () => {
        for (const parser of ["babel", "babel-ts", "typescript"]) {
            const source = "class A {}\nclass B {}"

            const options: Partial<Options> = { blockPaddingRules: ["classes"], blockPaddingMode: "between" }

            assert.equal(await formatCode(source, options, parser), "class A {}\nclass B {}\n", parser)
            assert.equal(
                await formatCode(source, { ...options, blockPaddingClassMode: "always", blockPaddingLines: 2 }, parser),
                "class A {}\n\n\nclass B {}\n",
                parser,
            )
            assert.equal(
                await formatCode("class A { value = 1 }\nclass B { value = 2 }", options, parser),
                "class A {\n    value = 1\n}\n\nclass B {\n    value = 2\n}\n",
                parser,
            )
        }
    })

    test("does not re-enable class declaration padding through multiline blocks", async () => {
        const source = "const before = 1\nclass A { method() { execute() } }\nconst after = 2"
        const expected = await format(source, { ...style, parser: "typescript" })
        assert.equal(await formatCode(source, { blockPaddingRules: ["multiline-blocks"], blockPaddingClassMode: "always" }), expected)
    })

    test("keeps class expressions under the expression rule, not the classes rule", async () => {
        const source = "const before = 1\nconst Value = class { method() { execute() } }\nconst after = 2"
        const expected = await format(source, { ...style, parser: "typescript" })
        assert.equal(await formatCode(source, { blockPaddingRules: ["classes"], blockPaddingClassMode: "always" }), expected)
        assert.equal(
            await formatCode(source, { blockPaddingRules: ["multiline-expressions"] }),
            "const before = 1\n\nconst Value = class {\n    method() {\n        execute()\n    }\n}\n\nconst after = 2\n",
        )
        assert.equal(
            await formatCode("const A = class {}\nconst B = class {}", { blockPaddingRules: ["multiline-expressions"], blockPaddingClassMode: "always" }),
            "const A = class {}\nconst B = class {}\n",
        )
    })

    test("limits padding to Program while all scope includes nested statement containers", async () => {
        const source = "function run() { const first = 1; const values = []; const last = 2 }"

        const options: Partial<Options> = { blockPaddingRules: ["object-array-literals"], blockPaddingLines: 2 }

        assert.equal(await formatCode(source, { ...options, blockPaddingScope: "top-level" }), await format(source, { ...style, parser: "typescript" }))
        assert.equal(await formatCode(source, options), "function run() {\n    const first = 1\n\n\n    const values = []\n\n\n    const last = 2\n}\n")
        const nested = "namespace N { type A = string; type B = number }\nclass C { static { type A = string; type B = number } }"

        const selected: Partial<Options> = { blockPaddingRules: ["types"], blockPaddingMode: "between", blockPaddingLines: 2 }

        const output = await formatCode(nested, selected)
        assert(output.includes("type A = string\n\n\n    type B = number"))
        assert(output.includes("type A = string\n\n\n        type B = number"))
        assert.equal(await formatCode(nested, { ...selected, blockPaddingScope: "top-level" }), await format(nested, { ...style, parser: "typescript" }))
    })

    test("caps original blank lines at unmatched boundaries while selected spacing is exact", async () => {
        assert.equal(
            await formatCode("type A = string\n\n\n\ntype B = number\n\n\n\nconst value = 1", {
                blockPaddingRules: ["types"],
                blockPaddingMode: "between",
                blockPaddingLines: 2,
            }),
            "type A = string\n\n\ntype B = number\n\nconst value = 1\n",
        )

        assert.equal(await formatCode("type A = string", { blockPaddingRules: ["types"], blockPaddingLines: 2 }), "type A = string\n")
        assert.equal(await formatCode("", { blockPaddingLines: 2 }), "")
    })

    test("empty rules match native Prettier including directives, comments, and empty bodies", async () => {
        const source = `/// <reference types="node" />
"use strict"
type A = string
interface B {}
function run() { /* keep */ }
class C { first = 1; method() { /* keep */ } }
namespace N { /* keep */ }
try { run() } catch { /* keep */ }
`

        for (const parser of ["typescript", "babel-ts"]) {
            const output = await formatCode(source, { blockPaddingRules: [], blockPaddingLines: 2, blockPaddingClassMode: "always" }, parser)
            assert.equal(output, await format(source, { ...style, parser }), parser)
            assert.equal(await formatCode(output, { blockPaddingRules: [] }, parser), output, parser)
        }
    })

    test("counts only real blank lines around leading and trailing comments at unmatched boundaries", async () => {
        const sources = [
            "const before = 1\nclass C { value = 1 } // trailing\nconst after = 2",
            "const before = 1\nconst callback = () => { execute() } // trailing\nconst after = 2",
            "const before = 1 /* multiple\n comment lines */\nconst after = 2",
            "const before = 1\n/* leading\n comment lines */\nconst after = 2",
            "const before = 1\n\nclass C { value = 1 } // trailing\n\nconst after = 2",
            "const before = 1 /* multiple\n comment lines */\n\nconst after = 2",
            "const before = 1\n\n/* leading\n comment lines */\nconst after = 2",
        ]

        for (const parser of ["typescript", "babel-ts", "babel"]) {
            for (const source of sources) {
                const options: Partial<Options> = { blockPaddingRules: ["types"] }

                const output = await formatCode(source, options, parser)

                assert.equal(output, await format(source, { ...style, parser }), source)
                assert.equal(await formatCode(output, options, parser), output, source)
            }
        }
    })

    test("preserves attached comments and safe directive delegation with custom spacing", async () => {
        const source = "type A = string // first\n// second\ninterface B {}"

        const options: Partial<Options> = { blockPaddingRules: ["types", "interfaces"], blockPaddingMode: "between", blockPaddingLines: 2 }

        for (const parser of ["typescript", "babel-ts"]) {
            const output = await formatCode(source, options, parser)
            assert.equal(output, "type A = string // first\n\n\n// second\ninterface B {}\n", parser)
            assert.equal(await formatCode(output, options, parser), output, parser)
            const directive = 'function run() { "use strict"; const first = 1; const object = {}; const last = 2 }'
            assert.equal(
                await formatCode(directive, { blockPaddingRules: ["object-array-literals"], blockPaddingLines: 2 }, parser),
                await format(directive, { ...style, parser }),
                parser,
            )
        }
    })

    test("supports JSON configuration and duplicate whitelist entries without mutating defaults", async () => {
        const options = JSON.parse('{"blockPaddingRules":["types","types"],"blockPaddingMode":"between","blockPaddingLines":2}') as Partial<Options>
        assert.equal(await formatCode("type A = string\ntype B = number", options), "type A = string\n\n\ntype B = number\n")
        assert.equal(await formatCode("const a = 1\nconst b = {}\nconst c = 2"), "const a = 1\n\nconst b = {}\n\nconst c = 2\n")
    })

    test("rejects invalid rules, enums, and blank-line counts", async () => {
        const invalid = [
            { blockPaddingRules: ["unknown"] },
            { blockPaddingScope: "nested" },
            { blockPaddingMode: "either" },
            { blockPaddingClassMode: "single-line" },
            ...[0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1].map(blockPaddingLines => ({ blockPaddingLines })),
        ]

        for (const options of invalid) await assert.rejects(formatCode("const a = 1", options as Partial<Options>), /blockPadding/)
    })
})
