let jsonModeActive = false

export const enableJsonResult = (): void => {
  jsonModeActive = true
}

export const isJsonResultActive = (): boolean => jsonModeActive

export const emitResult = (data: Record<string, unknown>): void => {
  if (!jsonModeActive) {
    return
  }
  process.stdout.write(JSON.stringify(data) + '\n')
}
