# Prettier Plugin Sort Imports

[English](https://github.com/1adybug/prettier-plugin-sort-imports/blob/main/README.md)

一个功能强大的 Prettier 插件，用于对 JavaScript/TypeScript 文件的导入语句进行智能分组和排序。

## 特性

- ✅ **智能排序**：支持对导入模块和导入内容进行排序
- ✅ **灵活分组**：自定义分组规则，支持按模块类型、路径等分组
- ✅ **TypeScript 支持**：完整支持 TypeScript 的 `type` 导入
- ✅ **注释保留**：注释会跟随对应的导入语句移动
- ✅ **副作用处理**：可配置副作用导入的排序行为
- ✅ **未使用导入删除**：可选的自动删除未使用的导入功能
- ✅ **工厂函数模式**：支持在配置文件中使用自定义函数

## 快速开始

### 安装

```bash
npm install @1adybug/prettier-plugin-sort-imports --save-dev
```

### 基础配置

在 `prettier.config.mjs` 中添加插件：

```javascript
export default {
    plugins: ["@1adybug/prettier-plugin-sort-imports"],
}
```

### 运行

```bash
npx prettier --write "src/**/*.{js,ts,jsx,tsx}"
```

## 使用示例

### 基本排序

```typescript
import React, { useEffect, useState } from "react"

import { Button } from "antd"

import { sum } from "./utils"

import "./styles.css"
```

### 自定义分组和排序

```javascript
// prettier.config.mjs
import { createPlugin } from "@1adybug/prettier-plugin-sort-imports"

export default {
    plugins: [
        createPlugin({
            // 自定义分组：按模块类型分组
            getGroup: statement => {
                if (statement.path.startsWith("react")) return "react"
                if (!statement.path.startsWith(".")) return "external"
                return "local"
            },
            // 指定分组顺序
            sortGroup: (a, b) => {
                const order = ["react", "external", "local"]

                return order.indexOf(a.name) - order.indexOf(b.name)
            },
            // 在分组之间添加空行
            separator: "",
        }),
    ],
}
```

结果：

```typescript
import React, { useState } from "react"

import { Button } from "antd"
import { format } from "date-fns"

import { Header } from "./components/Header"

import { sum } from "./utils"

import "./styles.css"
```

## API 文档

### 类型定义

#### ImportContent

导入内容的定义：

```typescript
interface ImportContent {
    /** 导入的内容的名称 */
    name: string
    /** 导入的内容的别名 */
    alias?: string
    /** 导入的内容的类型，只有明确在导入前加入了 type 标记的才属于 type 类型 */
    type: "type" | "variable"
}
```

#### ImportStatement

导入语句的定义：

```typescript
interface ImportStatement {
    /** 导入的模块路径，可以是相对路径或绝对路径 */
    path: string
    /** 是否是导出语句，默认为 false */
    isExport: boolean
    /** 是否是副作用导入，默认为 false */
    isSideEffect: boolean
    /** 导入的内容 */
    importContents: ImportContent[]
}
```

#### Group

分组定义：

```typescript
interface Group {
    /** 分组名称，默认为 default */
    name: string
    /** 是否是副作用分组，默认为 false */
    isSideEffect: boolean
    /** 分组对应的导入语句列表 */
    importStatements: ImportStatement[]
}
```

#### PluginConfig

插件配置：

```typescript
interface PluginConfig {
    /** 自定义分组函数 */
    getGroup?: (importStatement: ImportStatement) => string
    /** 自定义分组排序函数 */
    sortGroup?: (a: Group, b: Group) => number
    /** 自定义导入语句排序函数 */
    sortImportStatement?: (a: ImportStatement, b: ImportStatement) => number
    /** 自定义导入内容排序函数 */
    sortImportContent?: (a: ImportContent, b: ImportContent) => number
    /** 分组之间的分隔符 */
    separator?: string | ((group: Group, index: number) => string | undefined)
    /** 是否对副作用导入进行排序，默认为 false */
    sortSideEffect?: boolean
    /** 是否删除未使用的导入，默认为 false */
    removeUnusedImports?: boolean
}
```

## 配置选项

### 方式 1：简单配置

通过 Prettier 配置文件配置基本选项：

```javascript
export default {
    plugins: ["@1adybug/prettier-plugin-sort-imports"],
    importSortSideEffect: false, // 是否对副作用导入排序
    importSortSeparator: "", // 分组分隔符
    importSortRemoveUnused: false, // 是否删除未使用的导入
}
```

### 方式 2：高级配置（工厂函数）

使用 `createPlugin` 函数可以传递自定义函数：

```javascript
import { createPlugin } from "@1adybug/prettier-plugin-sort-imports"

export default {
    plugins: [
        createPlugin({
            getGroup: statement => {
                /* 自定义分组逻辑 */
            },
            sortGroup: (a, b) => {
                /* 自定义排序 */
            },
            sortImportStatement: (a, b) => {
                /* 自定义排序 */
            },
            sortImportContent: (a, b) => {
                /* 自定义排序 */
            },
            separator: "",
            sortSideEffect: true,
            removeUnusedImports: false,
        }),
    ],
}
```

### 方式 3：自定义插件模块

创建自定义插件模块以获得更好的组织性和可复用性：

**步骤 1**：创建自定义插件文件 `prettier-plugin-sort-imports.mjs`：

```javascript
// prettier-plugin-sort-imports.mjs
import { createPlugin } from "@1adybug/prettier-plugin-sort-imports"

export default createPlugin({
    // 自定义分组逻辑
    getGroup: statement => {
        const path = statement.path

        // React 及相关库
        if (path.startsWith("react") || path.startsWith("@react")) {
            return "react"
        }

        // UI 库
        if (path.includes("antd") || path.includes("@mui") || path.includes("chakra")) {
            return "ui"
        }

        // 工具库
        if (path.includes("lodash") || path.includes("ramda") || path.includes("date-fns")) {
            return "utils"
        }

        // 外部包 (node_modules)
        if (!path.startsWith(".") && !path.startsWith("@/")) {
            return "external"
        }

        // 内部别名 (@/)
        if (path.startsWith("@/")) {
            return "internal"
        }

        // 相对导入
        return "relative"
    },

    // 定义分组顺序
    sortGroup: (a, b) => {
        const order = ["react", "external", "ui", "utils", "internal", "relative"]

        return order.indexOf(a.name) - order.indexOf(b.name)
    },

    // 自定义导入内容排序
    sortImportContent: (a, b) => {
        // 类型在前，变量在后
        if (a.type !== b.type) {
            return a.type === "type" ? -1 : 1
        }

        // 同类型内按字母顺序
        const aName = a.alias ?? a.name
        const bName = b.alias ?? b.name
        return aName.localeCompare(bName)
    },

    // 在分组间添加空行
    separator: "\n",

    // 排序副作用导入
    sortSideEffect: true,
})
```

**步骤 2**：在 `prettier.config.mjs` 中使用自定义插件：

```javascript
// prettier.config.mjs
export default {
    plugins: ["./prettier-plugin-sort-imports.mjs"],
    // 其他 prettier 选项...
    semi: false,
    tabWidth: 4,
}
```

**此方法的优点**：

- ✅ **可复用**：在多个项目间共享相同配置
- ✅ **版本控制**：在 git 中跟踪你的导入排序规则
- ✅ **易维护**：将复杂逻辑从 prettier 配置中分离
- ✅ **团队协作**：团队成员间保持一致的导入排序规则

### 方式 4：插件兼容性

使用 `createPlugin` 的 `otherPlugins` 参数与其他 Prettier 插件合并，避免冲突：

```javascript
import { createPlugin } from "@1adybug/prettier-plugin-sort-imports"
import * as tailwindPlugin from "prettier-plugin-tailwindcss"

export default {
    plugins: [
        createPlugin({
            // 你的导入排序配置
            getGroup: statement => {
                if (statement.path.startsWith("react")) return "react"
                if (!statement.path.startsWith(".")) return "external"
                return "local"
            },
            separator: "\n",

            // 要合并的其他 Prettier 插件（仅支持 Plugin 对象）
            otherPlugins: [
                tailwindPlugin, // 直接导入插件
                // 根据需要添加更多插件...
            ],

            // 其他插件的配置选项
            prettierOptions: {
                // TailwindCSS 插件选项
                tailwindConfig: "./tailwind.config.js",
                tailwindFunctions: ["clsx", "cn", "cva"],
                tailwindAttributes: ["class", "className", "ngClass", ":class"],

                // 其他插件选项可以在这里配置...
            },
        }),
    ],
}
```

**重要说明**：

- `otherPlugins` 只接受导入的 Plugin 对象，不支持字符串插件名称
- 你必须自己导入插件以确保正确的模块解析
- 这种方法避免了复杂的模块加载问题，给你完全的控制权

**插件执行顺序**：

- 其他插件按照在 `otherPlugins` 数组中出现的顺序执行
- 导入排序始终最后执行以确保兼容性

**配置传递**：

- `prettierOptions` 中的选项会传递给所有其他插件
- 这允许其他插件即使在合并时也能接收到它们的配置

### importSortRemoveUnused

是否删除未使用的导入，默认为 `false`。

**默认行为（false）**：保留所有导入。

**开启后（true）**：自动分析代码并删除未使用的导入。

```typescript
// 排序前
import React, { useState, useEffect } from "react"
import { Button, Input } from "antd"
import { helper } from "./utils"

function MyComponent() {
    const [count, setCount] = useState(0)
    return <Button>Click me</Button>
}

// 排序后（开启 removeUnusedImports）
import React, { useState } from "react"
import { Button } from "antd"

function MyComponent() {
    const [count, setCount] = useState(0)
    return <Button>Click me</Button>
}
```

**注意事项**：

- 副作用导入（如 `import "./styles.css"`）不会被删除
- 导出语句（如 `export { x } from "module"`）不会被删除
- 分析基于 AST，会识别代码中实际使用的标识符
- 支持识别 JSX 组件、TypeScript 类型引用等

### importSortSideEffect

是否对副作用导入进行排序，默认为 `false`。

**默认行为（false）**：副作用导入作为分隔符，分隔符之间的导入独立排序。

```typescript
import "f-side-effect"
import "f-side-effect"
```

**开启后（true）**：副作用导入也会参与排序。

```typescript
import "f-side-effect"
import "f-side-effect"
```

### separator

分组之间的分隔符，默认为 `undefined`（无分隔符）。

可以是字符串或函数：

```javascript
// 字符串：在所有分组间添加空行
separator: ""

// 函数：灵活控制
separator: (group, index) => {
    // 第一个分组不添加分隔符
    if (index === 0) return undefined

    // 其他分组添加空行
    return ""
}
```

## 默认排序规则

### 导入内容排序

**默认行为**（未提供自定义 `sortImportContent` 时）：

1. 默认导入始终在最前面
2. 命名空间导入（`import * as`）在默认导入之后
3. 命名导入按照 `type` 类型优先，然后按最终导入名称字母顺序排序

```typescript
import Default, * as Namespace from "module"
import { type TypeA, type TypeB, VariableA, VariableB } from "module"
```

**自定义行为**：

如果提供了自定义的 `sortImportContent` 函数，插件会**完全遵循你的排序逻辑**：

```javascript
createPlugin({
    // 完全按字母顺序，不区分 type 和 variable
    sortImportContent: (a, b) => {
        const aName = a.alias ?? a.name
        const bName = b.alias ?? b.name
        return aName.localeCompare(bName)
    },
})
```

```typescript
import { type User, API_KEY, getUser } from "api"
```

### 导入语句排序

导入语句按模块路径的字母顺序排序：

```typescript
import { a } from "a-module"
import { b } from "b-module"
import { c } from "c-module"
```

### 注释处理

注释会跟随它们所附加的导入语句一起移动：

```typescript
// React 相关导入
import React from "react"

// UI 组件
import { Button } from "antd"

// 工具函数
import { sum } from "./utils"
```

## 实现细节

### 核心模块

#### 1. 类型定义 (`src/types.ts`)

定义所有接口类型：ImportContent、ImportStatement、Group、PluginConfig 和各种函数类型。

#### 2. 解析器 (`src/parser.ts`)

使用 `@babel/parser` 解析源代码，提取导入/导出语句：

- 解析源代码为 AST
- 遍历 AST 找到所有 import 和 export 语句
- 识别导入类型：默认导入、命名导入、命名空间导入、副作用导入
- 识别 TypeScript 的 `type` 导入标记
- 提取并保留导入语句上方的注释
- 记录导入语句的位置信息

#### 3. 排序器 (`src/sorter.ts`)

实现分组和排序逻辑：

- 根据 `getGroup` 函数对导入语句进行分组
- 如果 `sortSideEffect` 为 false，将副作用导入作为分隔符处理
- 使用各种排序函数对分组、导入语句、导入内容进行排序
- 支持完全自定义的排序逻辑

#### 4. 格式化器 (`src/formatter.ts`)

将排序后的导入语句转换回代码字符串：

- 根据 `ImportStatement` 生成对应的 import/export 代码
- 处理默认导入、命名导入、命名空间导入的格式
- 处理 `type` 导入的格式
- 根据 `separator` 配置在分组之间插入分隔符
- 保持注释关联

#### 5. 插件入口 (`src/index.ts`)

实现 Prettier 插件标准接口：

- 扩展现有的 babel/typescript 解析器
- 支持工厂函数模式
- 集成解析器、排序器、格式化器
- 只处理文件开头的连续导入语句块

#### 6. 分析器 (`src/analyzer.ts`)

分析代码中使用的标识符并过滤未使用的导入：

- 使用 `@babel/traverse` 遍历 AST
- 收集代码中使用的所有标识符（变量、函数、JSX 组件、类型引用等）
- 过滤导入语句，只保留在代码中使用的导入内容
- 支持识别别名、默认导入、命名空间导入等

### 技术栈

- **构建工具**：rslib
- **解析器**：@babel/parser
- **AST 遍历**：@babel/traverse
- **AST 类型**：@babel/types
- **插件系统**：Prettier 3.x

### 工厂函数模式的优势

Prettier 原生无法接受函数作为配置参数（因为配置需要序列化）。本插件通过工厂函数模式巧妙地解决了这个问题：

```javascript
// 工厂函数在配置文件中被调用，返回一个插件实例
import { createPlugin } from "@1adybug/prettier-plugin-sort-imports"

export default {
    plugins: [
        createPlugin({
            // 可以传递函数！
            getGroup: statement => {
                /* ... */
            },
        }),
    ],
}
```

这样既保持了配置的灵活性，又不违反 Prettier 的配置系统限制。

## 注意事项

1. **只处理文件开头的连续导入/导出语句块**
    - 遇到非导入/导出语句后，后续的导入不会被处理

2. **支持的文件类型**
    - JavaScript：`.js`, `.jsx`, `.mjs`, `.cjs`, `.mjsx`, `.cjsx`
    - TypeScript：`.ts`, `.tsx`, `.mts`, `.cts`, `.mtsx`, `.ctsx`

3. **不支持 CommonJS 的 `require` 语句**
    - 只支持 ES6 模块语法（import/export）

4. **自定义排序函数**
    - 提供自定义 `sortImportContent` 时，插件会完全遵循你的逻辑
    - 不会强制默认导入在前或 type 在前等规则

## 项目状态

✅ **完成并可用**

所有核心功能已实现并通过测试，插件可以正常工作并集成到任何使用 Prettier 的项目中。

### 已验证场景

1. ✅ 基本导入排序（按字母顺序）
2. ✅ 副作用导入作为分隔符
3. ✅ 副作用导入排序（开启选项）
4. ✅ 注释跟随导入语句
5. ✅ TypeScript type 导入优先
6. ✅ 默认导入和命名空间导入位置
7. ✅ 混合导入（默认 + 命名）
8. ✅ 导入内容按 alias 排序
9. ✅ 自定义排序逻辑

## 下一步（可选）

1. 添加单元测试（使用 Jest 或 Vitest）
2. 添加 CI/CD 配置
3. 发布到 npm
4. 添加更多示例
5. 支持更多配置选项（如忽略特定导入）

## License

MIT
