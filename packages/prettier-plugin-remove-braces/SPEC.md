# 项目需求文档：Prettier Plugin - Remove Unnecessary Braces

## 1. 项目概述

**目标**：开发一个 Prettier 插件 (`prettier-plugin-remove-braces`)。
**核心功能**：在保持代码语义不变的前提下，自动移除 JavaScript/TypeScript 代码中不必要的块级作用域大括号 `{}`。
**设计哲学**：追求极简风格，类似于 ESLint 的 `arrow-body-style: as-needed` 或 `curly: multi` (但方向相反，我们要移除)。

## 2. 技术架构

- **运行环境**: Node.js
- **依赖**: `prettier` (Peer Dependency)
- **实现原理**:
    - 利用 Prettier 的 Plugin API。
    - 采用 **Parser Wrapper** 模式：在 Prettier 打印代码之前，拦截 AST（抽象语法树），对特定节点进行转换（Transformation），将 `BlockStatement` 替换为单条语句。
    - AST 标准：基于 ESTree (支持 Babel/TypeScript 解析器)。

## 3. 功能详情与 AST 转换规则

插件需要遍历 AST，针对以下特定节点类型进行处理：

### 3.1 箭头函数 (ArrowFunctionExpression)

- **规则**：如果箭头函数的函数体 (`body`) 是一个 `BlockStatement`，且该块中**仅包含**一条 `ReturnStatement`，则移除大括号和 `return` 关键字，将其转换为隐式返回。
- **转换示例**:
    - `input`: `(a) => { return a + 1; }`
    - `output`: `(a) => a + 1`
- **特殊边界情况 (Critical)**:
    - **对象字面量返回**: 如果返回的是对象字面量，移除大括号后必须确保打印时包裹圆括号 `()`。
        - `input`: `() => { return { key: 'value' }; }`
        - `output`: `() => ({ key: 'value' })`
    - **非 Return 语句**: 如果块内只有一条语句但不是 `return`（例如 `void` 调用），通常不转换，或者根据配置处理（但在本项目中，默认仅处理 `return` 语句以保证安全）。

### 3.2 条件语句 (IfStatement)

- **规则**：如果 `consequent`（if 分支）或 `alternate`（else 分支）是一个 `BlockStatement`，且块内**仅包含**一条语句，移除大括号。
- **转换示例**:
    - `input`: `if (foo) { bar(); } else { baz(); }`
    - `output`: `if (foo) bar(); else baz();`

### 3.3 循环语句 (ForStatement, WhileStatement, DoWhileStatement, ForIn/Of)

- **规则**：如果循环体 (`body`) 是一个 `BlockStatement`，且块内**仅包含**一条语句，移除大括号。
- **转换示例**:
    - `input`: `for (let i=0; i<10; i++) { console.log(i); }`
    - `output`: `for (let i=0; i<10; i++) console.log(i);`

## 4. 约束与禁忌 (Constraints) - **非常重要**

在以下情况中，**严禁**移除大括号，否则会导致语法错误或逻辑改变：

1.  **词法声明 (Lexical Declarations)**:
    - 如果块内的单条语句是 `const`, `let`, `class`, 或 `function` (在严格模式下) 声明。
    - _原因_: JS 不允许 `if (x) const y = 1;` 这种语法，词法声明必须在块级作用域内。
    - _处理_: 跳过转换，保持 `{}`。

2.  **Dangling Else (悬挂 Else)**:
    - _场景_: `if (a) { if (b) foo(); } else bar();`
    - _风险_: 如果移除外层大括号变成 `if (a) if (b) foo(); else bar();`，`else` 会与最近的 `if (b)` 结合，改变原意。
    - _处理_: 插件逻辑需要检测此类嵌套，如果移除大括号会导致结合性改变，则不移除。

3.  **多条语句**:
    - 显然，如果 `BlockStatement` 的 `body` 数组长度大于 1，绝对不移除。

4.  **注释 (Comments)**:
    - 如果大括号内部包含注释（Leading/Trailing comments），移除大括号可能会导致注释丢失或位置错乱。
    - _策略_: 如果 `BlockStatement` 节点包含注释，建议**不进行转换**，或者需要非常小心地将注释附加到内部语句上。

## 5. 测试用例 (Test Cases)

生成的代码必须通过以下测试用例：

| ID  | 输入代码                                | 预期输出代码                      | 说明                     |
| :-- | :-------------------------------------- | :-------------------------------- | :----------------------- |
| T1  | `const f = (x) => { return x * x; };`   | `const f = (x) => x * x;`         | 基础箭头函数             |
| T2  | `const f = () => { return { a: 1 }; };` | `const f = () => ({ a: 1 });`     | 对象字面量处理           |
| T3  | `if (true) { doSomething(); }`          | `if (true) doSomething();`        | 基础 If                  |
| T4  | `if (true) { const a = 1; }`            | `if (true) { const a = 1; }`      | **不应移除** (Let/Const) |
| T5  | `while(true) { break; }`                | `while(true) break;`              | 基础 While               |
| T6  | `if (a) { // comment \n run(); }`       | `if (a) { // comment \n run(); }` | **不应移除** (含注释)    |
