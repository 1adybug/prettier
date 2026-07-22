import assert from "node:assert/strict"
import { describe, test } from "node:test"

import { format } from "prettier"

import plugin, { type TransformASTOptions } from "../src/index"

async function formatCode(code: string, options: TransformASTOptions = {}, parser: "babel" | "babel-ts" | "typescript" = "typescript") {
    return format(code, {
        parser,
        plugins: [plugin],
        semi: false,
        tabWidth: 4,
        ...options,
    })
}

describe("arrow return bodies", () => {
    test("converts values, object literals, empty returns, and async returns", async () => {
        const result = await formatCode(`
const value = () => { return 1 }
const object = () => { return { a: 1 } }
const empty = () => { return }
const asyncValue = async () => { return await load() }
`)

        assert.equal(
            result,
            `const value = () => 1
const object = () => ({ a: 1 })
const empty = () => undefined
const asyncValue = async () => await load()
`,
        )
    })

    test("preserves return blocks containing comments", async () => {
        const result = await formatCode(`
const value = () => {
    // Keep the explanation.
    return load()
}
`)

        assert.equal(
            result,
            `const value = () => {
    // Keep the explanation.
    return load()
}
`,
        )
    })

    test("handles return shorthand consistently in every exposed parser", async () => {
        const source = `
const object = () => { return { value: 1 } }
const empty = () => { return }
`

        for (const parser of ["babel", "babel-ts", "typescript"] as const)
            assert.equal(await formatCode(source, {}, parser), `const object = () => ({ value: 1 })\nconst empty = () => undefined\n`)
    })
})

describe("control statement safety", () => {
    test("removes simple braces but preserves lexical declarations and dangling else", async () => {
        const result = await formatCode(`
if (a) { run() }
if (a) { const value = 1 }
if (a) { if (b) run() } else fallback()
`)

        assert.equal(
            result,
            `if (a) run()
if (a) {
    const value = 1
}
if (a) {
    if (b) run()
} else fallback()
`,
        )
    })

    test("keeps braces around TypeScript declarations and nested dangling-else chains", async () => {
        const result = await formatCode(
            `
if (ready) { type Local = string }
if (ready) { enum State { Active } }
if (ready) { using resource = acquire() }
if (outer) { while (running) if (inner) execute() } else fallback()
`,
            { controlStatementBraces: "remove", multiLineBraces: "remove" },
        )

        assert.equal(
            result,
            `if (ready) {
    type Local = string
}
if (ready) {
    enum State {
        Active,
    }
}
if (ready) {
    using resource = acquire()
}
if (outer) {
    while (running) if (inner) execute()
} else fallback()
`,
        )
    })

    test("preserves commented alternate blocks while removing safe neighbors", async () => {
        const result = await formatCode(
            `
if (ready) { execute() } else {
    // keep fallback reason
    fallback()
}
`,
            { controlStatementBraces: "remove", multiLineBraces: "remove" },
        )

        assert.equal(
            result,
            `if (ready) execute()
else {
    // keep fallback reason
    fallback()
}
`,
        )
    })

    test("preserves comments attached anywhere inside consequent and loop blocks", async () => {
        const result = await formatCode(
            `
if (ready) {
    // keep consequent reason
    execute()
}
while (ready) {
    execute() // keep loop reason
}
if (outer) {
    while (ready) {
        // keep nested reason
        execute()
    }
}
`,
            { controlStatementBraces: "remove", multiLineBraces: "remove" },
        )

        assert.equal(
            result,
            `if (ready) {
    // keep consequent reason
    execute()
}
while (ready) {
    execute() // keep loop reason
}
if (outer) {
    while (ready) {
        // keep nested reason
        execute()
    }
}
`,
        )
    })

    test("supports every controlStatementBraces mode", async () => {
        const source = `if (a) { while (b) run() }`

        assert.equal(
            await formatCode(source),
            `if (a) {
    while (b) run()
}
`,
        )

        assert.equal(await formatCode(source, { controlStatementBraces: "remove" }), `if (a) while (b) run()\n`)

        assert.equal(
            await formatCode(`if (a) while (b) run()`, { controlStatementBraces: "add" }),
            `if (a) {
    while (b) run()
}
`,
        )
    })

    test("removes braces around every supported nested control statement", async () => {
        const result = await formatCode(
            `
if (a) { if (b) run() }
if (a) { for (;;) run() }
if (a) { for (const key in object) run(key) }
if (a) { for (const value of values) run(value) }
if (a) { while (b) run() }
if (a) { do run(); while (b) }
if (a) { try { run() } catch { fallback() } }
if (a) { switch (value) { case 1: run(); break; default: fallback() } }
`,
            { controlStatementBraces: "remove" },
        )

        assert.equal(
            result,
            `if (a) if (b) run()
if (a) for (;;) run()
if (a) for (const key in object) run(key)
if (a) for (const value of values) run(value)
if (a) while (b) run()
if (a)
    do run()
    while (b)
if (a)
    try {
        run()
    } catch {
        fallback()
    }
if (a)
    switch (value) {
        case 1:
            run()
            break
        default:
            fallback()
    }
`,
        )
    })

    test("supports every multiLineBraces mode", async () => {
        const unbraced = `if (a) run({\n first: 1,\n second: 2\n})`
        const braced = `if (a) { run({\n first: 1,\n second: 2\n}) }`

        const withoutBraces = `if (a)
    run({
        first: 1,
        second: 2,
    })
`

        assert.equal(await formatCode(unbraced), withoutBraces)
        assert.equal(await formatCode(braced, { multiLineBraces: "remove" }), withoutBraces)

        assert.equal(
            await formatCode(unbraced, { multiLineBraces: "add" }),
            `if (a) {
    run({
        first: 1,
        second: 2,
    })
}
`,
        )
    })

    test("handles all supported loop bodies", async () => {
        const result = await formatCode(`
for (;;) { run() }
for (const item of items) { consume(item) }
while (ready) { run() }
do { run() } while (ready)
`)

        assert.equal(
            result,
            `for (;;) run()
for (const item of items) consume(item)
while (ready) run()
do run()
while (ready)
`,
        )
    })

    test("keeps blocks required by functions and try statements", async () => {
        const result = await formatCode(
            `
function run() { if (a) execute() }
try { if (a) execute() } catch { while (a) execute() } finally { for (;;) execute() }
`,
            { controlStatementBraces: "remove" },
        )

        assert.equal(
            result,
            `function run() {
    if (a) execute()
}
try {
    if (a) execute()
} catch {
    while (a) execute()
} finally {
    for (;;) execute()
}
`,
        )
    })
})

test("formatting is idempotent across combined remove-braces options", async () => {
    const first = await formatCode(
        `
const callback = () => { execute() }
if (ready) while (pending) execute()
`,
        { arrowFunctionVoid: true, controlStatementBraces: "add", multiLineBraces: "add" },
    )
    const second = await formatCode(first, { arrowFunctionVoid: true, controlStatementBraces: "add", multiLineBraces: "add" })

    assert.equal(second, first)
})

test("multiLineBraces predicts width-based wrapping on the first pass", async () => {
    const options: TransformASTOptions = { multiLineBraces: "add", printWidth: 40 }

    const source = `if (ready) execute(firstArgument, secondArgument, thirdArgument)`
    const first = await formatCode(source, options)
    const second = await formatCode(first, options)

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

test("multiLineBraces predicts wrapping through unary expression shells", async () => {
    const options: TransformASTOptions = { multiLineBraces: "add", printWidth: 40 }

    for (const expression of ["void execute(firstArgument, secondArgument, thirdArgument)", "!execute(firstArgument, secondArgument, thirdArgument)"]) {
        const source = `function test() { if (ready) ${expression} }`
        const first = await formatCode(source, options)
        const second = await formatCode(first, options)

        assert.match(first, /if \(ready\) \{\n/)
        assert.equal(second, first, expression)
    }
})

test("multiLineBraces skips width prediction for expressions Prettier cannot break", async () => {
    const options: TransformASTOptions = { multiLineBraces: "add", printWidth: 40 }

    for (const expression of [
        'import("abcdefghijklmnopqrstuvwxyz0123456789")',
        "`abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmnopqrstuvwxyz`",
        "tag`abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmnopqrstuvwxyz`",
    ]) {
        const source = `function test() { if (ready) ${expression} }`
        const first = await formatCode(source, options)
        const second = await formatCode(first, options)

        assert.doesNotMatch(first, /if \(ready\) \{/)
        assert.equal(second, first, expression)
    }
})
