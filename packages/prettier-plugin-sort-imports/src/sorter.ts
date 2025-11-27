import { Group, ImportContent, ImportStatement, PluginConfig } from "./types"

type ImportType = "module" | "alias" | "relative"

/** 默认的分组函数，所有导入都在 default 分组 */
function defaultGetGroup(): string {
    return "default"
}

/** 默认的分组排序函数，按照分组名称的字母顺序排序 */
function defaultSortGroup(a: Group, b: Group): number {
    return a.name.localeCompare(b.name)
}

/** 获取导入路径的类型 */
function getImportType(path: string): ImportType {
    // 相对路径：以 ./ 或 ../ 开头
    if (path.startsWith("./") || path.startsWith("../")) {
        return "relative"
    }

    // 常见的路径别名：@/, ~/, #/ 等
    if (path.startsWith("@/") || path.startsWith("~/") || path.startsWith("#/")) {
        return "alias"
    }

    // 绝对路径（很少见，但也归类为 alias）
    if (path.startsWith("/")) {
        return "alias"
    }

    // 外部模块（从 node_modules 导入的第三方包）
    return "module"
}

/** 获取导入类型的排序优先级，数值越小越靠前 */
function getImportTypePriority(type: ImportType): number {
    switch (type) {
        case "module":
            return 0
        case "alias":
            return 1
        case "relative":
            return 2
    }
}

/** 默认的导入语句排序函数，优先按照导入类型（模块 > 绝对路径 > 相对路径），然后按照 path 的字母顺序排序 */
function defaultSortImportStatement(a: ImportStatement, b: ImportStatement): number {
    const aType = getImportType(a.path)
    const bType = getImportType(b.path)

    const aPriority = getImportTypePriority(aType)
    const bPriority = getImportTypePriority(bType)

    // 先按照类型优先级排序
    if (aPriority !== bPriority) {
        return aPriority - bPriority
    }

    // 同类型的按照 path 的字母顺序排序
    return a.path.localeCompare(b.path)
}

/** 默认的导入内容排序函数，type 类型在前，然后按照最终导入的内容名称的字母顺序排序 */
function defaultSortImportContent(a: ImportContent, b: ImportContent): number {
    // type 类型优先
    if (a.type === "type" && b.type !== "type") {
        return -1
    }

    if (a.type !== "type" && b.type === "type") {
        return 1
    }

    // 按照最终导入的名称排序（如果有别名用别名，否则用原名称）
    const aName = a.alias ?? a.name
    const bName = b.alias ?? b.name
    return aName.localeCompare(bName)
}

/** 默认配置 */
const DEFAULT_CONFIG = {
    getGroup: defaultGetGroup,
    sortGroup: defaultSortGroup,
    sortImportStatement: defaultSortImportStatement,
    sortImportContent: defaultSortImportContent,
    sortSideEffect: false,
}

/** 合并后的配置 */
export interface MergedConfig extends Omit<Required<PluginConfig>, "separator" | "removeUnusedImports" | "otherPlugins" | "prettierOptions"> {
    separator: PluginConfig["separator"]
    removeUnusedImports: boolean
}

/** 合并用户配置和默认配置 */
function mergeConfig(userConfig: PluginConfig): MergedConfig {
    return {
        getGroup: userConfig.getGroup ?? DEFAULT_CONFIG.getGroup,
        sortGroup: userConfig.sortGroup ?? DEFAULT_CONFIG.sortGroup,
        sortImportStatement: userConfig.sortImportStatement ?? DEFAULT_CONFIG.sortImportStatement,
        sortImportContent: userConfig.sortImportContent ?? DEFAULT_CONFIG.sortImportContent,
        separator: userConfig.separator,
        sortSideEffect: userConfig.sortSideEffect ?? DEFAULT_CONFIG.sortSideEffect,
        removeUnusedImports: userConfig.removeUnusedImports ?? false,
    }
}

/** 对导入语句进行排序 */
export function sortImports(imports: ImportStatement[], userConfig: PluginConfig): ImportStatement[] {
    const config = mergeConfig(userConfig)

    // 如果不对副作用导入进行排序，需要特殊处理
    if (!config.sortSideEffect) {
        return sortImportsWithSideEffectSeparators(imports, config)
    }

    // 对所有导入进行分组和排序
    const groups = groupImports(imports, config)

    const sortedGroups = sortGroups(groups, config)

    // 将分组中的导入语句展平
    const result: ImportStatement[] = []

    for (const group of sortedGroups) {
        const sortedStatements = sortImportStatements(group.importStatements, config)

        for (const statement of sortedStatements) {
            const sortedContents = sortImportContents(statement.importContents, config)

            result.push({
                ...statement,
                importContents: sortedContents,
            })
        }
    }

    return result
}

/** 对导入语句进行分组和排序（副作用导入作为分隔符） */
function sortImportsWithSideEffectSeparators(imports: ImportStatement[], config: MergedConfig): ImportStatement[] {
    const result: ImportStatement[] = []

    const chunks: ImportStatement[][] = []

    let currentChunk: ImportStatement[] = []

    // 按照副作用导入分割成多个块
    for (const statement of imports)
        if (statement.isSideEffect) {
            if (currentChunk.length > 0) {
                chunks.push(currentChunk)
                currentChunk = []
            }

            chunks.push([statement])
        } else {
            currentChunk.push(statement)
        }

    if (currentChunk.length > 0) {
        chunks.push(currentChunk)
    }

    // 对每个块进行排序
    for (const chunk of chunks) {
        // 如果是副作用导入块，直接添加
        if (chunk.length === 1 && chunk[0].isSideEffect) {
            result.push(chunk[0])
            continue
        }

        // 对非副作用导入块进行分组和排序
        const groups = groupImports(chunk, config)

        const sortedGroups = sortGroups(groups, config)

        for (const group of sortedGroups) {
            const sortedStatements = sortImportStatements(group.importStatements, config)

            for (const statement of sortedStatements) {
                const sortedContents = sortImportContents(statement.importContents, config)

                result.push({
                    ...statement,
                    importContents: sortedContents,
                })
            }
        }
    }

    return result
}

/** 对导入语句进行分组，同时根据 name 和 isSideEffect 区分 */
export function groupImports(imports: ImportStatement[], userConfig: PluginConfig): Group[] {
    const config = mergeConfig(userConfig)

    // 使用 name + isSideEffect 作为组合键来区分不同的 Group
    const groupMap = new Map<string, ImportStatement[]>()

    for (const statement of imports) {
        const groupName = config.getGroup(statement)

        // 组合键：name|||isSideEffect
        const key = `${groupName}|||${statement.isSideEffect}`

        const statements = groupMap.get(key) ?? []
        statements.push(statement)
        groupMap.set(key, statements)
    }

    const groups: Group[] = []

    for (const [key, statements] of Array.from(groupMap.entries())) {
        // 从组合键中解析出 name 和 isSideEffect
        const separatorIndex = key.lastIndexOf("|||")

        const name = key.slice(0, separatorIndex)
        const isSideEffect = key.slice(separatorIndex + 3) === "true"

        // 从第一个 ImportStatement 中获取 filepath（同一个文件的所有 import 的 filepath 应该相同）
        const filepath = statements[0].filepath

        groups.push({
            filepath,
            name,
            isSideEffect,
            importStatements: statements,
        })
    }

    return groups
}

/** 对分组进行排序 */
export function sortGroups(groups: Group[], userConfig: PluginConfig): Group[] {
    const config = mergeConfig(userConfig)
    return [...groups].sort(config.sortGroup)
}

/** 对导入语句进行排序 */
export function sortImportStatements(statements: ImportStatement[], userConfig: PluginConfig): ImportStatement[] {
    const config = mergeConfig(userConfig)
    return [...statements].sort(config.sortImportStatement)
}

/** 对导入内容进行排序 */
export function sortImportContents(contents: ImportContent[], userConfig: PluginConfig): ImportContent[] {
    const config = mergeConfig(userConfig)

    // 如果用户提供了自定义排序函数，完全使用用户的逻辑
    if (userConfig.sortImportContent) {
        return [...contents].sort(config.sortImportContent)
    }

    // 使用默认排序：默认导入和命名空间导入在最前面，type 在前
    const defaultImport = contents.filter(c => c.name === "default")

    const namespaceImport = contents.filter(c => c.name === "*")
    const namedImports = contents.filter(c => c.name !== "default" && c.name !== "*")

    return [...defaultImport, ...namespaceImport, ...namedImports.sort(config.sortImportContent)]
}

/** 合并来自同一模块的导入语句 */
export function mergeImports(imports: ImportStatement[]): ImportStatement[] {
    // 使用 Map 来存储合并后的导入
    // key 是 `${path}|||${isExport}` 的形式，确保相同模块和相同类型（import/export）的导入会被合并
    const mergedMap = new Map<string, ImportStatement>()

    for (const statement of imports) {
        // 副作用导入不合并
        if (statement.isSideEffect) {
            const key = `${statement.path}|||${statement.isExport}|||sideEffect|||${statement.start}`
            mergedMap.set(key, statement)
            continue
        }

        // 如果包含命名空间导入，不合并
        const hasNamespaceImport = statement.importContents.some(c => c.name === "*")

        if (hasNamespaceImport) {
            const key = `${statement.path}|||${statement.isExport}|||namespace|||${statement.start}`
            mergedMap.set(key, statement)
            continue
        }

        const key = `${statement.path}|||${statement.isExport}`
        const existing = mergedMap.get(key)

        if (!existing) {
            mergedMap.set(key, { ...statement })
        } else {
            // 合并导入内容
            const mergedContents = [...existing.importContents]

            for (const content of statement.importContents) {
                // 检查是否已经存在相同的导入
                const existingContent = mergedContents.find(c => c.name === content.name && c.alias === content.alias)

                if (!existingContent) {
                    mergedContents.push(content)
                } else {
                    // 如果已存在，合并注释
                    if (content.leadingComments) {
                        existingContent.leadingComments = [...(existingContent.leadingComments ?? []), ...content.leadingComments]
                    }

                    if (content.trailingComments) {
                        existingContent.trailingComments = [...(existingContent.trailingComments ?? []), ...content.trailingComments]
                    }
                }
            }

            // 合并语句级别的注释
            // 策略：
            // 1. 前置注释：合并所有导入的前置注释，按顺序排列
            // 2. 行尾注释：只保留第一个导入的行尾注释
            // 3. 被移除导入的行尾注释：存储到 removedTrailingComments，稍后输出为独立的注释行

            const mergedLeadingComments = [...(existing.leadingComments ?? []), ...(statement.leadingComments ?? [])]

            // 只保留第一个导入的行尾注释
            const mergedTrailingComments = existing.trailingComments ?? []

            // 收集被移除导入的行尾注释
            const removedTrailingComments = [...(existing.removedTrailingComments ?? []), ...(statement.trailingComments ?? [])]

            mergedMap.set(key, {
                ...existing,
                importContents: mergedContents,
                leadingComments: mergedLeadingComments.length > 0 ? mergedLeadingComments : undefined,
                trailingComments: mergedTrailingComments.length > 0 ? mergedTrailingComments : undefined,
                removedTrailingComments: removedTrailingComments.length > 0 ? removedTrailingComments : undefined,
            })
        }
    }

    return Array.from(mergedMap.values())
}
