import { Command } from 'commander'
import { createTtsCommand } from './tts/create-tts-command'
import { createImageCommand } from './image/create-image-command'
import { createVideoCommand } from './video/create-video-command'
import { createMusicCommand } from './music/create-music-command'
import { createTextCommand } from './text/create-text-command'
import { createMediaCommand } from './media/create-media-command'
import { createExtractCommand } from './extract/create-extract-command'
import { err, resetColorsCache } from '@/logging'
import { argv, exit, fileURLToPath, basename, readFileSync } from '@/node-utils'
import { initCliContext, EXIT_USAGE, installSignalHandlers } from '@/utils'

installSignalHandlers()

const packageJsonPath = new URL('../package.json', import.meta.url)
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
const VERSION = packageJson.version || '0.0.0'

const program = new Command()

program
  .name('autoshow-cli')
  .description('Automate processing of audio/video content, manage meta-workflows, generate text-to-speech, create AI images, videos, handle media operations, and extract text from PDFs.')
  .version(VERSION)
  
  .option('--no-color', 'Disable colored output')
  .option('--json', 'Output results as JSON (machine-readable)')
  .option('--plain', 'Output plain text without formatting (for piping to grep, awk, etc.)')
  .option('-q, --quiet', 'Suppress non-essential output')
  .option('--no-input', 'Disable all interactive prompts (for scripting)')
  
  .option('--timeout <ms>', 'Network request timeout in milliseconds (default: 30000)', parseInt)
  .option('--max-retries <n>', 'Maximum retry attempts for failed requests (default: 7)', parseInt)
  .option('--skip-existing', 'Skip processing items that already have output files')

program.addHelpText('beforeAll', `
Quick Start:
  $ autoshow-cli text --video <url>        Process a YouTube video
  $ autoshow-cli text --file <path>        Process a local audio file
  $ autoshow-cli text --rss <url>          Process a podcast RSS feed

`)

program.addHelpText('after', `
Examples:
  $ autoshow-cli text --video "https://www.youtube.com/watch?v=MORMZXEaONk"
  $ autoshow-cli text --file ./input/audio.mp3 --whisper --chatgpt
  $ autoshow-cli tts file ./input/sample.md --coqui
  $ autoshow-cli image generate -p "a sunset over mountains"
  $ autoshow-cli video generate -p "ocean waves" -m veo-3.0-fast-generate-preview

Global Options:
  --no-color       Disable colored output (also respects NO_COLOR env var)
  --json           Output results as JSON for scripting
  --plain          Plain text output for piping to other tools
  -q, --quiet      Suppress progress and informational messages
  --no-input       Disable interactive prompts (for scripting)
  --timeout <ms>   Network request timeout (default: 30000ms)
  --max-retries    Max retry attempts for failed requests (default: 7)
  --skip-existing  Skip items that already have output files

Report issues: https://github.com/autoshow/autoshow-cli/issues
`)

program.hook('preAction', (_thisCommand) => {
  
  const opts = program.opts()
  
  
  initCliContext({
    noColor: opts['color'] === false, 
    json: opts['json'] === true,
    plain: opts['plain'] === true,
    quiet: opts['quiet'] === true,
    noInput: opts['input'] === false, 
    timeout: opts['timeout'],
    maxRetries: opts['maxRetries'],
    skipExisting: opts['skipExisting'] === true
  })
  
  
  resetColorsCache()
})

program.addCommand(createTextCommand())
program.addCommand(createTtsCommand())
program.addCommand(createImageCommand())
program.addCommand(createVideoCommand())
program.addCommand(createMusicCommand())
program.addCommand(createMediaCommand())
program.addCommand(createExtractCommand())

program.on('command:*', () => {
  err(`Error: Invalid command '${program.args.join(' ')}'. Use --help to see available commands.`, undefined, EXIT_USAGE)
  exit(EXIT_USAGE)
})

const thisFilePath = fileURLToPath(import.meta.url)
if (argv[1] === thisFilePath || basename(argv[1] ?? '') === 'commander.ts') {
  program.parseAsync(argv)
}
