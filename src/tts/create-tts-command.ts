import { Command } from 'commander'
import { l, err } from '../logging.ts'
import { 
  existsSync, mkdirSync
} from '../node-utils.ts'
import { downloadModel, detectEngine, listModels, processFileWithEngine, processScriptWithEngine } from './tts-utils.ts'

const OUTDIR = 'output'

const sharedOptions = (cmd: Command): Command => cmd
  .option('--coqui', 'Use Coqui TTS engine (default)')
  .option('--elevenlabs', 'Use ElevenLabs engine')
  .option('--openai-tts', 'Use OpenAI TTS engine')
  .option('--polly', 'Use AWS Polly engine')
  .option('--openai-model <model>', 'OpenAI model: tts-1, tts-1-hd, gpt-4o-mini-tts (default: tts-1)')
  .option('--coqui-model <model>', 'Coqui model name or path (default: tacotron2-DDC, use "xtts" for XTTS v2)')
  .option('--voice <name>', 'Voice ID (elevenlabs) or voice name (openai/polly)')
  .option('--speaker <name>', 'Speaker name for Coqui TTS')
  .option('--voice-clone <path>', 'Path to voice sample for cloning (coqui XTTS)')
  .option('--language <code>', 'Language code for multi-lingual models (coqui/polly)')
  .option('--polly-format <format>', 'Polly output format: mp3, ogg_vorbis, pcm (default: mp3)')
  .option('--polly-sample-rate <rate>', 'Polly sample rate: 8000, 16000, 22050, 24000 (default: 24000)')
  .option('--polly-engine <engine>', 'Polly engine: standard, neural (auto-selected based on voice)')
  .option('--output <dir>', 'Output directory', OUTDIR)
  .option('--output-format <format>', 'Output format: mp3, opus, aac, flac, wav, pcm (openai)', 'mp3')
  .option('--speed <number>', 'Speed 0.25-4.0 (openai/coqui)', parseFloat)

const handleAction = async (action: string, runner: () => Promise<void>): Promise<void> => {
  try {
    l.dim(`Starting TTS ${action} action`)
    await runner()
  } catch (error) {
    err(`Error ${action === 'list' ? 'listing models' : action === 'download' ? 'downloading models' : 'generating speech'}: ${error}`)
  }
}

export const createTtsCommand = (): Command => {
  const tts = new Command('tts').description('Text-to-speech operations')

  tts.command('list').description('List available models')
    .action(async () => handleAction('list', listModels))

  tts.command('download').description('Download TTS models')
    .argument('<models...>', 'Model IDs to download')
    .action(async (models: string[]) => handleAction('download', async () => {
      await Promise.all(models.map(async m => { l.dim(`Downloading model: ${m}`); await downloadModel(m) }))
    }))

  sharedOptions(tts.command('file').description('Generate speech from a markdown file')
    .argument('<filePath>', 'Path to the markdown file')
    .option('--instructions <text>', 'Voice instructions (openai gpt-4o-mini-tts only)'))
    .action(async (filePath, options) => handleAction('file', async () => {
      l.dim(`Generating speech from ${filePath}`)
      if (!existsSync(filePath)) err(`File not found: ${filePath}`)
      
      const outputDir = options.output || OUTDIR
      if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true })
      }
      
      await processFileWithEngine(detectEngine(options), filePath, outputDir, options)
      l.dim(`Speech saved to ${outputDir} 🔊`)
    }))

  sharedOptions(tts.command('script').description('Generate speech from a JSON script file')
    .argument('<scriptPath>', 'Path to the JSON script file'))
    .action(async (scriptPath, options) => handleAction('script', async () => {
      l.dim(`Processing script from ${scriptPath}`)
      if (!existsSync(scriptPath)) err(`Script file not found: ${scriptPath}`)
      await processScriptWithEngine(detectEngine(options), scriptPath, options.output || OUTDIR, options)
    }))

  return tts
}