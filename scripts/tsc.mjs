// @ts-check

import { spawnAsync } from "soda-nodejs"

async function main() {
    const { readdir, readFile, stat } = await import("fs/promises")
    const { join } = await import("path")
    const dir = "packages"
    const dir2 = await readdir(dir)

    /** @type {string[]} */
    const packages2 = []

    for (const item of dir2) {
        const stat2 = await stat(join(dir, item))
        if (!stat2.isDirectory()) continue
        const dir3 = await readdir(join(dir, item))
        if (!dir3.includes("package.json")) continue
        const packageJson = JSON.parse(await readFile(join(dir, item, "package.json"), "utf-8"))
        if (packageJson.private) continue
        packages2.push(packageJson.name)
    }

    for (const item of packages2) {
        console.log(join(dir, item))
        await spawnAsync("bunx", ["tsc", "--noEmit"], {
            cwd: join(dir, item),
            stdio: "inherit",
        })
    }
}

main()
