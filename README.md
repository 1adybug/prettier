# @1adybug Tooling Monorepo

> **Notice: This project is implemented entirely by AI coding tools.**

[中文文档](./README.zh-CN.md)

Shared ESLint and Prettier tooling published under the `@1adybug` scope.

## Packages

| Package                                  | Purpose                                                                                              | Documentation                                                                                                                    |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `@1adybug/eslint`                        | Flat ESLint configuration for JavaScript, TypeScript, React, Expo/React Native, Next.js, and Node.js | [English](./packages/eslint/README.md) / [中文](./packages/eslint/README.zh-CN.md)                                               |
| `@1adybug/prettier`                      | Aggregate Prettier plugin for import sorting, block padding, brace transforms, and Tailwind CSS      | [English](./packages/prettier/README.md) / [中文](./packages/prettier/README.zh-CN.md)                                           |
| `@1adybug/prettier-plugin-block-padding` | Structural blank-line formatting                                                                     | [English](./packages/prettier-plugin-block-padding/README.md) / [中文](./packages/prettier-plugin-block-padding/README.zh-CN.md) |
| `@1adybug/prettier-plugin-remove-braces` | Brace and concise-arrow transforms                                                                   | [English](./packages/prettier-plugin-remove-braces/README.md) / [中文](./packages/prettier-plugin-remove-braces/README.zh-CN.md) |
| `@1adybug/prettier-plugin-sort-imports`  | Import sorting and type-only import handling                                                         | [English](./packages/prettier-plugin-sort-imports/README.md) / [中文](./packages/prettier-plugin-sort-imports/README.zh-CN.md)   |

## Quick Start

For the aggregate Prettier plugin:

```bash
pnpm add -D prettier @1adybug/prettier
```

Create `prettier.config.mjs`:

```js
export default {
    plugins: ["@1adybug/prettier"],
    semi: false,
    tabWidth: 4,
}
```

`@1adybug/prettier` is a plugin, so register it in `plugins`; it does not export a Prettier configuration preset. Individual plugins can also be installed separately. All Prettier packages require Prettier `^3.8.0`.

For configurable padding and composition with `prettier-plugin-merge`, see the [block-padding configuration](./packages/prettier-plugin-block-padding/README.md#configuration) and [composition example](./packages/prettier-plugin-block-padding/README.md#with-prettier-plugin-merge).

Run Prettier with the configuration above:

```bash
pnpm exec prettier --write "src/**/*.{js,jsx,ts,tsx}"
```

For ESLint setup, see the [ESLint package README](./packages/eslint/README.md).

## Documentation Conventions

- Install development dependencies with `pnpm add -D` and run locally installed tools with `pnpm exec`.
- Use `pnpm run` for repository scripts and `pnpm --filter <package> run <script>` for package scripts. Run development commands from the monorepo root.
- Primary Prettier configurations use the ESM file `prettier.config.mjs`; ESLint configurations use `eslint.config.mjs`.
- Prettier formatting examples explicitly set `semi: false` and `tabWidth: 4`. Individual examples add the relevant plugin options; these style values are not automatic plugin defaults.

## Development

Use Node.js, the pnpm version declared in the root `package.json`, and the `nub` executable required by the package scripts. Run these commands from the repository root:

```bash
pnpm install
pnpm run build
pnpm run check
pnpm run test
pnpm run lint
pnpm run dev
```

To work on one package:

```bash
pnpm --filter @1adybug/prettier-plugin-block-padding run build
pnpm --filter @1adybug/prettier-plugin-block-padding run check
pnpm --filter @1adybug/prettier-plugin-block-padding run test
pnpm --filter @1adybug/prettier-plugin-block-padding run dev
```

When formatting README files, use `--embedded-language-formatting off` to preserve the input/output examples inside code fences.

```bash
pnpm exec prettier --write --embedded-language-formatting off "**/README*.md"
```

Package versions and changelogs are managed with Changesets.
