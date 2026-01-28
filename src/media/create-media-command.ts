import { Command } from 'commander'
import { l, err, success } from '@/logging'
import { downloadAudioFromUrls } from './save-audio-urls'
import { convertLocalAudioFiles } from './save-audio-files'
import { createJsonOutput, setJsonError, outputJson, type MediaJsonOutput } from '@/utils'

export const AUDIO_FMT = 'mp3'
export const AUDIO_Q = '0'

export const createMediaCommand = (): Command => {
  const media = new Command('media')
    .description('Media file operations for downloading and converting audio/video content')

  media
    .command('download')
    .description('Download audio from URLs listed in a markdown file')
    .option('-u, --urls <markdownFile>', 'Path to markdown file containing URLs')
    .option('-v, --verbose', 'Display detailed output from external tools')
    .action(async (options) => {
      const jsonBuilder = createJsonOutput<MediaJsonOutput>('media')
      l('Downloading audio from file', { file: options.urls })
      
      try {
        if (!options.urls) {
          setJsonError(jsonBuilder, '--urls option is required for download command')
          outputJson(jsonBuilder)
          err('Error: --urls option is required for download command')
        }
        
        await downloadAudioFromUrls(options.urls, options.verbose || false)
        jsonBuilder.output.data = {
          inputPath: options.urls,
          outputPaths: [],
          operation: 'download'
        }
        outputJson(jsonBuilder)
        success('Audio download completed successfully')
      } catch (error) {
        setJsonError(jsonBuilder, error as Error)
        outputJson(jsonBuilder)
        err('Error downloading audio', { error: (error as Error).message })
      }
    })

  media
    .command('convert')
    .description('Convert local audio/video files to optimized MP3 format')
    .option('-f, --files <source>', 'Source directory or file containing media files')
    .option('-o, --output <directory>', 'Output directory (default: output)')
    .option('-v, --verbose', 'Display detailed output from external tools')
    .action(async (options) => {
      const jsonBuilder = createJsonOutput<MediaJsonOutput>('media')
      l('Converting media files from directory', { source: options.files })
      
      try {
        if (!options.files) {
          setJsonError(jsonBuilder, '--files option is required for convert command')
          outputJson(jsonBuilder)
          err('Error: --files option is required for convert command')
        }
        
        await convertLocalAudioFiles(options.files, options.output, options.verbose || false)
        jsonBuilder.output.data = {
          inputPath: options.files,
          outputPaths: [],
          operation: 'convert'
        }
        outputJson(jsonBuilder)
        success('Media conversion completed successfully')
      } catch (error) {
        setJsonError(jsonBuilder, error as Error)
        outputJson(jsonBuilder)
        err('Error converting audio files', { error: (error as Error).message })
      }
    })

  media.addHelpText('after', `
Examples:
  $ autoshow-cli media download --urls ./input/example-urls.md
  $ autoshow-cli media convert --files ./input/ --output ./output/
  $ autoshow-cli media convert --files ./input/audio.mp3 --verbose
`)

  return media
}