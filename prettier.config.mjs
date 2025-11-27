// @ts-check

/**
 * @type {import("prettier").Options}
 */
const config = {
    semi: false,
    tabWidth: 4,
    arrowParens: "avoid",
    endOfLine: "lf",
    printWidth: 160,
    plugins: ["@1adybug/prettier"],
    controlStatementBraces: "add",
    multipleLineBraces: "add",
}

export default config
