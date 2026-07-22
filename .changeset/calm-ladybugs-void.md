---
"@1adybug/prettier-plugin-remove-braces": patch
"@1adybug/prettier-plugin-sort-imports": patch
"@1adybug/prettier-plugin-block-padding": patch
"@1adybug/prettier": patch
---

Add the `arrowFunctionVoid` option and make brace transforms comment- and directive-safe and idempotent across width-based wrapping while skipping expressions that cannot safely be predicted. Preserve unsupported import syntax, comments, incompatible default imports, side-effect order, TypeScript runtime references, and JSDoc type imports while composing parser options correctly. Recognize export-wrapped and static-block padding targets, delegate directive-bearing or otherwise unsafe statement containers and commented empty blocks to Prettier, and load the bundled Tailwind integration consistently.
