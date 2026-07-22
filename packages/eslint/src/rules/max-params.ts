import type { Plugin, RuleDefinition } from "@eslint/core"

interface AstNode {
    type: string
    parent?: AstNode | null
    arguments?: AstNode[]
    params?: AstNode[]
    name?: string
    typeAnnotation?: TypeAnnotationContainer
}

interface TypeAnnotationContainer {
    typeAnnotation?: AstNode
}

interface FunctionNode extends AstNode {
    params: AstNode[]
}

interface MaxParamsOptions {
    countVoidThis?: boolean
    ignoreCallbacks?: boolean
    max?: number
    maximum?: number
}

interface MaxParamsReportData {
    count: number
    max: number
}

interface MaxParamsReportDescriptor {
    node: AstNode
    messageId: "exceed"
    data: MaxParamsReportData
}

interface MaxParamsContext {
    options: Array<MaxParamsOptions | number>
    report(descriptor: MaxParamsReportDescriptor): void
}

const functionNodeTypes = new Set(["ArrowFunctionExpression", "FunctionDeclaration", "FunctionExpression", "TSDeclareFunction", "TSFunctionType"])

function isFunctionNode(node: AstNode): node is FunctionNode {
    return functionNodeTypes.has(node.type) && Array.isArray(node.params)
}

function isCallArgument(node: AstNode, parent: AstNode) {
    return (parent.type === "CallExpression" || parent.type === "NewExpression") && parent.arguments?.includes(node) === true
}

function isCallback(node: FunctionNode) {
    if (node.type === "TSDeclareFunction" || node.type === "TSFunctionType") return true

    let child: AstNode = node
    let parent = node.parent

    while (parent) {
        if (isCallArgument(child, parent)) return true
        if (parent.type === "JSXAttribute" || parent.type === "JSXElement" || parent.type === "JSXFragment") return true
        if (isFunctionNode(parent)) return false

        child = parent
        parent = parent.parent
    }

    return false
}

function isVoidThisParameter(node: AstNode | undefined) {
    return node?.type === "Identifier" && node.name === "this" && node.typeAnnotation?.typeAnnotation?.type === "TSVoidKeyword"
}

const callbackAwareMaxParamsRule = {
    meta: {
        type: "suggestion",
        docs: {
            description: "Enforce a maximum number of parameters while allowing externally defined callback signatures",
        },
        schema: [
            {
                oneOf: [
                    {
                        type: "integer",
                        minimum: 0,
                    },
                    {
                        type: "object",
                        properties: {
                            maximum: {
                                type: "integer",
                                minimum: 0,
                            },
                            max: {
                                type: "integer",
                                minimum: 0,
                            },
                            countVoidThis: {
                                type: "boolean",
                            },
                            ignoreCallbacks: {
                                type: "boolean",
                            },
                        },
                        additionalProperties: false,
                    },
                ],
            },
        ],
        messages: {
            exceed: "Function has too many parameters ({{count}}). Maximum allowed is {{max}}.",
        },
    },
    create(context: MaxParamsContext) {
        const option = context.options[0]
        const options = typeof option === "object" ? option : undefined
        const max = typeof option === "number" ? option : (options?.maximum ?? options?.max ?? 2)
        const countVoidThis = options?.countVoidThis ?? false
        const ignoreCallbacks = options?.ignoreCallbacks ?? true

        function checkFunction(node: FunctionNode) {
            if (ignoreCallbacks && isCallback(node)) return

            const count = isVoidThisParameter(node.params[0]) && !countVoidThis ? node.params.length - 1 : node.params.length

            if (count > max) {
                context.report({
                    node,
                    messageId: "exceed",
                    data: { count, max },
                })
            }
        }

        return {
            ArrowFunctionExpression: checkFunction,
            FunctionDeclaration: checkFunction,
            FunctionExpression: checkFunction,
            TSDeclareFunction: checkFunction,
            TSFunctionType: checkFunction,
        }
    },
} as unknown as RuleDefinition

export const toolingPlugin: Plugin = {
    meta: {
        name: "@1adybug/eslint",
    },
    rules: {
        "max-params": callbackAwareMaxParamsRule,
    },
}
