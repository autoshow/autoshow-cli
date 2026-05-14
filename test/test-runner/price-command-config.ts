const CLI_ENTRY = 'src/cli/create-cli.ts'
export const EMPTY_PRICE_CONFIG_PATH = 'test/test-utils/fixtures/empty-autoshow-config.json'

const PROCESSING_COMMANDS = new Set([
  'metadata',
  'download',
  'extract',
  'write',
  'tts',
  'image',
  'music',
  'video',
  'resume',
])

const hasConfigPath = (args: string[]): boolean =>
  args.some((arg) => arg === '--config-path' || arg.startsWith('--config-path='))

export const withEmptyPriceConfig = (args: string[]): string[] => {
  if (args[0] !== CLI_ENTRY || hasConfigPath(args)) {
    return args
  }

  const command = args[1]
  if (typeof command !== 'string' || !PROCESSING_COMMANDS.has(command)) {
    return args
  }

  return [...args, '--config-path', EMPTY_PRICE_CONFIG_PATH]
}
