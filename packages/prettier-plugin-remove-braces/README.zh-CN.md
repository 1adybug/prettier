# @1adybug/prettier-plugin-remove-braces

> **声明：本项目完全由 AI 编码工具实现。**

[English](./README.md)

将安全的单语句块和箭头函数显式返回体转换为简写形式的 Prettier 插件。嵌套控制语句、多行语句及 `void` 箭头函数分别由独立选项控制。

## 安装

```bash
pnpm add -D prettier @1adybug/prettier-plugin-remove-braces
```

需要 Prettier `^3.8.0`，支持 `babel`、`babel-ts` 和 `typescript` 解析器。该包为 ESM。

## 使用

创建 `prettier.config.mjs`：

```js
export default {
    plugins: ["@1adybug/prettier-plugin-remove-braces"],
    semi: false,
    tabWidth: 4,
    arrowFunctionVoid: true,
    controlStatementBraces: "remove",
    multiLineBraces: "remove",
}
```

也可以使用 `.prettierrc.json`：

```json
{
    "plugins": [
        "@1adybug/prettier-plugin-remove-braces"
    ],
    "semi": false,
    "arrowFunctionVoid": true,
    "controlStatementBraces": "remove",
    "multiLineBraces": "remove",
    "tabWidth": 4
}
```

```bash
pnpm exec prettier --write "src/**/*.{js,jsx,ts,tsx}"
```

## 默认行为

下方格式化示例使用 `semi: false` 和 `tabWidth: 4`。

不设置自定义选项时，插件会移除普通单行语句外围可安全移除的大括号，并将只含一条显式 `return` 的箭头函数转换为简写形式。两个大括号选项的 `"default"` 只针对嵌套控制语句和多行语句，并不会关闭普通大括号移除。

格式化前：

```js
const add = (a, b) => { return a + b }
const getObject = () => { return { key: "value" } }
if (condition) { doSomething() } else { doSomethingElse() }
for (let i = 0; i < 10; i++) { console.log(i) }
while (running) { execute() }
```

格式化后（`semi: false`）：

```js
const add = (a, b) => a + b
const getObject = () => ({ key: "value" })
if (condition) doSomething()
else doSomethingElse()
for (let i = 0; i < 10; i++) console.log(i)
while (running) execute()
```

## 选项

| 选项                     | 默认值      | 作用范围                              |
| ------------------------ | ----------- | ------------------------------------- |
| `arrowFunctionVoid`      | `false`     | 只含一条表达式语句的箭头函数块体      |
| `controlStatementBraces` | `"default"` | `if` 分支或循环体中单独嵌套的控制语句 |
| `multiLineBraces`        | `"default"` | `if` 分支或循环体中的单条多行语句     |

### `arrowFunctionVoid`

设为 `true` 时，将单条表达式语句转换为简写的 `void` 函数体，保持原函数返回 `undefined` 的语义。此选项不控制原有的显式返回转换。

格式化前：

```js
const run = () => { doSomething() }
const assign = () => { value = getValue() }
```

格式化后（`arrowFunctionVoid: true`、`semi: false`）：

```js
const run = () => void doSomething()
const assign = () => void (value = getValue())
```

包含注释、指令、多条语句或非表达式语句的块体会被保留。

### `controlStatementBraces`

此选项针对**块内的单条语句本身也是控制语句**的情况，例如另一个 `if`、循环、`try` 或 `switch`，不是为所有 `if` 或循环统一添加大括号的开关。

- `"default"`：保留原文中包裹该嵌套控制语句的外层大括号状态。
- `"remove"`：安全时移除外层大括号。
- `"add"`：为没有外层大括号的嵌套控制语句添加包裹块。

格式化前：

```js
if (condition) {
    while (running) execute()
}
```

格式化后（`controlStatementBraces: "remove"`、`semi: false`）：

```js
if (condition) while (running) execute()
```

将 `controlStatementBraces` 设为 `"add"` 后，无外层大括号的示例会转换为上面的有大括号形式。`try`、`catch`、`finally` 和函数语法本身要求的大括号仍会保留。

`"remove"` 模式也会展开其他只含单条控制语句、且大括号不是语法必需的块，例如 `{ while (running) execute() }`。`"add"` 模式会保留 `else if` 链式结构，不会将它改为 `else { if (...) ... }`。

### `multiLineBraces`

- `"default"`：保留多行语句外围原有的大括号状态。
- `"remove"`：安全时移除这些大括号。
- `"add"`：为没有大括号的多行语句添加大括号。

格式化前：

```js
if (condition) {
    doSomething({
        a: 1,
        b: 2,
    })
}
```

格式化后（`multiLineBraces: "remove"`、`semi: false`、`tabWidth: 4`）：

```js
if (condition)
    doSomething({
        a: 1,
        b: 2,
    })
```

将 `multiLineBraces` 设为 `"add"` 后，无大括号的示例会转换为上面的有大括号形式。插件检查源码行跨度，并结合 `printWidth` 预测支持的宽度换行。嵌套控制语句优先按 `controlStatementBraces` 处理，再考虑多行规则。

## 安全规则

多条语句、块级声明（`let`、`const`、TypeScript 声明、函数和类）、注释、指令，以及可能改变 `else` 绑定的情况会阻止大括号移除。函数体及 `try`/`catch`/`finally` 块保留语法必需的大括号。

即使将大括号选项设为 `"remove"`，这些规则也仍然适用。目前没有关闭普通单语句与显式返回转换的选项。

## 导出

- 默认导出及具名导出 `plugin`：Prettier 插件。
- `transformAST`：插件使用的 AST 转换辅助函数。
- 类型：用于 Prettier 配置的 `Options`、用于解析器集成的 `PluginOptions`，以及用于 AST 辅助函数的 `TransformASTOptions`。

## 插件组合

需要同时使用导入排序、代码块留白、大括号转换和 Tailwind CSS 时，使用 [@1adybug/prettier](../prettier/README.zh-CN.md)。自定义组合可使用导入排序插件的 [`createPlugin({ otherPlugins })`](../prettier-plugin-sort-imports/README.zh-CN.md#插件组合) API。

## 本仓库开发

在 monorepo 根目录安装依赖。环境要求见[根目录 README](../../README.zh-CN.md#开发)。

```bash
pnpm --filter @1adybug/prettier-plugin-remove-braces run build
pnpm --filter @1adybug/prettier-plugin-remove-braces run check
pnpm --filter @1adybug/prettier-plugin-remove-braces run test
pnpm --filter @1adybug/prettier-plugin-remove-braces run dev
```

请在[问题反馈](https://github.com/1adybug/prettier/issues)提交问题，并附上最小输入和期望输出。

## 许可证

MIT
