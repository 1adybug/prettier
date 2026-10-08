import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { describe, test } from "node:test"

import { type Parser, type Plugin, format } from "prettier"
import merge from "prettier-plugin-merge"
import { parsers as babelParsers } from "prettier/plugins/babel"
import { parsers as typescriptParsers } from "prettier/plugins/typescript"

import padding from "../src/index"

const require = createRequire(import.meta.url)

const parserNames = ["babel", "babel-ts", "typescript"]

const bases: Record<string, Parser> = { babel: babelParsers.babel, "babel-ts": babelParsers["babel-ts"], typescript: typescriptParsers.typescript }

const style = { semi: false, tabWidth: 4 }

const selected = {
    blockPaddingRules: ["types", "interfaces", "enums", "classes"],
    blockPaddingScope: "top-level",
    blockPaddingMode: "between",
    blockPaddingLines: 2,
    blockPaddingClassMode: "always",
}

describe("parser-based plugin compatibility", () => {
    for (const parser of parserNames) {
        test(`merges declaration padding and comments with ${parser}`, async () => {
            const source =
                parser === "babel"
                    ? "export class A {}\n// B\nexport default class {}\nconst last = 1"
                    : "export type A<T> = { value: T }\n// B\ndeclare interface B extends Record<string, number> {}\nexport const enum C { Active }\nexport default class {}\nconst last = 1"

            const options = { ...style, ...selected, parser }

            const expected = await format(source, { ...options, plugins: [padding] })
            assert(expected.includes("\n\n\n// B"))
            const output = await format(source, { ...options, plugins: [padding, merge] })
            assert.equal(output, expected)
            assert.equal(await format(output, { ...options, plugins: [padding, merge] }), output)

            for (const blockPaddingRules of [[], ["classes"]]) {
                const config = { ...options, blockPaddingRules }

                assert.equal(await format(source, { ...config, plugins: [padding, merge] }), await format(source, { ...config, plugins: [padding] }))
            }
        })

        test(`delegates the preceding lazy ${parser} parser once per formatting run`, async () => {
            const calls = { factory: 0, preprocess: 0, parse: 0, earlier: 0 }

            const provider: Parser = {
                ...bases[parser],
                preprocess(text, options) {
                    calls.preprocess++
                    assert(!options.plugins.includes(padding))
                    return text.replace("original", "delegated")
                },
                parse(text, options) {
                    calls.parse++
                    assert(text.includes("delegated"))
                    assert(options.originalText.includes("delegated"))
                    assert(!options.plugins.includes(padding))
                    return bases[parser].parse(text, options)
                },
            }

            const earlier = {
                parsers: {
                    [parser]: async () => {
                        calls.earlier++
                        return bases[parser]
                    },
                },
            } as unknown as Plugin
            const preceding = {
                parsers: {
                    [parser]: async () => {
                        calls.factory++
                        return provider
                    },
                },
            } as unknown as Plugin

            const options = { ...style, parser, plugins: [earlier, preceding, padding], blockPaddingRules: [] }

            const output = await format("const original = 1", options)
            assert.equal(output, "const delegated = 1\n")
            assert.deepEqual(calls, { factory: 1, preprocess: 1, parse: 1, earlier: 0 })
            assert.equal(await format(output, options), output)
            assert.deepEqual(calls, { factory: 2, preprocess: 2, parse: 2, earlier: 0 })
        })
    }

    test("merges default padding without custom configuration", async () => {
        const source = "const first = 1\nconst object = {}\nconst last = 2"
        assert.equal(
            await format(source, { ...style, parser: "babel", plugins: [padding, merge] }),
            await format(source, { ...style, parser: "babel", plugins: [padding] }),
        )
    })

    test("loads the default entry and merge through string plugin paths", async () => {
        const options = {
            ...style,
            ...selected,
            parser: "typescript",
            plugins: [require.resolve("@1adybug/prettier-plugin-block-padding"), require.resolve("prettier-plugin-merge")],
        }

        assert.equal(await format("type A = string\ninterface B {}", options), "type A = string\n\n\ninterface B {}\n")
    })
})
