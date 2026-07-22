import { builtinModules, createRequire } from "node:module"

import type { Parser, ParserOptions, Plugin, Options as PrettierOptions } from "prettier"

import { markTypeOnlyImportsFromStatements, removeUnusedImportsFromStatements } from "./analyzer"
import { formatGroups, formatImportStatement, formatImportStatements } from "./formatter"
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

interface ImportRange {
    start: number
    end: number
}

function isNodeBuiltinModule(modulePath: string): boolean {
    const normalizedPath = modulePath.startsWith("node:") ? modulePath.slice(5) : modulePath
    if (NODE_BUILTIN_MODULES.has(normalizedPath)) return true

    const slashIndex = normalizedPath.indexOf("/")

    if (slashIndex === -1) return false

    return NODE_BUILTIN_MODULES.has(normalizedPath.slice(0, slashIndex))
}

function applyNodeProtocol(modulePath: string, nodeProtocol?: "add" | "remove"): string {
    if (nodeProtocol === undefined) return modulePath

    const hasNodePrefix = modulePath.startsWith("node:")
    const normalizedPath = hasNodePrefix ? modulePath.slice(5) : modulePath

    if (!isNodeBuiltinModule(normalizedPath)) return modulePath

    if (nodeProtocol === "add") return hasNodePrefix ? modulePath : `node:${modulePath}`

    if (nodeProtocol === "remove") return hasNodePrefix ? normalizedPath : modulePath

    return modulePath
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
     * 是否将仅用于类型位置的命名导入标记为 type。
     * @default false
     */
    markTypeOnlyImports?: boolean
    /**
     * 是否将全为 type 的命名导入合并为 import type/export type。
     * @default true
     */
    mergeTypeImports?: boolean
    /**
     * Whether to add/remove the node: prefix for Node.js builtin modules.
     * "add": add, "remove": remove, undefined: no change.
     * @default undefined
     */
    nodeProtocol?: "add" | "remove"
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

function getImportRanges(imports: ImportStatement[]): ImportRange[] {
    const ranges = imports
        .map(statement => ({
            start: statement.start ?? 0,
            end: statement.end ?? 0,
        }))
        .filter(range => range.end > range.start)
        .sort((a, b) => a.start - b.start)

    const merged: ImportRange[] = []

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

function removeRangesFromText(text: string, ranges: ImportRange[]): string {
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

function formatGroupedImportsPreservingSideEffects(
    statements: ImportStatement[],
    config: PluginConfig,
    trailingComma?: ParserOptions["trailingComma"],
): string {
    const sections: string[] = []

    let currentSection: ImportStatement[] = []

    const flushCurrentSection = () => {
        if (currentSection.length === 0) return

        const groups = groupImports(currentSection, config)
        const sortedGroups = sortGroups(groups, config)

        sections.push(formatGroups(sortedGroups, config, trailingComma))
        currentSection = []
    }

    for (const statement of statements) {
        if (!statement.isSideEffect) {
            currentSection.push(statement)
            continue
        }

        flushCurrentSection()
        sections.push(formatImportStatement(statement, trailingComma, config.mergeTypeImports ?? true))
    }

    flushCurrentSection()

    return sections.join("\n")
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
            markTypeOnlyImports: config.markTypeOnlyImports ?? optionsConfig.markTypeOnlyImports ?? false,
            mergeTypeImports: config.mergeTypeImports ?? optionsConfig.mergeTypeImports ?? true,
            nodeProtocol: config.nodeProtocol ?? optionsConfig.nodeProtocol,
        }

        const importRanges = getImportRanges(imports)
        const textWithoutImports = removeRangesFromText(text, importRanges)

        // 移除未使用的导入（如果配置了）
        let processedImports = imports

        if (finalConfig.removeUnusedImports) processedImports = removeUnusedImportsFromStatements(imports, textWithoutImports)

        if (finalConfig.markTypeOnlyImports) processedImports = markTypeOnlyImportsFromStatements(processedImports, textWithoutImports)

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
            if (finalConfig.sortSideEffect) {
                const groups = groupImports(mergedImports, finalConfig)
                const sortedGroups = sortGroups(groups, finalConfig)
                formattedImports = formatGroups(sortedGroups, finalConfig, options.trailingComma)
            } else formattedImports = formatGroupedImportsPreservingSideEffects(mergedImports, finalConfig, options.trailingComma)
        } else
            // 否则直接格式化
            formattedImports = formatImportStatements(mergedImports, options.trailingComma, finalConfig.mergeTypeImports)

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

type ParserLike = Parser | (() => Parser | Promise<Parser>) | undefined

async function resolveParser(parser: ParserLike) {
    if (typeof parser === "function") return parser()
    return parser
}

async function resolveParsers(parserName: string, plugins: Plugin[]) {
    const parsers: Parser[] = []

    for (const plugin of plugins) {
        const parser = await resolveParser(plugin?.parsers?.[parserName] as ParserLike)
        if (parser) parsers.push(parser)
    }

    return parsers
}

function getParserObject(parser: ParserLike) {
    if (!parser || typeof parser === "function") return undefined
    return parser
}

/** 创建合并后的 preprocess 函数 */
function createCombinedPreprocess(parserName: string, config: PluginConfig) {
    // 收集需要 preprocess 的插件（如 tailwindcss）
    const otherPlugins = config.otherPlugins || []

    return async function combinedPreprocess(text: string, options: any): Promise<string> {
        // 检测递归调用，避免无限循环
        if ((options as any)[PROCESSING_MARKER]) return text

        // 先执行我们的 import 排序
        let processedText = preprocessImports(text, options, config)

        // Prettier 支持懒加载 parser，tailwindcss 0.8 的 parser 就是异步工厂函数。
        // 因此这里需要先解析 parser，再链式调用它们自己的 preprocess。
        try {
            const parsers = await resolveParsers(parserName, otherPlugins)

            const otherPluginOptions = { ...options, ...config.prettierOptions }

            for (const parser of parsers) {
                if (typeof parser.preprocess === "function") processedText = await parser.preprocess(processedText, otherPluginOptions)
            }
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
        markTypeOnlyImports: {
            type: "boolean",
            category: "Import Sort",
            description: "Mark named imports used only in type positions as type-only imports",
            default: false,
        },
        mergeTypeImports: {
            type: "boolean",
            category: "Import Sort",
            description: "Merge all-type named imports into import type/export type declarations",
            default: true,
        },
        nodeProtocol: {
            type: "string",
            category: "Import Sort",
            description: "Add/remove node: prefix for Node.js builtin modules",
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
        const staticTransformASTFunctions: Array<(ast: any, options: any) => any> = []

        // 合并其他插件对该 parser 的修改
        for (const plugin of otherPlugins) {
            const otherParser = getParserObject(plugin?.parsers?.[parserName] as ParserLike) as any

            if (otherParser) {
                // 收集 __transformAST 函数用于链式调用
                if (typeof otherParser.__transformAST === "function") staticTransformASTFunctions.push(otherParser.__transformAST)

                // 保留其他插件的所有属性（parse, astFormat, print, etc.）
                // 但 preprocess 由我们统一管理，parse 和 __transformAST 也需要特殊处理
                const { preprocess, parse, __transformAST, ...otherAttrs } = otherParser
                merged = { ...merged, ...otherAttrs }
            }
        }

        const originalParse = baseParser.parse

        merged.parse = async function chainedParse(text: string, options: any) {
            const parsers = await resolveParsers(parserName, otherPlugins)

            const otherPluginOptions = { ...options, ...config.prettierOptions }

            // 像 prettier-plugin-tailwindcss 0.8 这样的插件会在 parse 阶段修改 AST。
            // 这类 parser 没有 __transformAST，必须显式调用它自己的 parse 才能生效。
            const parseParser = parsers.find(
                parser => typeof (parser as any).__transformAST !== "function" && typeof parser.parse === "function" && parser.parse !== originalParse,
            )

            let ast = parseParser ? await parseParser.parse(text, otherPluginOptions) : await originalParse(text, options)

            const transformASTFunctions = [
                ...staticTransformASTFunctions,
                ...parsers
                    .map(parser => (parser as any).__transformAST)
                    .filter(transformAST => typeof transformAST === "function" && !staticTransformASTFunctions.includes(transformAST)),
            ]

            // 然后依次调用所有插件的 __transformAST
            for (const transformAST of transformASTFunctions) {
                try {
                    ast = await transformAST(ast, otherPluginOptions)
                } catch (error) {
                    console.warn("Plugin transformAST failed:", error instanceof Error ? error.message : String(error))
                }
            }

            return ast
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
