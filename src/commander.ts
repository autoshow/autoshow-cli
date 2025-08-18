import { Command } from 'commander'
import { createTtsCommand } from './tts/create-tts-command.ts'
import { createImageCommand } from './image/create-image-command.ts'
import { createVideoCommand } from './video/create-video-command.ts'
import { createTextCommand } from './text/create-text-command.ts'
import { createConfigCommand } from './config/create-config-command.ts'
import { createMediaCommand } from './media/create-media-command.ts'
import { createExtractCommand } from './extract/create-extract-command.ts'
import { createMusicCommand } from './music/create-music-command.ts'
import { l, err } from '@/logging'
import { argv, exit, fileURLToPath, basename } from '@/node-utils'

const program = new Command()

program
  .name('autoshow-cli')
  .description('Automate processing of audio/video content, manage meta-workflows, generate text-to-speech, create AI images, videos, music, handle media operations, and extract text from PDFs.')
  .version('1.0.0')

const p = '[commander]'
l.dim(`${p} Adding commands to program`)
program.addCommand(createTextCommand())
program.addCommand(createTtsCommand())
program.addCommand(createImageCommand())
program.addCommand(createVideoCommand())
program.addCommand(createMusicCommand())
program.addCommand(createConfigCommand())
program.addCommand(createMediaCommand())
program.addCommand(createExtractCommand())

program.on('command:*', () => {
  err(`Error: Invalid command '${program.args.join(' ')}'. Use --help to see available commands.`)
  exit(1)
})

const thisFilePath = fileURLToPath(import.meta.url)
if (argv[1] === thisFilePath || basename(argv[1] ?? '') === 'commander.ts') {
  l.dim(`${p} Parsing command line arguments`)
  program.parseAsync(argv)
}