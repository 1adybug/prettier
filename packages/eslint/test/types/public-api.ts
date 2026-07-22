import defaultConfig, {
    type DefineConfigParams,
    type NextFeatureOptions,
    type NodeFeatureOptions,
    type NodePreset,
    type ReactFeatureOptions,
    type RuntimeDirectories,
    defineConfig,
} from "@1adybug/eslint"

const preset: NodePreset = "mixed"

const directories: RuntimeDirectories = {
    web: "client/**/*.tsx",
    node: ["server/**/*.ts"],
    mixed: "shared/**/*.ts",
}

const next: NextFeatureOptions = { enabled: true, recommended: false }

const react: ReactFeatureOptions = { enabled: true, recommended: false }

const node: NodeFeatureOptions = { enabled: true, preset, version: ">=24.0.0" }

const params: DefineConfigParams = {
    next,
    react,
    node,
    target: "both",
    directories,
    ignores: ["coverage/**"],
    rules: { "prefer-template": "error" },
}

const generatedConfig = defineConfig(params)

void defaultConfig
void generatedConfig

// @ts-expect-error NodePreset rejects unsupported values.
const invalidPreset: NodePreset = "invalid"

void invalidPreset

// @ts-expect-error RuntimeTarget rejects unsupported values.
const invalidParams: DefineConfigParams = { target: "invalid" }

void invalidParams
