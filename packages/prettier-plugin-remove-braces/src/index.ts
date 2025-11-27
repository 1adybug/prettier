import { createRequire } from "module"

import { ParserOptions, Plugin, SupportLanguage } from "prettier"

const require = createRequire(import.meta.url)

export interface PluginOptions extends ParserOptions {
    /** 控制单语句是控制语句时的花括号处理方式 */
    controlStatementBraces?: "default" | "remove" | "add"
    /** 控制单语句是多行语句时的花括号处理方式 */
    multipleLineBraces?: "default" | "remove" | "add"
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
    multipleLineBraces?: "default" | "remove" | "add"
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
                    // 内部是多行语句，根据 multipleLineBraces 选项决定
                    if (options.multipleLineBraces === "remove") transformed.consequent = copyLocationInfo(innerStatement, ast.consequent)
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
                    // 内部是多行语句，根据 multipleLineBraces 选项决定
                    if (options.multipleLineBraces === "remove") transformed.alternate = copyLocationInfo(innerStatement, ast.alternate)
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

        // Handle "add" mode for multipleLineBraces - 如果内部是多行语句且没有大括号，添加大括号
        if (options.multipleLineBraces === "add") {
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
                        // 内部是多行语句，根据 multipleLineBraces 选项决定
                        if (options.multipleLineBraces === "remove") transformed.body = copyLocationInfo(innerStatement, block)
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

        // Handle "add" mode for multipleLineBraces - 如果循环体是多行语句且没有大括号，添加大括号
        if (
            options.multipleLineBraces === "add" &&
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

// Create the plugin
export const plugin: Plugin = {
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
        typescript: {
            ...require("prettier/plugins/typescript").parsers.typescript,
            parse(text: string, options: PluginOptions) {
                const originalParser = require("prettier/plugins/typescript").parsers.typescript
                const ast = originalParser.parse(text, options)

                // Always transform when this plugin is enabled
                return transformAST(ast, options)
            },
        },
        babel: {
            ...require("prettier/plugins/babel").parsers.babel,
            parse(text: string, options: PluginOptions) {
                const originalParser = require("prettier/plugins/babel").parsers.babel
                const ast = originalParser.parse(text, options)

                // Always transform when this plugin is enabled
                return transformAST(ast, options)
            },
        },
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
        multipleLineBraces: {
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
