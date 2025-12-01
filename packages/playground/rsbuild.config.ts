import { defineConfig } from "@rsbuild/core"
import { pluginBabel } from "@rsbuild/plugin-babel"
import { pluginReact } from "@rsbuild/plugin-react"
import { pluginSvgr } from "@rsbuild/plugin-svgr"

export default defineConfig({
    html: {
        title: "playground",
        meta: {
            description: "designed by someone",
        },
        mountId: "root",
    },
    plugins: [
        pluginReact(),
        pluginBabel({
            include: /\.(?:jsx|tsx)$/,
            babelLoaderOptions(config) {
                config.plugins ??= []
                config.plugins?.unshift("babel-plugin-react-compiler")
            },
        }),
        pluginSvgr({
            svgrOptions: {
                exportType: "default",
                svgoConfig: {
                    plugins: [
                        {
                            name: "prefixIds",
                            params: {
                                prefixIds: false,
                                prefixClassNames: false,
                            },
                        },
                    ],
                },
            },
        }),
    ],
    server: {
        port: 5173,
    },
    output: {
        polyfill: "entry",
    },
})
