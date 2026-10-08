import type { Parser, ParserOptions, Plugin } from "prettier"
import { parsers as babelParsers } from "prettier/plugins/babel"
import { parsers as typescriptParsers } from "prettier/plugins/typescript"

// Composition factories own their parser pipeline; these adapters only make
// this printer plugin discoverable to parser-based tools such as plugin-merge.
const PARSER_ADAPTER = Symbol.for("@1adybug/prettier.parser-adapter")

type ParserLike = Parser | (() => Parser | Promise<Parser>)

interface ParserAdapter extends Parser {
    [PARSER_ADAPTER]: true
}

interface Delegate {
    parser: Parser
    plugins: Plugin[]
    options?: ParserOptions
}

const baseParsers: Record<string, Parser> = {
    babel: babelParsers.babel,
    "babel-ts": babelParsers["babel-ts"],
    typescript: typescriptParsers.typescript,
}

export const parsers: Record<string, Parser> = {}

for (const [name, base] of Object.entries(baseParsers)) {
    const delegates = new WeakMap<ParserOptions, Promise<Delegate>>()

    async function resolveDelegate(options: ParserOptions): Promise<Delegate> {
        const plugins = options.plugins.filter((plugin): plugin is Plugin => typeof plugin !== "string")
        const ownIndex = plugins.findLastIndex(plugin => plugin.parsers?.[name] === parsers[name])

        for (let index = ownIndex - 1; index >= 0; index--) {
            const candidate = plugins[index].parsers?.[name] as ParserLike | undefined
            if (!candidate) continue

            const parser = typeof candidate === "function" ? await candidate() : candidate

            if (parser.astFormat === "estree") return { parser, plugins: plugins.slice(0, index + 1) }
        }

        return { parser: base, plugins: ownIndex >= 0 ? plugins.slice(0, ownIndex) : [] }
    }

    function getDelegate(options: ParserOptions): Promise<Delegate> {
        let delegate = delegates.get(options)

        if (!delegate) {
            delegate = resolveDelegate(options)
            delegates.set(options, delegate)
        }

        return delegate
    }

    function getDelegatedOptions(delegate: Delegate, options: ParserOptions): ParserOptions {
        delegate.options ??= { ...options, plugins: delegate.plugins }
        Object.assign(delegate.options, options, { plugins: delegate.plugins })
        return delegate.options
    }

    parsers[name] = {
        ...base,
        [PARSER_ADAPTER]: true,
        async preprocess(text, options) {
            const delegate = await getDelegate(options)
            const delegatedOptions = getDelegatedOptions(delegate, options)

            return delegate.parser.preprocess ? delegate.parser.preprocess(text, delegatedOptions) : text
        },
        async parse(text, options) {
            const delegate = await getDelegate(options)

            return delegate.parser.parse(text, getDelegatedOptions(delegate, options))
        },
    } as ParserAdapter
}
