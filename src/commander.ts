import { Command } from 'commander'
import { createTtsCommand } from './tts/create-tts-command.ts'
import { createImageCommand } from './image/create-image-command.ts'
import { createTextCommand } from './text/create-text-command.ts'
import { handleMetaWorkflow } from './text/utils/workflows.ts'
import { l, err, logInitialFunctionCall } from './logging.ts'
import { argv, exit, fileURLToPath, basename } from './node-utils.ts'
import type { ProcessingOptions } from '@/types.ts'

const program = new Command()

program
  .name('autoshow-cli')
  .description('Automate processing of audio/video content, manage meta-workflows, generate text-to-speech, and create AI images.')
  .version('1.0.0')

l.dim('[commander] Adding commands to program')
program.addCommand(createTextCommand())
program.addCommand(createTtsCommand())
program.addCommand(createImageCommand())

program
  .option('--metaDir <dirName>', 'The meta-workflow directory name (e.g., "01-ai") located inside current directory')
  .option('--metaSrcDir <sourceDir>', 'The meta-workflow source data directory (e.g., "autoshow-daily", "mk-auto"), relative to current directory')
  .option('--metaDate <dates...>', 'The dates for the meta-workflow shownotes (YYYY-MM-DD format), allows multiple dates')
  .option('--metaInfo', 'Run the meta-workflow for information gathering')
  .option('--metaShownotes', 'Run the meta-workflow for shownotes generation')
  .action(async (options: ProcessingOptions & { metaDate?: string | string[] }) => {
    logInitialFunctionCall('autoshowCLI', options)
    l.dim('[commander] Attempting to handle meta workflow')
    const workflowHandled = await handleMetaWorkflow(options)
    if (!workflowHandled) {
      l.dim('[commander] No meta workflow handled, showing help')
      program.help()
    }
  })

program.on('command:*', () => {
  err(`Error: Invalid command '${program.args.join(' ')}'. Use --help to see available commands.`)
  exit(1)
})

const thisFilePath = fileURLToPath(import.meta.url)
if (argv[1] === thisFilePath || basename(argv[1] ?? '') === 'commander.ts') {
  l.dim('[commander] Parsing command line arguments')
  program.parseAsync(argv)
}