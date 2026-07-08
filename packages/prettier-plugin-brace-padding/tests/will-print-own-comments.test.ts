import assert from "node:assert/strict"
import { describe, test } from "node:test"

import { format } from "prettier"

import plugin from "../src/index"

async function formatCode(code: string) {
    return format(code, {
        parser: "typescript",
        plugins: [plugin],
        semi: false,
        tabWidth: 4,
    })
}

describe("willPrintOwnComments", () => {
    test("formats expression statements with leading comments when semi is false", async () => {
        const result = await formatCode(`
function run() {
    // keep this comment attached
    foo()
}
`)

        assert.equal(
            result,
            `function run() {
    // keep this comment attached
    foo()
}
`,
        )
    })
})
