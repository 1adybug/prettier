# @1adybug/eslint

> **Notice: This project is implemented entirely by AI coding tools.**

[中文文档](./README.zh-CN.md)

A recommended ESLint Flat Config with common TypeScript, React, Expo/React Native, Next.js, and Node.js rules, supporting runtime environments split by directory.

## Installation

```bash
pnpm add -D eslint @1adybug/eslint
```

Requires ESLint `^9.39.4`. Expo projects also need an `eslint-config-expo` version matching their SDK; the optional peer dependency requires `>=53.0.0`.

## Quick Start

Create `eslint.config.mjs`:

```js
import config from "@1adybug/eslint"

export default config
```

Or re-export the default configuration directly:

```js
export { default } from "@1adybug/eslint"
```

Run ESLint with the configuration above:

```bash
pnpm exec eslint .
```

## Custom Configuration

In `eslint.config.mjs`:

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

## Parameters

`defineConfig(params)` accepts:

- `next`: `boolean | FeatureOptions`
- `react`: `boolean | FeatureOptions`
- `expo`: `boolean | FeatureOptions`
- `node`: `boolean | (FeatureOptions & { preset?: "script" | "module" | "recommended" | "mixed"; version?: string })`
- `target`: `"browser" | "node" | "both"`
- `directories`: `{ web?: string | string[]; node?: string | string[]; mixed?: string | string[] }`
- `ignores`: `string | string[]`
- `rules`: `RulesConfig`

`FeatureOptions`:

- `enabled?: boolean`
- `recommended?: boolean`
- `extends?: string | config | (string | config)[]`
- `rules?: RulesConfig`

`FeatureOptions` describes the shared shape above, not an exported type name. The package exports `NextFeatureOptions`, `ReactFeatureOptions`, `ExpoFeatureOptions`, and `NodeFeatureOptions` for the respective features. Omitting `enabled` keeps automatic detection; set `enabled: true` to enable a feature explicitly. `recommended` defaults to `true`. Setting it to `false` skips that feature's recommended presets, while the shared base configuration, package-specific rules, and custom `extends`/`rules` can still apply.

`node.preset` defaults to `"script"`; `"module"`, `"recommended"`, and `"mixed"` select the corresponding Node presets. Runtime globals follow the resolved directory scopes independently of whether the Node rule feature is enabled.

## Default Behavior

1. **Dependency detection**:
   Next is enabled when `next` is detected; Expo is enabled when `expo` is detected; React is enabled when `react` is detected or Next/Expo is enabled.
2. **Default `target`**:
   Next projects use `"both"`; Expo or React projects use `"browser"`; other projects use `"node"`.
3. **Default Node enablement**:
   Node rules are enabled when `target !== "browser"`.
4. **Default Node version**:
   Defaults to `>=24.0.0`, overridable with `node.version`. The implementation does not automatically read the project's `package.json.engines.node`.
5. Default directories
    - Next + both: `web = ["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"]`; `node = ["shared/**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}", "prisma/**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}", "server/**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"]`.
    - browser: `web = ["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"]`.
    - node: `node = ["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"]`.
    - both: `mixed = ["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"]`.
6. **Default ignored directories**:
   `node_modules/**`, `out/**`, `build/**`, `dist/**`, `public/**`.
7. **Additional Next ignores**:
   `.next/**`, `next-env.d.ts`.
8. **Expo behavior**:
   Loads the project's installed `eslint-config-expo`, retaining Expo environment rules, Metro configuration, and `.android/.ios/.native/.web` platform resolution. Enables all `eslint-plugin-react-native` rules to check unused and inline styles, literal colors, style ordering, platform separation, raw text, and single-element style arrays. Allows CommonJS in Expo configuration files and provides project-service default projects for common root-level TypeScript configuration files outside the tsconfig. Ignores `.expo/**`, top-level generated native directories, and nested native build outputs. Source patterns use `**/*`, supporting root-level `app/**`, `modules/**`, and flat source layouts without requiring `src`.
9. **Directory conflict protection**:
   A glob appearing in more than one of `web/node/mixed` causes an error.
10. **TypeScript deprecation checks**:
    Enables `@typescript-eslint/no-deprecated` and `projectService` for TypeScript files by default. This rule does not apply to JavaScript or declaration files.
11. **Inline object types**:
    Warns on inline object types such as `const info: { name: string } = { name: "tom" }` and `function getName({ name }: { name: string }) {}`, suggesting extraction to a `type` or `interface`.
12. General style warnings: prefer `const` for variables that do not change, template literals for string concatenation, arrow callbacks without a `this` dependency, and concise arrow bodies when safe.
13. TypeScript declaration warnings: prefer `interface` for object types and PascalCase for type names. Warns on `enum`, suggesting an `as const` object with an inferred type.
14. React JSX style warnings: prefer full `<Fragment>` or `<React.Fragment>` syntax and self-closing JSX elements without children. Components can use either function declarations or arrow functions.

## Directory and Rule Overrides

Omitted `directories` fields retain the inferred defaults; an explicit `[]` clears that field. If all three fields are empty, the configuration falls back to a mixed scope covering all supported files. The automatic Next browser/Node split applies only when no directory fields are overridden. When providing custom scopes, choose patterns for the intended separation: the conflict check rejects identical glob strings, not every possible overlap between different patterns.

Global `rules` override shared default rules. Runtime-specific defaults are applied afterward, followed by feature-level `rules`: browser scopes use Next, React, then Expo overrides; Node scopes use Node overrides; mixed scopes combine those and apply Node overrides last. Put a runtime-specific override in that feature's `rules` when it must take precedence.

The default type-aware TypeScript rule requires a usable `tsconfig.json` covering the files being linted. Expo additionally permits the documented root-level configuration files through its default project. Setting `rules: { "@typescript-eslint/no-deprecated": "off" }` disables the rule unless an applicable feature override enables it again, but does not automatically disable `projectService`; the project configuration is still required.

## Exports

- Default export and named export `config`: the automatically detected flat configuration.
- `defineConfig(params)`: creates a custom flat configuration.
- Types: `DefineConfigParams`, `RuntimeDirectories`, `NodePreset`, `NextFeatureOptions`, `ReactFeatureOptions`, `ExpoFeatureOptions`, and `NodeFeatureOptions`.
- Runtime entries are available as ESM and CommonJS.

## Examples

### 1) Flat Expo/React Native Project

After installing an `eslint-config-expo` version matching the Expo SDK, the root `eslint.config.mjs` only needs:

```js
export { default } from "@1adybug/eslint"
```

The configuration covers root-level `app/**`, `modules/**`, and other JavaScript/TypeScript files without requiring a `src` directory.

For custom text components, add precise entries to the Expo rule's allowlist rather than skipping containers that can contain both icons and text:

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

### 2) Full-stack Next Project with Directory Scopes

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

### 3) React-only Project with Node Rules Disabled

```js
import { defineConfig } from "@1adybug/eslint"

export default defineConfig({
    react: true,
    node: false,
    target: "browser",
})
```

### 4) Node-only Library

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

## Monorepo Usage

### 1) Shared Root Configuration for Similar Rules

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

Notes:

1. The same glob must not appear in more than one of `web/node/mixed`.
2. With `next: true`, Next rules apply to `web + mixed` directories.

### 2) Root and Per-project Configurations When Only Some Apps Use Next

Recommended setup:

1. Configure common rules at the root with `next: false`.
2. Enable `next: true` in a separate `apps/web/eslint.config.mjs`.
3. Configure Node rules separately in `apps/api`.

This keeps Next rules scoped to Next projects.

## Development

Install dependencies from the repository root first. See the [root README](../../README.md#development) for prerequisites.

```bash
pnpm --filter @1adybug/eslint run build
pnpm --filter @1adybug/eslint run check
pnpm --filter @1adybug/eslint run test
pnpm --filter @1adybug/eslint run test:types
pnpm --filter @1adybug/eslint run test:coverage
pnpm --filter @1adybug/eslint run dev
```
