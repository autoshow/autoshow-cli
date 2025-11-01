import { l, err } from '@/logging'
import { execPromise, existsSync } from '@/node-utils'
import { ensureDiarizationEnvironment, runSetupWithRetry } from '../../utils/setup-helpers'
import { TRANSCRIPTION_SERVICES_CONFIG } from './transcription-models'
import type { ProcessingOptions } from '@/text/text-types'

async function ensureWhisperDiarizationEnv(): Promise<void> {
  const p = '[text/process-steps/02-run-transcription/whisper-diarization]'
  const pythonPath = './build/pyenv/whisper-diarization/bin/python'
  const scriptPath = './build/bin/whisper-diarize.py'
  
  if (!existsSync(pythonPath) || !existsSync(scriptPath)) {
    l.warn('Whisper-diarization environment not found, attempting automatic setup')
    
    const setupSuccess = await runSetupWithRetry(() => ensureDiarizationEnvironment(), 1)
    if (!setupSuccess) {
      err(`${p} Failed to automatically setup whisper-diarization environment`)
      throw new Error('Whisper-diarization environment setup failed. Run npm run setup:whisper-diarization')
    }
    
    l.success('Whisper-diarization environment successfully installed')
  }
  
  try {
    await execPromise(`${pythonPath} -c "import whisper,librosa,soundfile,scipy,torch,torchaudio,numpy"`, { maxBuffer: 10000 * 1024 })
  } catch (e: any) {
    err(`${p} Whisper-diarization dependencies validation failed: ${e.message}`)
    throw new Error('Whisper-diarization dependencies not properly installed')
  }
}

function formatWhisperDiarizationTranscript(output: string): string {
  const lines = output.trim().split('\n')
  let formattedTranscript = ''
  
  for (const line of lines) {
    const trimmedLine = line.trim()
    
    if (!trimmedLine) {
      continue
    }
    
    if (trimmedLine.includes('|') && (trimmedLine.includes('frames/s') || trimmedLine.includes('%|'))) {
      continue
    }
    
    if (trimmedLine.includes('torchaudio') || trimmedLine.includes('set_audio_backend')) {
      continue
    }
    
    if (trimmedLine.includes('Diarization unavailable') || 
        trimmedLine.includes('Using fallback') || 
        trimmedLine.includes('Reason:')) {
      continue
    }
    
    if (trimmedLine.includes('Traceback') || 
        trimmedLine.includes('File "') ||
        trimmedLine.includes('from ctc_forced_aligner')) {
      continue
    }
    
    if (trimmedLine.match(/^\d+%\|/) || 
        trimmedLine.match(/\d+\/\d+\s*\[/) ||
        trimmedLine.match(/\[\d+:\d+<\d+:\d+/)) {
      continue
    }
    
    if (trimmedLine.includes('Error:') || 
        trimmedLine.includes('Warning:') || 
        trimmedLine.includes('ImportError') ||
        trimmedLine.includes('ModuleNotFoundError')) {
      continue
    }
    
    if (trimmedLine.includes('[') && trimmedLine.includes(']')) {
      const timestampMatch = trimmedLine.match(/\[([^\]]+)\]/)
      
      if (timestampMatch) {
        const timestamp = timestampMatch[1]
        const afterTimestamp = trimmedLine.substring(trimmedLine.indexOf(']') + 1).trim()
        
        const speakerMatches = [...afterTimestamp.matchAll(/Speaker (\d+):/g)]
        
        if (speakerMatches.length > 1) {
          const lastSpeakerMatch = speakerMatches[speakerMatches.length - 1]
          if (lastSpeakerMatch && lastSpeakerMatch[1]) {
            const speaker = lastSpeakerMatch[1]
            const lastSpeakerIndex = afterTimestamp.lastIndexOf(`Speaker ${speaker}:`)
            const text = afterTimestamp.substring(lastSpeakerIndex + `Speaker ${speaker}:`.length).trim()
            
            if (text) {
              formattedTranscript += `[${timestamp}] Speaker ${speaker}: ${text}\n`
            }
          }
        } else if (speakerMatches.length === 1) {
          const firstMatch = speakerMatches[0]
          if (firstMatch && firstMatch[1]) {
            const speaker = firstMatch[1]
            const speakerIndex = afterTimestamp.indexOf(`Speaker ${speaker}:`)
            const text = afterTimestamp.substring(speakerIndex + `Speaker ${speaker}:`.length).trim()
            
            if (text) {
              formattedTranscript += `[${timestamp}] Speaker ${speaker}: ${text}\n`
            }
          }
        } else {
          const text = afterTimestamp.trim()
          if (text) {
            formattedTranscript += `[${timestamp}] Speaker 1: ${text}\n`
          }
        }
      }
    } else if (!trimmedLine.match(/^\s*$/) && !trimmedLine.includes('Speaker')) {
      formattedTranscript += trimmedLine + '\n'
    }
  }
  
  return formattedTranscript.trim() || '[00:00] Speaker 1: Transcription processing completed'
}

export async function callWhisperDiarization(
  options: ProcessingOptions,
  finalPath: string
): Promise<{ transcript: string; modelId: string; costPerMinuteCents: number }> {
  const p = '[text/process-steps/02-run-transcription/whisper-diarization]'
  
  try {
    const requestedModel = typeof options.whisperDiarization === 'string'
      ? options.whisperDiarization
      : 'medium.en'
    
    const configuredModel = TRANSCRIPTION_SERVICES_CONFIG.whisperDiarization.models.find(
      m => m.modelId === requestedModel
    )
    
    let modelId: string
    let costPerMinuteCents: number
    
    if (configuredModel) {
      modelId = configuredModel.modelId
      costPerMinuteCents = configuredModel.costPerMinuteCents
    } else {
      modelId = requestedModel
      costPerMinuteCents = 0
      l.warn(`Model ${requestedModel} not in predefined list, using it anyway with cost 0`)
    }
    
    await ensureWhisperDiarizationEnv()
    
    const audioFilePath = `${finalPath}.wav`
    const pythonPath = './build/pyenv/whisper-diarization/bin/python'
    const scriptPath = './build/bin/whisper-diarize.py'
    
    const diarizationArgs = [
      scriptPath,
      '-a', audioFilePath,
      '--whisper-model', modelId,
      '--device', 'cpu'
    ]
    
    if (options.speakerLabels === false) {
      diarizationArgs.push('--no-stem')
    }
    
    const { stdout, stderr } = await execPromise(
      `${pythonPath} ${diarizationArgs.join(' ')}`,
      { 
        maxBuffer: 50000 * 1024,
        cwd: process.cwd(),
        timeout: 300000
      }
    )
    
    const combinedOutput = stdout + '\n' + stderr
    const transcript = formatWhisperDiarizationTranscript(combinedOutput)
    
    if (!transcript || transcript.trim().length === 0) {
      throw new Error('No transcription output generated by whisper-diarization')
    }
    
    if (transcript.includes('Using fallback whisper-only transcription')) {
      l.warn('Diarization fell back to whisper-only mode')
    }
    
    return {
      transcript,
      modelId,
      costPerMinuteCents
    }
    
  } catch (error) {
    err(`${p} Error in whisper-diarization: ${(error as Error).message}`)
    throw error
  }
}