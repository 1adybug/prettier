# @1adybug/prettier-plugin-block-padding

> **声明：本项目完全由 AI 编码工具实现。**

[English](./README.md)

为特定语句和类成员之间插入空行的 Prettier 插件。插件基于 Prettier 的 estree 打印器处理语句容器和分隔，表达式和对象属性内部的格式仍交由 Prettier 负责。

## 主要能力

以下描述默认行为，可通过[配置选项](#配置)调整规则、作用范围和空行数。

- **所有代码块的分组留白**：在文件顶层、函数体、if/for/while、TypeScript 命名空间及类静态初始化块内为特定语句前后插入一个额外空行（即两条换行分隔相邻语句），增强结构分隔。由于 switch case 的语句序列不是块语句，仍交由 Prettier 原生处理。
- **多行表达式块智能识别**：自动识别并为模板字符串、函数表达式、类表达式、JSX 元素等跨多行的表达式块添加空行，提升代码可读性。
- **TypeScript 命名空间支持**：在 `namespace`/`module`（`TSModuleBlock`）内部同样按上述规则处理成员语句，并保证花括号与首末行的换行正确。
- **类成员分隔**：为多行类成员添加空行，并分隔相邻的属性与方法，单行方法也适用。
- **单行检测**：单行块和表达式通常不会触发额外空行；类型声明、对象/数组字面量及属性与方法的分隔规则除外。
- **与官方解析器协作**：复用官方 `babel`、`babel-ts`、`typescript` 解析器，仅覆盖 estree 打印阶段的"语句拼接"，其它格式化交由 Prettier 负责。

## 行为细节

默认配置下，语句容器（`Program`、`BlockStatement`、`TSModuleBlock`、`StaticBlock`）和类主体（`ClassBody`）会在以下情况为相邻语句或成员添加一行空行。规则和空行数可通过[配置](#配置)调整：

### 无条件添加空行（即使单行也添加）

- **TypeScript 类型声明**：`interface`、`type`、`enum`（含 `export` 包裹）
- **对象/数组字面量的顶层出现**：
    - 变量声明的初始化为对象/数组字面量
    - 以字面量为主体的表达式语句

### 多行时才添加空行

- **多行块状语句**：当语句打印结果为多行时（例如 `if`、`for`、`while`、`do/while`、`try/catch/finally`、`switch`、`function`、`TSModuleDeclaration` 等），在其与相邻语句之间增加一个额外空行

- **类声明**：独立的 `classes` 规则默认只为多行类声明留白；`blockPaddingClassMode: "always"` 也包含单行和空类。

- **多行表达式块**：当以下表达式跨多行时，在其与相邻语句之间增加一个额外空行
    - 模板字符串：`` `...` ``
    - 标签模板：``styled`...` ``
    - 箭头函数表达式：`() => {}`
    - 函数表达式：`function() {}`
    - 类表达式：`class {}`
    - 多行函数调用：`fn(...)`
    - 多行 new 表达式：`new Class(...)`
    - JSX 元素：`<div>...</div>`
    - JSX 片段：`<>...</>`

### 严格遵循的约束

- **不在容器边界外生成空行**：不会在文件首行之前或文件末尾之后额外添加空行。但是，如果文件首行或末行的语句符合上述规则（如对象字面量、类型声明、多行块状语句），它仍然会与相邻语句之间添加空行。
- **语句与类成员之间的留白**：插件负责容器花括号与语句/成员之间的分隔；表达式和对象属性内部的格式仍交由 Prettier 处理。函数体等嵌套语句容器也会应用留白规则。
- **单行规则的例外**：类型声明、对象/数组字面量，以及相邻的类属性与方法，即使为单行也可能触发空行。

相邻语句之间以换行分隔。默认配置下，命中规则的边界再增加一条换行，形成一行空行。

## 示例

### 基础示例（顶层）

对象/数组字面量、TS 类型声明、以及多行块状语句会触发额外留白：

```typescript
const a = 1

const b = {
    name: "Tom",
    age: 18,
}

if (a) {
    const d = 1
}

interface User {
    name: string
}

const c = [1, 2, 3]
```

### 函数体内部示例

插件同样在函数体、if/for/while 等所有代码块内部生效：

```typescript
function foo() {
    const a = 1

    const b = {
        name: "Tom",
        age: 18,
    }

    if (a) {
        const x = 1

        const y = {
            name: "Jerry",
            age: 20,
        }
    }

    const c = [1, 2, 3]
}
```

### 多行表达式块示例

模板字符串、函数表达式等跨多行时也会添加空行：

```typescript
const a = 1

const template = `
    hello, world!
    this is a multiline template
`

const fn = () => {
    console.log("test")
}

const b = 2

const styled = css`
    color: red;
    font-size: 14px;
`

const c = 3
```

### 单行不触发空行

单行的模板字符串、函数表达式等不会添加空行：

```typescript
const singleTemplate = `hello`
const singleFn = () => console.log("test")
const d = 4
```

注意：单行对象/数组字面量仍然会添加空行（无条件规则）：

```typescript
const a = 1

const singleObj = { a: 1 }

const b = 2
```

## 安装

```bash
pnpm add -D prettier @1adybug/prettier-plugin-block-padding
```

## 使用

创建 `prettier.config.mjs`（自定义组合中，建议将此插件放在其他 estree 打印器之后）：

```js
export default {
    plugins: ["@1adybug/prettier-plugin-block-padding"],
    semi: false,
    tabWidth: 4,
}
```

## 兼容性

- **Prettier**：`^3.8.0`，即 3.x 中的 3.8 及以上版本
- **解析器**：`babel`、`babel-ts`、`typescript`
- **模块**：ESM

## 配置

所有选项都可用于 JavaScript/JSON 配置和 Prettier 原生 CLI 参数，默认值保持原有格式化行为。

| 选项                    | 默认值           | 取值与行为                                                      |
| ----------------------- | ---------------- | --------------------------------------------------------------- |
| `blockPaddingRules`     | 下表全部九类规则 | 启用规则的数组；`[]` 关闭留白，将打印和注释处理交还 Prettier    |
| `blockPaddingScope`     | `"all"`          | `"all"` 处理支持的容器；`"top-level"` 只处理文件的 `Program`    |
| `blockPaddingMode`      | `"around"`       | `"around"` 要求任意一侧语句符合规则；`"between"` 要求双方都符合 |
| `blockPaddingLines`     | `1`              | 匹配边界实际输出的空行数，必须为正的安全整数                    |
| `blockPaddingClassMode` | `"multiline"`    | `"multiline"` 沿用强制换行检测；`"always"` 也包含单行和空类声明 |

### 规则名称

| 规则                         | 匹配范围                                                       |
| ---------------------------- | -------------------------------------------------------------- |
| `types`                      | 仅 `type` 类型别名，包括基础类型、联合类型、对象类型和泛型别名 |
| `interfaces`                 | 接口声明，包括继承、泛型和空接口                               |
| `enums`                      | 枚举声明，包括 `const enum`                                    |
| `classes`                    | 类声明，包括 abstract、declare、空类和匿名默认导出类           |
| `object-array-literals`      | 初始化值或语句主体为支持的对象/数组字面量                      |
| `multiline-blocks`           | 支持的多行块语句，排除类声明                                   |
| `multiline-expressions`      | 支持的多行表达式，包括类表达式                                 |
| `multiline-class-members`    | 支持的多行类成员                                               |
| `property-method-boundaries` | 相邻类属性与方法的边界，空方法也适用                           |

声明规则识别适用的 `export`、`export default` 和 `declare` 形式。`types` 不是接口、枚举和类的聚合规则。`const C = class {}` 等类表达式仍由 `multiline-expressions` 控制，`blockPaddingClassMode` 只影响类声明。规则顺序和重复项不影响结果。

### 顶层声明之间留两行空行

创建 `prettier.config.mjs`：

```js
export default {
    plugins: ["@1adybug/prettier-plugin-block-padding"],
    semi: false,
    tabWidth: 4,
    blockPaddingRules: ["types", "interfaces", "enums", "classes"],
    blockPaddingScope: "top-level",
    blockPaddingMode: "between",
    blockPaddingLines: 2,
    blockPaddingClassMode: "always",
}
```

只有连续且符合白名单的声明之间留两行空行，不同的已选声明种类也可以相互匹配。`"top-level"` 范围内，函数体、命名空间、静态块和类主体均使用 Prettier 原生格式。

例如，以下输出在声明之间包含**两行实际空行**：

<!-- prettier-ignore -->
```ts
type UserId = string


interface User {
    id: UserId
}


class Service {}
```

匹配边界恰好输出 `blockPaddingLines` 行空行，`2` 对应三个换行符。未匹配的边界最多保留一行原有空行。`property-method-boundaries` 直接匹配属性/方法组合，不受 `blockPaddingMode` 影响；两类成员规则都仅用于类主体。空的 `blockPaddingRules` 数组关闭本插件留白，组合的其他插件仍可运行。

未知规则、非法枚举值以及零、负数、小数或超出安全整数范围的空行数会被拒绝。

## 插件组合

需要组合其他 `@1adybug` 插件与 Tailwind CSS 时，使用已集成的 [@1adybug/prettier](../prettier/README.zh-CN.md)。第三方解析器/打印器组合（包括 `@ianvs/prettier-plugin-sort-imports`）不在该集成验证范围内，需要单独验证。

## 作用范围与限制

- 默认在支持的容器（包括文件顶层、函数体、if/for/while 等语句块、TS 命名空间块）内的"语句之间"插入额外空行。
- 支持的表达式块类型：模板字符串、标签模板（如 styled-components）、箭头函数、函数表达式、类表达式、多行函数调用、new 表达式、JSX 元素和片段。
- 表达式和对象属性内部的格式交由 Prettier 处理；插件负责语句容器与类成员分隔。
- 多行检测依据 Prettier 文档结构中的强制换行；仅由 `printWidth` 引起的换行不一定触发留白。
- 遇到指令序言（例如函数体内的 `"use strict"`）时，会将该语句容器交回 Prettier，仅跳过该容器内的留白处理，避免丢失指令。
- 含悬挂注释的文件顶层容器和带注释的空块也会交由 Prettier 处理，这些容器可能跳过自动留白以保留语法与注释。
- 不会擅自在文件/块的首尾位置添加多余空行。
- 单行语句通常不会触发空行；类型声明、对象/数组字面量及属性与方法的分隔规则除外。`blockPaddingClassMode` 为 `"always"` 时，单行类声明也符合规则。

## 导出

- 默认导出：Prettier 打印器插件及其注册的选项。
- `BlockPaddingRule`：支持的规则名称联合类型。
- `Options`：包含五个留白选项的扩展 Prettier 选项类型。

## 本地快速体验

```bash
pnpm exec prettier --write "src/**/*.{js,jsx,ts,tsx}"
```

本仓库开发时，在 monorepo 根目录安装依赖、构建工作区子包后，使用以下脚本。环境要求见[根目录 README](../../README.zh-CN.md#开发)：

```bash
pnpm --filter @1adybug/prettier-plugin-block-padding run build
pnpm --filter @1adybug/prettier-plugin-block-padding run check
pnpm --filter @1adybug/prettier-plugin-block-padding run test
pnpm --filter @1adybug/prettier-plugin-block-padding run test:quick
pnpm --filter @1adybug/prettier-plugin-block-padding run dev
```

---

如果遇到与预期不一致的留白行为，欢迎在[问题反馈](https://github.com/1adybug/prettier/issues)提交最小可复现示例。
