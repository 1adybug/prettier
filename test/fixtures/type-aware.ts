/** @deprecated Use currentValue instead. */
const legacyValue = 1

const copiedValue = legacyValue

const record: { name: string } = { name: "Ada" }

enum Status {
    Ready,
}

console.log(copiedValue, record, Status)
