import type { ChoiceSupportOption, Options as PrettierOptions, SupportOptions } from "prettier"

export type BlockPaddingRule =

        | "types"
        | "interfaces"
        | "enums"
        | "classes"
        | "object-array-literals"
        | "multiline-blocks"
        | "multiline-expressions"
        | "multiline-class-members"
        | "property-method-boundaries"

export interface Options extends PrettierOptions {
    /** Enabled padding rules. An empty array disables padding. Defaults to all rules. */
    blockPaddingRules?: BlockPaddingRule[]
    /** Statement containers to pad. Defaults to "all". */
    blockPaddingScope?: "all" | "top-level"
    /** Whether either or both neighboring statements must match. Defaults to "around". */
    blockPaddingMode?: "around" | "between"
    /** Actual blank lines at matching boundaries. Defaults to 1; must be a positive integer. */
    blockPaddingLines?: number
    /** When class declarations match. Defaults to "multiline". */
    blockPaddingClassMode?: "multiline" | "always"
}

const ruleDescriptions: Record<BlockPaddingRule, string> = {
    types: "Type aliases",
    interfaces: "Interface declarations",
    enums: "Enum declarations, including const enums",
    classes: "Class declarations",
    "object-array-literals": "Statements containing object or array literals",
    "multiline-blocks": "Multiline block statements other than class declarations",
    "multiline-expressions": "Multiline expressions, including class expressions",
    "multiline-class-members": "Multiline class members",
    "property-method-boundaries": "Boundaries between class properties and methods",
}

const allRules = Object.keys(ruleDescriptions) as BlockPaddingRule[]

// Prettier supports choice arrays at runtime, while ChoiceSupportOption omits `array`.
const rulesOption = {
    type: "choice",
    array: true,
    category: "Block Padding",
    description: "Enabled block-padding rules; an empty array disables padding",
    default: [{ value: allRules }],
    choices: allRules.map(value => ({ value, description: ruleDescriptions[value] })),
} satisfies ChoiceSupportOption & { array: true }

export const paddingOptions: SupportOptions = {
    blockPaddingRules: rulesOption,
    blockPaddingScope: {
        type: "choice",
        category: "Block Padding",
        description: "Statement containers to apply padding to",
        default: "all",
        choices: [
            { value: "all", description: "All supported statement containers and class bodies" },
            { value: "top-level", description: "Only the file's top-level statement sequence" },
        ],
    },
    blockPaddingMode: {
        type: "choice",
        category: "Block Padding",
        description: "Which neighboring statements must match a padding rule",
        default: "around",
        choices: [
            { value: "around", description: "Pad when either neighboring statement matches" },
            { value: "between", description: "Pad when both neighboring statements match" },
        ],
    },
    blockPaddingLines: {
        type: "int",
        category: "Block Padding",
        description: "Number of actual blank lines at matching boundaries (positive integer)",
        default: 1,
        range: { start: 1, end: Number.MAX_SAFE_INTEGER, step: 1 },
    },
    blockPaddingClassMode: {
        type: "choice",
        category: "Block Padding",
        description: "When the classes rule matches class declarations",
        default: "multiline",
        choices: [
            { value: "multiline", description: "Only class declarations with forced multiline documents" },
            { value: "always", description: "All class declarations, including empty classes" },
        ],
    },
}

export interface ResolvedPaddingOptions {
    rules: ReadonlySet<BlockPaddingRule>
    scope: NonNullable<Options["blockPaddingScope"]>
    mode: NonNullable<Options["blockPaddingMode"]>
    lines: number
    classMode: NonNullable<Options["blockPaddingClassMode"]>
}

export function resolvePaddingOptions(options: Partial<Options> = {}): ResolvedPaddingOptions {
    const lines = options.blockPaddingLines ?? 1

    if (!Number.isSafeInteger(lines) || lines < 1) throw new Error("blockPaddingLines must be a positive safe integer")

    return {
        rules: new Set(options.blockPaddingRules ?? allRules),
        scope: options.blockPaddingScope ?? "all",
        mode: options.blockPaddingMode ?? "around",
        lines,
        classMode: options.blockPaddingClassMode ?? "multiline",
    }
}

export function isPaddingContainer(type?: string): boolean {
    return type === "Program" || type === "TSModuleBlock" || type === "BlockStatement" || type === "StaticBlock" || type === "ClassBody"
}

export function shouldPadContainer(type: string, options: ResolvedPaddingOptions): boolean {
    if (options.scope === "top-level" && type !== "Program") return false

    if (type === "ClassBody") return options.rules.has("multiline-class-members") || options.rules.has("property-method-boundaries")

    return isPaddingContainer(type) && [...options.rules].some(rule => rule !== "multiline-class-members" && rule !== "property-method-boundaries")
}
