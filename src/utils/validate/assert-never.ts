

export function assertNever(x: never): never {
  throw new Error(`Unreachable state reached: ${JSON.stringify(x)}`)
}
