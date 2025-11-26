import { readFileSync } from "fs"
import { builtinModules } from "module"

import removeBraces from "@1adybug/prettier-plugin-remove-braces"
import { createPlugin } from "@1adybug/prettier-plugin-sort-imports"
import JSON5 from "json5"
import { Plugin } from "prettier"
import blockPadding from "prettier-plugin-block-padding"
import * as tailwindcss from "prettier-plugin-tailwindcss"

const packageJson = JSON5.parse(readFileSync("package.json", "utf-8"))

function hasDependency(dependency: string | RegExp) {
    const dependencies = packageJson.dependencies ?? {}
    const devDependencies = packageJson.devDependencies ?? {}
    const peerDependencies = packageJson.peerDependencies ?? {}

    const total = Object.keys({
        ...dependencies,
        ...devDependencies,
        ...peerDependencies,
    })

    return total.some(item => (typeof dependency === "string" ? item === dependency : dependency.test(item)))
}

const hasReact = hasDependency("react")

function isReact(path: string) {
    return hasReact && /^@?react\b/.test(path)
}

function isBuiltin(path: string) {
    return path.startsWith("node:") || builtinModules.includes(path)
}

let pathAlias: string[] = []

try {
    const tsConfig = JSON5.parse(readFileSync("tsconfig.json", "utf-8"))
    pathAlias = Object.keys(tsConfig.compilerOptions?.paths ?? {})
        .map(item => item.match(/^((@|~).*\/)\*/))
        .filter(Boolean)
        .map(item => item?.[1]!)
} catch {}

function isAbsolute(path: string) {
    return pathAlias.some(item => path.startsWith(item))
}

function isRelative(path: string) {
    return path.startsWith("./") || path.startsWith("../")
}

interface GroupPathInfo {
    type: string
    dir: string
}

function compareGroupName(a: string, b: string) {
    const orders = ["react", "builtin", "third-party", "absolute", "relative"]

    const aInfo = JSON.parse(a) as GroupPathInfo
    const bInfo = JSON.parse(b) as GroupPathInfo

    return orders.indexOf(aInfo.type) - orders.indexOf(bInfo.type) || aInfo.dir.localeCompare(bInfo.dir)
}

function getDir(path: string) {
    return path.match(/^(((@|~)\/?|\.{1,2}\/)([^./]+))(\/|$)/)?.[1] ?? ""
}

function getModuleType(path: string) {
    if (isReact(path)) return "react"
    if (isBuiltin(path)) return "builtin"
    if (isAbsolute(path)) return "absolute"
    if (isRelative(path)) return "relative"
    return "third-party"
}

const hasTailwindcss = hasDependency("tailwindcss")

const otherPlugins: Plugin[] = hasTailwindcss ? [blockPadding, tailwindcss, removeBraces] : [blockPadding, removeBraces]

export const plugin = createPlugin({
    getGroup({ path }) {
        const type = getModuleType(path)

        const info: GroupPathInfo = {
            type,
            dir: type === "absolute" || type === "relative" ? getDir(path) : "",
        }

        return JSON.stringify(info)
    },
    sortGroup(a, b) {
        return Number(a.isSideEffect) - Number(b.isSideEffect) || compareGroupName(a.name, b.name)
    },
    separator: "",
    sortSideEffect: true,
    otherPlugins,
})

export default plugin
