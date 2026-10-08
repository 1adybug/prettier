# @1adybug/prettier-plugin-remove-braces

> **Notice: This project is implemented entirely by AI coding tools.**

[中文文档](./README.zh-CN.md)

A Prettier plugin for converting safe single-statement blocks and arrow function return bodies into concise forms. Nested control statements, multiline statements, and `void` arrow functions have separate options.

## Installation

```bash
pnpm add -D prettier @1adybug/prettier-plugin-remove-braces
```

Requires Prettier `^3.8.0`. Supported parsers: `babel`, `babel-ts`, and `typescript`. The package is ESM.

## Usage

Create `prettier.config.mjs`:

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

Or use `.prettierrc.json`:

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

## Default Behavior

The formatting examples below use `semi: false` and `tabWidth: 4`.

Without custom options, the plugin removes safe braces around ordinary single-line statements and converts arrow bodies containing a single explicit `return`. The two `"default"` brace options apply only to nested control statements and multiline statements; they do not disable ordinary brace removal.

Before:

```js
const add = (a, b) => { return a + b }
const getObject = () => { return { key: "value" } }
if (condition) { doSomething() } else { doSomethingElse() }
for (let i = 0; i < 10; i++) { console.log(i) }
while (running) { execute() }
```

After (`semi: false`):

```js
const add = (a, b) => a + b
const getObject = () => ({ key: "value" })
if (condition) doSomething()
else doSomethingElse()
for (let i = 0; i < 10; i++) console.log(i)
while (running) execute()
```

## Options

| Option                   | Default     | Scope                                                                |
| ------------------------ | ----------- | -------------------------------------------------------------------- |
| `arrowFunctionVoid`      | `false`     | Arrow block bodies containing one expression statement               |
| `controlStatementBraces` | `"default"` | A single nested control statement inside an `if` branch or loop body |
| `multiLineBraces`        | `"default"` | A single multiline statement inside an `if` branch or loop body      |

### `arrowFunctionVoid`

When `true`, converts a single expression statement into a concise `void` body, retaining the original `undefined` return value. This option does not control the existing explicit-return conversion.

Before:

```js
const run = () => { doSomething() }
const assign = () => { value = getValue() }
```

After (`arrowFunctionVoid: true`, `semi: false`):

```js
const run = () => void doSomething()
const assign = () => void (value = getValue())
```

Bodies with comments, directives, multiple statements, or non-expression statements are preserved.

### `controlStatementBraces`

This option applies when the **contained statement** is a control statement, such as another `if`, loop, `try`, or `switch`. It is not an option to add braces around every `if` or loop.

- `"default"`: preserve the outer braces as written.
- `"remove"`: remove the outer braces when safe.
- `"add"`: wrap an unbraced nested control statement.

Before:

```js
if (condition) {
    while (running) execute()
}
```

After (`controlStatementBraces: "remove"`, `semi: false`):

```js
if (condition) while (running) execute()
```

With `controlStatementBraces: "add"`, formatting the unbraced example produces the braced form above. Braces required by `try`, `catch`, `finally`, and function syntax remain intact.

The `"remove"` mode also unwraps other optional blocks containing one control statement, such as `{ while (running) execute() }`. The `"add"` mode preserves `else if` chains rather than turning them into `else { if (...) ... }` blocks.

### `multiLineBraces`

- `"default"`: preserve braces around a multiline statement as written.
- `"remove"`: remove those braces when safe.
- `"add"`: add braces around an unbraced multiline statement.

Before:

```js
if (condition) {
    doSomething({
        a: 1,
        b: 2,
    })
}
```

After (`multiLineBraces: "remove"`, `semi: false`, `tabWidth: 4`):

```js
if (condition)
    doSomething({
        a: 1,
        b: 2,
    })
```

With `multiLineBraces: "add"`, formatting the unbraced example produces the braced form above. The plugin checks source line spans and predicts supported width-based wrapping using `printWidth`. A nested control statement follows `controlStatementBraces` before the multiline rule.

## Safety Rules

Brace removal is skipped for multiple statements, block-scoped declarations (`let`, `const`, TypeScript declarations, functions, and classes), comments, directives, and transformations that could change an `else` binding. Function bodies and `try`/`catch`/`finally` blocks retain syntactically required braces.

These rules apply even when either brace option is `"remove"`. The plugin does not support an option to disable its ordinary single-statement and explicit-return transforms.

## Exports

- Default export and named export `plugin`: the Prettier plugin.
- `transformAST`: the AST transformation helper used by the plugin.
- Types: `Options` for Prettier configuration, `PluginOptions` for parser integration, and `TransformASTOptions` for the AST helper.

## Combining Plugins

For import sorting, block padding, brace transforms, and Tailwind CSS together, use [@1adybug/prettier](../prettier/README.md). For a custom combination, use the sort-imports plugin's [`createPlugin({ otherPlugins })`](../prettier-plugin-sort-imports/README.md#combining-plugins) API.

## Development

Install dependencies from the monorepo root. See the [root README](../../README.md#development) for prerequisites.

```bash
pnpm --filter @1adybug/prettier-plugin-remove-braces run build
pnpm --filter @1adybug/prettier-plugin-remove-braces run check
pnpm --filter @1adybug/prettier-plugin-remove-braces run test
pnpm --filter @1adybug/prettier-plugin-remove-braces run dev
```

Report issues with a minimal input/output example in the [issue tracker](https://github.com/1adybug/prettier/issues).

## License

MIT
