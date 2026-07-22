# @1adybug Tooling Monorepo

Shared ESLint and Prettier tooling published under the `@1adybug` scope.

## Packages

- `@1adybug/eslint`: shared flat ESLint configuration for JavaScript, TypeScript, React, Next.js, and Node.js projects.
- `@1adybug/prettier`: recommended Prettier configuration and aggregate plugin.
- `@1adybug/prettier-plugin-block-padding`: structural blank-line formatting.
- `@1adybug/prettier-plugin-remove-braces`: configurable brace and concise-arrow transforms.
- `@1adybug/prettier-plugin-sort-imports`: import sorting and type-only import handling.

## Development

```bash
pnpm install
pnpm run check
pnpm run test
pnpm run build
pnpm run lint
```

Package versions and changelogs are managed with Changesets.
