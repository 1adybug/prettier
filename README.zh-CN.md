# @1adybug 工具 Monorepo

> **声明：本项目完全由 AI 编码工具实现。**

[English](./README.md)

以 `@1adybug` scope 发布的共享 ESLint 和 Prettier 工具。

## 子包

| 包名                                     | 用途                                                                                            | 文档                                                                                                                             |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `@1adybug/eslint`                        | 面向 JavaScript、TypeScript、React、Expo/React Native、Next.js 和 Node.js 的 ESLint Flat Config | [English](./packages/eslint/README.md) / [中文](./packages/eslint/README.zh-CN.md)                                               |
| `@1adybug/prettier`                      | 组合导入排序、代码块留白、大括号转换和 Tailwind CSS 的聚合 Prettier 插件                        | [English](./packages/prettier/README.md) / [中文](./packages/prettier/README.zh-CN.md)                                           |
| `@1adybug/prettier-plugin-block-padding` | 按代码结构添加空行                                                                              | [English](./packages/prettier-plugin-block-padding/README.md) / [中文](./packages/prettier-plugin-block-padding/README.zh-CN.md) |
| `@1adybug/prettier-plugin-remove-braces` | 大括号与箭头函数简写转换                                                                        | [English](./packages/prettier-plugin-remove-braces/README.md) / [中文](./packages/prettier-plugin-remove-braces/README.zh-CN.md) |
| `@1adybug/prettier-plugin-sort-imports`  | 导入排序与类型导入处理                                                                          | [English](./packages/prettier-plugin-sort-imports/README.md) / [中文](./packages/prettier-plugin-sort-imports/README.zh-CN.md)   |

## 快速开始

使用聚合 Prettier 插件：

```bash
pnpm add -D prettier @1adybug/prettier
```

创建 `prettier.config.mjs`：

```js
export default {
    plugins: ["@1adybug/prettier"],
    semi: false,
    tabWidth: 4,
}
```

`@1adybug/prettier` 导出的是插件，需要注册到 `plugins` 中，不是 Prettier 配置预设。也可以单独安装各子插件。所有 Prettier 包均要求 Prettier `^3.8.0`。

留白配置及与 `prettier-plugin-merge` 的组合方式，见[留白插件配置](./packages/prettier-plugin-block-padding/README.zh-CN.md#配置)和[组合示例](./packages/prettier-plugin-block-padding/README.zh-CN.md#配合-prettier-plugin-merge)。

使用上述配置执行 Prettier：

```bash
pnpm exec prettier --write "src/**/*.{js,jsx,ts,tsx}"
```

ESLint 的配置方式见 [ESLint 子包文档](./packages/eslint/README.zh-CN.md)。

## 文档约定

- 安装开发依赖统一使用 `pnpm add -D`，执行项目中安装的工具使用 `pnpm exec`。
- 仓库脚本使用 `pnpm run`，子包脚本使用 `pnpm --filter <包名> run <脚本>`，开发命令在 monorepo 根目录执行。
- Prettier 主配置示例统一使用 ESM 文件 `prettier.config.mjs`；ESLint 使用 `eslint.config.mjs`。
- Prettier 格式化示例显式设置 `semi: false`、`tabWidth: 4`；具体功能示例再设置相应插件选项，这些值不是插件自动提供的默认风格。

## 开发

需要 Node.js、根目录 `package.json` 声明版本的 pnpm，以及包脚本使用的 `nub` 可执行程序。在仓库根目录执行：

```bash
pnpm install
pnpm run build
pnpm run check
pnpm run test
pnpm run lint
pnpm run dev
```

单独开发某个子包：

```bash
pnpm --filter @1adybug/prettier-plugin-block-padding run build
pnpm --filter @1adybug/prettier-plugin-block-padding run check
pnpm --filter @1adybug/prettier-plugin-block-padding run test
pnpm --filter @1adybug/prettier-plugin-block-padding run dev
```

格式化 README 时，使用 `--embedded-language-formatting off` 保留代码块中的输入/输出示例。

```bash
pnpm exec prettier --write --embedded-language-formatting off "**/README*.md"
```

包版本和变更日志由 Changesets 管理。
