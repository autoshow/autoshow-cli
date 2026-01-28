import { getCliContext } from './cli-context.ts'

const shownWarnings = new Set<string>()

export type DeprecationInfo = {
  feature: string
  removeIn: string
  replacement?: string
  message?: string
}

export function deprecate(info: DeprecationInfo): void {
  const ctx = getCliContext()
  
  if (ctx.quiet || ctx.format === 'json') {
    return
  }
  
  const key = `${info.feature}:${info.removeIn}`
  if (shownWarnings.has(key)) {
    return
  }
  shownWarnings.add(key)
  
  const lines: string[] = []
  lines.push(`DEPRECATION WARNING: '${info.feature}' is deprecated and will be removed in ${info.removeIn}.`)
  
  if (info.replacement) {
    lines.push(`  Use '${info.replacement}' instead.`)
  }
  
  if (info.message) {
    lines.push(`  ${info.message}`)
  }
  
  const warning = lines.join('\n')
  if (!ctx.noColor) {
    console.error(`\x1b[33m${warning}\x1b[0m`)
  } else {
    console.error(warning)
  }
}

export function createDeprecatedFlagHandler(
  deprecatedFlag: string,
  replacementFlag: string | undefined,
  removeIn: string
): (value: string, previous: unknown) => string {
  return (value: string, _previous: unknown) => {
    deprecate({
      feature: deprecatedFlag,
      removeIn,
      replacement: replacementFlag
    })
    return value
  }
}

export function resetDeprecationWarnings(): void {
  shownWarnings.clear()
}
