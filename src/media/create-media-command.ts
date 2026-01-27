import { Command } from 'commander'
import { l, err } from '@/logging'
import { downloadAudioFromUrls } from './save-audio-urls'
import { convertLocalAudioFiles } from './save-audio-files'

export const AUDIO_FMT = 'mp3'
export const AUDIO_Q = '0'

export const createMediaCommand = (): Command => {
  const media = new Command('media')
    .description('Media file operations for downloading and converting audio/video content')

  media
    .command('download')
    .description('Download audio from URLs listed in a markdown file')
    .option('--urls <markdownFile>', 'Path to markdown file containing URLs')
    .option('--verbose', 'Display detailed output from external tools')
    .action(async (options) => {
      l.opts(`Downloading audio from: ${options.urls}`)
      
      try {
        if (!options.urls) {
          err('Error: --urls option is required for download command')
        }
        
        await downloadAudioFromUrls(options.urls, options.verbose || false)
        l.success('Audio download completed successfully')
      } catch (error) {
        err(`Error downloading audio: ${(error as Error).message}`)
      }
    })

  media
    .command('convert')
    .description('Convert local audio/video files to optimized MP3 format')
    .option('--files <source>', 'Source directory or file containing media files')
    .option('--output <directory>', 'Output directory (default: output)')
    .option('--verbose', 'Display detailed output from external tools')
    .action(async (options) => {
      l.opts(`Converting media files from: ${options.files}`)
      
      try {
        if (!options.files) {
          err('Error: --files option is required for convert command')
        }
        
        await convertLocalAudioFiles(options.files, options.output, options.verbose || false)
        l.success('Media conversion completed successfully')
      } catch (error) {
        err(`Error converting audio files: ${(error as Error).message}`)
      }
    })

  return media
}