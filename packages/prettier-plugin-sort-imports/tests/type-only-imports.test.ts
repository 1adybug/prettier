import { describe, expect, test } from "bun:test"
import { format } from "prettier"

import { createPlugin } from "../src/index"

async function formatCode(code: string, options: Parameters<typeof createPlugin>[0] = {}) {
    return format(code, {
        parser: "typescript",
        plugins: [createPlugin(options)],
        semi: false,
    })
}

describe("type-only imports", () => {
    test("marks named imports used only in type references", async () => {
        const result = await formatCode(
            `
import { A } from "./a"

type B = A
`,
            { markTypeOnlyImports: true },
        )

        expect(result).toBe(`import type { A } from "./a"

type B = A
`)
    })

    test("marks value exports used only in typeof type queries", async () => {
        const result = await formatCode(
            `
import { a } from "./a"

export type A = typeof a
`,
            { markTypeOnlyImports: true },
        )

        expect(result).toBe(`import type { a } from "./a"

export type A = typeof a
`)
    })

    test("keeps value imports when the binding is used at runtime", async () => {
        const result = await formatCode(`
import { a } from "./a"

export type A = typeof a
console.log(a)
`)

        expect(result).toBe(`import { a } from "./a"

export type A = typeof a
console.log(a)
`)
    })

    test("keeps type-only usages unchanged by default", async () => {
        const result = await formatCode(`
import { A } from "./a"

type B = A
`)

        expect(result).toBe(`import { A } from "./a"

type B = A
`)
    })

    test("can keep specifier-level type markers instead of import type", async () => {
        const result = await formatCode(
            `
import { B, A } from "./a"

type C = A | B
`,
            { markTypeOnlyImports: true, mergeTypeImports: false },
        )

        expect(result).toBe(`import { type A, type B } from "./a"

type C = A | B
`)
    })

    test("handles aliased imports", async () => {
        const result = await formatCode(
            `
import { a as value } from "./a"

type A = typeof value
`,
            { markTypeOnlyImports: true },
        )

        expect(result).toBe(`import type { a as value } from "./a"

type A = typeof value
`)
    })

    test("works with removeUnusedImports", async () => {
        const result = await formatCode(
            `
import { b, a } from "./a"

type A = typeof a
`,
            { markTypeOnlyImports: true, removeUnusedImports: true },
        )

        expect(result).toBe(`import type { a } from "./a"

type A = typeof a
`)
    })

    test("preserves specifier comments when merging type imports", async () => {
        const result = await formatCode(
            `
import {
    // useful
    A,
} from "./a"

type B = A
`,
            { markTypeOnlyImports: true },
        )

        expect(result).toBe(`import type {
  // useful
  A,
} from "./a"

type B = A
`)
    })
})
