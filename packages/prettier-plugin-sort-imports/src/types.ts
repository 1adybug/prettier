import { Plugin } from "prettier"

/** 导入内容 */
export interface ImportContent {
    /** 导入的内容的名称 */
    name: string
    /** 导入的内容的别名 */
    alias?: string
    /** 导入的内容的类型，只有明确在导入前加入了 type 标记的才属于 type 类型，没有明确的加入 type 标记的都属于 variable 类型 */
    type: "type" | "variable"
    /** 导入内容上方的注释 */
    leadingComments?: string[]
    /** 导入内容后方的行尾注释 */
    trailingComments?: string[]
}

/** 导入语句 */
export interface ImportStatement {
    /** 导入的模块路径，可以是相对路径或绝对路径，比如 react, react-dom 或者 ./utils/index，@/utils/index 等 */
    path: string
    /** 是否是导出语句，默认为 false */
    isExport: boolean
    /** 是否是副作用导入，默认为 false */
    isSideEffect: boolean
    /** 导入的内容 */
    importContents: ImportContent[]
    /** 导入语句上方的注释 */
    leadingComments?: string[]
    /** 导入语句后方的行尾注释 */
    trailingComments?: string[]
    /** 被移除的导入语句的行尾注释（合并时使用） */
    removedTrailingComments?: string[]
    /** 前导注释后的空行数（用于保留注释和 import 之间的空行） */
    emptyLinesAfterComments?: number
    /** 在源代码中的起始位置（包括注释） */
    start?: number
    /** 在源代码中的结束位置 */
    end?: number
}

/** 分组 */
export interface Group {
    /** 分组名称，默认为 default */
    name: string
    /** 是否是副作用分组，默认为 false */
    isSideEffect: boolean
    /** 分组对应的导入语句列表 */
    importStatements: ImportStatement[]
}

/** 获取分组名称的函数 */
export type GetGroupFunction = (importStatement: ImportStatement) => string

/** 分组排序函数 */
export type SortGroupFunction = (a: Group, b: Group) => number

/** 导入语句排序函数 */
export type SortImportStatementFunction = (a: ImportStatement, b: ImportStatement) => number

/** 导入内容排序函数 */
export type SortImportContentFunction = (a: ImportContent, b: ImportContent) => number

/** 分隔符函数 */
export type SeparatorFunction = (group: Group, index: number) => string | undefined

/** 插件配置 */
export interface PluginConfig {
    /** 可选的，获取分组名称 */
    getGroup?: GetGroupFunction
    /** 可选的，默认按照分组名称的字母顺序排序 */
    sortGroup?: SortGroupFunction
    /** 可选的，默认按照导入语句的 path 的字母顺序排序 */
    sortImportStatement?: SortImportStatementFunction
    /** 可选的，默认按照导入内容的 name 的字母顺序排序，默认按照优先 type 类型在前，其次按照最终导入的内容名称的字母顺序排序 */
    sortImportContent?: SortImportContentFunction
    /** 分隔符，分组之间的分隔符，默认为 undefined */
    separator?: string | SeparatorFunction
    /** 是否对副作用导入进行排序，默认为 false */
    sortSideEffect?: boolean
    /** 是否删除未使用的导入，默认为 false */
    removeUnusedImports?: boolean
    /** 要合并的其他 Prettier 插件，按传入顺序执行 */
    otherPlugins?: Plugin[]
    /** 传递给其他插件的 Prettier 配置选项 */
    prettierOptions?: Record<string, any>
}
