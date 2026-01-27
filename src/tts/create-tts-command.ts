import { Command } from 'commander'
import { err, success } from '@/logging'
import { 
  existsSync, mkdirSync
} from '@/node-utils'
import { listModels } from './tts-commands/list-command'
import { downloadModel } from './tts-commands/download-command'
import { processFileWithEngine } from './tts-commands/file-command'
import { processScriptWithEngine } from './tts-commands/script-command'
import { detectEngine } from './tts-utils/engine-utils'

const OUTDIR = 'output'

const sharedOptions = (cmd: Command): Command => cmd
  .option('--coqui', 'Use Coqui TTS engine (default)')
  .option('--elevenlabs', 'Use ElevenLabs engine')
  .option('--polly', 'Use AWS Polly engine')
  .option('--kitten', 'Use Kitten TTS engine (lightweight, CPU-only)')
  .option('--qwen3', 'Use Qwen3 TTS engine')
  .option('--chatterbox', 'Use Chatterbox TTS engine (GPU/MPS recommended)')
  .option('--chatterbox-model <model>', 'Chatterbox model: turbo, standard, multilingual (default: turbo)')
  .option('--chatterbox-language <lang>', 'Language for multilingual model (e.g., en, fr, zh, ja)')
  .option('--chatterbox-device <device>', 'Device override: cpu, mps, cuda')
  .option('--chatterbox-dtype <dtype>', 'Dtype override: float32, float16, bfloat16')
  .option('--chatterbox-exaggeration <n>', 'Exaggeration level 0.0-1.0 (standard model)', parseFloat)
  .option('--chatterbox-cfg <n>', 'CFG weight 0.0-1.0 (standard model)', parseFloat)
  .option('--fish-audio', 'Use FishAudio TTS engine (S1-mini)')
  .option('--fish-language <lang>', 'Language code: en, zh, ja, de, fr, es, ko, etc.')
  .option('--fish-api-url <url>', 'FishAudio API server URL (default: http://localhost:8080)')
  .option('--fish-emotion <emotion>', 'Emotion marker: excited, sad, whispering, etc.')
  .option('--fish-device <device>', 'Device override: cpu, mps, cuda')
  .option('--cosyvoice', 'Use CosyVoice3 TTS engine (multilingual, voice cloning)')
  .option('--cosy-mode <mode>', 'CosyVoice mode: instruct (default), zero_shot, cross_lingual')
  .option('--cosy-language <lang>', 'Language: auto, zh, en, ja, ko, de, es, fr, it, ru')
  .option('--cosy-api-url <url>', 'CosyVoice API server URL (default: http://localhost:50000)')
  .option('--cosy-instruct <text>', 'Voice instruction (e.g., "Speak with enthusiasm", "Use Cantonese")')
  .option('--cosy-stream', 'Enable streaming inference')
  .option('--coqui-model <model>', 'Coqui model name or path (default: tacotron2-DDC, use "xtts" for XTTS v2)')
  .option('--kitten-model <model>', 'Kitten model name (default: KittenML/kitten-tts-nano-0.1)')
  .option('--qwen3-model <model>', 'Qwen3 model variant (CustomVoice, VoiceDesign, Base)')
  .option('--qwen3-speaker <name>', 'Qwen3 speaker: Vivian, Serena, Uncle_Fu, Dylan, Eric, Ryan, Aiden, Ono_Anna, Sohee')
  .option('--qwen3-instruct <text>', 'Qwen3 natural language voice control')
  .option('--qwen3-mode <mode>', 'Qwen3 generation mode: custom, design, clone')
  .option('--qwen3-language <lang>', 'Qwen3 language: Auto, Chinese, English, Japanese, Korean, German, French, Russian, Portuguese, Spanish, Italian')
  .option('--qwen3-max-chunk <n>', 'Qwen3 max chunk size for long text (default: 500)', parseInt)
  .option('--ref-audio <path>', 'Reference audio for voice cloning (qwen3 clone mode)')
  .option('--ref-text <text>', 'Transcript of reference audio (qwen3 clone mode)')
  .option('--voice <name>', 'Voice ID (elevenlabs) or voice name (polly/kitten)')
  .option('--speaker <name>', 'Speaker name for Coqui TTS')
  .option('--voice-clone <path>', 'Path to voice sample for cloning (coqui XTTS)')
  .option('--language <code>', 'Language code for multi-lingual models (coqui/polly)')
  .option('--polly-format <format>', 'Polly output format: mp3, ogg_vorbis, pcm (default: mp3)')
  .option('--polly-sample-rate <rate>', 'Polly sample rate: 8000, 16000, 22050, 24000 (default: 24000)')
  .option('--polly-engine <engine>', 'Polly engine: standard, neural (auto-selected based on voice)')
  .option('--output <dir>', 'Output directory', OUTDIR)
  .option('--speed <number>', 'Speed 0.25-4.0 (coqui/kitten/qwen3)', parseFloat)

const handleAction = async (action: string, runner: () => Promise<void>): Promise<void> => {
  try {
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
      await Promise.all(models.map(async m => { await downloadModel(m) }))
    }))

  sharedOptions(tts.command('file').description('Generate speech from a markdown file')
    .argument('<filePath>', 'Path to the markdown file'))
    .action(async (filePath, options) => handleAction('file', async () => {
      if (!existsSync(filePath)) err(`File not found: ${filePath}`)
      
      const outputDir = options.output || OUTDIR
      if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true })
      }
      
      await processFileWithEngine(detectEngine(options), filePath, outputDir, options)
      success(`Speech saved to ${outputDir} 🔊`)
    }))

  sharedOptions(tts.command('script').description('Generate speech from a JSON script file')
    .argument('<scriptPath>', 'Path to the JSON script file'))
    .action(async (scriptPath, options) => handleAction('script', async () => {
      if (!existsSync(scriptPath)) err(`Script file not found: ${scriptPath}`)
      await processScriptWithEngine(detectEngine(options), scriptPath, options.output || OUTDIR, options)
    }))

  return tts
}