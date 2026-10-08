# @1adybug/prettier-plugin-sort-imports

> **声明：本项目完全由 AI 编码工具实现。**

[English](./README.md)

为 JavaScript/TypeScript 导入及带模块来源的重新导出进行分组、排序和合并的 Prettier 插件，也支持可选的未使用导入删除与类型导入处理。

## 安装

```bash
pnpm add -D prettier @1adybug/prettier-plugin-sort-imports
```

需要 Prettier `^3.8.0`，支持 `babel`、`babel-ts` 和 `typescript` 解析器。该包为 ESM。

## 使用

创建 `prettier.config.mjs`：

```js
export default {
    plugins: ["@1adybug/prettier-plugin-sort-imports"],
    semi: false,
    tabWidth: 4,
    sortSideEffect: false,
    removeUnusedImports: false,
    markTypeOnlyImports: false,
    mergeTypeImports: true,
    nodeProtocol: "add",
}
```

```bash
pnpm exec prettier --write "src/**/*.{js,jsx,ts,tsx}"
```

示例中显式开启了 `nodeProtocol: "add"`；此选项默认不修改前缀。

## 默认排序

格式化前：

```ts
import { z, a } from "./z"
import value from "pkg"
import { b } from "@/alias"
console.log(value, a, z, b)
```

格式化后（插件选项使用默认值，`semi: false`）：

```ts
import value from "pkg"
import { b } from "@/alias"
import { a, z } from "./z"

console.log(value, a, z, b)
```

默认先排列外部模块，再排列别名/绝对路径（`@/`、`~/`、`#/`、`/`），最后排列相对路径；同类路径按字母顺序排序。命名内容优先排列显式类型标记，再按本地名称（存在别名时使用别名）排序。同模块的兼容声明会被合并；来自不同声明的内容合并后可能保留合并顺序，而不是重新排列所有内容。

默认导入和命名空间导入始终按模块语法要求打印。自定义 `sortImportContent` 可以调整内容排序，但不会改变这些语法约束。

## 选项

以下选项可直接写在 Prettier 配置中，也可以传入 `createPlugin`：

| 选项                  | 默认值      | 行为                                                     |
| --------------------- | ----------- | -------------------------------------------------------- |
| `sortSideEffect`      | `false`     | 开启后将副作用导入纳入排序                               |
| `removeUnusedImports` | `false`     | 删除当前文件中未使用的导入                               |
| `markTypeOnlyImports` | `false`     | 为仅在类型位置使用的命名导入添加类型标记                 |
| `mergeTypeImports`    | `true`      | 将全为类型的命名内容打印为 `import type` / `export type` |
| `nodeProtocol`        | `undefined` | 为内置模块 `"add"` 或 `"remove"` `node:` 前缀            |
| `groupSeparator`      | `undefined` | 使用自定义分组时插入分隔符                               |

### 类型导入

格式化前：

```ts
import { User } from "./types"
export type Account = User
```

格式化后（`markTypeOnlyImports: true`、`semi: false`）：

```ts
import type { User } from "./types"

export type Account = User
```

设置 `mergeTypeImports: false` 后，导入改为 `import { type User } from "./types"`。自动类型标记基于当前文件 AST，不使用 TypeScript type checker，不转换默认导入、命名空间导入、副作用导入或重新导出。运行时引用仍保留值导入。

### 未使用导入

`removeUnusedImports: true` 会分析当前文件中的引用，包括支持的 JSX 和 TypeScript 用法。副作用导入与重新导出语句会被保留。分析不会跨文件解析类型，具体边界见下方限制。

### 副作用导入

默认情况下，副作用导入充当分隔边界：普通导入只在各边界之间的区段内排序，不会跨越边界移动。

输入及默认输出（`semi: false`）：

```ts
import "./z.css"
import "./a.css"
```

`sortSideEffect: true` 时的输出：

```ts
import "./a.css"
import "./z.css"
```

开启此选项可能改变模块求值顺序。

### 分组分隔符

分隔符在配置 `getGroup` 时生效。`undefined` 不添加分隔符；`""` 在分组之间添加一行空行；非空字符串会在一行空行后输出该字符串，例如 `"// external modules"`。回调接收 `(group, index)`，可返回字符串或 `undefined`，不会在第一个分组前调用。

需要一行空行时使用 `""`，不必使用 `"\n"`。

## 自定义分组与排序

需要回调时，在 JavaScript 配置中使用 `createPlugin`。工厂支持 `getGroup`、`sortGroup`、`sortImportStatement`、`sortImportContent` 和函数形式的 `groupSeparator`；这些回调没有注册为普通 Prettier 选项。

```js
import { createPlugin } from "@1adybug/prettier-plugin-sort-imports"

export default {
    plugins: [
        createPlugin({
            getGroup: statement => {
                if (/^react(?:-dom)?(?:\/|$)/.test(statement.path)) return "react"
                if (!statement.path.startsWith(".")) return "external"
                return "local"
            },
            sortGroup: (a, b) => {
                const order = ["react", "external", "local"]
                return order.indexOf(a.name) - order.indexOf(b.name)
            },
            sortImportStatement: (a, b) => a.path.localeCompare(b.path),
            sortImportContent: (a, b) => (a.alias ?? a.name).localeCompare(b.alias ?? b.name),
            groupSeparator: "",
        }),
    ],
    semi: false,
    tabWidth: 4,
}
```

`getGroup` 接收 `ImportStatement`，排序回调接收两条对应记录，`groupSeparator` 接收 `Group` 及其索引。导出的 `ImportStatement` 和 `Group` 类型包含 `filepath`、`isExport` 和 `isSideEffect`。包也导出 `PluginConfig` 和回调类型，完整定义见 [src/types.ts](./src/types.ts)。

工厂配置优先于对应的顶层 Prettier 选项。例如，`createPlugin({ sortSideEffect: true })` 优先于外层配置中的 `sortSideEffect: false`。

需要复用配置时，可以在本地 `.mjs` 文件中导出 `createPlugin(...)` 的结果，再将该文件加入 `plugins`。

## 插件组合

通过 `otherPlugins` 组合解析器/打印器插件，不能假定简单排列 `plugins` 就会串联各插件的解析器。该数组接受导入的插件对象，不接受包名字符串。

与 Tailwind CSS 组合时，先安装对应插件：

```bash
pnpm add -D prettier-plugin-tailwindcss
```

```js
import { createPlugin } from "@1adybug/prettier-plugin-sort-imports"
import * as tailwindcss from "prettier-plugin-tailwindcss"

export default {
    semi: false,
    tabWidth: 4,
    plugins: [
        createPlugin({
            otherPlugins: [tailwindcss],
            prettierOptions: {
                tailwindFunctions: ["clsx", "cn"],
            },
        }),
    ],
}
```

导入预处理先执行，再按 `otherPlugins` 的顺序运行组合解析器的预处理；随后执行组合解析器和可用的 AST 转换，再进入打印阶段。`prettierOptions` 会传递给其他解析器，打印器专用选项应写在顶层 Prettier 配置中。`@1adybug/prettier` 提供本仓库的[内置组合](../prettier/README.zh-CN.md)。

组合不会串联执行每个插件的 `parse` 方法，而是选择第一个不带 AST 转换钩子的自定义解析器；没有此类解析器时使用官方解析器，然后执行收集到的 `__transformAST` 钩子。同名打印器定义由 `otherPlugins` 中靠后的插件覆盖，`babel`、`babel-ts` 和 `typescript` 以外的语言解析器不会被合并。

## 导出

- 默认导出：使用默认导入排序配置的插件。
- `createPlugin(config)`：使用工厂配置及可选组合创建插件。
- 类型：用于 Prettier 配置的 `Options`、用于工厂配置的 `PluginConfig`，以及 [src/types.ts](./src/types.ts) 定义的导入/分组记录和回调类型。

## 范围与安全限制

- 收集整个文件中支持的顶层导入和带模块来源的重新导出，包括出现在其他语句之后的声明，并将它们集中到第一条收集到的声明处。
- 支持上面列出的解析器及其常见 `.js`、`.jsx`、`.mjs`、`.cjs`、`.ts`、`.tsx`、`.mts`、`.cts` 文件，不重写 CommonJS `require` 调用或动态导入。
- 文件包含归一化导入模型无法保留的语法时，整份文件的导入重写会被跳过，包括 import attributes/assertions、仅类型的默认/命名空间导入、仅类型星号导出、字符串名称说明符、namespace re-export、空命名导入和不支持的行内导入注释。组合的其他插件仍可继续运行。
- 带装饰器的文件会跳过 `markTypeOnlyImports`，避免影响装饰器元数据。TypeScript namespace、枚举初始化值、参数属性、export assignment 和 import-equals 中的运行时引用仍按值使用处理。
- 存在 JSDoc 类型标签时，会跳过 `removeUnusedImports`，因为当前 AST 分析不能无损解析这些引用。
- 支持的附加注释会随对应声明或命名内容移动。命名空间导入与不兼容的默认导入会保持分离，避免不安全的合并。

## 本仓库开发

在 monorepo 根目录安装依赖。环境要求见[根目录 README](../../README.zh-CN.md#开发)。

```bash
pnpm --filter @1adybug/prettier-plugin-sort-imports run build
pnpm --filter @1adybug/prettier-plugin-sort-imports run check
pnpm --filter @1adybug/prettier-plugin-sort-imports run test
pnpm --filter @1adybug/prettier-plugin-sort-imports run test:watch
pnpm --filter @1adybug/prettier-plugin-sort-imports run dev
```

请在[问题反馈](https://github.com/1adybug/prettier/issues)提交问题，并附上最小输入和期望输出。

## 许可证

MIT
