import { builtinModules, createRequire } from "module"

import { format, ParserOptions, Plugin, Options as PrettierOptions } from "prettier"

import { removeUnusedImportsFromStatements } from "./analyzer"
import { formatGroups, formatImportStatements } from "./formatter"
import { parseImports } from "./parser"
import { groupImports, mergeImports, sortGroups, sortImports } from "./sorter"
import type {
    GetGroupFunction,
    GroupSeparatorFunction,
    ImportStatement,
    PluginConfig,
    SortGroupFunction,
    SortImportContentFunction,
    SortImportStatementFunction,
} from "./types"

export * from "./types"

const require = createRequire(import.meta.url)

const NODE_BUILTIN_MODULES = new Set(builtinModules.map(moduleName => (moduleName.startsWith("node:") ? moduleName.slice(5) : moduleName)))

function isNodeBuiltinModule(modulePath: string): boolean {
    const normalizedPath = modulePath.startsWith("node:") ? modulePath.slice(5) : modulePath
    if (NODE_BUILTIN_MODULES.has(normalizedPath)) return true

    const slashIndex = normalizedPath.indexOf("/")

    if (slashIndex === -1) return false

    return NODE_BUILTIN_MODULES.has(normalizedPath.slice(0, slashIndex))
}

function applyNodeProtocol(modulePath: string, nodeProtocol?: boolean): string {
    if (nodeProtocol === undefined) return modulePath

    const hasNodePrefix = modulePath.startsWith("node:")
    const normalizedPath = hasNodePrefix ? modulePath.slice(5) : modulePath

    if (!isNodeBuiltinModule(normalizedPath)) return modulePath

    if (nodeProtocol) return hasNodePrefix ? modulePath : `node:${modulePath}`

    return hasNodePrefix ? normalizedPath : modulePath
}

export interface Options extends PrettierOptions {
    /**
     * 分组之间的分隔符，支持字符串或函数返回。
     * @default undefined
     */
    groupSeparator?: string | GroupSeparatorFunction
    /**
     * 是否对副作用导入进行排序。
     * @default false
     */
    sortSideEffect?: boolean
    /**
     * 是否删除未使用的导入。
     * @default false
     */
    removeUnusedImports?: boolean
    /**
     * Whether to add/remove the node: prefix for Node.js builtin modules.
     * true: add, false: remove, undefined: no change.
     * @default undefined
     */
    nodeProtocol?: boolean
    /**
     * 自定义获取分组名称。
     */
    getGroup?: GetGroupFunction
    /**
     * 自定义分组排序逻辑。
     */
    sortGroup?: SortGroupFunction
    /**
     * 自定义导入语句排序逻辑。
     */
    sortImportStatement?: SortImportStatementFunction
    /**
     * 自定义导入内容排序逻辑。
     */
    sortImportContent?: SortImportContentFunction
}

function getImportRanges(imports: ImportStatement[]): Array<{ start: number; end: number }> {
    const ranges = imports
        .map(statement => ({
            start: statement.start ?? 0,
            end: statement.end ?? 0,
        }))
        .filter(range => range.end > range.start)
        .sort((a, b) => a.start - b.start)

    const merged: Array<{ start: number; end: number }> = []

    for (const range of ranges) {
        const last = merged[merged.length - 1]

        if (last && range.start <= last.end) {
            last.end = Math.max(last.end, range.end)
            continue
        }

        merged.push({ ...range })
    }

    return merged
}

function removeRangesFromText(text: string, ranges: Array<{ start: number; end: number }>): string {
    if (ranges.length === 0) return text

    let result = ""
    let cursor = 0

    for (const range of ranges) {
        result += text.slice(cursor, range.start)
        cursor = range.end
    }

    result += text.slice(cursor)
    return result
}

/** 预处理导入语句 */
function preprocessImports(text: string, options: ParserOptions & Partial<PluginConfig>, config: PluginConfig = {}): string {
    try {
        // 只处理 JavaScript/TypeScript 文件
        const parser = options.parser

        const supportedParsers = ["babel", "typescript", "babel-ts"]

        if (!parser || !supportedParsers.includes(parser as string)) return text

        // 使用文件的绝对路径，便于后续分组/别名解析
        const filepath = options.filepath

        // 解析 import 语句
        const imports = parseImports(text, filepath)

        if (imports.length === 0) return text

        // 构建配置（优先级：config > options > defaults）
        const optionsConfig = options as any

        const finalConfig: PluginConfig = {
            getGroup: config.getGroup ?? optionsConfig.getGroup,
            sortGroup: config.sortGroup ?? optionsConfig.sortGroup,
            sortImportStatement: config.sortImportStatement ?? optionsConfig.sortImportStatement,
            sortImportContent: config.sortImportContent ?? optionsConfig.sortImportContent,
            groupSeparator: config.groupSeparator ?? optionsConfig.groupSeparator,
            sortSideEffect: config.sortSideEffect ?? optionsConfig.sortSideEffect ?? false,
            removeUnusedImports: config.removeUnusedImports ?? optionsConfig.removeUnusedImports ?? false,
            nodeProtocol: config.nodeProtocol ?? optionsConfig.nodeProtocol,
        }

        const importRanges = getImportRanges(imports)
        const textWithoutImports = removeRangesFromText(text, importRanges)

        // 移除未使用的导入（如果配置了）
        let processedImports = imports

        if (finalConfig.removeUnusedImports) processedImports = removeUnusedImportsFromStatements(imports, textWithoutImports)

        if (finalConfig.nodeProtocol !== undefined) {
            processedImports = processedImports.map(statement => ({
                ...statement,
                path: applyNodeProtocol(statement.path, finalConfig.nodeProtocol),
            }))
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
            formattedImports = formatGroups(sortedGroups, finalConfig, options.trailingComma)
        } else
            // 否则直接格式化
            formattedImports = formatImportStatements(mergedImports, options.trailingComma)

        // 获取导入块的起始位置（使用首个导入语句位置）
        const firstImport = imports[0]

        const startIndex = firstImport.start ?? 0

        // 替换原始导入语句
        const beforeImports = textWithoutImports.slice(0, startIndex)

        let afterImports = textWithoutImports.slice(startIndex)

        // 确保导入语句后面有适当的换行
        // 如果 afterImports 不是以换行开始,添加两个换行
        if (afterImports) afterImports = afterImports.replace(/^\n+/, "\n")

        const needsExtraNewline = afterImports && !afterImports.startsWith("\n")
        const separator = afterImports ? (needsExtraNewline ? "\n\n" : "\n") : ""

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

// 用于检测递归调用的标记
const PROCESSING_MARKER = Symbol("prettier-plugin-sort-imports-processing")

/** 创建合并后的 preprocess 函数 */
function createCombinedPreprocess(parserName: string, config: PluginConfig) {
    // 收集需要 preprocess 的插件（如 tailwindcss）
    const otherPlugins = config.otherPlugins || []

    const pluginsWithPreprocess = otherPlugins.filter(plugin => {
        const parser = plugin?.parsers?.[parserName]
        return parser?.preprocess && typeof parser.preprocess === "function"
    })

    return async function combinedPreprocess(text: string, options: any): Promise<string> {
        // 检测递归调用，避免无限循环
        if ((options as any)[PROCESSING_MARKER]) return text

        // 先执行我们的 import 排序
        let processedText = preprocessImports(text, options, config)

        // 如果没有其他需要 preprocess 的插件，直接返回
        if (pluginsWithPreprocess.length === 0) return processedText

        // 对于需要 preprocess 的插件（如 tailwindcss），
        // 使用 prettier.format 来触发它们的 preprocess
        // 因为 tailwindcss 的 preprocess 需要 prettier 的完整环境才能工作
        try {
            processedText = await format(processedText, {
                ...options,
                // 只使用需要 preprocess 的插件
                plugins: pluginsWithPreprocess,
                // 标记正在处理中，避免递归
                [PROCESSING_MARKER]: true,
            })
        } catch (error) {
            console.warn("Failed to apply other plugins preprocess:", error instanceof Error ? error.message : String(error))
        }

        return processedText
    }
}

/** 创建插件实例 */
function createPluginInstance(config: PluginConfig = {}): Plugin {
    // 收集基础 options
    const baseOptions: Record<string, any> = {
        groupSeparator: {
            type: "string",
            category: "Import Sort",
            description: "����֮��ķָ���",
        },
        sortSideEffect: {
            type: "boolean",
            category: "Import Sort",
            description: "�Ƿ�Ը����õ����������",
            default: false,
        },
        removeUnusedImports: {
            type: "boolean",
            category: "Import Sort",
            description: "�Ƿ�ɾ��δʹ�õĵ���",
            default: false,
        },
        nodeProtocol: {
            type: "boolean",
            category: "Import Sort",
            description: "Use node: prefix for Node.js builtin modules",
        },
    }

    // 合并其他插件的 options
    const otherPlugins = config.otherPlugins || []

    const mergedOptions = { ...baseOptions }

    for (const plugin of otherPlugins) {
        if (plugin?.options) Object.assign(mergedOptions, plugin.options)
    }

    // 合并其他插件的 printers
    const mergedPrinters: Record<string, any> = {}

    for (const plugin of otherPlugins) {
        if (plugin?.printers) Object.assign(mergedPrinters, plugin.printers)
    }

    // 合并其他插件的 parsers（合并所有 parser 属性，不只是 preprocess）
    const mergedParsers: Record<string, any> = {}

    // 对每个 parser，合并所有插件的定义
    const parserNames = ["babel", "typescript", "babel-ts"]

    const baseParsers: Record<string, any> = { babel, typescript, "babel-ts": babelTs }

    for (const parserName of parserNames) {
        const baseParser = baseParsers[parserName]

        let merged = { ...baseParser }

        // 收集所有插件的 __transformAST 函数
        const transformASTFunctions: Array<(ast: any, options: any) => any> = []

        // 合并其他插件对该 parser 的修改
        for (const plugin of otherPlugins) {
            const otherParser = plugin?.parsers?.[parserName] as any

            if (otherParser) {
                // 收集 __transformAST 函数用于链式调用
                if (typeof otherParser.__transformAST === "function") transformASTFunctions.push(otherParser.__transformAST)

                // 保留其他插件的所有属性（parse, astFormat, print, etc.）
                // 但 preprocess 由我们统一管理，parse 和 __transformAST 也需要特殊处理
                const { preprocess, parse, __transformAST, ...otherAttrs } = otherParser
                merged = { ...merged, ...otherAttrs }
            }
        }

        // 如果有 __transformAST 函数，创建链式调用的 parse 函数
        if (transformASTFunctions.length > 0) {
            const originalParse = baseParser.parse

            merged.parse = function chainedParse(text: string, options: any) {
                // 先调用原始 parse 获取 AST
                let ast = originalParse(text, options)

                // 然后依次调用所有插件的 __transformAST
                for (const transformAST of transformASTFunctions) {
                    try {
                        ast = transformAST(ast, options)
                    } catch (error) {
                        console.warn("Plugin transformAST failed:", error instanceof Error ? error.message : String(error))
                    }
                }

                return ast
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
    if (Object.keys(mergedPrinters).length > 0) result.printers = mergedPrinters

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
