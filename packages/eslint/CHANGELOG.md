# @1adybug/eslint

## 0.0.17

### Patch Changes

- 88b063d: 为 Expo/React Native 项目启用 `eslint-plugin-react-native` 全部规则，并支持按项目精确配置自定义文本组件白名单。

## 0.0.16

### Patch Changes

- d076b80: 新增 Expo/React Native 自动探测与 Flat Config 支持，统一重复插件实例，并支持无 `src` 的平铺项目直接重新导出默认配置。

## 0.0.15

### Patch Changes

- 移除默认最大参数数量限制及内置的 `@1adybug/max-params` 规则。

## 0.0.14

### Patch Changes

- 4652eb0: 函数参数数量规则忽略由外部 API 决定签名的内联回调和 TypeScript 回调类型，同时继续检查项目自主定义的函数。

## 0.0.13

### Patch Changes

- 6195034: Add broader JavaScript, TypeScript, and React style warnings; support all common module extensions and plugin string presets; and harden runtime targets, directory scopes, type-aware rule overrides, and disabled-feature handling with comprehensive runtime and public-type coverage. Move the package into the shared toolchain monorepo.
