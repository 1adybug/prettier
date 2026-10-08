import assert from "node:assert/strict"
import { describe, test } from "node:test"

import { type Options, format } from "prettier"

import plugin from "../src/index"

async function formatCode(code: string, options: Partial<Options> = {}) {
    return format(code, {
        parser: "typescript",
        plugins: [plugin],
        semi: false,
        tabWidth: 4,
        ...options,
    })
}

describe("statement padding", () => {
    test("pads type declarations and object literals at the top level", async () => {
        const result = await formatCode(`
const before = 1
type User = { id: string }
const values = { a: 1 }
const after = 2
`)

        assert.equal(
            result,
            `const before = 1

type User = { id: string }

const values = { a: 1 }

const after = 2
`,
        )
    })

    test("pads multiline blocks and array literals inside functions", async () => {
        const result = await formatCode(`
function run() {
    const before = 1
    if (ready) { execute() }
    const values = [1, 2]
    return before
}
`)

        assert.equal(
            result,
            `function run() {
    const before = 1

    if (ready) {
        execute()
    }

    const values = [1, 2]

    return before
}
`,
        )
    })

    test("separates class properties and multiline methods", async () => {
        const result = await formatCode(`
class Example {
    value = 1
    method() { run() }
    other = 2
}
`)

        assert.equal(
            result,
            `class Example {
    value = 1

    method() {
        run()
    }

    other = 2
}
`,
        )
    })

    test("pads statements inside class static initialization blocks", async () => {
        const result = await formatCode(`
class Example {
    static {
        const before = 1
        const value = { a: 1 }
        const after = 2
    }
}
`)

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

    test("pads declarations inside TypeScript namespaces", async () => {
        const result = await formatCode(`
namespace A {
    type B = string
    const value = { a: 1 }
    export function run() {}
}
`)

        assert.equal(
            result,
            `namespace A {
    type B = string

    const value = { a: 1 }

    export function run() {}
}
`,
        )
    })

    test("recognizes declarations and expressions wrapped by export statements", async () => {
        const result = await formatCode(`
const before = 1
export const config = { value: 1 }
export default function run() { execute() }
export class Example { method() { execute() } }
const after = 2
`)

        assert.equal(
            result,
            `const before = 1

export const config = { value: 1 }

export default function run() {
    execute()
}

export class Example {
    method() {
        execute()
    }
}

const after = 2
`,
        )
    })

    test("pads every supported expression kind when its document is forced to break", async () => {
        const result = await formatCode(
            `
const before = 1
const template = \`first
second\`
const tagged = html\`prefix \${
    // force multiline
    value
} suffix\`
const arrow = () => { execute() }
const fn = function () { execute() }
const Klass = class { method() { execute() } }
const view = <section><span>content</span><span>more</span></section>
const fragment = <><span>content</span><span>more</span></>
const call = createThing(
    firstArgument,
    // force multiline
    secondArgument,
)
const instance = new Service(
    firstArgument,
    // force multiline
    secondArgument,
)
const after = 2
`,
            { printWidth: 40 },
        )

        assert.equal(
            result,
            `const before = 1

const template = \`first
second\`

const tagged = html\`prefix
\${
    // force multiline
    value
}
suffix\`

const arrow = () => {
    execute()
}

const fn = function () {
    execute()
}

const Klass = class {
    method() {
        execute()
    }
}

const view = (
    <section>
        <span>content</span>
        <span>more</span>
    </section>
)

const fragment = (
    <>
        <span>content</span>
        <span>more</span>
    </>
)

const call = createThing(
    firstArgument,
    // force multiline
    secondArgument,
)

const instance = new Service(
    firstArgument,
    // force multiline
    secondArgument,
)

const after = 2
`,
        )
    })

    test("normalizes multiple existing blank lines to one", async () => {
        const result = await formatCode(`const a = 1\n\n\nconst b = 2\n\n\ntype C = string\n\n\nconst d = 4`)

        assert.equal(
            result,
            `const a = 1

const b = 2

type C = string

const d = 4
`,
        )
    })
})

describe("comments and syntax safety", () => {
    test("delegates empty commented bodies to Prettier", async () => {
        const result = await formatCode(`
function f() { /* function */ }
class A { /* class */ }
namespace B { /* namespace */ }
`)

        assert.equal(
            result,
            `function f() {
    /* function */
}

class A {
    /* class */
}

namespace B {
    /* namespace */
}
`,
        )
    })

    test("preserves directives, triple-slash comments, and empty statements", async () => {
        assert.equal(await formatCode(`"use strict"\nconst value = 1`), `"use strict"\nconst value = 1\n`)
        assert.equal(await formatCode(`/// <reference types="node" />\n\nconst value = 1`), `/// <reference types="node" />\n\nconst value = 1\n`)
        assert.equal(await formatCode(`;\n[]\n;\nconst value = 1`), `;[]\n\nconst value = 1\n`)
    })

    test("delegates function directive prologues for every parser", async () => {
        const source = `function run() { "use strict"; const config = { value: 1 }; execute(config) }`

        const expected = `function run() {
    "use strict"
    const config = { value: 1 }
    execute(config)
}
`

        for (const parser of ["babel", "babel-ts", "typescript"]) {
            assert.equal(
                await format(source, {
                    parser,
                    plugins: [plugin],
                    semi: false,
                    tabWidth: 4,
                }),
                expected,
                parser,
            )
        }
    })

    test("preserves shebangs and comments in catch and static blocks", async () => {
        const result = await formatCode(`#!/usr/bin/env node
try { run() } catch { /* keep catch */ } finally { cleanup() }
class Example { static { /* keep static */ } }
`)

        assert.equal(
            result,
            `#!/usr/bin/env node
try {
    run()
} catch {
    /* keep catch */
} finally {
    cleanup()
}

class Example {
    static {
        /* keep static */
    }
}
`,
        )
    })

    test("delegates switch-case statement sequences without losing comments", async () => {
        const result = await formatCode(`
switch (value) {
    case 1:
        // keep case reason
        use({ value: 1 })
        break
    default:
        fallback()
}
`)

        assert.equal(
            result,
            `switch (value) {
    case 1:
        // keep case reason
        use({ value: 1 })
        break
    default:
        fallback()
}
`,
        )
    })
})

test("supports babel, babel-ts, and typescript parser output", async () => {
    const source = `const before = 1\nconst value = { a: 1 }\nconst after = 2`

    for (const parser of ["babel", "babel-ts", "typescript"]) {
        const result = await format(source, {
            parser,
            plugins: [plugin],
            semi: false,
            tabWidth: 4,
        })

        assert.equal(result, `const before = 1\n\nconst value = { a: 1 }\n\nconst after = 2\n`)
    }
})

test("block padding is idempotent", async () => {
    const first = await formatCode(`
const before = 1
if (ready) { execute() }
const values = { a: 1 }
`)
    const second = await formatCode(first)

    assert.equal(second, first)
})
