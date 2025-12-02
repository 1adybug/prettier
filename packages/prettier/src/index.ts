import { existsSync, readdirSync, statSync } from "fs"
import { builtinModules, createRequire } from "module"
import { join, parse, resolve } from "path"

import blockPadding from "@1adybug/prettier-plugin-block-padding"
import removeBraces from "@1adybug/prettier-plugin-remove-braces"
import { createPlugin, PluginConfig } from "@1adybug/prettier-plugin-sort-imports"
import { Plugin } from "prettier"
import * as tailwindcss from "prettier-plugin-tailwindcss"
import { createMatchPath, loadConfig } from "tsconfig-paths"

const require = createRequire(import.meta.url)

function isPossibleFile(base: string, item: string) {
    if (!item.startsWith(`${base}.`)) return false
    const left = item.slice(base.length + 1)
    if (!left) return false
    if (left === "d.ts") return true
    if (left.includes(".")) return false
    return true
}

// 检查文件是否存在，支持任意扩展名
function fileExistsWithAnyExtension(path: string): boolean {
    // 如果路径已经存在（精确匹配或目录），返回 true
    if (existsSync(path)) return true

    // 检查是否存在任何扩展名的文件
    const { dir, base } = parse(path)

    if (!existsSync(dir)) return false

    const list = readdirSync(dir)
    return list.some(item => isPossibleFile(base, item))
}

function getResolveAlias(filepath: string) {
    try {
        filepath = resolve(filepath)
        let tsconfigPath: string

        while (true) {
            const { root, dir } = parse(filepath)
            tsconfigPath = join(dir, "tsconfig.json")
            if (existsSync(tsconfigPath)) break
            if (dir === root) break
            filepath = dir
        }

        if (!tsconfigPath) return undefined
        const tsconfig = loadConfig(tsconfigPath)
        if (tsconfig.resultType === "failed") return undefined
        const matchPath = createMatchPath(tsconfig.absoluteBaseUrl, tsconfig.paths)
        return function resolveAlias(importPath: string) {
            importPath = importPath.replace(/^(.+?)\?.*$/, "$1")
            // 使用自定义的 fileExists 函数来支持任意扩展名
            return matchPath!(importPath, undefined, fileExistsWithAnyExtension, undefined)
        }
    } catch (error) {
        return undefined
    }
}

function hasDependency(dependency: string) {
    try {
        require.resolve(dependency)
        return true
    } catch (error) {
        return false
    }
}

function isReact(path: string) {
    return /^(npm:)?react(-dom|-native)?(\/|$)/.test(path)
}

function isBuiltin(path: string) {
    return path.startsWith("node:") || builtinModules.includes(path)
}

function isAbsolute(path: string) {
    return !!resolveAlias?.(path)
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

function getModuleType(path: string) {
    if (isReact(path)) return "react"
    if (isBuiltin(path)) return "builtin"
    if (isAbsolute(path)) return "absolute"
    if (isRelative(path)) return "relative"
    return "third-party"
}

const hasTailwindcss = hasDependency("tailwindcss")

const otherPlugins: Plugin[] = hasTailwindcss ? [blockPadding, tailwindcss, removeBraces] : [blockPadding, removeBraces]

let resolveAlias: ((importPath: string) => string | undefined) | undefined

function getResolvedPathDir(resolvedPath: string) {
    if (existsSync(resolvedPath) && statSync(resolvedPath).isFile()) return parse(resolvedPath).dir

    const { dir, base } = parse(resolvedPath)
    const list = readdirSync(dir)

    for (const item of list) {
        if (isPossibleFile(base, item) && statSync(join(dir, item)).isFile()) return dir
    }

    return resolvedPath
}

export const config: PluginConfig = {
    getGroup({ path, filepath }) {
        if (filepath) resolveAlias ??= getResolveAlias(filepath)
        const type = getModuleType(path)
        let dir = ""
        if (type === "absolute") dir = getResolvedPathDir(resolveAlias!(path)!)
        if (type === "relative" && !!filepath) dir = getResolvedPathDir(resolve(filepath, "../", path))

        const info: GroupPathInfo = {
            type,
            dir,
        }

        return JSON.stringify(info)
    },
    sortGroup(a, b) {
        return Number(a.isExport) - Number(b.isExport) || Number(a.isSideEffect) - Number(b.isSideEffect) || compareGroupName(a.name, b.name)
    },
    groupSeparator: "",
    sortSideEffect: true,
    otherPlugins,
}

export const plugin = createPlugin(config)

export default plugin
