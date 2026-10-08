# @1adybug/eslint

> **声明：本项目完全由 AI 编码工具实现。**

[English](./README.md)

推荐的 ESLint Flat Config，内置 TypeScript、React、Expo/React Native、Next.js、Node.js 常见规则，并支持按目录拆分运行时环境。

## 安装

```bash
pnpm add -D eslint @1adybug/eslint
```

需要 ESLint `^9.39.4`。Expo 项目还需安装与项目 SDK 匹配的 `eslint-config-expo`（本包的可选 peer dependency 要求为 `>=53.0.0`）。

## 快速开始

`eslint.config.mjs`

```js
import config from "@1adybug/eslint"

export default config
```

也可以直接重新导出默认配置：

```js
export { default } from "@1adybug/eslint"
```

使用上述配置执行 ESLint：

```bash
pnpm exec eslint .
```

## 自定义配置

`eslint.config.mjs`

```js
import { defineConfig } from "@1adybug/eslint"

export default defineConfig({
    expo: false,
    next: true,
    react: true,
    node: {
        enabled: true,
        preset: "script",
        version: ">=24.0.0",
    },
})
```

## 参数说明

`defineConfig(params)` 支持以下参数：

- `next`: `boolean | FeatureOptions`
- `react`: `boolean | FeatureOptions`
- `expo`: `boolean | FeatureOptions`
- `node`: `boolean | (FeatureOptions & { preset?: "script" | "module" | "recommended" | "mixed"; version?: string })`
- `target`: `"browser" | "node" | "both"`
- `directories`: `{ web?: string | string[]; node?: string | string[]; mixed?: string | string[] }`
- `ignores`: `string | string[]`
- `rules`: `RulesConfig`

`FeatureOptions`：

- `enabled?: boolean`
- `recommended?: boolean`
- `extends?: string | config | (string | config)[]`
- `rules?: RulesConfig`

`FeatureOptions` 表示上述共享结构，不是导出的类型名称。各功能对应导出的类型为 `NextFeatureOptions`、`ReactFeatureOptions`、`ExpoFeatureOptions` 和 `NodeFeatureOptions`。省略 `enabled` 时继续自动探测，需要显式启用时设置 `enabled: true`。`recommended` 默认为 `true`，设为 `false` 会跳过该功能的推荐预设，但共享基础配置、本包自身的规则以及自定义 `extends`/`rules` 仍可能生效。

`node.preset` 默认为 `"script"`，也可用 `"module"`、`"recommended"` 或 `"mixed"` 选择对应的 Node 预设。运行时全局变量依据最终目录分区设置，不依赖 Node 规则功能是否启用。

## 默认行为（开箱即用）

1. **自动探测依赖**：
   检测到 `next` 时默认启用 Next；检测到 `expo` 时默认启用 Expo；检测到 `react`（或启用 Next/Expo）时默认启用 React。
2. **`target` 默认推断**：
   Next 项目默认 `"both"`；Expo 或 React 项目默认 `"browser"`；其他默认 `"node"`。
3. **Node 默认启用条件**：
   当 `target !== "browser"` 时默认启用 Node 规则。
4. **Node 默认版本**：
   默认按 `>=24.0.0` 处理，可通过 `node.version` 覆盖；当前实现不会自动读取目标项目的 `package.json.engines.node`。
5. 目录默认值
    - Next + both: `web = ["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"]`，`node = ["shared/**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}", "prisma/**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}", "server/**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"]`。
    - browser: `web = ["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"]`。
    - node: `node = ["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"]`。
    - both: `mixed = ["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"]`。
6. **默认忽略目录**：
   `node_modules/**`, `out/**`, `build/**`, `dist/**`, `public/**`。
7. **Next 额外忽略**：
   `.next/**`, `next-env.d.ts`。
8. Expo 默认行为
   自动加载项目安装的 `eslint-config-expo`，保留 Expo 环境规则、Metro 配置和 `.android/.ios/.native/.web` 平台文件解析；启用 `eslint-plugin-react-native` 的全部规则，检查未使用、内联、硬编码颜色、顺序、平台拆分、原始文本和单元素数组等原生样式与渲染问题；允许 Expo 配置文件使用 CommonJS，并为未进入 tsconfig 的常见根级 TypeScript 配置文件提供 project-service 默认项目；同时忽略 `.expo/**`、顶层原生生成目录和嵌套原生构建输出。默认源码范围使用 `**/*`，不依赖 `src` 目录，支持根级 `app/**`、`modules/**` 和平铺源码。
9. 目录冲突保护
   同一个 glob 同时出现在 `web/node/mixed` 会直接报错。
10. TypeScript 默认弃用检查
    TypeScript 文件默认开启 `@typescript-eslint/no-deprecated`，并自动启用 `projectService`；JavaScript 与声明文件不会应用这条规则。
11. 内联对象类型提示
    默认对 `const info: { name: string } = { name: "tom" }`、`function getName({ name }: { name: string }) {}` 这类内联对象类型给出警告，建议先提取为 `type` 或 `interface`。
12. 通用代码风格提示：默认以 warning 提示可保持不变的变量使用 `const`、字符串拼接使用模板字符串、无 `this` 依赖的回调使用箭头函数，并省略可安全省略的箭头函数体大括号。
13. TypeScript 类型声明提示：对象类型声明建议使用 `interface`，类型名称使用 PascalCase；`enum` 会给出警告，建议改为 `as const` 对象和推导类型。
14. React JSX 风格提示：React 项目默认以 warning 提示 Fragment 使用 `<Fragment>` 或 `<React.Fragment>` 的完整形式，并将无子节点的 JSX 元素写成自闭合标签；组件可以根据需要使用函数声明或箭头函数。

## 目录与规则覆盖

省略的 `directories` 字段会保留推断出的默认值，显式传入 `[]` 会清空该字段。如果三个字段均为空，配置会回退到覆盖所有支持文件的 mixed 分区。Next 自动浏览器/Node 分区仅在没有覆盖任何目录字段时生效。自定义时应按预期设置分区模式；冲突检查只拒绝完全相同的 glob 字符串，不会检查不同模式之间的所有可能交集。

顶层 `rules` 会覆盖共享默认规则，随后应用运行时自身的默认规则，再应用功能级 `rules`：浏览器分区依次应用 Next、React、Expo 覆盖；Node 分区应用 Node 覆盖；mixed 分区组合上述规则，并最后应用 Node 覆盖。需要优先于某运行时默认值的配置，应放在对应功能的 `rules` 中。

默认 TypeScript 类型感知规则需要有效的 `tsconfig.json` 覆盖待检查文件。Expo 还会为上文所述的根级配置文件提供默认项目。设置 `rules: { "@typescript-eslint/no-deprecated": "off" }` 可关闭该规则，除非其他适用功能级覆盖重新启用它；但这不会自动关闭 `projectService`，仍需要项目配置。

## 导出

- 默认导出及具名导出 `config`：自动探测生成的 Flat Config。
- `defineConfig(params)`：创建自定义 Flat Config。
- 类型：`DefineConfigParams`、`RuntimeDirectories`、`NodePreset`、`NextFeatureOptions`、`ReactFeatureOptions`、`ExpoFeatureOptions` 和 `NodeFeatureOptions`。
- 运行时入口同时支持 ESM 和 CommonJS。

## 示例

### 1) Expo/React Native 平铺项目

安装与当前 Expo SDK 匹配的 `eslint-config-expo` 后，根目录的 `eslint.config.mjs` 只需：

```js
export { default } from "@1adybug/eslint"
```

该配置会覆盖根级 `app/**`、`modules/**` 和其他 JavaScript/TypeScript 文件，无需保留 `src` 目录。

如果项目使用自定义文本组件，通过 Expo 规则配置精确加入白名单，不要跳过会同时承载图标和文本的容器组件：

```js
import { defineConfig } from "@1adybug/eslint"

export default defineConfig({
    expo: {
        rules: {
            "react-native/no-raw-text": ["error", { skip: ["Button.Label", "Typography.Paragraph"] }],
        },
    },
})
```

### 2) Next 全栈项目（目录分区）

```js
import { defineConfig } from "@1adybug/eslint"

export default defineConfig({
    next: true,
    react: true,
    node: true,
    directories: {
        web: ["apps/web/**/*.{js,mjs,ts,tsx}"],
        node: ["apps/api/**/*.{js,mjs,ts,tsx}"],
        mixed: ["packages/shared/**/*.{js,mjs,ts,tsx}"],
    },
})
```

### 3) 纯 React 项目（关闭 Node 规则）

```js
import { defineConfig } from "@1adybug/eslint"

export default defineConfig({
    react: true,
    node: false,
    target: "browser",
})
```

### 4) 纯 Node 库

```js
import { defineConfig } from "@1adybug/eslint"

export default defineConfig({
    next: false,
    react: false,
    node: {
        enabled: true,
        preset: "module",
        version: ">=24.0.0",
        rules: {
            "n/no-process-exit": "off",
        },
    },
    target: "node",
})
```

## Monorepo 使用

### 1) 根目录统一配置（规则基本一致时）

```js
import { defineConfig } from "@1adybug/eslint"

export default defineConfig({
    next: true,
    react: true,
    node: { enabled: true, preset: "module" },
    directories: {
        web: ["apps/web/**/*.{js,mjs,ts,tsx}", "apps/admin/**/*.{js,mjs,ts,tsx}"],
        node: ["apps/api/**/*.{js,mjs,ts,tsx}", "tools/**/*.{js,mjs,ts,tsx}"],
        mixed: ["packages/**/*.{js,mjs,ts,tsx}"],
    },
    ignores: ["**/dist/**", "**/.turbo/**", "**/coverage/**"],
})
```

注意：

1. 同一个 glob 不能同时出现在 `web/node/mixed`，否则会报错。
2. `next: true` 时，Next 规则会应用到 `web + mixed` 目录。

### 2) 根配置 + 子项目配置（只有部分应用是 Next 时）

建议做法：

1. 根目录配置通用规则，`next: false`。
2. `apps/web` 单独 `eslint.config.mjs` 开启 `next: true`。
3. `apps/api` 单独配置 `node` 规则。

这样可以避免把 Next 规则应用到非 Next 项目。

## 本仓库开发命令

在仓库根目录安装依赖后执行。环境要求见[根目录 README](../../README.zh-CN.md#开发)。

```bash
pnpm --filter @1adybug/eslint run build
pnpm --filter @1adybug/eslint run check
pnpm --filter @1adybug/eslint run test
pnpm --filter @1adybug/eslint run test:types
pnpm --filter @1adybug/eslint run test:coverage
pnpm --filter @1adybug/eslint run dev
```
