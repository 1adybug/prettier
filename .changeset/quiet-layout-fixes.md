---
"@1adybug/prettier-plugin-block-padding": patch
"@1adybug/prettier-plugin-remove-braces": patch
"@1adybug/prettier": patch
---

Preserve Prettier's native assignment and callback layout arguments in the block-padding printer. Predict control-body wrapping from the transformed nesting depth and tab width, fixing non-idempotent braces in nested control statements and keeping direct and merge output consistent.
