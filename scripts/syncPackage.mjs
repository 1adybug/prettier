// @ts-check

/**
 * 同步包
 * @param {string} packageName 包名
 */
function syncPackage(packageName) {
    return fetch(`https://registry-direct.npmmirror.com/-/package/${packageName}/syncs`, {
        referrer: "https://npmmirror.com/",
        referrerPolicy: "strict-origin-when-cross-origin",
        method: "PUT",
        mode: "cors",
        credentials: "omit",
    })
}

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

    await Promise.all(packages2.map(syncPackage))
}

main()
