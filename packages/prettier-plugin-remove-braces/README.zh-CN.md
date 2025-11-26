# Prettier Plugin - Remove Braces

[English](https://github.com/1adybug/prettier-plugin-remove-braces/blob/main/README.md)

> **注意**: 这是一个完全由 Claude Code + GLM-4.6 完成的插件

一个用于自动移除 JavaScript/TypeScript 代码中不必要大括号的 Prettier 插件，实现更简洁的代码风格，类似于 ESLint 的 `arrow-body-style: as-needed` 规则但功能更广泛。

## 功能特性

- ✅ **箭头函数转换**：`() => { return x; }` → `() => x`
- ✅ **对象字面量返回**：正确包装返回的对象：`() => { return { a: 1 }; }` → `() => ({ a: 1 })`
- ✅ **If 语句转换**：移除单条语句的大括号：`if (cond) { stmt(); }` → `if (cond) stmt();`
- ✅ **循环语句转换**：支持 `for`、`while`、`do-while`、`for-in`、`for-of` 循环
- ✅ **安全检查**：必要时保留大括号以确保语法正确性

## 安全规则（保留大括号的情况）

插件在以下情况下 **不会** 移除大括号：

1. **词法声明**：`if (x) { const y = 1; }` - 保留大括号（const/let 必须在块中）
2. **多语句**：`if (x) { a(); b(); }` - 保留大括号（多条语句）
3. **悬挂 Else**：`if (a) { if (b) foo(); } else bar();` - 保留大括号（防止 else 绑定问题）
4. **注释**：`if (x) { /* comment */ stmt(); }` - 可能保留大括号以保持注释位置
5. **函数/类声明**：`if (x) { function foo() {} }` - 保留大括号（块中的函数声明）

## 安装

```bash
npm install prettier-plugin-remove-braces --save-dev
```

## 使用方法

### Prettier 配置

将插件添加到你的 Prettier 配置中：

**prettier.config.js**:

```js
module.exports = {
    plugins: ["prettier-plugin-remove-braces"],
    controlStatementBraces: "remove", // 选项: "default" | "remove" | "add"
    // ... 其他 prettier 选项
}
```

**.prettierrc**:

```json
{
    "plugins": ["prettier-plugin-remove-braces"],
    "controlStatementBraces": "remove"
}
```

### 命令行

```bash
# 格式化所有文件
npx prettier --write .

# 格式化特定文件
npx prettier --write src/index.js
```

### VS Code

添加到 `.vscode/settings.json`：

```json
{
    "editor.defaultFormatter": "esbenp.prettier-vscode",
    "editor.formatOnSave": true,
    "prettier.configPath": ".prettierrc"
}
```

## 示例

### 格式化前后对比

```javascript
// 格式化前
const add = (a, b) => a + b

const getObject = () => ({ key: "value" })

if (condition) doSomething()
else doSomethingElse()

for (let i = 0; i < 10; i++) console.log(i)

while (true) break

// 格式化后
const add = (a, b) => a + b

const getObject = () => ({ key: "value" })

if (condition) doSomething()
else doSomethingElse()

for (let i = 0; i < 10; i++) console.log(i)

while (true) break
```

### 保留大括号的情况

```javascript
// 保留大括号 - 词法声明
if (condition) {
    const result = calculate()
}

// 保留大括号 - 多语句
if (condition) {
    prepare()
    execute()
}

// 保留大括号 - 悬挂 else 预防
if (a) {
    if (b) foo()
} else bar()
```

## 选项

### `controlStatementBraces` (选择类型, 默认: "default")

控制单个控制语句（if、for、while、try 等）周围大括号的处理方式。

#### 选项

- **"default"** - 保持原始格式 - 不添加或移除控制语句周围的大括号
- **"remove"** - 尽可能移除单个控制语句周围的大括号
- **"add"** - 为没有大括号的控制语句添加大括号

#### 示例

**"remove" 模式：**

```javascript
// 格式化前
if (condition0) if (condition1) doSomething()

if (condition) for (let i = 0; i < 10; i++) console.log(i)

// 格式化后
if (condition0) if (condition1) doSomething()

if (condition) for (let i = 0; i < 10; i++) console.log(i)
```

**"add" 模式：**

```javascript
// 格式化前
if (condition) if (condition1) doSomething()

if (condition) for (let i = 0; i < 10; i++) console.log(i)

// 格式化后
if (condition) if (condition1) doSomething()

if (condition) for (let i = 0; i < 10; i++) console.log(i)
```

**安全规则依然适用：**

- 多语句时保留大括号
- 词法声明时保留大括号（`const`、`let`、function、class）
- 有注释时保留大括号
- 仍然遵循悬挂 else 预防规则

## 兼容性

- ✅ Prettier 2.x 和 3.x
- ✅ TypeScript
- ✅ JavaScript (ES2015+)
- ✅ Node.js 14+

## 开发

```bash
# 克隆仓库
git clone <repository-url>
cd prettier-plugin-remove-braces

# 安装依赖
npm install

# 构建插件
npm run build

# 运行测试
npm test

# 开发时监听变化
npm run dev
```

## 测试

插件包含全面的测试，涵盖：

- 基础转换
- 边缘情况和安全约束
- 对象字面量返回
- 注释保留
- 嵌套结构

运行测试：

```bash
npm test
```

## 贡献

1. Fork 仓库
2. 创建功能分支
3. 为你的更改添加测试
4. 确保所有测试通过
5. 提交 Pull Request

## 许可证

MIT 许可证 - 详见 LICENSE 文件。

## 类似项目

- [ESLint arrow-body-style](https://eslint.org/docs/rules/arrow-body-style) - 仅适用于箭头函数的类似规则
- [Prettier Plugin JSdoc](https://github.com/prettier/prettier/blob/main/src/language-js/embed.js) - Prettier 的内置格式化规则
