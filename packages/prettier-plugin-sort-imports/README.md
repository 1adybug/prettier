# @1adybug/prettier-plugin-sort-imports

> **Notice: This project is implemented entirely by AI coding tools.**

[中文文档](./README.zh-CN.md)

A Prettier plugin for grouping, sorting, and merging JavaScript/TypeScript imports and source-bearing re-exports, with optional unused-import removal and type-only import handling.

## Installation

```bash
pnpm add -D prettier @1adybug/prettier-plugin-sort-imports
```

Requires Prettier `^3.8.0`. Supported parsers: `babel`, `babel-ts`, and `typescript`. The package is ESM.

## Usage

Create `prettier.config.mjs`:

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

`nodeProtocol: "add"` is explicitly enabled in this example; its default is no change.

## Default Sorting

Before:

```ts
import { z, a } from "./z"
import value from "pkg"
import { b } from "@/alias"
console.log(value, a, z, b)
```

After (default plugin options, `semi: false`):

```ts
import value from "pkg"
import { b } from "@/alias"
import { a, z } from "./z"

console.log(value, a, z, b)
```

The default path order is external modules, aliases/absolute paths (`@/`, `~/`, `#/`, `/`), then relative paths. Paths are sorted alphabetically within each category. Named contents are sorted by explicit type markers, then local names (aliases when present). Compatible declarations from the same module are merged; merging separate declarations can retain their merge order rather than re-sort all combined contents.

Default and namespace imports are printed in the positions required by module syntax. A custom `sortImportContent` changes content ordering, not those syntax constraints.

## Options

The following options can be set directly in a Prettier configuration or passed to `createPlugin`:

| Option                | Default     | Behavior                                                       |
| --------------------- | ----------- | -------------------------------------------------------------- |
| `sortSideEffect`      | `false`     | Include side-effect imports in sorting when enabled            |
| `removeUnusedImports` | `false`     | Remove imports unused in the current file                      |
| `markTypeOnlyImports` | `false`     | Mark named imports used only in type positions                 |
| `mergeTypeImports`    | `true`      | Print all-type named contents as `import type` / `export type` |
| `nodeProtocol`        | `undefined` | `"add"` or `"remove"` the `node:` prefix on built-in modules   |
| `groupSeparator`      | `undefined` | Insert a separator when custom groups are used                 |

### Type-only Imports

Before:

```ts
import { User } from "./types"
export type Account = User
```

After (`markTypeOnlyImports: true`, `semi: false`):

```ts
import type { User } from "./types"

export type Account = User
```

With `mergeTypeImports: false`, the import is printed as `import { type User } from "./types"` instead. Marking type-only imports uses the current file's AST, not the TypeScript type checker. It does not convert default imports, namespace imports, side-effect imports, or re-exports. Runtime references remain value imports.

### Unused Imports

`removeUnusedImports: true` analyzes references in the current file, including supported JSX and TypeScript uses. Side-effect imports and re-export statements are preserved. The analysis does not resolve types across files; see the safety limits below.

### Side-effect Imports

By default, side-effect imports act as barriers: ordinary imports are sorted within the sections between them, and are not moved across those barriers.

Input and default output (`semi: false`):

```ts
import "./z.css"
import "./a.css"
```

Output with `sortSideEffect: true`:

```ts
import "./a.css"
import "./z.css"
```

Enabling this option can change module evaluation order.

### Group Separators

Separators apply when `getGroup` is provided. `undefined` adds no separator; `""` adds one blank line between groups. A nonempty string adds a blank line followed by that string, for example `"// external modules"`. A callback receives `(group, index)` and can return a string or `undefined`; it is not called before the first group.

Use `""` for a blank line, rather than `"\n"`.

## Custom Grouping and Sorting

Use `createPlugin` in a JavaScript configuration for callbacks. The factory accepts `getGroup`, `sortGroup`, `sortImportStatement`, `sortImportContent`, and a function-valued `groupSeparator`; these callbacks are not registered as ordinary Prettier options.

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

`getGroup` receives an `ImportStatement`, sorting callbacks receive two corresponding records, and `groupSeparator` receives a `Group` and its index. The exported `ImportStatement` and `Group` types include `filepath`, `isExport`, and `isSideEffect`. `PluginConfig`, these record types, and callback types are exported from the package; see [src/types.ts](./src/types.ts) for their full definitions.

Factory options take precedence over equivalent top-level Prettier options. For example, `createPlugin({ sortSideEffect: true })` takes precedence over `sortSideEffect: false` in the enclosing configuration.

For a reusable configuration, export the result of `createPlugin(...)` from a local `.mjs` file and reference that file in `plugins`.

## Combining Plugins

Use `otherPlugins` to compose parser/printer plugins instead of assuming that a `plugins` array will chain their parsers. The array accepts imported plugin objects, not package-name strings.

For Tailwind CSS:

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

Import preprocessing runs first, followed by composed parser preprocessors in `otherPlugins` order. The composed parser and available AST transforms then run before printing. `prettierOptions` is forwarded to the other parsers; place printer-specific options in the top-level Prettier configuration. The `@1adybug/prettier` package provides the repository's [built-in combination](../prettier/README.md).

Composition does not chain every plugin's `parse` method. It selects the first custom parser without an AST-transform hook, or the official parser when none is available, then runs the collected `__transformAST` hooks. Printer definitions with the same name are replaced by later entries in `otherPlugins`. Additional language parsers outside `babel`, `babel-ts`, and `typescript` are not merged.

Pure parser adapters from the [block-padding plugin](../prettier-plugin-block-padding/README.md) do not replace the composed parsing pipeline; their options and printers remain included. Lazy parser factories resolve once per formatting run, and preprocessing and parsing share the run's composed options. To combine complete formatting passes through `prettier-plugin-merge`, keep merge last; see the [padding example](../prettier-plugin-block-padding/README.md#with-prettier-plugin-merge).

## Exports

- Default export: the plugin with default import-sorting configuration.
- `createPlugin(config)`: creates a plugin with factory options and optional composition.
- Types: `Options` for Prettier configuration, `PluginConfig` for factory configuration, and the import/group records and callback types defined in [src/types.ts](./src/types.ts).

## Scope and Safety Limits

- Collects supported top-level imports and source-bearing re-exports throughout a file, including declarations after other statements, and gathers them at the first collected declaration.
- Supports the parsers listed above and their usual `.js`, `.jsx`, `.mjs`, `.cjs`, `.ts`, `.tsx`, `.mts`, and `.cts` files. Does not rewrite CommonJS `require` calls or dynamic imports.
- If a file contains syntax the normalized import model cannot preserve, import rewriting is skipped for the whole file. This includes import attributes/assertions, type-only default/namespace imports, type-only star exports, string-named specifiers, namespace re-exports, empty named imports, and unsupported inline import comments. Composed plugins can still run.
- `markTypeOnlyImports` is skipped in decorated files because imports can affect decorator metadata. TypeScript namespace, enum initializer, parameter property, export assignment, and import-equals runtime references remain value uses.
- `removeUnusedImports` is skipped when JSDoc type tags are present because the current AST analysis cannot resolve their references losslessly.
- Supported attached comments move with their declarations or named contents. Namespace imports and incompatible default imports remain separate rather than being merged unsafely.

## Development

Install dependencies from the monorepo root. See the [root README](../../README.md#development) for prerequisites.

```bash
pnpm --filter @1adybug/prettier-plugin-sort-imports run build
pnpm --filter @1adybug/prettier-plugin-sort-imports run check
pnpm --filter @1adybug/prettier-plugin-sort-imports run test
pnpm --filter @1adybug/prettier-plugin-sort-imports run test:watch
pnpm --filter @1adybug/prettier-plugin-sort-imports run dev
```

Report issues with a minimal input/output example in the [issue tracker](https://github.com/1adybug/prettier/issues).

## License

MIT
