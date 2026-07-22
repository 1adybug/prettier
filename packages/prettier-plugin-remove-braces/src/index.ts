import { createRequire } from "node:module"

import { type ParserOptions, type Plugin, type Options as PrettierOptions, type SupportLanguage, format } from "prettier"

const require = createRequire(import.meta.url)

export interface Options extends PrettierOptions {
    /**
     * 将只包含单个表达式语句的箭头函数块体转换为简写的 void 表达式。
     * @default false
     */
    arrowFunctionVoid?: boolean
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
    /** 将只包含单个表达式语句的箭头函数块体转换为简写的 void 表达式 */
    arrowFunctionVoid?: boolean
    /** 控制单语句是控制语句时的花括号处理方式 */
    controlStatementBraces?: "default" | "remove" | "add"
    /** 控制单语句是多行语句时的花括号处理方式 */
    multiLineBraces?: "default" | "remove" | "add"
}

// Helper function to check if a statement is a lexical declaration
function isLexicalDeclaration(node: any): boolean {
    return (
        (node?.type === "VariableDeclaration" && node.kind !== "var") ||
        node?.type === "FunctionDeclaration" ||
        node?.type === "ClassDeclaration" ||
        ["TSTypeAliasDeclaration", "TSInterfaceDeclaration", "TSEnumDeclaration", "TSModuleDeclaration", "TSImportEqualsDeclaration"].includes(node?.type)
    )
}

// Helper function to check if node contains comments
function hasComments(node: any): boolean {
    return !!(node?.leadingComments?.length || node?.trailingComments?.length || node?.innerComments?.length)
}

// Comments may be attached to a nested expression instead of its containing statement.
function hasCommentsInSubtree(node: any, visited = new WeakSet<object>()): boolean {
    if (!node || typeof node !== "object") return false
    if (visited.has(node)) return false

    visited.add(node)
    if (hasComments(node)) return true

    for (const key in node) {
        if (["loc", "range", "tokens", "leadingComments", "trailingComments", "innerComments"].includes(key)) continue

        const value = node[key]

        if (Array.isArray(value)) {
            if (value.some(item => hasCommentsInSubtree(item, visited))) return true
        } else if (hasCommentsInSubtree(value, visited)) return true
    }

    return false
}

function getNodeRange(node: any): [number, number] | undefined {
    if (Array.isArray(node?.range)) return [node.range[0], node.range[1]]
    if (typeof node?.start === "number" && typeof node?.end === "number") return [node.start, node.end]

    return undefined
}

function hasCommentsInRange(node: any, comments: any[]): boolean {
    const nodeRange = getNodeRange(node)

    if (!nodeRange) return false

    return comments.some(comment => {
        const commentRange = getNodeRange(comment)

        return !!commentRange && commentRange[0] >= nodeRange[0] && commentRange[1] <= nodeRange[1]
    })
}

// Different parsers attach comments to different nodes. Check both the AST
// subtree and the root comment list before removing a syntactic boundary.
function blockHasComments(block: any, comments: any[]): boolean {
    return hasCommentsInSubtree(block) || hasCommentsInRange(block, comments)
}

function hasDirectivePrologue(block: any): boolean {
    if (Array.isArray(block?.directives) && block.directives.length > 0) return true

    return Array.isArray(block?.body) && block.body.some((statement: any) => typeof statement?.directive === "string")
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

function expressionMayWrap(node: any): boolean {
    if (!node) return false

    if (
        [
            "ParenthesizedExpression",
            "TSAsExpression",
            "TSSatisfiesExpression",
            "TSTypeAssertion",
            "TSNonNullExpression",
            "TSInstantiationExpression",
            "ChainExpression",
        ].includes(node.type)
    )
        return expressionMayWrap(node.expression)

    if (node.type === "UnaryExpression" || node.type === "YieldExpression" || node.type === "AwaitExpression") return expressionMayWrap(node.argument)

    return [
        "ArrayExpression",
        "ArrowFunctionExpression",
        "AssignmentExpression",
        "BinaryExpression",
        "CallExpression",
        "ClassExpression",
        "ConditionalExpression",
        "FunctionExpression",
        "JSXElement",
        "JSXFragment",
        "LogicalExpression",
        "NewExpression",
        "ObjectExpression",
        "OptionalCallExpression",
        "SequenceExpression",
    ].includes(node.type)
}

function statementMayWrap(node: any): boolean {
    if (node?.type === "ExpressionStatement" || node?.type === "ReturnStatement" || node?.type === "ThrowStatement")
        return expressionMayWrap(node.expression ?? node.argument)

    if (node?.type === "VariableDeclaration") return node.declarations?.some((declaration: any) => expressionMayWrap(declaration.init)) ?? false

    return false
}

// Check both source line spans and predictable width-based wrapping. Without
// the latter, an unbraced long call gets braces only on the second format pass.
function isMultilineStatement(node: any, options: TransformASTOptions): boolean {
    if (!node?.loc) return false

    if (node.loc.start.line !== node.loc.end.line) return true

    const printWidth = options.printWidth
    const range = getNodeRange(node)

    return (
        typeof printWidth === "number" &&
        printWidth > 0 &&
        !!range &&
        statementMayWrap(node) &&
        (node.loc.start.column ?? 0) + (range[1] - range[0]) > printWidth
    )
}

// Helper function to check if removing braces would cause dangling else issue
function canAbsorbElse(node: any): boolean {
    if (!node) return false

    if (node.type === "IfStatement") return !node.alternate || canAbsorbElse(node.alternate)

    if (["ForStatement", "ForInStatement", "ForOfStatement", "WhileStatement", "WithStatement", "LabeledStatement"].includes(node.type))
        return canAbsorbElse(node.body)

    return false
}

function wouldCauseDanglingElse(ifNode: any): boolean {
    if (!ifNode || ifNode.type !== "IfStatement") return false

    const consequent = ifNode.consequent
    if (!consequent || consequent.type !== "BlockStatement") return false

    // Any short-if chain can capture the outer else after braces are removed.
    return !!ifNode.alternate && consequent.body.length === 1 && canAbsorbElse(consequent.body[0])
}

/** transformAST 函数的选项 */
export interface TransformASTOptions {
    /** 将只包含单个表达式语句的箭头函数块体转换为简写的 void 表达式 */
    arrowFunctionVoid?: boolean
    /** 控制单语句是控制语句时的花括号处理方式 */
    controlStatementBraces?: "default" | "remove" | "add"
    /** 控制单语句是多行语句时的花括号处理方式 */
    multiLineBraces?: "default" | "remove" | "add"
    /** Prettier line width, used to predict wrapping before the first print. */
    printWidth?: number
}

interface TransformContext {
    parent?: any
    parentKey?: string
    comments?: any[]
}

// Certain parents (e.g. function bodies, try/catch) syntactically require a BlockStatement
function isBlockRequiredContext(context: TransformContext): boolean {
    const { parent, parentKey } = context

    if (!parent || !parentKey) return false

    if (
        parentKey === "body" &&
        [
            "ArrowFunctionExpression",
            "FunctionDeclaration",
            "FunctionExpression",
            "ObjectMethod",
            "ClassMethod",
            "ClassPrivateMethod",
            "TSDeclareFunction",
            "TSDeclareMethod",
        ].includes(parent.type)
    )
        return true

    if (parent.type === "CatchClause" && parentKey === "body") return true
    if (parent.type === "TryStatement" && (parentKey === "block" || parentKey === "finalizer")) return true

    return false
}

// Main AST transformation function
function transformAST(ast: any, options: TransformASTOptions = {}, context: TransformContext = {}): any {
    if (!ast || typeof ast !== "object") return ast

    const comments = context.comments ?? (Array.isArray(ast.comments) ? ast.comments : [])

    // Handle ArrowFunctionExpression
    if (ast.type === "ArrowFunctionExpression" && ast.body?.type === "BlockStatement") {
        const block = ast.body

        // Check if block has only one statement and it's a return statement
        if (
            block.body.length === 1 &&
            block.body[0].type === "ReturnStatement" &&
            !hasDirectivePrologue(block) &&
            !hasComments(block.body[0]) && // Check comment on return statement
            !hasComments(block) &&
            !hasCommentsInRange(ast, comments) &&
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

        const expressionStatement = block.body[0]

        if (
            options.arrowFunctionVoid &&
            block.body.length === 1 &&
            expressionStatement.type === "ExpressionStatement" &&
            !hasDirectivePrologue(block) &&
            !expressionStatement.directive &&
            !hasCommentsInSubtree(block) &&
            !hasCommentsInRange(ast, comments)
        ) {
            const voidExpression = {
                type: "UnaryExpression",
                operator: "void",
                prefix: true,
                argument: expressionStatement.expression,
            }

            voidExpression.argument = transformAST(voidExpression.argument, options, { parent: voidExpression, parentKey: "argument", comments })

            return {
                ...ast,
                body: copyLocationInfo(voidExpression, block),
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
            !blockHasComments(ast.consequent, comments) &&
            !isLexicalDeclaration(ast.consequent.body[0]) &&
            !wouldCauseDanglingElse(ast)
        ) {
            const innerStatement = ast.consequent.body[0]

            if (isControlStatement(innerStatement)) {
                // 内部是控制语句，根据 controlStatementBraces 选项决定
                if (options.controlStatementBraces === "remove") transformed.consequent = copyLocationInfo(innerStatement, ast.consequent)
                // "default" 和 "add" 模式：保持大括号
            } else {
                if (isMultilineStatement(innerStatement, options)) {
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
            !blockHasComments(ast.alternate, comments) &&
            !isLexicalDeclaration(ast.alternate.body[0])
        ) {
            const innerStatement = ast.alternate.body[0]

            if (isControlStatement(innerStatement)) {
                // 内部是控制语句，根据 controlStatementBraces 选项决定
                if (options.controlStatementBraces === "remove") transformed.alternate = copyLocationInfo(innerStatement, ast.alternate)
                // "default" 和 "add" 模式：保持大括号
            } else {
                if (isMultilineStatement(innerStatement, options)) {
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

            // 对于 else if 语句（alternate 是 IfStatement），不添加大括号，保持链式结构
            if (
                ast.alternate &&
                isControlStatement(ast.alternate) &&
                ast.alternate.type !== "BlockStatement" &&
                ast.alternate.type !== "IfStatement" // 排除 else if 的情况
            ) {
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
            if (
                ast.consequent &&
                !isControlStatement(ast.consequent) &&
                ast.consequent.type !== "BlockStatement" &&
                isMultilineStatement(ast.consequent, options)
            ) {
                transformed.consequent = copyLocationInfo(
                    {
                        type: "BlockStatement",
                        body: [ast.consequent],
                    },
                    ast.consequent,
                )
            }

            if (
                ast.alternate &&
                !isControlStatement(ast.alternate) &&
                ast.alternate.type !== "BlockStatement" &&
                isMultilineStatement(ast.alternate, options)
            ) {
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
        transformed.consequent = transformAST(transformed.consequent, options, { parent: transformed, parentKey: "consequent", comments })
        transformed.alternate = transformAST(transformed.alternate, options, { parent: transformed, parentKey: "alternate", comments })

        return transformed
    }

    // Handle loop statements (ForStatement, WhileStatement, DoWhileStatement, ForInStatement, ForOfStatement)
    const loopTypes = ["ForStatement", "WhileStatement", "DoWhileStatement", "ForInStatement", "ForOfStatement"]

    if (loopTypes.includes(ast.type)) {
        const transformed = { ...ast }

        // 检查是否可以移除循环体的 {}
        if (ast.body?.type === "BlockStatement") {
            const block = ast.body

            if (block.body.length === 1 && !blockHasComments(block, comments) && !isLexicalDeclaration(block.body[0])) {
                const innerStatement = block.body[0]

                if (isControlStatement(innerStatement)) {
                    // 内部是控制语句，根据 controlStatementBraces 选项决定
                    if (options.controlStatementBraces === "remove") transformed.body = copyLocationInfo(innerStatement, block)
                    // "default" 和 "add" 模式：保持大括号
                } else {
                    if (isMultilineStatement(innerStatement, options)) {
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
            isMultilineStatement(ast.body, options)
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
        transformed.body = transformAST(transformed.body, options, { parent: transformed, parentKey: "body", comments })

        return transformed
    }

    // Handle control statement blocks based on controlStatementBraces option
    if (
        options.controlStatementBraces === "remove" &&
        ast.type === "BlockStatement" &&
        ast.body.length === 1 &&
        !blockHasComments(ast, comments) &&
        !isLexicalDeclaration(ast.body[0]) &&
        isControlStatement(ast.body[0]) &&
        !(context.parentKey === "consequent" && wouldCauseDanglingElse(context.parent)) &&
        !isBlockRequiredContext(context)
    )
        return copyLocationInfo(ast.body[0], ast)

    // Recursively transform all child nodes
    for (const key in ast) {
        if (Array.isArray(ast[key])) ast[key] = ast[key].map(item => transformAST(item, options, { parent: ast, parentKey: key, comments }))
        else {
            if (ast[key] && typeof ast[key] === "object" && key !== "loc" && key !== "range" && key !== "tokens")
                ast[key] = transformAST(ast[key], options, { parent: ast, parentKey: key, comments })
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
function createParserWithTransform(parserName: "typescript" | "babel" | "babel-ts") {
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
            parsers: ["babel", "babel-ts"],
            extensions: [".js", ".jsx", ".mjs", ".cjs"],
        },
    ] as SupportLanguage[],
    parsers: {
        typescript: createParserWithTransform("typescript"),
        babel: createParserWithTransform("babel"),
        "babel-ts": createParserWithTransform("babel-ts"),
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
        arrowFunctionVoid: {
            type: "boolean",
            default: false,
            description: "Convert single-expression arrow function blocks to concise void expression bodies",
        },
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
