---
"@1adybug/prettier-plugin-block-padding": patch
"@1adybug/prettier-plugin-sort-imports": patch
"@1adybug/prettier": patch
---

Make the default block-padding entry compatible with prettier-plugin-merge by registering parser adapters that preserve preceding parser behavior. Keep pure adapters out of the composed parser pipeline so preprocessing and AST transforms are not duplicated. Rename the package directory to prettier-plugin-block-padding and update repository links and composition documentation.
