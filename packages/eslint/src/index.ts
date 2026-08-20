import { createRequire } from "node:module"
import { resolve } from "node:path"

import type { ConfigWithExtends, ExtendsElement } from "@eslint/config-helpers"
import type { Plugin, RulesConfig } from "@eslint/core"
import js from "@eslint/js"
import { defineConfig as _defineConfig, globalIgnores } from "eslint/config"
import globals from "globals"
import tseslint from "typescript-eslint"

const require = createRequire(import.meta.url)
const requireFromProject = createRequire(resolve(process.cwd(), "package.json"))

const allFiles = ["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"]

const nextDefaultNodeFiles = [
    "shared/**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}",
    "prisma/**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}",
    "server/**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}",
]

const defaultIgnores = ["node_modules/**", "out/**", "build/**", "dist/**", "public/**"]

const expoDefaultIgnores = [".expo/**", "android/**", "ios/**", "**/android/build/**", "**/ios/build/**"]

const expoCommonJsConfigFiles = ["**/{app,babel,metro,react-native}.config.{js,cjs,mjs,ts,cts,mts}"]

const expoDefaultProjectFiles = [
    "app.config.ts",
    "babel.config.ts",
    "metro.config.ts",
    "nativewind.config.ts",
    "react-native.config.ts",
    "tailwind.config.ts",
    "uniwind.config.ts",
]

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

const defaultExpoRules: RulesConfig = {
    "react-native/no-color-literals": "error",
    "react-native/no-inline-styles": "error",
    "react-native/no-raw-text": "error",
    "react-native/no-single-element-style-arrays": "error",
    "react-native/no-unused-styles": "error",
    "react-native/sort-styles": "error",
    "react-native/split-platform-components": "error",
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

const runtimeTargets = ["browser", "node", "both"] as const

type RuntimeTarget = (typeof runtimeTargets)[number]

type FeatureInput<T extends BaseFeatureOptions = BaseFeatureOptions> = boolean | T

type FeatureExtend = ExtendsElement

interface ConfigurablePlugin extends Plugin {
    configs?: Plugin["configs"]
}

interface PluginModule extends ConfigurablePlugin {
    default?: ConfigurablePlugin
}

interface NodePluginRuntime extends ConfigurablePlugin {
    configs: NonNullable<Plugin["configs"]>
}

export type NodePreset = keyof typeof nodePresetToConfigKey

function hasDependency(dependency: string) {
    if (dependencyCache.has(dependency)) return dependencyCache.get(dependency) ?? false

    try {
        requireFromProject.resolve(dependency)
        dependencyCache.set(dependency, true)
        return true
    } catch (error) {
        dependencyCache.set(dependency, false)
        return false
    }
}

function resolveModuleId(moduleId: string) {
    try {
        return requireFromProject.resolve(moduleId)
    } catch (error) {
        return require.resolve(moduleId)
    }
}

function requireCached<T>(moduleId: string) {
    const resolvedModuleId = resolveModuleId(moduleId)
    if (moduleCache.has(resolvedModuleId)) return moduleCache.get(resolvedModuleId) as T
    const loadedModule = require(resolvedModuleId) as T
    moduleCache.set(resolvedModuleId, loadedModule)
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

export interface ExpoFeatureOptions extends BaseFeatureOptions {}

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
    expo?: FeatureInput<ExpoFeatureOptions>
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

interface ProjectServiceOptions {
    allowDefaultProject: string[]
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

function getDefaultTarget(nextEnabled: boolean, reactEnabled: boolean, expoEnabled: boolean): RuntimeTarget {
    if (nextEnabled) return "both"
    if (reactEnabled || expoEnabled) return "browser"
    return "node"
}

function assertValidTarget(target: RuntimeTarget | undefined) {
    if (target !== undefined && !runtimeTargets.includes(target))
        throw new Error(`Unknown runtime target "${target}". Expected one of: ${runtimeTargets.join(", ")}.`)
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
        web: unique(directories?.web === undefined ? defaults.web : toGlobs(directories.web)),
        node: unique(directories?.node === undefined ? defaults.node : toGlobs(directories.node)),
        mixed: unique(directories?.mixed === undefined ? defaults.mixed : toGlobs(directories.mixed)),
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

function getPluginConfig(plugin: ConfigurablePlugin, configName: string) {
    const directConfig = plugin.configs?.[configName]
    if (directConfig !== undefined) return directConfig

    let nestedConfig: unknown = plugin.configs

    for (const segment of configName.split("/")) {
        if (!nestedConfig || typeof nestedConfig !== "object" || !(segment in nestedConfig)) return undefined
        nestedConfig = (nestedConfig as Record<string, unknown>)[segment]
    }

    return nestedConfig
}

function resolveKnownStringExtends(extendsItems: FeatureExtend[], stringPlugins: Record<string, ConfigurablePlugin> | undefined) {
    if (!stringPlugins) return extendsItems

    const pluginEntries = Object.entries(stringPlugins).sort(([left], [right]) => right.length - left.length)

    return extendsItems.flatMap<FeatureExtend>(extend => {
        if (typeof extend !== "string") return [extend]

        const pluginEntry = pluginEntries.find(([pluginName]) => extend.startsWith(`${pluginName}/`))
        if (!pluginEntry) return [extend]

        const [pluginName, plugin] = pluginEntry
        const configName = extend.slice(pluginName.length + 1)
        const pluginConfig = getPluginConfig(plugin, configName)

        if (pluginConfig === undefined) throw new Error(`Plugin config "${configName}" not found in plugin "${pluginName}".`)

        return normalizeUnknownExtends(pluginConfig)
    })
}

function createScopedExtends(extendsItems: FeatureExtend[], scopes: FeatureScope[], stringPlugins?: Record<string, ConfigurablePlugin>) {
    const resolvedExtends = resolveKnownStringExtends(extendsItems, stringPlugins)
    if (resolvedExtends.length === 0) return []

    const resolvedScopes = normalizeScopes(scopes)
    if (resolvedScopes.length === 0) return []

    const scopedConfigs: ConfigWithExtends[] = []

    for (const config of resolvedExtends) {
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

function replaceKnownPluginInstances(config: unknown, knownPlugins: Record<string, ConfigurablePlugin>): FeatureExtend[] {
    if (typeof config === "string") return [config]
    if (Array.isArray(config)) return config.flatMap(item => replaceKnownPluginInstances(item, knownPlugins))
    if (!config || typeof config !== "object") return []

    const sourceConfig = config as ConfigWithExtends
    const { extends: sourceExtends, plugins: sourcePlugins, ...flatConfig } = sourceConfig

    if (sourceExtends?.length) throw new Error('The loaded Expo Flat Config must not contain nested "extends" entries.')

    const plugins = sourcePlugins
        ? Object.fromEntries(Object.entries(sourcePlugins).map(([pluginName, plugin]) => [pluginName, knownPlugins[pluginName] ?? plugin]))
        : undefined

    return [
        {
            ...flatConfig,
            ...(plugins ? { plugins } : {}),
        },
    ]
}

function findPlugin(configs: FeatureExtend[], pluginName: string) {
    for (const config of configs) {
        if (typeof config === "string" || Array.isArray(config)) continue
        const plugin = config.plugins?.[pluginName]
        if (plugin) return plugin as ConfigurablePlugin
    }

    return undefined
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

function createTypeAwareConfig(scopes: FeatureScope[], rules: RulesConfig, projectService: true | ProjectServiceOptions = true) {
    if (Object.keys(rules).length === 0) return []

    return normalizeScopes(scopes).map<ConfigWithExtends>(scope => ({
        files: scope.files,
        ignores: unique([...(scope.ignores ?? []), ...typeAwareIgnores]),
        plugins: {
            "@typescript-eslint": tseslint.plugin,
        },
        languageOptions: {
            parserOptions: {
                projectService,
            },
        },
        rules,
    }))
}

function withoutTypeAwareRules(rules: RulesConfig) {
    return Object.fromEntries(Object.entries(rules).filter(([ruleId]) => !(ruleId in defaultTypeAwareRules))) as RulesConfig
}

function resolveTypeAwareRules(...ruleSets: RulesConfig[]) {
    const resolvedRules: RulesConfig = { ...defaultTypeAwareRules }

    for (const rules of ruleSets) {
        for (const ruleId of Object.keys(defaultTypeAwareRules)) {
            if (ruleId in rules) resolvedRules[ruleId] = rules[ruleId]
        }
    }

    return resolvedRules
}

export function defineConfig({ next, react, expo, node, target, directories, ignores, rules }: DefineConfigParams = {}) {
    assertValidTarget(target)

    const nextFeature = resolveFeature(next, hasDependency("next"))
    const expoFeature = resolveFeature(expo, hasDependency("expo"))
    const reactFeature = resolveFeature(react, hasDependency("react") || nextFeature.enabled || expoFeature.enabled)
    const resolvedTarget = target ?? getDefaultTarget(nextFeature.enabled, reactFeature.enabled, expoFeature.enabled)
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

    const resolvedIgnores = unique([
        ...defaultIgnores,
        ...toGlobs(ignores),
        ...(nextFeature.enabled ? [".next/**", "next-env.d.ts"] : []),
        ...(expoFeature.enabled ? expoDefaultIgnores : []),
    ])

    const configWithExtends: ConfigWithExtends[] = createScopedExtends([js.configs.recommended, ...tseslint.configs.recommended], baseScopes)

    let reactPlugin: ConfigurablePlugin | undefined
    let reactHooksPlugin: ConfigurablePlugin | undefined

    if (reactFeature.enabled) {
        reactPlugin = requireCached<ConfigurablePlugin>("eslint-plugin-react")

        if (!nextFeature.enabled || !nextFeature.recommended) {
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

        if (reactFeature.recommended || (expoFeature.enabled && expoFeature.recommended)) {
            const reactHooks = requireCached<typeof import("eslint-plugin-react-hooks")>("eslint-plugin-react-hooks")
            reactHooksPlugin = reactHooks as unknown as ConfigurablePlugin

            if (!(expoFeature.enabled && expoFeature.recommended)) {
                const reactRefresh = requireCached<typeof import("eslint-plugin-react-refresh")>("eslint-plugin-react-refresh")
                configWithExtends.push(...createScopedExtends([reactHooks.configs.flat.recommended, reactRefresh.default.configs.vite], browserScopes))
            }
        }

        configWithExtends.push(...createScopedExtends(reactFeature.extends, browserScopes, { react: reactPlugin }))
    }

    if (expoFeature.enabled) {
        if (!hasDependency("eslint-config-expo")) throw new Error('Expo support requires "eslint-config-expo" to be installed in the project.')

        const reactNativePlugin = requireCached<ConfigurablePlugin>("eslint-plugin-react-native")

        const knownPlugins: Record<string, ConfigurablePlugin> = {
            "@typescript-eslint": tseslint.plugin as ConfigurablePlugin,
            ...(reactPlugin ? { react: reactPlugin } : {}),
            ...(reactHooksPlugin ? { "react-hooks": reactHooksPlugin } : {}),
            "react-native": reactNativePlugin,
        }

        const expoConfigs = replaceKnownPluginInstances(requireCached<unknown>("eslint-config-expo/flat.js"), knownPlugins)
        const expoPlugin = findPlugin(expoConfigs, "expo")

        if (!expoPlugin) throw new Error('The installed "eslint-config-expo" does not expose the expected "expo" Flat Config plugin.')

        if (expoFeature.recommended) configWithExtends.push(...createScopedExtends(expoConfigs, browserScopes))
        else configWithExtends.push(...createScopedExtends([{ plugins: { expo: expoPlugin } }], browserScopes))

        configWithExtends.push(...createScopedExtends([{ plugins: { "react-native": reactNativePlugin } }], browserScopes))

        configWithExtends.push(
            ...createScopedExtends(
                [
                    {
                        files: expoCommonJsConfigFiles,
                        rules: { "@typescript-eslint/no-require-imports": "off" },
                    },
                ],
                browserScopes,
            ),
        )

        configWithExtends.push(
            ...createScopedExtends(expoFeature.extends, browserScopes, {
                expo: expoPlugin,
                "react-native": reactNativePlugin,
            }),
        )
    }

    if (nextFeature.enabled) {
        const nextPluginModule = requireCached<PluginModule>("@next/eslint-plugin-next")
        const nextPlugin = nextPluginModule.default ?? nextPluginModule

        if (nextFeature.recommended) {
            const nextVitals = requireCached<typeof import("eslint-config-next/core-web-vitals")>("eslint-config-next/core-web-vitals")
            const nextTs = requireCached<typeof import("eslint-config-next/typescript")>("eslint-config-next/typescript")
            configWithExtends.push(...createScopedExtends([...nextVitals, ...nextTs], browserScopes))
        } else configWithExtends.push(...createScopedExtends([{ plugins: { "@next/next": nextPlugin } }], browserScopes))

        configWithExtends.push(...createScopedExtends(nextFeature.extends, browserScopes, { "@next/next": nextPlugin }))
    }

    if (nodeFeature.enabled) {
        const nodePlugin = requireCached<NodePluginRuntime>("eslint-plugin-n")

        if (nodeFeature.recommended) {
            const preset = nodeFeature.options.preset ?? "script"
            const nodePresetConfig = nodePlugin.configs[nodePresetToConfigKey[preset]]
            if (!nodePresetConfig) throw new Error(`Unknown Node preset "${preset}". Expected one of: ${Object.keys(nodePresetToConfigKey).join(", ")}.`)
            configWithExtends.push(...createScopedExtends(normalizeUnknownExtends(nodePresetConfig), nodeScopes))
        } else configWithExtends.push(...createScopedExtends([{ plugins: { n: nodePlugin } }], nodeScopes))

        configWithExtends.push(...createScopedExtends(nodeFeature.extends, nodeScopes, { n: nodePlugin }))
    }

    const globalRules = rules ?? {}
    const nextRules = nextFeature.enabled ? nextFeature.rules : {}
    const reactRules = reactFeature.enabled ? reactFeature.rules : {}
    const expoRules = expoFeature.enabled ? expoFeature.rules : {}
    const nodeFeatureRules = nodeFeature.enabled ? nodeFeature.rules : {}

    const mergedBaseRules: RulesConfig = {
        ...defaultRules,
        ...withoutTypeAwareRules(globalRules),
    }

    const browserRules: RulesConfig = {
        ...mergedBaseRules,
        ...(reactFeature.enabled ? defaultReactRules : {}),
        ...(expoFeature.enabled ? defaultExpoRules : {}),
        ...(reactFeature.enabled && reactFeature.recommended
            ? {
                  "react-hooks/set-state-in-effect": "off",
              }
            : {}),
        ...(reactFeature.enabled && reactFeature.recommended && !(expoFeature.enabled && expoFeature.recommended)
            ? { "react-refresh/only-export-components": "off" }
            : {}),
        ...withoutTypeAwareRules(nextRules),
        ...withoutTypeAwareRules(reactRules),
        ...withoutTypeAwareRules(expoRules),
    }

    const nodeRules: RulesConfig = {
        ...mergedBaseRules,
        ...(nodeFeature.enabled ? defaultNodeRules : {}),
        ...withoutTypeAwareRules(nodeFeatureRules),
    }

    const mixedRules: RulesConfig = {
        ...browserRules,
        ...(nodeFeature.enabled ? defaultNodeRules : {}),
        ...withoutTypeAwareRules(nodeFeatureRules),
    }

    const appConfig: ConfigWithExtends[] = []

    if (resolvedDirectories.web.length > 0) appConfig.push(createRuntimeConfig(resolvedDirectories.web, "browser", browserRules, webIgnores))

    if (resolvedDirectories.node.length > 0) {
        appConfig.push({
            ...createRuntimeConfig(resolvedDirectories.node, "node", nodeRules),
            ...(nodeFeature.enabled ? { settings: createNodeVersionSettings(nodeVersion) } : {}),
        })
    }

    if (resolvedDirectories.mixed.length > 0) {
        appConfig.push({
            ...createRuntimeConfig(resolvedDirectories.mixed, "both", mixedRules),
            ...(nodeFeature.enabled ? { settings: createNodeVersionSettings(nodeVersion) } : {}),
        })
    }

    const config = [globalIgnores(resolvedIgnores), ...configWithExtends, ...appConfig]

    const expoProjectService = expoFeature.enabled ? { allowDefaultProject: expoDefaultProjectFiles } : true

    config.push(
        ...createTypeAwareConfig(
            [{ files: resolvedDirectories.web, ignores: webIgnores }],
            resolveTypeAwareRules(globalRules, nextRules, reactRules, expoRules),
            expoProjectService,
        ),
        ...createTypeAwareConfig([{ files: resolvedDirectories.node }], resolveTypeAwareRules(globalRules, nodeFeatureRules)),
        ...createTypeAwareConfig(
            [{ files: resolvedDirectories.mixed }],
            resolveTypeAwareRules(globalRules, nextRules, reactRules, expoRules, nodeFeatureRules),
            expoProjectService,
        ),
    )

    return _defineConfig(config)
}

export const config = defineConfig()

export default config
