import { FC } from "react"

import Counter from "@/components/Counter"

const App: FC = () => (
    <div>
        <div className="z-50 m-2 flex flex-col p-4 text-red-500">Hello, World!</div>
        <Counter />
    </div>
)

if (process.env.NODE_ENV === "development") {
    for (let i = 0; i < 10; i++) console.log(i)
}

export default App
