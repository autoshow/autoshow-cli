import { Command } from 'commander'
import { createTtsCommand } from './tts/create-tts-command'
import { createImageCommand } from './image/create-image-command'
import { createVideoCommand } from './video/create-video-command'
import { createMusicCommand } from './music/create-music-command'
import { createTextCommand } from './text/create-text-command'
import { createMediaCommand } from './media/create-media-command'
import { createExtractCommand } from './extract/create-extract-command'
import { err } from '@/logging'
import { argv, exit, fileURLToPath, basename } from '@/node-utils'

const program = new Command()

program
  .name('autoshow-cli')
  .description('Automate processing of audio/video content, manage meta-workflows, generate text-to-speech, create AI images, videos, handle media operations, and extract text from PDFs.')
  .version('1.0.0')

program.addCommand(createTextCommand())
program.addCommand(createTtsCommand())
program.addCommand(createImageCommand())
program.addCommand(createVideoCommand())
program.addCommand(createMusicCommand())
program.addCommand(createMediaCommand())
program.addCommand(createExtractCommand())

program.on('command:*', () => {
  err(`Error: Invalid command '${program.args.join(' ')}'. Use --help to see available commands.`)
  exit(1)
})

const thisFilePath = fileURLToPath(import.meta.url)
if (argv[1] === thisFilePath || basename(argv[1] ?? '') === 'commander.ts') {
  program.parseAsync(argv)
}