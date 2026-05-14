export type CliFlagType =
  | BooleanConstructor
  | StringConstructor
  | [StringConstructor]
  | readonly [StringConstructor]

export type CliFlagDefinition = {
  description: string
  type: CliFlagType
  default?: unknown
  short?: string
  negatable?: boolean
  help?: Record<string, unknown>
}

export type CliFlagsDefinition = Record<string, CliFlagDefinition>

export type CliParameterDefinition = {
  key: string
  description?: string
}

export type CliHelpGroup = readonly [key: string, label: string]

export type CliHelpDefinition = {
  group?: string
  examples?: ReadonlyArray<readonly [command: string, description: string]>
  notes?: readonly string[]
}

export type CliRawParsed = {
  doubleDash: string[]
  explicitFlags: Set<string>
  unknown: Record<string, unknown>
}

export type CliParameterValues = Record<string, string> & {
  action: string
  input: string
  outputDir: string
  prompt: string
}

export type CliFlagValues = Record<string, unknown> & {
  aws?: unknown
  doctor?: unknown
  gcloud?: unknown
  models?: unknown
  out?: unknown
  refresh?: unknown
  repeat?: unknown
  sample?: unknown
  step?: unknown
}

export type CliCommandContext = {
  calledAs?: string
  command?: CliCommandDefinition
  flags: CliFlagValues
  parameters: CliParameterValues
  rawParsed: CliRawParsed
  store: Record<string, unknown>
}

export type CliCommandHandler = (ctx: CliCommandContext) => void | Promise<void>

export type CliCommandDefinition = {
  name: string
  description: string
  parameters?: readonly CliParameterDefinition[]
  flags?: CliFlagsDefinition
  help?: CliHelpDefinition
  allowUnknownFlags?: boolean
  allowExcessParameters?: boolean
  handler: CliCommandHandler
}

export type CliRootDefinition = {
  name: string
  scriptName: string
  description: string
  version: string
  globalFlags: CliFlagsDefinition
  commandGroups: readonly CliHelpGroup[]
  flagGroups: readonly CliHelpGroup[]
}

export type CliParseMode = 'command' | 'help' | 'version'

export type CliParseResult = {
  mode: CliParseMode
  argv: string[]
  calledAs?: string
  command?: CliCommandDefinition
  flags: CliFlagValues
  parameters: CliParameterValues
  rawParsed: CliRawParsed
}

export const defineCliCommand = (
  definition: Omit<CliCommandDefinition, 'handler'>,
  handler: CliCommandHandler
): CliCommandDefinition => ({
  ...definition,
  handler
})
