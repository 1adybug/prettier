# @1adybug/prettier

> **Notice: This project is implemented entirely by AI coding tools.**

[中文文档](./README.zh-CN.md)

An aggregate Prettier plugin combining import sorting, block padding, brace transforms, and Tailwind CSS class sorting.

## Installation

```bash
pnpm add -D prettier @1adybug/prettier
```

Requires Prettier `^3.8.0`. The package exports a plugin, not a Prettier configuration preset that can be re-exported directly.

## Usage

Create `prettier.config.mjs`:

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

This configuration explicitly enables the brace, `node:` prefix, type-only import, and `void` arrow options. The plugin does not automatically set these values or standard Prettier style options such as `semi` and `tabWidth`.

```bash
pnpm exec prettier --write "src/**/*.{js,jsx,ts,tsx}"
```

## Combined Behavior

- Imports are grouped as React (including React DOM and React Native), Node.js built-ins, third-party modules, aliases resolved through the nearest `tsconfig.json`, and relative paths. Alias and relative-path groups are further split by directory, with one blank line between groups. Alias resolution and directory grouping require a `filepath`; the Prettier CLI supplies it when formatting files.
- Side-effect imports retain their relative positions by default. Unused-import removal and automatic type-only import marking are disabled by default.
- Block padding defaults to all rules and one blank line. The five `blockPadding*` options select declaration kinds, scope, boundary mode, blank-line count, and class declaration behavior; `blockPaddingRules: []` disables padding.
- Ordinary single-statement control blocks and explicit-return arrow functions follow the remove-braces plugin's transforms. Nested control statements, multiline statements, and `void` arrows are controlled by their corresponding options.
- Tailwind CSS class sorting runs through the composed plugin. Options such as `tailwindConfig`, `tailwindStylesheet`, and `tailwindFunctions` can be set in the Prettier configuration.

The bundled plugins do not need to be added to `plugins` again. Install the corresponding individual package when only one capability is needed.

The combined parser pipeline supports `babel`, `babel-ts`, and `typescript`, including JSX/TSX handled by those parsers. It does not expose the Tailwind plugin's other language parsers, such as HTML or CSS.

For each plugin's options and limits, see:

- [Import sorting](../prettier-plugin-sort-imports/README.md)
- [Block padding](../prettier-plugin-block-padding/README.md)
- [Brace transforms](../prettier-plugin-remove-braces/README.md)

## Block Padding

The same five options as the [standalone padding plugin](../prettier-plugin-block-padding/README.md#configuration) can be set directly in the Prettier configuration:

| Option                  | Default              | Behavior                                                           |
| ----------------------- | -------------------- | ------------------------------------------------------------------ |
| `blockPaddingRules`     | All nine rules below | Enabled rule array; `[]` disables padding                          |
| `blockPaddingScope`     | `"all"`              | Supported containers, or only `Program` with `"top-level"`         |
| `blockPaddingMode`      | `"around"`           | Either neighboring statement matches, or both with `"between"`     |
| `blockPaddingLines`     | `1`                  | Actual blank lines at matching boundaries; a positive safe integer |
| `blockPaddingClassMode` | `"multiline"`        | Multiline class declarations, or all classes with `"always"`       |

| Rule                         | Matches                                                                                      |
| ---------------------------- | -------------------------------------------------------------------------------------------- |
| `types`                      | Only `type` aliases, including primitive, union, object, and generic aliases                 |
| `interfaces`                 | Interface declarations, including inherited, generic, and empty interfaces                   |
| `enums`                      | Enum declarations, including `const enum`                                                    |
| `classes`                    | Class declarations, including abstract, declare, empty, and anonymous default-export classes |
| `object-array-literals`      | Supported object/array literal statements                                                    |
| `multiline-blocks`           | Supported multiline block statements, excluding class declarations                           |
| `multiline-expressions`      | Supported multiline expressions, including class expressions                                 |
| `multiline-class-members`    | Supported multiline class members                                                            |
| `property-method-boundaries` | Adjacent class property/method boundaries                                                    |

Declaration rules recognize applicable `export`, `export default`, and `declare` forms. Class expressions remain controlled by `multiline-expressions`. The property/method boundary rule works independently of `blockPaddingMode`.

For two blank lines only between consecutive selected top-level declarations:

```js
export default {
    plugins: ["@1adybug/prettier"],
    semi: false,
    tabWidth: 4,
    blockPaddingRules: ["types", "interfaces", "enums", "classes"],
    blockPaddingScope: "top-level",
    blockPaddingMode: "between",
    blockPaddingLines: 2,
    blockPaddingClassMode: "always",
}
```

`blockPaddingClassMode: "always"` includes empty class declarations. Matching boundaries use exactly the requested number of empty lines; unmatched boundaries retain at most one existing blank line. `"top-level"` delegates nested containers to Prettier. Unknown rules, invalid enum values, and invalid blank-line counts are rejected. Disabling padding does not disable import sorting, brace transforms, or Tailwind class sorting.

### With prettier-plugin-merge

The aggregate plugin already combines its bundled transforms. If you use `prettier-plugin-merge` to combine it with additional JS/TS plugins, keep merge last (tested with `0.10.1`):

```bash
pnpm add -D prettier @1adybug/prettier prettier-plugin-merge
```

```js
export default {
    plugins: ["@1adybug/prettier", "prettier-plugin-merge"],
    semi: false,
    tabWidth: 4,
    blockPaddingRules: ["types", "interfaces", "enums", "classes"],
    blockPaddingScope: "top-level",
    blockPaddingMode: "between",
    blockPaddingLines: 2,
    blockPaddingClassMode: "always",
}
```

The bundled import sorting, Tailwind sorting, brace transforms, and padding remain active. See the [padding composition notes](../prettier-plugin-block-padding/README.md#with-prettier-plugin-merge) for the supported parsers and limits.

## Exports

- Default export and named export `plugin`: the composed Prettier plugin.
- `config`: the import-sorting and plugin-composition configuration for `createPlugin`, not a Prettier configuration file object.
- `Options`: the TypeScript type containing standard Prettier options, import-sorting options, padding options, and brace-transform options.

## Customizing the Built-in Groups

The aggregate plugin fixes `getGroup`, `sortGroup`, and `groupSeparator` in its factory configuration. Equivalent top-level Prettier options do not override these values. Use the exported `config` with `createPlugin` to customize them while retaining the bundled plugins:

```js
import { config } from "@1adybug/prettier"
import { createPlugin } from "@1adybug/prettier-plugin-sort-imports"

export default {
    semi: false,
    tabWidth: 4,
    plugins: [createPlugin({ ...config, groupSeparator: "// next group" })],
}
```

This configuration imports the sort-imports package directly, so add it as a direct development dependency alongside `@1adybug/prettier`:

```bash
pnpm add -D @1adybug/prettier-plugin-sort-imports
```

## Development

Install dependencies from the repository root and build the workspace packages first. See the [root README](../../README.md#development) for prerequisites.

```bash
pnpm --filter @1adybug/prettier run build
pnpm --filter @1adybug/prettier run check
pnpm --filter @1adybug/prettier run test
pnpm --filter @1adybug/prettier run dev
```
