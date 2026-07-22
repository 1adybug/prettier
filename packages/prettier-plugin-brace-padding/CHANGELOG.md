# @1adybug/prettier-plugin-block-padding

## 0.0.21

### Patch Changes

- 4c6b9ea: Add the `arrowFunctionVoid` option and make brace transforms comment- and directive-safe and idempotent across width-based wrapping while skipping expressions that cannot safely be predicted. Preserve unsupported import syntax, comments, incompatible default imports, side-effect order, TypeScript runtime references, and JSDoc type imports while composing parser options correctly. Recognize export-wrapped and static-block padding targets, delegate directive-bearing or otherwise unsafe statement containers and commented empty blocks to Prettier, and load the bundled Tailwind integration consistently.

## 0.0.20

### Patch Changes

- fix(prettier-plugin-block-padding): Fix option forwarding in the block-padding printer comment hook so expression statements with leading comments format correctly when `semi` is false.

## 0.0.19

### Patch Changes

- fix: make leading semicolon formatting idempotent

## 0.0.18

### Patch Changes

- fix(prettier): 修复 tailwind 插件失效的问题

## 0.0.17

### Patch Changes

- feat(sort-imports): add configurable type-only import handling

## 0.0.16

### Patch Changes

- 升级依赖，修复 import 语句未提升的问题

## 0.0.15

### Patch Changes

- 处理 EmptyStatement 节点的打印逻辑以避免错误

## 0.0.14

### Patch Changes

- multipleLineBraces 改为 multiLineBraces，新增类型导出

## 0.0.13

### Patch Changes

- 修复与 tailwindcss 插件的兼容性问题

## 0.0.12

### Patch Changes

- 新增 multiLineBraces 选项，修复其他问题

## 0.0.11

### Patch Changes

- 迁移到 monorepo
