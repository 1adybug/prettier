import { parse } from "@babel/parser"
import traverseModule, { NodePath } from "@babel/traverse"
import {
    ExportNamedDeclaration,
    Identifier,
    JSXIdentifier,
    JSXMemberExpression,
    TSExpressionWithTypeArguments,
    TSTypeQuery,
    TSTypeReference,
} from "@babel/types"

import { ImportContent, ImportStatement } from "./types"

interface TraverseModule {
    default: typeof traverseModule
}

// 处理 ESM/CommonJS 兼容性
const traverse = typeof traverseModule === "function" ? traverseModule : (traverseModule as TraverseModule).default

export interface IdentifierUsage {
    /** 是否在类型位置使用 */
    type: boolean
    /** 是否在值位置使用 */
    value: boolean
}

function addUsage(usages: Map<string, IdentifierUsage>, name: string, kind: keyof IdentifierUsage): void {
    const usage = usages.get(name) ?? { type: false, value: false }
    usage[kind] = true
    usages.set(name, usage)
}

function getRootIdentifierName(node: any): string | undefined {
    if (!node) return undefined

    if (node.type === "Identifier" || node.type === "JSXIdentifier") return node.name

    if (node.type === "TSQualifiedName") return getRootIdentifierName(node.left)

    if (node.type === "MemberExpression" || node.type === "OptionalMemberExpression") return getRootIdentifierName(node.object)

    if (node.type === "JSXMemberExpression") return getRootIdentifierName(node.object)

    return undefined
}

function isTypeDeclarationName(path: NodePath<Identifier>): boolean {
    const parent = path.parent

    return (
        (parent.type === "TSTypeAliasDeclaration" && parent.id === path.node) ||
        (parent.type === "TSInterfaceDeclaration" && parent.id === path.node) ||
        (parent.type === "TSEnumDeclaration" && parent.id === path.node) ||
        (parent.type === "TSModuleDeclaration" && parent.id === path.node)
    )
}

function isTypeOnlyIdentifierPosition(path: NodePath<Identifier>): boolean {
    let current: NodePath = path

    while (current.parentPath) {
        const parentPath = current.parentPath
        const parent = parentPath.node

        if (
            parent.type === "TSTypeReference" ||
            parent.type === "TSTypeQuery" ||
            parent.type === "TSExpressionWithTypeArguments" ||
            parent.type === "TSQualifiedName"
        )
            return true

        if (
            (parent.type === "TSAsExpression" ||
                parent.type === "TSSatisfiesExpression" ||
                parent.type === "TSTypeAssertion" ||
                parent.type === "TSNonNullExpression" ||
                parent.type === "TSInstantiationExpression") &&
            current.key === "expression"
        )
            return false

        if (parent.type.startsWith("TS")) return true

        current = parentPath
    }

    return false
}

function addRootTypeUsage(usages: Map<string, IdentifierUsage>, node: any): void {
    const name = getRootIdentifierName(node)

    if (name) addUsage(usages, name, "type")
}

function addRootValueUsage(usages: Map<string, IdentifierUsage>, node: any): void {
    const name = getRootIdentifierName(node)

    if (name) addUsage(usages, name, "value")
}

/** 分析代码中标识符的类型位置和值位置使用情况 */
export function analyzeIdentifierUsages(code: string): Map<string, IdentifierUsage> | null {
    const usages = new Map<string, IdentifierUsage>()

    try {
        const ast = parse(code, {
            sourceType: "module",
            plugins: ["typescript", "jsx"],
            errorRecovery: true,
        })

        // 遍历 AST，收集所有使用的标识符
        traverse(ast, {
            // 处理普通标识符
            Identifier(path: NodePath<Identifier>) {
                const node = path.node
                const parent = path.parent

                // 只收集被引用的标识符
                if (!path.isReferencedIdentifier()) return

                if (isTypeDeclarationName(path)) return

                if (parent?.type === "ExportSpecifier") return

                // 跳过对象属性的 key（除非是计算属性）
                if (parent?.type === "ObjectProperty" && parent.key === node && !parent.computed) return

                if (isTypeOnlyIdentifierPosition(path)) return

                addUsage(usages, node.name, "value")
            },

            // 处理 JSX 标识符
            JSXIdentifier(path: NodePath<JSXIdentifier>) {
                const node = path.node

                // JSX 开始标签和结束标签
                if (path.parent?.type === "JSXOpeningElement" || path.parent?.type === "JSXClosingElement") addUsage(usages, node.name, "value")
            },

            // 处理 JSX 成员表达式（如 <DatePicker.RangePicker />）
            JSXMemberExpression(path: NodePath<JSXMemberExpression>) {
                addRootValueUsage(usages, path.node)
            },

            // 处理 TypeScript 类型引用
            TSTypeReference(path: NodePath<TSTypeReference>) {
                addRootTypeUsage(usages, path.node.typeName)
            },

            // 处理 TypeScript typeof 类型查询，如 type A = typeof a
            TSTypeQuery(path: NodePath<TSTypeQuery>) {
                addRootTypeUsage(usages, path.node.exprName)
            },

            // 处理 interface/class 的 extends/implements 类型引用
            TSExpressionWithTypeArguments(path: NodePath<TSExpressionWithTypeArguments>) {
                addRootTypeUsage(usages, path.node.expression)
            },

            // 处理 export 语句中的标识符
            ExportNamedDeclaration(path: NodePath<ExportNamedDeclaration>) {
                const node = path.node

                // 如果是 export { a, b } 这种形式，需要收集使用的标识符
                if (!node.source && node.specifiers) {
                    for (const specifier of node.specifiers) {
                        if (specifier.type === "ExportSpecifier") {
                            if (specifier.local.type === "Identifier") {
                                const isTypeExport = node.exportKind === "type" || specifier.exportKind === "type"

                                addUsage(usages, specifier.local.name, isTypeExport ? "type" : "value")
                            }
                        }
                    }
                }
            },
        })
    } catch (error) {
        // 静默处理语法错误
        // Prettier 是格式化工具，不应该验证语法错误
        // 当代码有语法错误时（如重复声明变量），返回 null 表示分析失败
        // 这样调用方可以跳过移除未使用导入的逻辑
        return null
    }

    return usages
}

/** 分析代码中使用的标识符 */
export function analyzeUsedIdentifiers(code: string): Set<string> | null {
    const usages = analyzeIdentifierUsages(code)

    if (usages === null) return null

    const usedIdentifiers = new Set<string>()

    for (const [name, usage] of Array.from(usages.entries())) {
        if (usage.type || usage.value) usedIdentifiers.add(name)
    }

    return usedIdentifiers
}

/** 过滤未使用的导入内容 */
export function filterUnusedImports(importStatement: ImportStatement, usedIdentifiers: Set<string>): ImportStatement {
    // 副作用导入和导出语句不过滤
    if (importStatement.isSideEffect || importStatement.isExport) return importStatement

    // 过滤导入内容
    const usedContents: ImportContent[] = []

    for (const content of importStatement.importContents) {
        // 获取实际使用的名称（如果有别名用别名，否则用原名称）
        const usedName = content.alias ?? content.name

        // 对于默认导入和命名空间导入，使用别名
        if (content.name === "default" || content.name === "*") {
            if (content.alias && usedIdentifiers.has(content.alias)) usedContents.push(content)
        } else {
            // 对于命名导入，检查使用的名称
            if (usedIdentifiers.has(usedName)) usedContents.push(content)
        }
    }

    return {
        ...importStatement,
        importContents: usedContents,
        // 如果所有导入内容都被删除了，变成副作用导入
        isSideEffect: usedContents.length === 0,
    }
}

/** 从导入语句列表中移除未使用的导入 */
export function removeUnusedImportsFromStatements(importStatements: ImportStatement[], code: string): ImportStatement[] {
    // 分析代码中使用的标识符
    const usedIdentifiers = analyzeUsedIdentifiers(code)

    // 如果分析失败（代码有语法错误），直接返回原始导入语句，不做任何修改
    if (usedIdentifiers === null) return importStatements

    // 过滤每个导入语句
    const filteredStatements: ImportStatement[] = []

    for (const statement of importStatements) {
        const filteredStatement = filterUnusedImports(statement, usedIdentifiers)

        // 如果过滤后变成了副作用导入，但原本不是副作用导入，说明所有导入都未使用
        // 这种情况下可以选择保留或删除整个导入语句
        // 这里我们选择删除整个导入语句
        if (!statement.isSideEffect && filteredStatement.isSideEffect && filteredStatement.importContents.length === 0) continue

        filteredStatements.push(filteredStatement)
    }

    return filteredStatements
}

/** 将仅用于类型位置的命名导入标记为 type */
export function markTypeOnlyImportsFromStatements(importStatements: ImportStatement[], code: string): ImportStatement[] {
    const usages = analyzeIdentifierUsages(code)

    if (usages === null) return importStatements

    return importStatements.map(statement => {
        if (statement.isSideEffect || statement.isExport) return statement

        let changed = false

        const importContents = statement.importContents.map(content => {
            if (content.type === "type" || content.name === "default" || content.name === "*") return content

            const usedName = content.alias ?? content.name
            const usage = usages.get(usedName)

            if (usage?.type && !usage.value) {
                changed = true

                return {
                    ...content,
                    type: "type" as const,
                }
            }

            return content
        })

        if (!changed) return statement

        return {
            ...statement,
            importContents,
        }
    })
}
