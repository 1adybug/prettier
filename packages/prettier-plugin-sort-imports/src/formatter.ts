import { Group, ImportStatement, PluginConfig } from "./types" /** 格式化导入语句 */

export function formatImportStatement(statement: ImportStatement): string {
    const { path, isExport, isSideEffect, importContents, leadingComments, trailingComments, removedTrailingComments, emptyLinesAfterComments } = statement

    const lines: string[] = []

    // 添加前导注释
    if (leadingComments && leadingComments.length > 0) {
        lines.push(...leadingComments)
        // 添加注释后的空行
        const emptyLines = emptyLinesAfterComments ?? 0

        for (let i = 0; i < emptyLines; i++) lines.push("")
    }

    // 副作用导入
    if (isSideEffect) {
        let importLine = ""

        if (isExport) importLine = `export * from "${path}"`
        else importLine = `import "${path}"`

        // 添加行尾注释
        if (trailingComments && trailingComments.length > 0) importLine += ` ${trailingComments.join(" ")}`

        lines.push(importLine)
        return lines.join("\n")
    }

    // 检查命名导入是否包含注释
    const hasNamedImportComments = importContents.some(
        content =>
            content.name !== "default" &&
            content.name !== "*" &&
            ((content.leadingComments && content.leadingComments.length > 0) || (content.trailingComments && content.trailingComments.length > 0)),
    )

    // 构建导入内容（importContents 已经排序好了，直接按顺序处理）
    const parts: string[] = []

    const namedParts: string[] = []

    const namedPartsWithComments: string[] = []

    for (const content of importContents) {
        // 默认导入
        if (content.name === "default") {
            // 对于 import 语句，默认导入不需要大括号
            // 对于 export 语句，默认导入需要使用 { default } 或 { default as alias } 格式
            if (isExport) {
                // export 语句始终使用命名导出格式
                if (content.alias) namedParts.push(`default as ${content.alias}`)
                else namedParts.push("default")
            } else
                // import 语句使用简化的默认导入格式
                parts.push(content.alias ?? "default")

            continue
        }

        // 命名空间导入
        if (content.name === "*") {
            parts.push(`* as ${content.alias ?? "namespace"}`)
            continue
        }

        // 命名导入
        const typePrefix = content.type === "type" ? "type " : ""
        let importItem = ""

        if (content.alias) importItem = `${typePrefix}${content.name} as ${content.alias}`
        else importItem = `${typePrefix}${content.name}`

        // 如果有命名导入包含注释，需要使用多行格式
        if (hasNamedImportComments) {
            const itemLines: string[] = []

            // 添加前导注释
            if (content.leadingComments && content.leadingComments.length > 0) itemLines.push(...content.leadingComments)

            // 添加导入项本身
            let itemLine = importItem

            // 添加行尾注释
            if (content.trailingComments && content.trailingComments.length > 0) itemLine += ` ${content.trailingComments.join(" ")}`

            itemLines.push(itemLine)

            namedPartsWithComments.push(itemLines.join("\n    "))
        } else namedParts.push(importItem)
    }

    // 检查导入类型组合
    const namedImports = importContents.filter(c => c.name !== "default" && c.name !== "*")

    const allNamedImportsAreTypes = namedImports.every(c => c.type === "type")
    const hasDefaultOrNamespace = importContents.some(c => c.name === "default" || c.name === "*")

    // 添加命名导入部分
    if (hasNamedImportComments && namedPartsWithComments.length > 0) {
        // 多行格式
        const keyword = isExport ? "export" : "import"
        // 只有在所有命名导入都是类型且没有默认导入/命名空间导入时才使用 type 关键字
        const typeKeyword = allNamedImportsAreTypes && !hasDefaultOrNamespace ? "type " : ""
        const defaultPart = parts.length > 0 ? parts.join(", ") + ", " : ""
        const importStart = `${keyword} ${typeKeyword}${defaultPart}{`
        const importEnd = `} from "${path}"`

        lines.push(importStart)
        lines.push(`    ${namedPartsWithComments.join(",\n    ")},`)
        lines.push(importEnd)
    } else {
        // 单行格式
        if (namedParts.length > 0) {
            // 如果所有命名导入都是类型且没有默认导入/命名空间导入
            if (allNamedImportsAreTypes && !hasDefaultOrNamespace) {
                // 使用 import type { A, B } 格式
                // 移除每个导入项前面的 type 关键字
                const cleanedParts = namedParts.map(part => part.replace(/^type /, ""))

                parts.push(`{ ${cleanedParts.join(", ")} }`)
            } else
                // 其他情况保持每个导入项前面的 type 关键字
                parts.push(`{ ${namedParts.join(", ")} }`)
        }

        // 构建完整的导入语句
        const importClause = parts.join(", ")

        // 只有在所有命名导入都是类型且没有默认导入/命名空间导入时才使用 type 关键字
        const typeKeyword = allNamedImportsAreTypes && !hasDefaultOrNamespace ? "type " : ""
        let importLine = ""

        if (isExport) importLine = `export ${typeKeyword}${importClause} from "${path}"`
        else importLine = `import ${typeKeyword}${importClause} from "${path}"`

        // 添加行尾注释
        if (trailingComments && trailingComments.length > 0) importLine += ` ${trailingComments.join(" ")}`

        lines.push(importLine)
    }

    // 添加被移除导入的行尾注释（作为独立的注释行）
    if (removedTrailingComments && removedTrailingComments.length > 0) {
        lines.push("") // 添加空行

        lines.push(...removedTrailingComments)
    }

    return lines.join("\n")
}

/** 格式化分组 */
export function formatGroups(groups: Group[], config: PluginConfig): string {
    const lines: string[] = []

    const separator = config.separator

    for (let i = 0; i < groups.length; i++) {
        const group = groups[i]

        // 添加分隔符（第一个分组前不添加分隔符）
        if (separator !== undefined && i > 0) {
            let separatorStr: string | undefined

            if (typeof separator === "string") separatorStr = separator
            else separatorStr = separator(group, i)

            if (separatorStr !== undefined) {
                // 先添加一个空行，然后添加分隔符
                lines.push("")

                if (separatorStr !== "") lines.push(separatorStr)
            }
        }

        // 格式化分组中的导入语句
        for (const statement of group.importStatements) lines.push(formatImportStatement(statement))
    }

    return lines.join("\n")
}

/** 格式化导入语句列表（不使用分组） */
export function formatImportStatements(statements: ImportStatement[]): string {
    return statements.map(formatImportStatement).join("\n")
}
