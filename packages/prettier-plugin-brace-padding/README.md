# @1adybug/prettier-plugin-block-padding

> **Notice: This project is implemented entirely by AI coding tools.**

[中文文档](./README.zh-CN.md)

A Prettier plugin that inserts blank lines between selected statements and class members. It wraps Prettier's estree printer to control statement containers and separators, while leaving expression and object-property formatting to Prettier.

## Key Features

- **All Code Blocks Grouping**: Inserts an additional blank line before and after specific statements in file top-level, function bodies, if/for/while statement blocks, TypeScript namespaces, and class static initialization blocks (i.e., two line breaks separating adjacent statements), enhancing structural separation. Switch-case sequences remain delegated to Prettier because they are not block statements.
- **Smart Multi-line Expression Block Recognition**: Automatically identifies and adds blank lines around multi-line expression blocks such as template literals, function expressions, class expressions, JSX elements, etc., improving code readability.
- **TypeScript Namespace Support**: Applies the same rules to member statements inside `namespace`/`module` (`TSModuleBlock`), ensuring correct line breaks between braces and first/last lines.
- **Class Member Separation**: Pads multiline class members and separates adjacent properties and methods, including single-line methods.
- **Single-line Detection**: Single-line blocks and expressions do not trigger additional blank lines, except for type declarations, object/array literals, and the property/method separation rule.
- **Collaboration with Official Parsers**: Reuses official `babel`, `babel-ts`, and `typescript` parsers, only overriding the "statement concatenation" during the estree printing stage, leaving other formatting to Prettier.

## Behavior Details

In statement containers (`Program`, `BlockStatement`, `TSModuleBlock`, and `StaticBlock`) and class bodies (`ClassBody`), the plugin adds a blank line between adjacent statements or members in the following cases:

### Unconditional Blank Lines (Even for Single Lines)

- **TypeScript Type Declarations**: `interface`, `type`, `enum` (including those wrapped with `export`)
- **Top-level Object/Array Literals**:
    - Variable declarations initialized with object/array literals
    - Expression statements with literals as the main body

### Blank Lines Only for Multi-line Cases

- **Multi-line Block Statements**: When a statement's printed result is multi-line (e.g., `if`, `for`, `while`, `do/while`, `try/catch/finally`, `switch`, `function`, `class`, `TSModuleDeclaration`, etc.), an additional blank line is added between it and adjacent statements.

- **Multi-line Expression Blocks** (New): When the following expressions span multiple lines, an additional blank line is added between them and adjacent statements:
    - Template literals: `` `...` ``
    - Tagged templates: ``styled`...` ``
    - Arrow function expressions: `() => {}`
    - Function expressions: `function() {}`
    - Class expressions: `class {}`
    - Multi-line function calls: `fn(...)`
    - Multi-line new expressions: `new Class(...)`
    - JSX elements: `<div>...</div>`
    - JSX fragments: `<>...</>`

### Strict Constraints

- **No Blank Lines Outside Container Boundaries**: Will not add extra blank lines before the file's first line or after the file's last line. However, if the file's first or last line's statement matches the above rules (e.g., object literals, type declarations, multi-line block statements), it will still add blank lines between it and adjacent statements.
- **Padding Between Statements and Class Members**: The plugin controls container braces and statement/member separators; expression and object-property formatting remains delegated to Prettier. Function bodies and other nested statement containers receive the same padding rules.
- **Single-line Exceptions**: Type declarations, object/array literals, and adjacent class properties/methods can trigger padding even when printed on one line.

> Summary: The plugin always ensures "at least one line break between adjacent statements", and when rules are matched, an additional line break is added to form a visual blank line.

## Examples

### Basic Example (Top-level)

Object/array literals, TS type declarations, and multi-line block statements trigger additional whitespace:

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

### Function Body Example

The plugin also works inside function bodies, if/for/while, and all code blocks:

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

### Multi-line Expression Block Example

Template literals, function expressions, etc., spanning multiple lines also add blank lines:

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

### Single-line Does Not Trigger Blank Lines

Single-line template literals, function expressions, etc., do not add blank lines:

```typescript
const singleTemplate = `hello`
const singleFn = () => console.log("test")
const d = 4
```

Note: Single-line object/array literals still add blank lines (unconditional rule):

```typescript
const a = 1

const singleObj = { a: 1 }

const b = 2
```

## Installation

```bash
pnpm add -D prettier @1adybug/prettier-plugin-block-padding
```

## Usage

Create `prettier.config.mjs` (in a custom combination, place this plugin after other estree printers):

```js
export default {
    plugins: ["@1adybug/prettier-plugin-block-padding"],
    semi: false,
    tabWidth: 4,
}
```

## Compatibility

- **Prettier**: `^3.8.0` (Prettier 3.8 or later within 3.x)
- **Parsers**: `babel`, `babel-ts`, `typescript`
- **Module**: ESM

## Configuration and Plugin Composition

There are currently no plugin-specific options to toggle individual padding rules, restrict padding to the file top level, or set the number of blank lines. At most **one blank line** is emitted between statements, even if the input contains more. One blank line means two newline characters, not two empty lines.

For the supported combination with the other `@1adybug` plugins and Tailwind CSS, use [@1adybug/prettier](../prettier/README.md). Third-party parser/printer combinations, including `@ianvs/prettier-plugin-sort-imports`, are not covered by that integration and should be verified separately.

## Scope and Limitations

- Inserts additional blank lines "between statements" in all code blocks (including file top-level, function bodies, if/for/while statement blocks, TS namespace blocks).
- Supported expression block types: template literals, tagged templates (e.g., styled-components), arrow functions, function expressions, class expressions, multi-line function calls, new expressions, JSX elements, and fragments.
- Leaves expression and object-property formatting to Prettier, while controlling statement containers and class member separators.
- Multiline detection uses forced breaks in Prettier's document representation; wrapping caused only by `printWidth` may not trigger padding.
- Statement containers with directive prologues (for example, function-level `"use strict"`) are delegated to Prettier, so padding is skipped only inside that container rather than risking directive loss.
- Programs with dangling comments and commented empty bodies are also delegated to Prettier. Automatic padding may be skipped in those containers to preserve their syntax and comments.
- Will not arbitrarily add extra blank lines at the beginning/end of files/blocks.
- Single-line expressions do not normally trigger blank lines; the type declaration, object/array literal, and property/method rules are exceptions.

## Quick Local Testing

```bash
pnpm exec prettier --write "src/**/*.{js,jsx,ts,tsx}"
```

For development, install dependencies from the monorepo root, build the workspace packages, and use the package scripts. See the [root README](../../README.md#development) for prerequisites:

```bash
pnpm --filter @1adybug/prettier-plugin-block-padding run build
pnpm --filter @1adybug/prettier-plugin-block-padding run check
pnpm --filter @1adybug/prettier-plugin-block-padding run test
pnpm --filter @1adybug/prettier-plugin-block-padding run test:quick
pnpm --filter @1adybug/prettier-plugin-block-padding run dev
```

---

If you encounter unexpected padding, submit a minimal reproducible example to the [issue tracker](https://github.com/1adybug/prettier/issues).
