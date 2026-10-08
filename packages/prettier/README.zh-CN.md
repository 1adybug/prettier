# @1adybug/prettier

> **声明：本项目完全由 AI 编码工具实现。**

[English](./README.md)

聚合 Prettier 插件，组合导入排序、代码块留白、大括号转换和 Tailwind CSS 类名排序。

## 安装

```bash
pnpm add -D prettier @1adybug/prettier
```

需要 Prettier `^3.8.0`。该包导出的是插件，不是可直接重新导出的 Prettier 配置预设。

## 使用

创建 `prettier.config.mjs`：

```js
export default {
    plugins: ["@1adybug/prettier"],
    semi: false,
    tabWidth: 4,
    arrowParens: "avoid",
    controlStatementBraces: "add",
    multiLineBraces: "add",
    nodeProtocol: "add",
    markTypeOnlyImports: true,
    arrowFunctionVoid: true,
}
```

上述配置显式开启大括号、`node:` 前缀、类型导入和 `void` 箭头函数选项；插件本身不会自动设置这些值，也不会自动设置 `semi`、`tabWidth` 等 Prettier 风格选项。

```bash
pnpm exec prettier --write "src/**/*.{js,jsx,ts,tsx}"
```

## 组合行为

- 导入按 React（包括 React DOM 和 React Native）、Node.js 内置模块、第三方模块、可通过最近的 `tsconfig.json` 解析的路径别名、相对路径分组；别名与相对路径分组再按目录细分，分组之间留一行空行。别名解析和目录分组需要 `filepath`，Prettier CLI 在格式化文件时会提供该值。
- 副作用导入默认保留其相对位置；删除未使用导入和自动标记类型导入默认关闭。
- 代码块留白默认生效，最多保留一行空行，目前没有独立规则开关或仅处理文件顶层的选项。
- 普通单语句控制块和显式 `return` 箭头函数按移除大括号插件的规则转换；嵌套控制语句、多行语句和 `void` 箭头函数由对应选项控制。
- Tailwind CSS 类名排序通过组合插件运行；可在 Prettier 配置中传入 `tailwindConfig`、`tailwindStylesheet`、`tailwindFunctions` 等 Tailwind 插件选项。

无需再将这些内置插件重复添加到 `plugins` 数组。需要单独使用某项能力时，安装对应子包。

组合解析器管线支持 `babel`、`babel-ts` 和 `typescript`，包括这些解析器处理的 JSX/TSX，不会额外暴露 Tailwind 插件的 HTML、CSS 等其他语言解析器。

各插件的选项和限制见：

- [导入排序](../prettier-plugin-sort-imports/README.zh-CN.md)
- [代码块留白](../prettier-plugin-brace-padding/README.zh-CN.md)
- [大括号转换](../prettier-plugin-remove-braces/README.zh-CN.md)

## 导出

- 默认导出及具名导出 `plugin`：组合后的 Prettier 插件。
- `config`：用于 `createPlugin` 的导入排序与插件组合配置，不是 Prettier 配置文件对象。
- `Options`：包含标准 Prettier 选项、导入排序选项和大括号转换选项的 TypeScript 类型。

## 自定义内置分组

聚合插件在工厂配置中固定了 `getGroup`、`sortGroup` 和 `groupSeparator`，对应的顶层 Prettier 选项不会覆盖它们。需要自定义时，将导出的 `config` 传入 `createPlugin`，保留内置插件并修改分组配置：

```js
import { config } from "@1adybug/prettier"
import { createPlugin } from "@1adybug/prettier-plugin-sort-imports"

export default {
    semi: false,
    tabWidth: 4,
    plugins: [createPlugin({ ...config, groupSeparator: "// next group" })],
}
```

该配置直接导入了导入排序包，需要在 `@1adybug/prettier` 之外将它声明为直接开发依赖：

```bash
pnpm add -D @1adybug/prettier-plugin-sort-imports
```

## 本仓库开发

在仓库根目录安装依赖，并先构建工作区子包。开发环境要求见[根目录 README](../../README.zh-CN.md#开发)。

```bash
pnpm --filter @1adybug/prettier run build
pnpm --filter @1adybug/prettier run check
pnpm --filter @1adybug/prettier run test
pnpm --filter @1adybug/prettier run dev
```
