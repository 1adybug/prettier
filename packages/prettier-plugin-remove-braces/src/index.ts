import { createRequire } from "module"

import { format, ParserOptions, Plugin, Options as PrettierOptions, SupportLanguage } from "prettier"

const require = createRequire(import.meta.url)

export interface Options extends PrettierOptions {
    /**
     * 控制单个控制语句（if、for、while、try 等）周围大括号的处理方式。
     * @default "default"
     */
    controlStatementBraces?: "default" | "remove" | "add"
    /**
     * 控制单语句是多行语句时的花括号处理方式。
     * @default "default"
     */
    multiLineBraces?: "default" | "remove" | "add"
}

export interface PluginOptions extends ParserOptions {
    /** 控制单语句是控制语句时的花括号处理方式 */
    controlStatementBraces?: "default" | "remove" | "add"
    /** 控制单语句是多行语句时的花括号处理方式 */
    multiLineBraces?: "default" | "remove" | "add"
}

// Helper function to check if a statement is a lexical declaration
function isLexicalDeclaration(node: any): boolean {
    return (
        (node?.type === "VariableDeclaration" && (node.kind === "const" || node.kind === "let")) ||
        node?.type === "FunctionDeclaration" ||
        node?.type === "ClassDeclaration"
    )
}

// Helper function to check if node contains comments
function hasComments(node: any): boolean {
    return !!(node?.leadingComments?.length || node?.trailingComments?.length || node?.innerComments?.length)
}

// Helper function to copy location info from outer node to inner node
// 用于将外部节点的位置信息复制到内部节点，避免注释位置冲突
function copyLocationInfo(innerNode: any, outerNode: any): any {
    if (!innerNode || !outerNode) return innerNode

    const result = { ...innerNode }

    // 复制位置信息
    if (outerNode.start !== undefined) result.start = outerNode.start

    if (outerNode.end !== undefined) result.end = outerNode.end
    if (outerNode.loc) result.loc = outerNode.loc
    if (outerNode.range) result.range = outerNode.range

    return result
}

// Helper function to check if a statement is a control statement
function isControlStatement(node: any): boolean {
    return [
        "IfStatement",
        "ForStatement",
        "ForInStatement",
        "ForOfStatement",
        "WhileStatement",
        "DoWhileStatement",
        "TryStatement",
        "SwitchStatement",
    ].includes(node?.type)
}

// Helper function to check if a statement spans multiple lines
// 检查语句是否跨多行
function isMultilineStatement(node: any): boolean {
    if (!node?.loc) return false

    return node.loc.start.line !== node.loc.end.line
}

// Helper function to check if removing braces would cause dangling else issue
function wouldCauseDanglingElse(ifNode: any): boolean {
    if (!ifNode || ifNode.type !== "IfStatement") return false

    const consequent = ifNode.consequent
    if (!consequent || consequent.type !== "BlockStatement") return false

    // Check if the block contains only one if statement without else
    if (consequent.body.length === 1 && consequent.body[0].type === "IfStatement") {
        const innerIf = consequent.body[0]

        // If inner if has no else branch but outer if has else branch, removing braces would cause dangling else
        if (!innerIf.alternate && ifNode.alternate) return true
    }

    return false
}

/** transformAST 函数的选项 */
export interface TransformASTOptions {
    /** 控制单语句是控制语句时的花括号处理方式 */
    controlStatementBraces?: "default" | "remove" | "add"
    /** 控制单语句是多行语句时的花括号处理方式 */
    multiLineBraces?: "default" | "remove" | "add"
}

// Main AST transformation function
function transformAST(ast: any, options: TransformASTOptions = {}): any {
    if (!ast || typeof ast !== "object") return ast

    // Handle ArrowFunctionExpression
    if (ast.type === "ArrowFunctionExpression" && ast.body?.type === "BlockStatement") {
        const block = ast.body

        // Check if block has only one statement and it's a return statement
        if (
            block.body.length === 1 &&
            block.body[0].type === "ReturnStatement" &&
            !hasComments(block.body[0]) && // Check comment on return statement
            !hasComments(block) &&
            !isLexicalDeclaration(block.body[0])
        ) {
            const returnStatement = block.body[0]
            let argument = returnStatement.argument

            // For object literals, we'll handle this differently by using sequence expression
            if (argument?.type === "ObjectExpression") {
                return {
                    ...ast,
                    body: copyLocationInfo(
                        {
                            type: "SequenceExpression",
                            expressions: [argument],
                        },
                        block,
                    ),
                }
            }

            return {
                ...ast,
                body: copyLocationInfo(argument || { type: "Identifier", name: "undefined" }, block),
            }
        }
    }

    // Handle IfStatement
    if (ast.type === "IfStatement") {
        const transformed = { ...ast }

        // Check consequent - 检查是否可以移除 {}
        if (
            ast.consequent?.type === "BlockStatement" &&
            ast.consequent.body.length === 1 &&
            !hasComments(ast.consequent) &&
            !isLexicalDeclaration(ast.consequent.body[0]) &&
            !wouldCauseDanglingElse(ast)
        ) {
            const innerStatement = ast.consequent.body[0]

            if (isControlStatement(innerStatement)) {
                // 内部是控制语句，根据 controlStatementBraces 选项决定
                if (options.controlStatementBraces === "remove") transformed.consequent = copyLocationInfo(innerStatement, ast.consequent)
                // "default" 和 "add" 模式：保持大括号
            } else {
                if (isMultilineStatement(innerStatement)) {
                    // 内部是多行语句，根据 multiLineBraces 选项决定
                    if (options.multiLineBraces === "remove") transformed.consequent = copyLocationInfo(innerStatement, ast.consequent)
                    // "default" 和 "add" 模式：保持大括号
                } else
                    // 其他情况，总是移除大括号
                    transformed.consequent = copyLocationInfo(innerStatement, ast.consequent)
            }
        }

        // Check alternate - 检查是否可以移除 {}
        if (
            ast.alternate?.type === "BlockStatement" &&
            ast.alternate.body.length === 1 &&
            !hasComments(ast.alternate) &&
            !isLexicalDeclaration(ast.alternate.body[0])
        ) {
            const innerStatement = ast.alternate.body[0]

            if (isControlStatement(innerStatement)) {
                // 内部是控制语句，根据 controlStatementBraces 选项决定
                if (options.controlStatementBraces === "remove") transformed.alternate = copyLocationInfo(innerStatement, ast.alternate)
                // "default" 和 "add" 模式：保持大括号
            } else {
                if (isMultilineStatement(innerStatement)) {
                    // 内部是多行语句，根据 multiLineBraces 选项决定
                    if (options.multiLineBraces === "remove") transformed.alternate = copyLocationInfo(innerStatement, ast.alternate)
                    // "default" 和 "add" 模式：保持大括号
                } else
                    // 其他情况，总是移除大括号
                    transformed.alternate = copyLocationInfo(innerStatement, ast.alternate)
            }
        }

        // Handle "add" mode for controlStatementBraces - 如果内部是控制语句且没有大括号，添加大括号
        if (options.controlStatementBraces === "add") {
            if (ast.consequent && isControlStatement(ast.consequent) && ast.consequent.type !== "BlockStatement") {
                transformed.consequent = copyLocationInfo(
                    {
                        type: "BlockStatement",
                        body: [ast.consequent],
                    },
                    ast.consequent,
                )
            }

            if (ast.alternate && isControlStatement(ast.alternate) && ast.alternate.type !== "BlockStatement") {
                transformed.alternate = copyLocationInfo(
                    {
                        type: "BlockStatement",
                        body: [ast.alternate],
                    },
                    ast.alternate,
                )
            }
        }

        // Handle "add" mode for multiLineBraces - 如果内部是多行语句且没有大括号，添加大括号
        if (options.multiLineBraces === "add") {
            if (ast.consequent && !isControlStatement(ast.consequent) && ast.consequent.type !== "BlockStatement" && isMultilineStatement(ast.consequent)) {
                transformed.consequent = copyLocationInfo(
                    {
                        type: "BlockStatement",
                        body: [ast.consequent],
                    },
                    ast.consequent,
                )
            }

            if (ast.alternate && !isControlStatement(ast.alternate) && ast.alternate.type !== "BlockStatement" && isMultilineStatement(ast.alternate)) {
                transformed.alternate = copyLocationInfo(
                    {
                        type: "BlockStatement",
                        body: [ast.alternate],
                    },
                    ast.alternate,
                )
            }
        }

        // Recursively transform nested if statements
        transformed.consequent = transformAST(transformed.consequent, options)
        transformed.alternate = transformAST(transformed.alternate, options)

        return transformed
    }

    // Handle loop statements (ForStatement, WhileStatement, DoWhileStatement, ForInStatement, ForOfStatement)
    const loopTypes = ["ForStatement", "WhileStatement", "DoWhileStatement", "ForInStatement", "ForOfStatement"]

    if (loopTypes.includes(ast.type)) {
        const transformed = { ...ast }

        // 检查是否可以移除循环体的 {}
        if (ast.body?.type === "BlockStatement") {
            const block = ast.body

            if (block.body.length === 1 && !hasComments(block) && !isLexicalDeclaration(block.body[0])) {
                const innerStatement = block.body[0]

                if (isControlStatement(innerStatement)) {
                    // 内部是控制语句，根据 controlStatementBraces 选项决定
                    if (options.controlStatementBraces === "remove") transformed.body = copyLocationInfo(innerStatement, block)
                    // "default" 和 "add" 模式：保持大括号
                } else {
                    if (isMultilineStatement(innerStatement)) {
                        // 内部是多行语句，根据 multiLineBraces 选项决定
                        if (options.multiLineBraces === "remove") transformed.body = copyLocationInfo(innerStatement, block)
                        // "default" 和 "add" 模式：保持大括号
                    } else
                        // 其他情况，总是移除大括号
                        transformed.body = copyLocationInfo(innerStatement, block)
                }
            }
        }

        // Handle "add" mode for controlStatementBraces - 如果循环体是控制语句且没有大括号，添加大括号
        if (options.controlStatementBraces === "add" && ast.body && isControlStatement(ast.body) && ast.body.type !== "BlockStatement") {
            transformed.body = copyLocationInfo(
                {
                    type: "BlockStatement",
                    body: [ast.body],
                },
                ast.body,
            )
        }

        // Handle "add" mode for multiLineBraces - 如果循环体是多行语句且没有大括号，添加大括号
        if (
            options.multiLineBraces === "add" &&
            ast.body &&
            !isControlStatement(ast.body) &&
            ast.body.type !== "BlockStatement" &&
            isMultilineStatement(ast.body)
        ) {
            transformed.body = copyLocationInfo(
                {
                    type: "BlockStatement",
                    body: [ast.body],
                },
                ast.body,
            )
        }

        // Recursively transform loop body
        transformed.body = transformAST(transformed.body, options)

        return transformed
    }

    // Handle control statement blocks based on controlStatementBraces option
    if (
        options.controlStatementBraces === "remove" &&
        ast.type === "BlockStatement" &&
        ast.body.length === 1 &&
        !hasComments(ast) &&
        !isLexicalDeclaration(ast.body[0]) &&
        isControlStatement(ast.body[0])
    )
        return copyLocationInfo(ast.body[0], ast)

    // Recursively transform all child nodes
    for (const key in ast) {
        if (Array.isArray(ast[key])) ast[key] = ast[key].map(item => transformAST(item, options))
        else {
            if (ast[key] && typeof ast[key] === "object" && key !== "loc" && key !== "range" && key !== "tokens") ast[key] = transformAST(ast[key], options)
        }
    }

    return ast
}

// 用于标识当前插件，避免在查找其他插件时重复处理自己
const PLUGIN_ID = Symbol.for("prettier-plugin-remove-braces")

// 用于检测递归调用的标记
const PROCESSING_MARKER = Symbol.for("prettier-plugin-remove-braces-processing")

// 创建带有 __transformAST 属性的 parser
// __transformAST 用于支持多插件链式调用，它会在 AST 解析后被调用
function createParserWithTransform(parserName: "typescript" | "babel") {
    const modulePath = parserName === "typescript" ? "prettier/plugins/typescript" : "prettier/plugins/babel"
    const originalParser = require(modulePath).parsers[parserName]

    return {
        ...originalParser,
        // 添加 __transformAST 属性，用于链式调用
        // 当使用 prettier-plugin-sort-imports 时，会自动收集并链式调用这个函数
        __transformAST: (ast: any, options: PluginOptions) => transformAST(ast, options),
        // 保留 parse 函数以支持独立使用
        async parse(text: string, options: PluginOptions) {
            let processedText = text
            const plugins = (options as any).plugins || []

            // 检测递归调用，避免无限循环
            if (!(options as any)[PROCESSING_MARKER]) {
                // 查找需要 preprocess 的其他插件（如 tailwindcss）
                const pluginsWithPreprocess = plugins.filter((p: any) => {
                    // 跳过自己
                    if (p?.__pluginId === PLUGIN_ID) return false

                    const otherParser = p?.parsers?.[parserName]
                    return otherParser?.preprocess && typeof otherParser.preprocess === "function"
                })

                // 如果有其他需要 preprocess 的插件，使用 prettier.format 来触发它们
                // 因为某些插件（如 tailwindcss）的 preprocess 需要 prettier 的完整环境才能工作
                if (pluginsWithPreprocess.length > 0) {
                    try {
                        processedText = await format(text, {
                            ...options,
                            plugins: pluginsWithPreprocess,
                            [PROCESSING_MARKER]: true,
                        })
                    } catch (error) {
                        console.warn(`[prettier-plugin-remove-braces] Failed to apply other plugins:`, error instanceof Error ? error.message : String(error))
                    }
                }
            }

            // 使用原始 parser 解析处理后的代码
            const ast = originalParser.parse(processedText, options)

            // 转换 AST
            return transformAST(ast, options)
        },
    }
}

// Create the plugin
export const plugin: Plugin = {
    // 用于标识当前插件，避免在查找其他插件时重复处理自己
    __pluginId: PLUGIN_ID,
    languages: [
        {
            name: "typescript",
            parsers: ["typescript"],
            extensions: [".ts", ".tsx", ".mts", ".cts"],
        },
        {
            name: "babel",
            parsers: ["babel"],
            extensions: [".js", ".jsx", ".mjs", ".cjs"],
        },
    ] as SupportLanguage[],
    parsers: {
        typescript: createParserWithTransform("typescript"),
        babel: createParserWithTransform("babel"),
    },
    printers: {
        "typescript-estree": {
            print: (path: any, options: any, print: any) => {
                const node = path.getValue()
                const originalPrinter = require("prettier/plugins/typescript").printers["typescript-estree"]

                // Handle sequence expressions that should be wrapped in parentheses
                if (node.type === "SequenceExpression" && node.expressions.length === 1) {
                    const expr = node.expressions[0]

                    if (expr.type === "ObjectExpression")
                        return `(${originalPrinter.print(path.call.apply(path, [print as any, "expressions", 0]), options, print)})`
                }

                // Use original printer for everything else
                return originalPrinter.print(path, options, print)
            },
        },
        "babel-ast": {
            print: (path: any, options: any, print: any) => {
                const node = path.getValue()
                const originalPrinter = require("prettier/plugins/babel").printers["babel-ast"]

                // Handle sequence expressions that should be wrapped in parentheses
                if (node.type === "SequenceExpression" && node.expressions.length === 1) {
                    const expr = node.expressions[0]

                    if (expr.type === "ObjectExpression")
                        return `(${originalPrinter.print(path.call.apply(path, [print as any, "expressions", 0]), options, print)})`
                }

                // Use original printer for everything else
                return originalPrinter.print(path, options, print)
            },
        },
    },
    options: {
        controlStatementBraces: {
            type: "choice",
            default: "default",
            description: "Control how braces are handled around single control statements (if, for, while, try, etc.)",
            choices: [
                {
                    value: "default",
                    description: "Keep original formatting - don't add or remove braces around control statements",
                },
                {
                    value: "remove",
                    description: "Remove braces around single control statements when possible",
                },
                {
                    value: "add",
                    description: "Add braces around control statements that don't have them",
                },
            ],
        },
        multiLineBraces: {
            type: "choice",
            default: "default",
            description: "Control how braces are handled when single statement spans multiple lines",
            choices: [
                {
                    value: "default",
                    description: "Keep original formatting - don't add or remove braces around multiple line statements",
                },
                {
                    value: "remove",
                    description: "Remove braces around single multiple line statements when possible",
                },
                {
                    value: "add",
                    description: "Add braces around multiple line statements that don't have them",
                },
            ],
        },
    },
} as unknown as Plugin

export { transformAST }
export default plugin
