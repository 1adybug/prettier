import { FC } from "react"

const App: FC = () => <div className="z-50 m-2 flex flex-col p-4 text-red-500">Hello, World!</div>

if (process.env.NODE_ENV === "development") {
    for (let i = 0; i < 10; i++) console.log(i)
}

export default App
