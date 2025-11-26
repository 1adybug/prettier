// @ts-check

import { readFileSync } from "fs"
import { builtinModules } from "module"

import { createPlugin } from "@1adybug/prettier-plugin-sort-imports"
import JSON5 from "json5"
import blockPadding from "prettier-plugin-block-padding"

/**
 * @param {string} path
 */
function isBuiltin(path) {
    return path.startsWith("node:") || builtinModules.includes(path)
}

/** @type {string[]} */
let pathAlias = []

try {
    const tsConfig = JSON5.parse(readFileSync("tsconfig.json", "utf-8"))
    pathAlias = Object.keys(tsConfig.compilerOptions?.paths ?? {})
        .map(item => item.match(/^(@.*\/)\*/))
        .filter(Boolean)
        .map(item => /** @type {string} */ (item?.[1]))
} catch {}

/**
 * @param {string} path
 */
function isAbsolute(path) {
    return pathAlias.some(item => path.startsWith(item))
}

/**
 * @param {string} path
 */
function isRelative(path) {
    return path.startsWith("./") || path.startsWith("../")
}

/**
 * @param {string} a
 * @param {string} b
 */
function compareGroupName(a, b) {
    const orders = ["builtin", "third-party", "absolute", "relative"]

    a = a.replace(/-side-effect$/, "")
    b = b.replace(/-side-effect$/, "")
    return orders.indexOf(a) - orders.indexOf(b) || a.localeCompare(b)
}

export default createPlugin({
    getGroup({ path, isSideEffect }) {
        if (isSideEffect) {
            if (isBuiltin(path)) return "builtin-side-effect"
            if (isAbsolute(path)) return "absolute-side-effect"
            if (isRelative(path)) return "relative-side-effect"
            return "third-party-side-effect"
        }

        if (isBuiltin(path)) return "builtin"
        if (isAbsolute(path)) return "absolute"
        if (isRelative(path)) return "relative"
        return "third-party"
    },
    sortGroup(a, b) {
        return Number(a.isSideEffect) - Number(b.isSideEffect) || compareGroupName(a.name, b.name)
    },
    separator: "",
    sortSideEffect: true,
    removeUnusedImports: true,
    otherPlugins: [blockPadding],
})
