# @1adybug/prettier-plugin-sort-imports

## 0.0.34

### Patch Changes

- 4c6b9ea: Add the `arrowFunctionVoid` option and make brace transforms comment- and directive-safe and idempotent across width-based wrapping while skipping expressions that cannot safely be predicted. Preserve unsupported import syntax, comments, incompatible default imports, side-effect order, TypeScript runtime references, and JSDoc type imports while composing parser options correctly. Recognize export-wrapped and static-block padding targets, delegate directive-bearing or otherwise unsafe statement containers and commented empty blocks to Prettier, and load the bundled Tailwind integration consistently.

## 0.0.33

### Patch Changes

- fix(prettier-plugin-block-padding): Fix option forwarding in the block-padding printer comment hook so expression statements with leading comments format correctly when `semi` is false.

## 0.0.32

### Patch Changes

- fix(prettier): 修复 tailwind 插件失效的问题

## 0.0.31

### Patch Changes

- feat(sort-imports): add configurable type-only import handling

## 0.0.30

### Patch Changes

- 添加 node: 前缀

## 0.0.29

### Patch Changes

- 修改类型，与其他插件保持一致

## 0.0.28

### Patch Changes

- 新增 nodeProtocol 选项

## 0.0.27

### Patch Changes

- 升级依赖，修复 import 语句未提升的问题

## 0.0.26

### Patch Changes

- multipleLineBraces 改为 multiLineBraces，新增类型导出

## 0.0.25

### Patch Changes

- 修复 trailingComma 参数的默认值处理逻辑

## 0.0.24

### Patch Changes

- 修复重复添加尾随逗号的问题

## 0.0.23

### Patch Changes

- 统一配置选项

## 0.0.22

### Patch Changes

- 文件路径改为绝对路径

## 0.0.21

### Patch Changes

- 修复与 tailwindcss 插件的兼容性问题

## 0.0.20

### Patch Changes

- 新增 multiLineBraces 选项，修复其他问题

## 0.0.19

### Patch Changes

- 修复一些问题

## 0.0.18

### Patch Changes

- 迁移到 monorepo
