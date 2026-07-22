import assert from "node:assert/strict"
import { createRequire } from "node:module"
import test from "node:test"

import defaultConfig, { defineConfig } from "@1adybug/eslint"
import { ESLint } from "eslint"

const requireFromPackage = createRequire(import.meta.url)

const allFiles = ["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"]

const nextNodeFiles = [
    "shared/**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}",
    "prisma/**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}",
    "server/**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}",
]

function sameItems(left, right) {
    return left?.length === right.length && right.every((item, index) => left[index] === item)
}

function findRuntimeConfig(configs, files) {
    return configs.find(config => sameItems(config.files, files) && config.languageOptions?.globals && config.rules)
}

function findTypeAwareConfig(configs, files) {
    return configs.find(config => sameItems(config.files, files) && config.languageOptions?.parserOptions?.projectService === true)
}

function hasOwn(object, property) {
    return Object.hasOwn(object ?? {}, property)
}

async function lint(config, code, filePath) {
    const eslint = new ESLint({
        overrideConfigFile: true,
        overrideConfig: config,
    })

    const [result] = await eslint.lintText(code, { filePath })
    return result
}

function assertRuleMessage(result, ruleId, severity) {
    assert.ok(
        result.messages.some(message => message.ruleId === ruleId && message.severity === severity),
        `Expected ${ruleId} with severity ${severity}, received ${JSON.stringify(result.messages)}`,
    )
}

test("publishes executable ESM and CommonJS entry points", async () => {
    const commonJsModule = requireFromPackage("@1adybug/eslint")

    const commonJsConfig = commonJsModule.defineConfig({
        next: false,
        react: false,
        node: { enabled: true, recommended: false },
        target: "node",
    })

    assert.equal(typeof defineConfig, "function")
    assert.ok(Array.isArray(defaultConfig))
    assert.equal(typeof commonJsModule.defineConfig, "function")
    assert.ok(Array.isArray(commonJsModule.default))

    const defaultResult = await lint(defaultConfig, "const name = 'world'\nconsole.log('hello ' + name)\n", "server/default-entry.js")
    const commonJsResult = await lint(commonJsConfig, "const name = 'world'\nconsole.log('hello ' + name)\n", "commonjs-entry.js")

    assert.equal(defaultResult.fatalErrorCount, 0)
    assertRuleMessage(defaultResult, "prefer-template", 1)
    assert.equal(commonJsResult.fatalErrorCount, 0)
    assertRuleMessage(commonJsResult, "prefer-template", 1)
})

test("infers the default runtime target from enabled features", async t => {
    await t.test("Next defaults to split browser and Node scopes", () => {
        const configs = defineConfig({
            next: { enabled: true, recommended: false },
            react: false,
            node: false,
        })

        assert.notEqual(findRuntimeConfig(configs, allFiles), undefined)
        assert.notEqual(findRuntimeConfig(configs, nextNodeFiles), undefined)
    })

    await t.test("React defaults to a browser scope", () => {
        const configs = defineConfig({
            next: false,
            react: { enabled: true, recommended: false },
        })

        const runtimeConfig = findRuntimeConfig(configs, allFiles)

        assert.equal(runtimeConfig?.languageOptions.globals.window, false)
        assert.equal(hasOwn(runtimeConfig?.languageOptions.globals, "process"), false)
        assert.equal(runtimeConfig?.settings, undefined)
    })

    await t.test("a non-frontend project defaults to a Node scope", () => {
        const configs = defineConfig({ next: false, react: false })
        const runtimeConfig = findRuntimeConfig(configs, allFiles)

        assert.equal(runtimeConfig?.languageOptions.globals.process, false)
        assert.equal(hasOwn(runtimeConfig?.languageOptions.globals, "window"), false)
    })

    await t.test("an explicit both target uses a mixed scope", () => {
        const configs = defineConfig({ next: false, react: false, node: false, target: "both" })
        const runtimeConfig = findRuntimeConfig(configs, allFiles)

        assert.equal(runtimeConfig?.languageOptions.globals.window, false)
        assert.equal(runtimeConfig?.languageOptions.globals.process, false)
        assert.equal(runtimeConfig?.settings, undefined)
    })

    await t.test("Next enables React defaults when React is not specified", () => {
        const configs = defineConfig({
            next: { enabled: true, recommended: false },
            node: false,
            target: "browser",
        })

        const runtimeConfig = findRuntimeConfig(configs, allFiles)

        assert.deepEqual(runtimeConfig?.rules["react/jsx-fragments"], ["warn", "element"])

        assert.equal(
            configs.some(config => config.plugins?.react),
            true,
        )
    })
})

test("keeps the documented default rule contract and Node settings", () => {
    const baseConfigs = defineConfig({ next: false, react: false, node: false, target: "node" })
    const baseRuntime = findRuntimeConfig(baseConfigs, allFiles)
    const nodeConfigs = defineConfig({ next: false, react: false, node: { enabled: true, recommended: false }, target: "node" })
    const nodeRuntime = findRuntimeConfig(nodeConfigs, allFiles)
    const reactConfigs = defineConfig({ next: false, react: true, node: false, target: "browser" })
    const reactRuntime = findRuntimeConfig(reactConfigs, allFiles)

    assert.deepEqual(baseRuntime?.rules["@typescript-eslint/no-unused-vars"], ["warn", { args: "none", caughtErrors: "none", ignoreRestSiblings: true }])
    assert.deepEqual(baseRuntime?.rules["prefer-const"], ["warn", { destructuring: "any" }])
    assert.equal(baseRuntime?.rules["prefer-template"], "warn")
    assert.equal(hasOwn(baseRuntime?.rules, "max-params"), false)
    assert.equal(hasOwn(baseRuntime?.rules, "@typescript-eslint/max-params"), false)
    assert.equal(hasOwn(baseRuntime?.rules, "@1adybug/max-params"), false)
    assert.equal(hasOwn(baseRuntime?.plugins, "@1adybug"), false)
    assert.equal(baseRuntime?.settings, undefined)
    assert.equal(hasOwn(baseRuntime?.rules, "n/no-missing-import"), false)

    assert.equal(nodeRuntime?.rules["n/no-missing-import"], "off")

    assert.deepEqual(nodeRuntime?.settings, {
        n: { version: ">=24.0.0" },
        node: { version: ">=24.0.0" },
    })

    assert.deepEqual(reactRuntime?.rules["react/jsx-fragments"], ["warn", "element"])
    assert.deepEqual(reactRuntime?.rules["react/self-closing-comp"], ["warn", { component: true, html: true }])
    assert.equal(reactRuntime?.rules["react-refresh/only-export-components"], "off")
    assert.equal(reactRuntime?.rules["react-hooks/set-state-in-effect"], "off")
})

test("merges and deduplicates ignores while adding Next ignores", () => {
    const configs = defineConfig({
        next: { enabled: true, recommended: false },
        react: false,
        node: false,
        target: "browser",
        ignores: ["coverage/**", "dist/**", "coverage/**"],
    })

    const ignoreConfig = configs.find(config => !config.files && config.ignores?.includes("node_modules/**"))

    assert.deepEqual(ignoreConfig?.ignores, ["node_modules/**", "out/**", "build/**", "dist/**", "public/**", "coverage/**", ".next/**", "next-env.d.ts"])
})

test("normalizes explicit runtime directories and assigns the correct globals", () => {
    const configs = defineConfig({
        next: false,
        react: false,
        node: { enabled: true, recommended: false, version: ">=22.0.0" },
        target: "both",
        directories: {
            web: "client/**/*.tsx",
            node: ["server/**/*.ts", "server/**/*.ts"],
            mixed: "shared/**/*.ts",
        },
    })

    const browserConfig = findRuntimeConfig(configs, ["client/**/*.tsx"])
    const nodeConfig = findRuntimeConfig(configs, ["server/**/*.ts"])
    const mixedConfig = findRuntimeConfig(configs, ["shared/**/*.ts"])

    assert.equal(browserConfig?.languageOptions.globals.window, false)
    assert.equal(hasOwn(browserConfig?.languageOptions.globals, "process"), false)
    assert.equal(nodeConfig?.languageOptions.globals.process, false)
    assert.equal(hasOwn(nodeConfig?.languageOptions.globals, "window"), false)
    assert.equal(mixedConfig?.languageOptions.globals.window, false)
    assert.equal(mixedConfig?.languageOptions.globals.process, false)
    assert.deepEqual(nodeConfig?.settings, { n: { version: ">=22.0.0" }, node: { version: ">=22.0.0" } })
    assert.deepEqual(mixedConfig?.settings, { n: { version: ">=22.0.0" }, node: { version: ">=22.0.0" } })
})

test("falls back to a mixed scope when every explicit directory is empty", () => {
    const configs = defineConfig({
        next: false,
        react: false,
        node: false,
        directories: { web: [], node: [], mixed: [] },
    })

    const runtimeConfig = findRuntimeConfig(configs, allFiles)

    assert.equal(runtimeConfig?.languageOptions.globals.window, false)
    assert.equal(runtimeConfig?.languageOptions.globals.process, false)
})

test("deduplicates scopes and applies feature extensions only to matching runtimes", () => {
    const configs = defineConfig({
        next: false,
        react: {
            enabled: true,
            recommended: false,
            extends: [
                { name: "test/react-a", rules: { "react/jsx-key": "error" } },
                { name: "test/react-b", rules: { "react/no-danger": "error" } },
            ],
        },
        node: {
            enabled: true,
            recommended: false,
            extends: { name: "test/node", rules: { "n/no-process-exit": "error" } },
        },
        target: "both",
        directories: {
            web: ["client/**/*.tsx", "client/**/*.tsx"],
            node: ["server/**/*.ts"],
            mixed: ["shared/**/*.ts"],
        },
    })

    const reactScopes = configs.filter(config => config.name?.endsWith("test/react-a")).map(config => config.files)
    const nodeScopes = configs.filter(config => config.name?.endsWith("test/node")).map(config => config.files)

    assert.deepEqual(reactScopes, [["client/**/*.tsx"], ["shared/**/*.ts"]])
    assert.deepEqual(nodeScopes, [["server/**/*.ts"], ["shared/**/*.ts"]])
})

test("resolves documented string extensions for built-in feature plugins", async t => {
    await t.test("React", async () => {
        const config = defineConfig({
            next: false,
            react: { enabled: true, recommended: false, extends: "react/flat/recommended" },
            node: false,
            target: "browser",
        })

        const result = await lint(config, "export const View = () => <Missing />\n", "view.jsx")

        assert.equal(result.fatalErrorCount, 0)
        assertRuleMessage(result, "react/jsx-no-undef", 2)
    })

    await t.test("Node", async () => {
        const config = defineConfig({
            next: false,
            react: false,
            node: { enabled: true, recommended: false, extends: "n/flat/recommended-module" },
            target: "node",
        })

        const result = await lint(config, "process.exit(1)\n", "example.mjs")

        assert.equal(result.fatalErrorCount, 0)
        assertRuleMessage(result, "n/no-process-exit", 2)
    })

    await t.test("Next", async () => {
        const config = defineConfig({
            next: {
                enabled: true,
                recommended: false,
                extends: "@next/next/recommended",
                rules: { "@next/next/no-html-link-for-pages": "off" },
            },
            react: false,
            node: false,
            target: "browser",
        })

        const result = await lint(config, "export default function Page() { return <img src='/photo.png' alt='' /> }\n", "app/page.jsx")

        assert.equal(result.fatalErrorCount, 0)
        assertRuleMessage(result, "@next/next/no-img-element", 1)
    })
})

test("reports invalid preset and string extension names", () => {
    assert.throws(
        () =>
            defineConfig({
                next: false,
                react: false,
                target: "invalid",
            }),
        /Unknown runtime target "invalid"\. Expected one of: browser, node, both\./,
    )

    assert.throws(
        () =>
            defineConfig({
                next: false,
                react: false,
                node: { enabled: true, preset: "invalid" },
                target: "node",
            }),
        /Unknown Node preset "invalid"\. Expected one of: script, module, recommended, mixed\./,
    )

    assert.throws(
        () =>
            defineConfig({
                next: false,
                react: { enabled: true, recommended: false, extends: "react/not-a-config" },
                node: false,
                target: "browser",
            }),
        /Plugin config "not-a-config" not found in plugin "react"\./,
    )
})

test("does not leak feature plugins or extensions when their runtime has no files", () => {
    const reactConfigs = defineConfig({
        next: false,
        react: {
            enabled: true,
            recommended: false,
            extends: { name: "test/react-only", rules: { "react/jsx-key": "error" } },
        },
        node: false,
        target: "node",
        directories: { web: [], node: allFiles, mixed: [] },
    })

    const nodeConfigs = defineConfig({
        next: false,
        react: false,
        node: {
            enabled: true,
            recommended: false,
            extends: { name: "test/node-only", rules: { "n/no-process-exit": "error" } },
        },
        target: "browser",
        directories: { web: allFiles, node: [], mixed: [] },
    })

    assert.equal(
        reactConfigs.some(config => config.plugins?.react || config.name?.endsWith("test/react-only")),
        false,
    )

    assert.equal(
        nodeConfigs.some(config => config.plugins?.n || config.name?.endsWith("test/node-only")),
        false,
    )
})

test("does not apply rules belonging to explicitly disabled features", () => {
    const configs = defineConfig({
        next: { enabled: false, rules: { eqeqeq: "error" } },
        react: { enabled: false, rules: { curly: "error" } },
        node: { enabled: false, rules: { "no-alert": "error" } },
        target: "both",
    })

    const runtimeConfig = findRuntimeConfig(configs, allFiles)

    assert.equal(hasOwn(runtimeConfig?.rules, "eqeqeq"), false)
    assert.equal(hasOwn(runtimeConfig?.rules, "curly"), false)
    assert.equal(hasOwn(runtimeConfig?.rules, "no-alert"), false)
})

test("merges global and feature rules in runtime-specific precedence order", () => {
    const configs = defineConfig({
        next: { enabled: true, recommended: false, rules: { eqeqeq: "warn" } },
        react: { enabled: true, recommended: false, rules: { eqeqeq: "error" } },
        node: { enabled: true, recommended: false, rules: { eqeqeq: "off" } },
        target: "both",
        directories: {
            web: "client/**/*.tsx",
            node: "server/**/*.ts",
            mixed: "shared/**/*.ts",
        },
        rules: { eqeqeq: "warn" },
    })

    assert.equal(findRuntimeConfig(configs, ["client/**/*.tsx"])?.rules.eqeqeq, "error")
    assert.equal(findRuntimeConfig(configs, ["server/**/*.ts"])?.rules.eqeqeq, "off")
    assert.equal(findRuntimeConfig(configs, ["shared/**/*.ts"])?.rules.eqeqeq, "off")
})

test("preserves runtime-specific overrides for type-aware rules", () => {
    const ruleId = "@typescript-eslint/no-deprecated"

    const configs = defineConfig({
        next: { enabled: true, recommended: false, rules: { [ruleId]: "warn" } },
        react: { enabled: true, recommended: false, rules: { [ruleId]: "off" } },
        node: { enabled: true, recommended: false, rules: { [ruleId]: "warn" } },
        target: "both",
        directories: {
            web: "client/**/*.tsx",
            node: "server/**/*.ts",
            mixed: "shared/**/*.ts",
        },
        rules: { [ruleId]: "error" },
    })

    assert.equal(findTypeAwareConfig(configs, ["client/**/*.tsx"])?.rules[ruleId], "off")
    assert.equal(findTypeAwareConfig(configs, ["server/**/*.ts"])?.rules[ruleId], "warn")
    assert.equal(findTypeAwareConfig(configs, ["shared/**/*.ts"])?.rules[ruleId], "warn")
})

test("automatically excludes Next server directories from browser configurations", () => {
    const configs = defineConfig({
        next: { enabled: true, recommended: false },
        react: false,
        node: { enabled: true, recommended: false },
    })

    const browserConfig = findRuntimeConfig(configs, allFiles)
    const nodeConfig = findRuntimeConfig(configs, nextNodeFiles)
    const typeAwareBrowserConfig = findTypeAwareConfig(configs, allFiles)

    assert.deepEqual(browserConfig?.ignores, nextNodeFiles)
    assert.deepEqual(typeAwareBrowserConfig?.ignores, [...nextNodeFiles, "**/*.{js,jsx,mjs,cjs}", "**/*.d.{ts,tsx,mts,cts}"])
    assert.equal(browserConfig?.languageOptions.globals.window, false)
    assert.equal(nodeConfig?.languageOptions.globals.process, false)
})

test("rejects a glob assigned to multiple runtime groups", () =>
    void assert.throws(
        () =>
            defineConfig({
                directories: {
                    web: "shared/**/*.ts",
                    node: "shared/**/*.ts",
                },
            }),
        /Directory globs must not be duplicated across web\/node\/mixed: "shared\/\*\*\/\*\.ts" => browser, node/,
    ))

test("supports every Node preset", async t => {
    const cases = [
        ["script", "example.cjs"],
        ["module", "example.mjs"],
        ["recommended", "example.mjs"],
        ["mixed", "example.cjs"],
    ]

    for (const [preset, filePath] of cases) {
        await t.test(preset, async () => {
            const config = defineConfig({
                next: false,
                react: false,
                node: { enabled: true, preset },
                target: "node",
            })

            const result = await lint(config, "new Buffer(1)\n", filePath)

            assert.equal(result.fatalErrorCount, 0)
            assertRuleMessage(result, "n/no-deprecated-api", 2)
        })
    }
})

test("executes custom Node plugin rules when recommendations are disabled", async () => {
    const config = defineConfig({
        next: false,
        react: false,
        node: {
            enabled: true,
            recommended: false,
            rules: { "n/no-process-exit": "error" },
        },
        target: "node",
    })

    const result = await lint(config, "process.exit(1)\n", "example.js")

    assert.equal(result.fatalErrorCount, 0)
    assertRuleMessage(result, "n/no-process-exit", 2)
})

test("executes React plugin rules when recommendations are disabled", async () => {
    const config = defineConfig({
        next: false,
        react: {
            enabled: true,
            recommended: false,
            rules: { "react/no-danger": "error" },
        },
        node: false,
        target: "browser",
    })

    const result = await lint(config, "export const View = () => <div dangerouslySetInnerHTML={{ __html: 'unsafe' }} />\n", "view.jsx")

    assert.equal(result.fatalErrorCount, 0)
    assertRuleMessage(result, "react/no-danger", 2)
})

test("executes recommended React Hooks rules", async () => {
    const config = defineConfig({
        next: false,
        react: true,
        node: false,
        target: "browser",
    })

    const result = await lint(config, "import { useState } from 'react'\nfunction helper() { useState(0) }\nexport { helper }\n", "view.jsx")

    assert.equal(result.fatalErrorCount, 0)
    assertRuleMessage(result, "react-hooks/rules-of-hooks", 2)
})

test("executes custom Next rules when recommendations are disabled", async () => {
    const config = defineConfig({
        next: {
            enabled: true,
            recommended: false,
            rules: { "@next/next/no-img-element": "error" },
        },
        react: false,
        node: false,
        target: "browser",
    })

    const result = await lint(config, "export default function Page() { return <img src='/photo.png' alt='' /> }\n", "app/page.jsx")

    assert.equal(result.fatalErrorCount, 0)
    assertRuleMessage(result, "@next/next/no-img-element", 2)
})

test("executes the recommended Next core-web-vitals preset", async () => {
    const config = defineConfig({
        next: {
            enabled: true,
            rules: { "@next/next/no-html-link-for-pages": "off" },
        },
        react: true,
        node: false,
        target: "browser",
    })

    const result = await lint(config, "export default function Page() { return <img src='/photo.png' alt='' /> }\n", "app/page.jsx")

    assert.equal(result.fatalErrorCount, 0)
    assertRuleMessage(result, "@next/next/no-img-element", 1)
})

test("omits recommended plugin presets when recommended is false", async t => {
    await t.test("React Hooks", async () => {
        const config = defineConfig({
            next: false,
            react: { enabled: true, recommended: false },
            node: false,
            target: "browser",
        })

        const result = await lint(config, "import { useState } from 'react'\nfunction helper() { useState(0) }\nexport { helper }\n", "view.jsx")

        assert.equal(result.fatalErrorCount, 0)

        assert.equal(
            result.messages.some(message => message.ruleId === "react-hooks/rules-of-hooks"),
            false,
        )
    })

    await t.test("Next", async () => {
        const config = defineConfig({
            next: { enabled: true, recommended: false },
            react: false,
            node: false,
            target: "browser",
        })

        const result = await lint(config, "export default function Page() { return <img src='/photo.png' alt='' /> }\n", "app/page.jsx")

        assert.equal(result.fatalErrorCount, 0)

        assert.equal(
            result.messages.some(message => message.ruleId?.startsWith("@next/next/")),
            false,
        )
    })

    await t.test("Node", async () => {
        const config = defineConfig({
            next: false,
            react: false,
            node: { enabled: true, recommended: false },
            target: "node",
        })

        const result = await lint(config, "new Buffer(1)\n", "example.cjs")

        assert.equal(result.fatalErrorCount, 0)

        assert.equal(
            result.messages.some(message => message.ruleId === "n/no-deprecated-api"),
            false,
        )
    })
})

test("enforces browser, Node, and mixed globals in their own directories", async () => {
    const config = defineConfig({
        next: false,
        react: false,
        node: false,
        target: "both",
        directories: {
            web: "client/**/*.js",
            node: "server/**/*.js",
            mixed: "shared/**/*.js",
        },
    })

    const browserResult = await lint(config, "window.location.href = process.cwd()\n", "client/example.js")
    const nodeResult = await lint(config, "window.location.href = process.cwd()\n", "server/example.js")
    const mixedResult = await lint(config, "window.location.href = process.cwd()\n", "shared/example.js")

    assert.deepEqual(
        browserResult.messages.filter(message => message.ruleId === "no-undef").map(message => message.message),
        ["'process' is not defined."],
    )

    assert.deepEqual(
        nodeResult.messages.filter(message => message.ruleId === "no-undef").map(message => message.message),
        ["'window' is not defined."],
    )

    assert.equal(
        mixedResult.messages.some(message => message.ruleId === "no-undef"),
        false,
    )
})

test("executes type-aware and TypeScript syntax rules", async () => {
    const config = defineConfig({
        next: false,
        react: false,
        node: { enabled: true, recommended: false },
        target: "node",
    })

    const source = [
        "/** @deprecated Use currentValue instead. */",
        "const legacyValue = 1",
        "const copiedValue = legacyValue",
        "const record: { name: string } = { name: 'Ada' }",
        "enum Status { Ready }",
        "console.log(copiedValue, record, Status)",
    ].join("\n")
    const result = await lint(config, source, "test/fixtures/type-aware.ts")

    assert.equal(result.fatalErrorCount, 0, JSON.stringify(result.messages))
    assertRuleMessage(result, "@typescript-eslint/no-deprecated", 2)
    assert.equal(result.messages.filter(message => message.ruleId === "no-restricted-syntax").length, 2)
})

test("allows the type-aware default rule to be disabled", async () => {
    const config = defineConfig({
        next: false,
        react: false,
        node: false,
        target: "node",
        rules: { "@typescript-eslint/no-deprecated": "off" },
    })

    const source = ["/** @deprecated */", "const legacyValue = 1", "console.log(legacyValue)"].join("\n")
    const result = await lint(config, source, "test/fixtures/type-aware.ts")

    assert.equal(result.fatalErrorCount, 0, JSON.stringify(result.messages))

    assert.equal(
        result.messages.some(message => message.ruleId === "@typescript-eslint/no-deprecated"),
        false,
    )
})

test("does not apply type-aware rules to JavaScript files", async () => {
    const config = defineConfig({
        next: false,
        react: false,
        node: false,
        target: "node",
        rules: { "@typescript-eslint/no-deprecated": "error" },
    })

    const result = await lint(config, "console.log('plain JavaScript')\n", "example.js")

    assert.equal(result.fatalErrorCount, 0)

    assert.equal(
        result.messages.some(message => message.ruleId === "@typescript-eslint/no-deprecated"),
        false,
    )
})

test("honors default and custom ignored paths", async () => {
    const eslint = new ESLint({
        overrideConfigFile: true,
        overrideConfig: defineConfig({
            next: false,
            react: false,
            ignores: "generated/**",
        }),
    })

    assert.equal(await eslint.isPathIgnored("dist/output.js"), true)
    assert.equal(await eslint.isPathIgnored("generated/output.js"), true)
    assert.equal(await eslint.isPathIgnored("src/index.ts"), false)
})
