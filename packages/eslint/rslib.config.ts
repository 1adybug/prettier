import { defineConfig } from "@rslib/core"

export default defineConfig({
    lib: [
        {
            format: "esm",
            syntax: ["node 24"],
            dts: true,
        },
        {
            format: "cjs",
            syntax: ["node 24"],
        },
    ],
})
