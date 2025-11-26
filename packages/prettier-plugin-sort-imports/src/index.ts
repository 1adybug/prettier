import { createRequire } from "module"

import { ParserOptions, Plugin } from "prettier"

import { removeUnusedImportsFromStatements } from "./analyzer"

import { formatGroups, formatImportStatements } from "./formatter"

import { parseImports } from "./parser"

import { groupImports, mergeImports, sortGroups, sortImports } from "./sorter"

import type { PluginConfig } from "./types"

export * from "./types"

const require = createRequire(import.meta.url)

/** 预处理导入语句 */
function preprocessImports(text: string, options: ParserOptions & Partial<PluginConfig>, config: PluginConfig = {}): string {
    try {
        // 只处理 JavaScript/TypeScript 文件
        const parser = options.parser

        const supportedParsers = ["babel", "typescript", "babel-ts"]

        if (!parser || !supportedParsers.includes(parser as string)) {
            return text
        }

        // 解析导入语句
        const imports = parseImports(text)

        if (imports.length === 0) {
            return text
        }

        // 构建配置（优先级：config > options > defaults）
        const optionsConfig = options as any

        const finalConfig: PluginConfig = {
            getGroup: config.getGroup ?? optionsConfig.getGroup,
            sortGroup: config.sortGroup ?? optionsConfig.sortGroup,
            sortImportStatement: config.sortImportStatement ?? optionsConfig.sortImportStatement,
            sortImportContent: config.sortImportContent ?? optionsConfig.sortImportContent,
            separator: config.separator ?? optionsConfig.importSortSeparator ?? optionsConfig.separator,
            sortSideEffect: config.sortSideEffect ?? optionsConfig.importSortSideEffect ?? false,
            removeUnusedImports: config.removeUnusedImports ?? optionsConfig.importSortRemoveUnused ?? false,
        }

        // 移除未使用的导入（如果配置了）
        let processedImports = imports

        if (finalConfig.removeUnusedImports) {
            // 只分析导入语句之后的代码部分
            const lastImport = imports[imports.length - 1]
            const codeAfterImports = text.slice(lastImport.end ?? 0)
            processedImports = removeUnusedImportsFromStatements(imports, codeAfterImports)
        }

        // 排序导入语句
        const sortedImports = sortImports(processedImports, finalConfig)

        // 合并来自同一模块的导入
        const mergedImports = mergeImports(sortedImports)

        // 格式化导入语句
        let formattedImports: string

        // 如果配置了分组函数，使用分组格式化
        if (finalConfig.getGroup) {
            const groups = groupImports(mergedImports, finalConfig)
            const sortedGroups = sortGroups(groups, finalConfig)
            formattedImports = formatGroups(sortedGroups, finalConfig)
        } else {
            // 否则直接格式化
            formattedImports = formatImportStatements(mergedImports)
        }

        // 获取导入块的起始和结束位置
        const firstImport = imports[0]
        const lastImport = imports[imports.length - 1]

        const startIndex = firstImport.start ?? 0
        const endIndex = lastImport.end ?? text.length

        // 替换原始导入语句
        const beforeImports = text.slice(0, startIndex)

        const afterImports = text.slice(endIndex)

        // 确保导入语句后面有适当的换行
        // 如果 afterImports 不是以换行开始,添加两个换行
        const needsExtraNewline = afterImports && !afterImports.startsWith("\n")
        const separator = needsExtraNewline ? "\n\n" : "\n"

        return beforeImports + formattedImports + separator + afterImports
    } catch (error) {
        // 如果解析失败，返回原始文本
        // 对于 Markdown 等文件中的代码块，解析失败是正常现象，不输出错误
        return text
    }
}

// 动态加载 prettier 的解析器
const {
    parsers: { babel },
} = require("prettier/parser-babel")

const {
    parsers: { typescript },
} = require("prettier/parser-typescript")

const {
    parsers: { "babel-ts": babelTs },
} = require("prettier/parser-babel")

/** 创建合并后的 preprocess 函数 */
function createCombinedPreprocess(parserName: string, config: PluginConfig) {
    return function combinedPreprocess(text: string, options: any): string {
        const otherPlugins = config.otherPlugins || []

        if (otherPlugins.length === 0) {
            return preprocessImports(text, options, config)
        }

        // 获取合并后的配置选项
        const prettierOptions = config.prettierOptions || {}

        const mergedOptions = { ...options, ...prettierOptions }

        // 收集所有插件的 preprocess 函数
        const preprocessFunctions: Array<(text: string, options: any) => string> = []

        // 我们的 import 排序作为第一步（先排序导入）
        preprocessFunctions.push((text: string, options: any) => preprocessImports(text, options, config))

        // 然后按传入顺序获取其他插件的 preprocess（如 Tailwind）
        for (const plugin of otherPlugins) {
            const parser = plugin?.parsers?.[parserName]

            if (parser?.preprocess && typeof parser.preprocess === "function") {
                preprocessFunctions.push(parser.preprocess)
            }
        }

        // 执行链式调用
        let processedText = text

        for (const preprocess of preprocessFunctions)
            try {
                // 使用合并后的配置调用其他插件
                processedText = preprocess(processedText, mergedOptions)
            } catch (error) {
                console.warn("Plugin preprocess failed:", error instanceof Error ? error.message : String(error))
            }

        return processedText
    }
}

/** 创建插件实例 */
function createPluginInstance(config: PluginConfig = {}): Plugin {
    // 收集基础 options
    const baseOptions: Record<string, any> = {
        importSortSeparator: {
            type: "string",
            category: "Import Sort",
            description: "分组之间的分隔符",
        },
        importSortSideEffect: {
            type: "boolean",
            category: "Import Sort",
            description: "是否对副作用导入进行排序",
            default: false,
        },
        importSortRemoveUnused: {
            type: "boolean",
            category: "Import Sort",
            description: "是否删除未使用的导入",
            default: false,
        },
    }

    // 合并其他插件的 options
    const otherPlugins = config.otherPlugins || []

    const mergedOptions = { ...baseOptions }

    for (const plugin of otherPlugins)
        if (plugin?.options) {
            Object.assign(mergedOptions, plugin.options)
        }

    // 合并其他插件的 printers
    const mergedPrinters: Record<string, any> = {}

    for (const plugin of otherPlugins)
        if (plugin?.printers) {
            Object.assign(mergedPrinters, plugin.printers)
        }

    // 合并其他插件的 parsers（合并所有 parser 属性，不只是 preprocess）
    const mergedParsers: Record<string, any> = {}

    // 对每个 parser，合并所有插件的定义
    const parserNames = ["babel", "typescript", "babel-ts"]

    const baseParsers: Record<string, any> = { babel, typescript, "babel-ts": babelTs }

    for (const parserName of parserNames) {
        const baseParser = baseParsers[parserName]

        let merged = { ...baseParser }

        // 合并其他插件对该 parser 的修改
        for (const plugin of otherPlugins) {
            const otherParser = plugin?.parsers?.[parserName]

            if (otherParser) {
                // 保留其他插件的所有属性（parse, astFormat, print, etc.）
                // 但 preprocess 由我们统一管理
                const { preprocess, ...otherAttrs } = otherParser
                merged = { ...merged, ...otherAttrs }
            }
        }

        // 最后设置我们的 preprocess（它会链式调用所有插件的 preprocess）
        merged.preprocess = createCombinedPreprocess(parserName, config)
        mergedParsers[parserName] = merged
    }

    const result: Plugin = {
        parsers: mergedParsers,
        options: mergedOptions,
    }

    // 只有在有 printers 时才添加
    if (Object.keys(mergedPrinters).length > 0) {
        result.printers = mergedPrinters
    }

    return result
}

/** 创建自定义配置的插件（工厂函数） */
export function createPlugin(config: PluginConfig = {}): Plugin {
    return createPluginInstance(config)
}

/** 默认插件实例（用于简单使用） */
const plugin: Plugin = createPluginInstance()

// 默认导出插件实例（支持简单用法）
export default plugin
