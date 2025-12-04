# Prettier Plugin - Remove Braces

[中文文档](https://github.com/1adybug/prettier-plugin-remove-braces/blob/main/README.zh-CN.md)

> **Note**: This plugin was completely developed by Claude Code + GLM-4.6

A Prettier plugin that automatically removes unnecessary braces from JavaScript/TypeScript code to achieve a more concise style, similar to ESLint's `arrow-body-style: as-needed` but with broader scope.

## Features

- ✅ **Arrow Functions**: Converts `() => { return x; }` to `() => x`
- ✅ **Object Literal Returns**: Properly wraps returned objects: `() => { return { a: 1 }; }` → `() => ({ a: 1 })`
- ✅ **If Statements**: Removes braces from single-statement blocks: `if (cond) { stmt(); }` → `if (cond) stmt();`
- ✅ **Loops**: Supports `for`, `while`, `do-while`, `for-in`, and `for-of` loops
- ✅ **Safety Checks**: Preserves braces when necessary for syntax correctness

## Safety Rules (When Braces Are Preserved)

The plugin will **NOT** remove braces in these cases:

1. **Lexical Declarations**: `if (x) { const y = 1; }` - Keeps braces (const/let must be in blocks)
2. **Multiple Statements**: `if (x) { a(); b(); }` - Keeps braces (more than one statement)
3. **Dangling Else**: `if (a) { if (b) foo(); } else bar();` - Keeps braces (prevents else binding change)
4. **Comments**: `if (x) { /* comment */ stmt(); }` - May keep braces to preserve comment placement
5. **Function/Class Declarations**: `if (x) { function foo() {} }` - Keeps braces (function declarations in blocks)

## Installation

```bash
npm install prettier-plugin-remove-braces --save-dev
```

## Usage

### Prettier Configuration

Add the plugin to your Prettier configuration:

**prettier.config.js**:

```js
module.exports = {
    plugins: ["prettier-plugin-remove-braces"],
    controlStatementBraces: "remove", // Options: "default" | "remove" | "add"
    // ... your other prettier options
}
```

**.prettierrc**:

```json
{
    "plugins": ["prettier-plugin-remove-braces"],
    "controlStatementBraces": "remove"
}
```

### Command Line

```bash
# Format all files
npx prettier --write .

# Format specific file
npx prettier --write src/index.js
```

### VS Code

Add to your `.vscode/settings.json`:

```json
{
    "editor.defaultFormatter": "esbenp.prettier-vscode",
    "editor.formatOnSave": true,
    "prettier.configPath": ".prettierrc"
}
```

## Examples

### Before vs After

```javascript
// Before
const add = (a, b) => a + b

const getObject = () => ({ key: "value" })

if (condition) doSomething()
else doSomethingElse()

for (let i = 0; i < 10; i++) console.log(i)

while (true) break

// After
const add = (a, b) => a + b

const getObject = () => ({ key: "value" })

if (condition) doSomething()
else doSomethingElse()

for (let i = 0; i < 10; i++) console.log(i)

while (true) break
```

### Cases Where Braces Are Preserved

```javascript
// Braces kept - lexical declarations
if (condition) {
    const result = calculate()
}

// Braces kept - multiple statements
if (condition) {
    prepare()
    execute()
}

// Braces kept - dangling else prevention
if (a) {
    if (b) foo()
} else bar()
```

## Options

### `controlStatementBraces` (choice, default: "default")

Control how braces are handled around single control statements (if, for, while, try, etc.).

#### Options

- **"default"** - Keep original formatting - don't add or remove braces around control statements
- **"remove"** - Remove braces around single control statements when possible
- **"add"** - Add braces around control statements that don't have them

#### Examples

**"remove" mode:**

```javascript
// Before
if (condition0) {
    if (condition1) doSomething()
}

if (condition) {
    for (let i = 0; i < 10; i++) console.log(i)
}

// After
if (condition0) {
    if (condition1) doSomething()
}

if (condition) {
    for (let i = 0; i < 10; i++) console.log(i)
}
```

**"add" mode:**

```javascript
// Before
if (condition0) {
    if (condition1) doSomething()
}

if (condition) {
    for (let i = 0; i < 10; i++) console.log(i)
}

// After
if (condition0) {
    if (condition1) doSomething()
}

if (condition) {
    for (let i = 0; i < 10; i++) console.log(i)
}
```

### `multiLineBraces` (choice, default: "default")

Control how braces are handled when a single statement spans multiple lines.

#### Options

- **"default"** - Keep original formatting - don't add or remove braces around multiple line statements
- **"remove"** - Remove braces around single multiple line statements when possible
- **"add"** - Add braces around multiple line statements that don't have them

#### Examples

**"default" mode:**

```javascript
// This will be preserved as-is
if (condition) {
    doSomething({
        a: 1,
        b: 2,
    })
}
```

**"remove" mode:**

```javascript
// Before
if (condition) {
    doSomething({
        a: 1,
        b: 2,
    })
}

// After
if (condition) {
    doSomething({
        a: 1,
        b: 2,
    })
}
```

**"add" mode:**

```javascript
// Before
if (condition) {
    doSomething({
        a: 1,
        b: 2,
    })
}

// After
if (condition) {
    doSomething({
        a: 1,
        b: 2,
    })
}
```

**Safety Rules Still Apply:**

- Braces are preserved with multiple statements
- Braces are preserved with lexical declarations (`const`, `let`, function, class)
- Braces are preserved with comments
- Dangling else prevention is still respected

## Compatibility

- ✅ Prettier 2.x and 3.x
- ✅ TypeScript
- ✅ JavaScript (ES2015+)
- ✅ Node.js 14+

## Development

```bash
# Clone the repository
git clone <repository-url>
cd prettier-plugin-remove-braces

# Install dependencies
npm install

# Build the plugin
npm run build

# Run tests
npm test

# Watch for changes during development
npm run dev
```

## Testing

The plugin includes comprehensive tests covering:

- Basic transformations
- Edge cases and safety constraints
- Object literal returns
- Comment preservation
- Nested structures

Run tests with:

```bash
npm test
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for your changes
4. Ensure all tests pass
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Similar Projects

- [ESLint arrow-body-style](https://eslint.org/docs/rules/arrow-body-style) - Similar rule for arrow functions only
- [Prettier Plugin JSdoc](https://github.com/prettier/prettier/blob/main/src/language-js/embed.js) - Prettier's built-in formatting rules
