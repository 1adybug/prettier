import assert from "node:assert/strict"
import { describe, test } from "node:test"

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

        assert.equal(
            result,
            `import type { A } from "./a"

type B = A
`,
        )
    })

    test("marks value exports used only in typeof type queries", async () => {
        const result = await formatCode(
            `
import { a } from "./a"

export type A = typeof a
`,
            { markTypeOnlyImports: true },
        )

        assert.equal(
            result,
            `import type { a } from "./a"

export type A = typeof a
`,
        )
    })

    test("keeps value imports when the binding is used at runtime", async () => {
        const result = await formatCode(`
import { a } from "./a"

export type A = typeof a
console.log(a)
`)

        assert.equal(
            result,
            `import { a } from "./a"

export type A = typeof a
console.log(a)
`,
        )
    })

    test("keeps type-only usages unchanged by default", async () => {
        const result = await formatCode(`
import { A } from "./a"

type B = A
`)

        assert.equal(
            result,
            `import { A } from "./a"

type B = A
`,
        )
    })

    test("can keep specifier-level type markers instead of import type", async () => {
        const result = await formatCode(
            `
import { B, A } from "./a"

type C = A | B
`,
            { markTypeOnlyImports: true, mergeTypeImports: false },
        )

        assert.equal(
            result,
            `import { type A, type B } from "./a"

type C = A | B
`,
        )
    })

    test("handles aliased imports", async () => {
        const result = await formatCode(
            `
import { a as value } from "./a"

type A = typeof value
`,
            { markTypeOnlyImports: true },
        )

        assert.equal(
            result,
            `import type { a as value } from "./a"

type A = typeof value
`,
        )
    })

    test("classifies qualified, inherited, and satisfies usages", async () => {
        const result = await formatCode(
            `
import { value, Shape, Namespace, Base } from "./types"
interface Derived extends Base {}
type Member = Namespace.Member
const checked = value satisfies Shape
console.log(checked)
`,
            { markTypeOnlyImports: true },
        )

        assert.equal(
            result,
            `import { type Base, type Namespace, type Shape, value } from "./types"

interface Derived extends Base {}
type Member = Namespace.Member
const checked = value satisfies Shape
console.log(checked)
`,
        )
    })

    test("keeps runtime references inside TypeScript-prefixed containers", async () => {
        const source = `
import { namespaceValue, enumValue, parameterValue, exportedValue, aliasValue } from "./runtime"
namespace Runtime {
    console.log(namespaceValue)
    export import Alias = aliasValue.Member
}
enum Values { Current = enumValue }
class Example { constructor(public field = parameterValue) {} }
export = exportedValue
`

        for (const config of [{ removeUnusedImports: true }, { markTypeOnlyImports: true }]) {
            const result = await formatCode(source, config)

            assert.equal(
                result,
                `import {
  aliasValue,
  enumValue,
  exportedValue,
  namespaceValue,
  parameterValue,
} from "./runtime"

namespace Runtime {
  console.log(namespaceValue)
  export import Alias = aliasValue.Member
}
enum Values {
  Current = enumValue,
}
class Example {
  constructor(public field = parameterValue) {}
}
export = exportedValue
`,
            )
        }
    })

    test("works with removeUnusedImports", async () => {
        const result = await formatCode(
            `
import { b, a } from "./a"

type A = typeof a
`,
            { markTypeOnlyImports: true, removeUnusedImports: true },
        )

        assert.equal(
            result,
            `import type { a } from "./a"

type A = typeof a
`,
        )
    })

    test("does not discard comments while removing unused imports", async () => {
        const statementComment = await formatCode(
            `
// keep import reason
import { unused } from "./module" // keep trailing
console.log("value")
`,
            { removeUnusedImports: true },
        )

        assert.equal(
            statementComment,
            `// keep import reason
import { unused } from "./module" // keep trailing

console.log("value")
`,
        )

        const specifierComment = await formatCode(
            `
import {
    // keep specifier reason
    commented,
    unused,
    used,
} from "./module"
console.log(used)
`,
            { removeUnusedImports: true },
        )

        assert.equal(
            specifierComment,
            `import {
  // keep specifier reason
  commented,
  used,
} from "./module"

console.log(used)
`,
        )
    })

    test("removes unused default, namespace, and named bindings but keeps side effects and re-exports", async () => {
        const result = await formatCode(
            `
import unusedDefault from "./default"
import * as unusedNamespace from "./namespace"
import { unused, used } from "./named"
import "./setup"
export { exported } from "./exported"
console.log(used)
`,
            { removeUnusedImports: true },
        )

        assert.equal(
            result,
            `import { used } from "./named"
import "./setup"
export { exported } from "./exported"

console.log(used)
`,
        )
    })

    test("removes an entirely unused import block without leaving whitespace", async () =>
        void assert.equal(
            await formatCode(
                `
import unusedDefault from "./default"
import { unused } from "./named"
console.log("value")
`,
                { removeUnusedImports: true },
            ),
            `console.log("value")
`,
        ))

    test("retains runtime references nested in TypeScript containers", async () => {
        const cases = [
            `namespace Runtime { console.log(value) }`,
            `enum Runtime { Current = value }`,
            `class Runtime { constructor(public field = value) {} }`,
            `export = value`,
        ]

        for (const body of cases) {
            const result = await formatCode(`import { unused, value } from "./runtime"\n${body}`, { removeUnusedImports: true })
            const second = await formatCode(result, { removeUnusedImports: true })

            assert.match(result, /^import \{ value \} from "\.\/runtime"/)
            assert.doesNotMatch(result, /\bunused\b/)
            assert.equal(second, result, body)
        }
    })

    test("skips unused-import removal when JSDoc type references cannot be resolved safely", async () => {
        const result = await formatCode(
            `
import { Unused, Value } from "./types"
/** @type {Value} */
const value = {}
console.log(value)
`,
            { removeUnusedImports: true },
        )

        assert.equal(
            result,
            `import { Unused, Value } from "./types"

/** @type {Value} */
const value = {}
console.log(value)
`,
        )
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

        assert.equal(
            result,
            `import type {
  // useful
  A,
} from "./a"

type B = A
`,
        )
    })
})
