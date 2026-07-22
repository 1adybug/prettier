import { createRequire } from "node:module"

import type { ConfigWithExtends, ExtendsElement } from "@eslint/config-helpers"
import type { Plugin, RulesConfig } from "@eslint/core"
import js from "@eslint/js"
import { defineConfig as _defineConfig, globalIgnores } from "eslint/config"
import globals from "globals"
import tseslint from "typescript-eslint"

const require = createRequire(import.meta.url)

const allFiles = ["**/*.{js,mjs,ts,tsx}"]

const nextDefaultNodeFiles = ["shared/**/*.{js,mjs,ts,tsx}", "prisma/**/*.{js,mjs,ts,tsx}", "server/**/*.{js,mjs,ts,tsx}"]

const defaultIgnores = ["node_modules/**", "out/**", "build/**", "dist/**", "public/**"]

const typeAwareIgnores = ["**/*.{js,jsx,mjs,cjs}", "**/*.d.{ts,tsx,mts,cts}"]

const dependencyCache = new Map<string, boolean>()
const moduleCache = new Map<string, unknown>()
const nodePresetToConfigKey = {
    script: "flat/recommended-script",
    module: "flat/recommended-module",
    recommended: "flat/recommended",
    mixed: "flat/mixed-esm-and-cjs",
} as const

const noInlineObjectTypeMessage = "Avoid inline object type literals. Define a type or interface first."

const noInlineObjectTypeSelector = "TSTypeLiteral:not(TSTypeAliasDeclaration > TSTypeLiteral)"

const noEnumMessage = "Avoid enums. Use an as const object and infer its value type instead."

const noEnumSelector = "TSEnumDeclaration"

const defaultRules: RulesConfig = {
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-empty-object-type": "off",
    "@typescript-eslint/no-non-null-asserted-optional-chain": "off",
    "no-empty": "off",
    "no-extra-boolean-cast": "off",
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": [
        "warn",
        {
            args: "none",
            caughtErrors: "none",
            ignoreRestSiblings: true,
        },
    ],
    "prefer-const": [
        "warn",
        {
            destructuring: "any",
        },
    ],
    "prefer-template": "warn",
    "prefer-arrow-callback": "warn",
    "arrow-body-style": ["warn", "as-needed"],
    "max-params": "off",
    "@typescript-eslint/max-params": ["warn", { max: 2 }],
    "@typescript-eslint/consistent-type-definitions": ["warn", "interface"],
    "@typescript-eslint/naming-convention": [
        "warn",
        {
            selector: "typeLike",
            format: ["PascalCase"],
        },
    ],
    "no-restricted-syntax": [
        "warn",
        {
            selector: noInlineObjectTypeSelector,
            message: noInlineObjectTypeMessage,
        },
        {
            selector: noEnumSelector,
            message: noEnumMessage,
        },
    ],
}

const defaultReactRules: RulesConfig = {
    "react/jsx-fragments": ["warn", "element"],
    "react/self-closing-comp": [
        "warn",
        {
            component: true,
            html: true,
        },
    ],
}

const defaultTypeAwareRules: RulesConfig = {
    "@typescript-eslint/no-deprecated": "error",
}

const defaultNodeVersion = ">=24.0.0"

const defaultNodeRules: RulesConfig = {
    "n/no-missing-import": "off",
    "n/no-missing-require": "off",
    "n/no-unsupported-features/node-builtins": "off",
}

type MaybeArray<T> = T | T[]

type GlobInput = string | string[]

type RuntimeTarget = "browser" | "node" | "both"

type FeatureInput<T extends BaseFeatureOptions = BaseFeatureOptions> = boolean | T

type FeatureExtend = ExtendsElement

type NodePluginRuntime = {
    configs: Record<string, unknown>
}

export type NodePreset = keyof typeof nodePresetToConfigKey

function hasDependency(dependency: string) {
    if (dependencyCache.has(dependency)) return dependencyCache.get(dependency) ?? false

    try {
        require.resolve(dependency)
        dependencyCache.set(dependency, true)
        return true
    } catch (error) {
        dependencyCache.set(dependency, false)
        return false
    }
}

function requireCached<T>(moduleId: string) {
    if (moduleCache.has(moduleId)) return moduleCache.get(moduleId) as T
    const loadedModule = require(moduleId) as T
    moduleCache.set(moduleId, loadedModule)
    return loadedModule
}

interface BaseFeatureOptions {
    enabled?: boolean
    recommended?: boolean
    extends?: MaybeArray<FeatureExtend>
    rules?: RulesConfig
}

export interface NextFeatureOptions extends BaseFeatureOptions {}

export interface ReactFeatureOptions extends BaseFeatureOptions {}

export interface NodeFeatureOptions extends BaseFeatureOptions {
    preset?: NodePreset
    version?: string
}

export interface RuntimeDirectories {
    web?: GlobInput
    node?: GlobInput
    mixed?: GlobInput
}

export interface DefineConfigParams {
    next?: FeatureInput<NextFeatureOptions>
    react?: FeatureInput<ReactFeatureOptions>
    node?: FeatureInput<NodeFeatureOptions>
    /**
     * Used to infer default runtime directories when `directories` is not provided.
     */
    target?: RuntimeTarget
    /**
     * Explicit directory mappings. When provided, it takes precedence over `target` defaults.
     */
    directories?: RuntimeDirectories
    ignores?: GlobInput
    rules?: RulesConfig
}

interface ResolvedDirectories {
    web: string[]
    node: string[]
    mixed: string[]
}

interface FeatureScope {
    files: string[]
    ignores?: string[]
}

interface ResolvedFeature<T extends BaseFeatureOptions = BaseFeatureOptions> {
    enabled: boolean
    recommended: boolean
    extends: FeatureExtend[]
    rules: RulesConfig
    options: T
}

function toArray<T>(value: MaybeArray<T> | undefined): T[] {
    if (!value) return []
    return Array.isArray(value) ? value : [value]
}

function toGlobs(value: GlobInput | undefined): string[] {
    if (!value) return []
    return Array.isArray(value) ? value : [value]
}

function unique(items: string[]) {
    return Array.from(new Set(items))
}

function resolveFeature<T extends BaseFeatureOptions>(feature: FeatureInput<T> | undefined, defaultEnabled: boolean): ResolvedFeature<T> {
    if (typeof feature === "boolean") {
        return {
            enabled: feature,
            recommended: true,
            extends: [],
            rules: {},
            options: {} as T,
        }
    }

    const option = (feature ?? {}) as T

    return {
        enabled: option.enabled ?? defaultEnabled,
        recommended: option.recommended ?? true,
        extends: toArray<FeatureExtend>(option.extends),
        rules: option.rules ?? {},
        options: option,
    }
}

function getDefaultTarget(nextEnabled: boolean, reactEnabled: boolean): RuntimeTarget {
    if (nextEnabled) return "both"
    if (reactEnabled) return "browser"
    return "node"
}

function getDefaultDirectories(nextEnabled: boolean, target: RuntimeTarget): ResolvedDirectories {
    if (nextEnabled && target === "both") {
        return {
            web: allFiles,
            node: nextDefaultNodeFiles,
            mixed: [],
        }
    }

    if (target === "browser") {
        return {
            web: allFiles,
            node: [],
            mixed: [],
        }
    }

    if (target === "node") {
        return {
            web: [],
            node: allFiles,
            mixed: [],
        }
    }

    return {
        web: [],
        node: [],
        mixed: allFiles,
    }
}

function resolveDirectories(directories: RuntimeDirectories | undefined, defaults: ResolvedDirectories): ResolvedDirectories {
    const resolved: ResolvedDirectories = {
        web: directories?.web === undefined ? defaults.web : toGlobs(directories.web),
        node: directories?.node === undefined ? defaults.node : toGlobs(directories.node),
        mixed: directories?.mixed === undefined ? defaults.mixed : toGlobs(directories.mixed),
    }

    if (resolved.web.length === 0 && resolved.node.length === 0 && resolved.mixed.length === 0) resolved.mixed = allFiles

    return resolved
}

function hasDirectoryOverrides(directories: RuntimeDirectories | undefined) {
    if (!directories) return false
    return directories.web !== undefined || directories.node !== undefined || directories.mixed !== undefined
}

function assertNoDirectoryConflicts(directories: ResolvedDirectories) {
    const matchedRuntimes = new Map<string, RuntimeTarget[]>()

    const runtimeEntries: Array<[RuntimeTarget, string[]]> = [
        ["browser", directories.web],
        ["node", directories.node],
        ["both", directories.mixed],
    ]

    for (const [runtime, globs] of runtimeEntries) {
        for (const glob of globs) {
            const existed = matchedRuntimes.get(glob) ?? []
            if (!existed.includes(runtime)) existed.push(runtime)
            matchedRuntimes.set(glob, existed)
        }
    }

    const conflicts = Array.from(matchedRuntimes.entries()).filter(([, runtimes]) => runtimes.length > 1)

    if (conflicts.length === 0) return

    const conflictMessage = conflicts.map(([glob, runtimes]) => `"${glob}" => ${runtimes.join(", ")}`).join("; ")
    throw new Error(`Directory globs must not be duplicated across web/node/mixed: ${conflictMessage}`)
}

function normalizeScopes(scopes: FeatureScope[]) {
    const map = new Map<string, FeatureScope>()

    for (const scope of scopes) {
        if (scope.files.length === 0) continue
        const files = unique(scope.files)
        const ignores = scope.ignores ? unique(scope.ignores) : undefined
        const key = `${files.join("|")}::${ignores ? ignores.join("|") : ""}`
        if (!map.has(key)) map.set(key, { files, ignores })
    }

    return Array.from(map.values())
}

function toTopLevelConfig(extend: FeatureExtend): ConfigWithExtends {
    if (typeof extend === "string" || Array.isArray(extend)) return { extends: [extend] }
    return extend as ConfigWithExtends
}

function createScopedExtends(extendsItems: FeatureExtend[], scopes: FeatureScope[]) {
    if (extendsItems.length === 0) return []

    const resolvedScopes = normalizeScopes(scopes)
    if (resolvedScopes.length === 0) return extendsItems.map(item => toTopLevelConfig(item))

    const scopedConfigs: ConfigWithExtends[] = []

    for (const config of extendsItems) {
        for (const scope of resolvedScopes) {
            scopedConfigs.push({
                files: scope.files,
                ...(scope.ignores && scope.ignores.length > 0 ? { ignores: scope.ignores } : {}),
                extends: [config],
            })
        }
    }

    return scopedConfigs
}

function normalizeUnknownExtends(config: unknown): FeatureExtend[] {
    if (typeof config === "string") return [config]
    if (Array.isArray(config)) return config as FeatureExtend[]
    if (config && typeof config === "object") return [config as FeatureExtend]
    return []
}

function createRuntimeConfig(files: string[], runtimeTarget: RuntimeTarget, rules: RulesConfig, ignores?: string[]) {
    const runtimeGlobals = {
        browser: globals.browser,
        node: globals.node,
        both: { ...globals.browser, ...globals.node },
    } as const

    return {
        files,
        ...(ignores && ignores.length > 0 ? { ignores } : {}),
        languageOptions: {
            ecmaVersion: "latest",
            globals: runtimeGlobals[runtimeTarget],
        },
        rules,
    }
}

function createNodeVersionSettings(version: string) {
    return {
        n: { version },
        node: { version },
    }
}

function createTypeAwareConfig(scopes: FeatureScope[], rules: RulesConfig) {
    if (Object.keys(rules).length === 0) return []

    return normalizeScopes(scopes).map<ConfigWithExtends>(scope => ({
        files: scope.files,
        ignores: unique([...(scope.ignores ?? []), ...typeAwareIgnores]),
        plugins: {
            "@typescript-eslint": tseslint.plugin,
        },
        languageOptions: {
            parserOptions: {
                projectService: true,
            },
        },
        rules,
    }))
}

export function defineConfig({ next, react, node, target, directories, ignores, rules }: DefineConfigParams = {}) {
    const nextFeature = resolveFeature(next, hasDependency("next"))
    const reactFeature = resolveFeature(react, hasDependency("react") || nextFeature.enabled)
    const resolvedTarget = target ?? getDefaultTarget(nextFeature.enabled, reactFeature.enabled)
    const nodeFeature = resolveFeature(node, resolvedTarget !== "browser")
    const nodeVersion = nodeFeature.options.version ?? defaultNodeVersion

    const defaultDirectories = getDefaultDirectories(nextFeature.enabled, resolvedTarget)
    const resolvedDirectories = resolveDirectories(directories, defaultDirectories)
    assertNoDirectoryConflicts(resolvedDirectories)

    const useNextAutoSplit = nextFeature.enabled && resolvedTarget === "both" && !hasDirectoryOverrides(directories)
    const webIgnores = useNextAutoSplit ? resolvedDirectories.node : undefined

    const browserScopes: FeatureScope[] = [{ files: resolvedDirectories.web, ignores: webIgnores }, { files: resolvedDirectories.mixed }]

    const nodeScopes: FeatureScope[] = [{ files: resolvedDirectories.node }, { files: resolvedDirectories.mixed }]

    const baseScopes: FeatureScope[] = [
        { files: resolvedDirectories.web, ignores: webIgnores },
        { files: resolvedDirectories.node },
        { files: resolvedDirectories.mixed },
    ]

    const resolvedIgnores = unique([...defaultIgnores, ...toGlobs(ignores), ...(nextFeature.enabled ? [".next/**", "next-env.d.ts"] : [])])

    const configWithExtends: ConfigWithExtends[] = createScopedExtends([js.configs.recommended, ...tseslint.configs.recommended], baseScopes)

    if (reactFeature.enabled) {
        if (!nextFeature.enabled || !nextFeature.recommended) {
            const reactPlugin = requireCached<Plugin>("eslint-plugin-react")

            configWithExtends.push(
                ...createScopedExtends(
                    [
                        {
                            plugins: { react: reactPlugin },
                            settings: { react: { version: "detect" } },
                        },
                    ],
                    browserScopes,
                ),
            )
        }

        if (reactFeature.recommended) {
            const reactHooks = requireCached<typeof import("eslint-plugin-react-hooks")>("eslint-plugin-react-hooks")
            const reactRefresh = requireCached<typeof import("eslint-plugin-react-refresh")>("eslint-plugin-react-refresh")
            configWithExtends.push(...createScopedExtends([reactHooks.configs.flat.recommended, reactRefresh.default.configs.vite], browserScopes))
        }

        configWithExtends.push(...createScopedExtends(reactFeature.extends, browserScopes))
    }

    if (nextFeature.enabled) {
        if (nextFeature.recommended) {
            const nextVitals = requireCached<typeof import("eslint-config-next/core-web-vitals")>("eslint-config-next/core-web-vitals")
            const nextTs = requireCached<typeof import("eslint-config-next/typescript")>("eslint-config-next/typescript")
            configWithExtends.push(...createScopedExtends([...nextVitals, ...nextTs], browserScopes))
        }

        configWithExtends.push(...createScopedExtends(nextFeature.extends, browserScopes))
    }

    if (nodeFeature.enabled) {
        if (nodeFeature.recommended) {
            const nodePlugin = requireCached<NodePluginRuntime>("eslint-plugin-n")
            const preset = nodeFeature.options.preset ?? "script"
            const nodePresetConfig = nodePlugin.configs[nodePresetToConfigKey[preset]]
            configWithExtends.push(...createScopedExtends(normalizeUnknownExtends(nodePresetConfig), nodeScopes))
        }

        configWithExtends.push(...createScopedExtends(nodeFeature.extends, nodeScopes))
    }

    const mergedBaseRules: RulesConfig = {
        ...defaultRules,
        ...(rules ?? {}),
    }

    const typeAwareRules: RulesConfig = {
        ...defaultTypeAwareRules,
        ...("@typescript-eslint/no-deprecated" in (rules ?? {}) ? { "@typescript-eslint/no-deprecated": rules?.["@typescript-eslint/no-deprecated"] } : {}),
    }

    const browserRules: RulesConfig = {
        ...mergedBaseRules,
        ...(reactFeature.enabled ? defaultReactRules : {}),
        ...(reactFeature.enabled && reactFeature.recommended
            ? {
                  "react-refresh/only-export-components": "off",
                  "react-hooks/set-state-in-effect": "off",
              }
            : {}),
        ...nextFeature.rules,
        ...reactFeature.rules,
    }

    const nodeRules: RulesConfig = {
        ...mergedBaseRules,
        ...(nodeFeature.enabled ? defaultNodeRules : {}),
        ...(nodeFeature.enabled ? nodeFeature.rules : {}),
    }

    const mixedRules: RulesConfig = {
        ...browserRules,
        ...(nodeFeature.enabled ? defaultNodeRules : {}),
        ...(nodeFeature.enabled ? nodeFeature.rules : {}),
    }

    const appConfig: ConfigWithExtends[] = []

    if (resolvedDirectories.web.length > 0) appConfig.push(createRuntimeConfig(resolvedDirectories.web, "browser", browserRules, webIgnores))

    if (resolvedDirectories.node.length > 0) {
        appConfig.push({
            ...createRuntimeConfig(resolvedDirectories.node, "node", nodeRules),
            settings: createNodeVersionSettings(nodeVersion),
        })
    }

    if (resolvedDirectories.mixed.length > 0) {
        appConfig.push({
            ...createRuntimeConfig(resolvedDirectories.mixed, "both", mixedRules),
            ...(nodeFeature.enabled ? { settings: createNodeVersionSettings(nodeVersion) } : {}),
        })
    }

    const config = [globalIgnores(resolvedIgnores), ...configWithExtends, ...appConfig]

    config.push(...createTypeAwareConfig(baseScopes, typeAwareRules))

    return _defineConfig(config)
}

export const config = defineConfig()

export default config
