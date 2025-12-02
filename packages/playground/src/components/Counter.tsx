import { ComponentProps, FC, useState } from "react"

import { clsx, StrictOmit } from "deepsea-tools"

export interface CounterProps extends StrictOmit<ComponentProps<"div">, "children"> {}

const Counter: FC<CounterProps> = ({ className, ...rest }) => {
    const [count, setCount] = useState(0)
    return (
        <div className={clsx("flex", className)} {...rest}>
            <button onClick={() => setCount(count + 1)}>Increment</button>
            <span>{count}</span>
            <button onClick={() => setCount(count - 1)}>Decrement</button>
        </div>
    )
}

export default Counter
