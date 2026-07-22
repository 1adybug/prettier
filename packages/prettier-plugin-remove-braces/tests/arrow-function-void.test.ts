import assert from "node:assert/strict"
import { describe, test } from "node:test"

import { format } from "prettier"

import plugin from "../src/index"

async function formatCode(code: string, parser: "babel" | "babel-ts" | "typescript" = "typescript", arrowFunctionVoid = true) {
    return format(code, {
        parser,
        plugins: [plugin],
        arrowFunctionVoid,
        semi: false,
        tabWidth: 4,
    })
}

describe("arrowFunctionVoid", () => {
    test("is disabled by default", async () => {
        const result = await formatCode(
            `
const run = () => {
    doSomething()
}
`,
            "typescript",
            false,
        )

        assert.equal(
            result,
            `const run = () => {
    doSomething()
}
`,
        )
    })

    for (const parser of ["babel", "babel-ts", "typescript"] as const) {
        test(`converts a single expression statement with the ${parser} parser`, async () => {
            const result = await formatCode(
                `
const read = () => { value }
const run = () => { doSomething() }
const assign = () => { value = getValue() }
`,
                parser,
            )

            assert.equal(
                result,
                `const read = () => void value
const run = () => void doSomething()
const assign = () => void (value = getValue())
`,
            )
        })
    }

    test("converts matching nested arrow functions", async () => {
        const result = await formatCode(`
const run = () => {
    execute(() => {
        doSomething()
    })
}
`)

        assert.equal(result, `const run = () => void execute(() => void doSomething())\n`)
    })

    test("preserves precedence for sequence, logical, object, and await expressions", async () => {
        const result = await formatCode(`
const sequence = () => { (prepare(), execute()) }
const logical = () => { ready && execute() }
const object = () => { ({ value: 1 }) }
const asyncRun = async () => { await execute() }
`)

        assert.equal(
            result,
            `const sequence = () => void (prepare(), execute())
const logical = () => void (ready && execute())
const object = () => void { value: 1 }
const asyncRun = async () => void (await execute())
`,
        )
    })

    test("preserves comments, directives, multiple statements, and explicit returns", async () => {
        const result = await formatCode(`
const commented = () => {
    // Keep this comment.
    doSomething()
}

const directive = () => {
    "use strict"
}

const multiple = () => {
    prepare()
    execute()
}

const returned = () => {
    return doSomething()
}

const returnedCommented = () => {
    // Keep this return comment.
    return doSomething()
}
`)

        assert.equal(
            result,
            `const commented = () => {
    // Keep this comment.
    doSomething()
}

const directive = () => {
    "use strict"
}

const multiple = () => {
    prepare()
    execute()
}

const returned = () => doSomething()

const returnedCommented = () => {
    // Keep this return comment.
    return doSomething()
}
`,
        )
    })

    test("preserves directive prologues before expressions and returns in every parser", async () => {
        const source = `
const invoked = () => { "use strict"; doSomething() }
const returned = () => { "use strict"; return doSomething() }
`

        const expected = `const invoked = () => {
    "use strict"
    doSomething()
}
const returned = () => {
    "use strict"
    return doSomething()
}
`

        for (const parser of ["babel", "babel-ts", "typescript"] as const) assert.equal(await formatCode(source, parser), expected, parser)
    })
})
