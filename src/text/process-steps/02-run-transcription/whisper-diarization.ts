import { l, err } from '@/logging'
import { execPromise, existsSync } from '@/node-utils'
import { TRANSCRIPTION_SERVICES_CONFIG } from './transcription-models'
import type { ProcessingOptions } from '@/text/text-types'

async function ensureWhisperDiarizationEnv(): Promise<void> {
  const p = '[text/process-steps/02-run-transcription/whisper-diarization]'
  const pythonPath = './build/pyenv/whisper-diarization/bin/python'
  const scriptPath = './build/bin/whisper-diarize.py'
  
  l.dim(`${p} Checking whisper-diarization environment`)
  
  if (!existsSync(pythonPath)) {
    err(`${p} Whisper-diarization Python environment not found at: ${pythonPath}`)
    throw new Error('Whisper-diarization environment is missing. Run npm run setup')
  }
  
  if (!existsSync(scriptPath)) {
    err(`${p} Whisper-diarization script not found at: ${scriptPath}`)
    throw new Error('Whisper-diarization script is missing. Run npm run setup')
  }
  
  try {
    await execPromise(`${pythonPath} -c "import whisper,librosa,soundfile,scipy,torch,ctc_forced_aligner,demucs"`, { maxBuffer: 10000 * 1024 })
    l.dim(`${p} Whisper-diarization environment dependencies verified`)
  } catch (e: any) {
    err(`${p} Whisper-diarization dependencies validation failed: ${e.message}`)
    throw new Error('Whisper-diarization dependencies not properly installed. Run npm run setup')
  }
  
  try {
    const compatibilityCheck = `${pythonPath} -c "
try:
    from ctc_forced_aligner import load_alignment_model
    print('COMPAT_OK')
except ImportError:
    try:
        from ctc_forced_aligner.alignment import load_model
        print('COMPAT_FALLBACK')
    except ImportError:
        print('COMPAT_ERROR')
"`
    const { stdout } = await execPromise(compatibilityCheck, { maxBuffer: 10000 * 1024 })
    const compatStatus = stdout.trim()
    
    if (compatStatus === 'COMPAT_ERROR') {
      l.warn(`${p} ctc_forced_aligner compatibility issue detected - using fallback mode`)
    } else {
      l.dim(`${p} ctc_forced_aligner compatibility: ${compatStatus}`)
    }
  } catch (e: any) {
    l.warn(`${p} Could not verify ctc_forced_aligner compatibility: ${e.message}`)
  }
}

function formatWhisperDiarizationTranscript(output: string): string {
  const p = '[text/process-steps/02-run-transcription/whisper-diarization]'
  const lines = output.trim().split('\n')
  let formattedTranscript = ''
  let filteredCount = 0
  let duplicateFixCount = 0
  
  for (const line of lines) {
    const trimmedLine = line.trim()
    
    if (!trimmedLine) {
      continue
    }
    
    if (trimmedLine.includes('|') && (trimmedLine.includes('frames/s') || trimmedLine.includes('%|'))) {
      filteredCount++
      l.dim(`${p} Filtering progress bar: ${trimmedLine.substring(0, 50)}...`)
      continue
    }
    
    if (trimmedLine.includes('torchaudio') || trimmedLine.includes('set_audio_backend')) {
      filteredCount++
      l.dim(`${p} Filtering torchaudio message`)
      continue
    }
    
    if (trimmedLine.includes('Diarization unavailable') || 
        trimmedLine.includes('Using fallback') || 
        trimmedLine.includes('Reason:')) {
      filteredCount++
      l.dim(`${p} Filtering diarization status message`)
      continue
    }
    
    if (trimmedLine.includes('Traceback') || 
        trimmedLine.includes('File "') ||
        trimmedLine.includes('from ctc_forced_aligner')) {
      filteredCount++
      l.dim(`${p} Filtering traceback/import error`)
      continue
    }
    
    if (trimmedLine.match(/^\d+%\|/) || 
        trimmedLine.match(/\d+\/\d+\s*\[/) ||
        trimmedLine.match(/\[\d+:\d+<\d+:\d+/)) {
      filteredCount++
      l.dim(`${p} Filtering progress indicator`)
      continue
    }
    
    if (trimmedLine.includes('Error:') || 
        trimmedLine.includes('Warning:') || 
        trimmedLine.includes('ImportError') ||
        trimmedLine.includes('ModuleNotFoundError')) {
      filteredCount++
      continue
    }
    
    if (trimmedLine.includes('[') && trimmedLine.includes(']')) {
      const timestampMatch = trimmedLine.match(/\[([^\]]+)\]/)
      
      if (timestampMatch) {
        const timestamp = timestampMatch[1]
        const afterTimestamp = trimmedLine.substring(trimmedLine.indexOf(']') + 1).trim()
        
        const speakerMatches = [...afterTimestamp.matchAll(/Speaker (\d+):/g)]
        
        if (speakerMatches.length > 1) {
          duplicateFixCount++
          const lastSpeakerMatch = speakerMatches[speakerMatches.length - 1]
          if (lastSpeakerMatch && lastSpeakerMatch[1]) {
            const speaker = lastSpeakerMatch[1]
            const lastSpeakerIndex = afterTimestamp.lastIndexOf(`Speaker ${speaker}:`)
            const text = afterTimestamp.substring(lastSpeakerIndex + `Speaker ${speaker}:`.length).trim()
            
            if (text) {
              formattedTranscript += `[${timestamp}] Speaker ${speaker}: ${text}\n`
              l.dim(`${p} Fixed duplicate speaker label, extracted: "${text.substring(0, 50)}..."`)
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
  
  if (filteredCount > 0) {
    l.dim(`${p} Filtered ${filteredCount} technical output lines`)
  }
  
  if (duplicateFixCount > 0) {
    l.dim(`${p} Fixed ${duplicateFixCount} duplicate speaker labels`)
  }
  
  return formattedTranscript.trim() || '[00:00] Speaker 1: Transcription processing completed'
}

export async function callWhisperDiarization(
  options: ProcessingOptions,
  finalPath: string
): Promise<{ transcript: string; modelId: string; costPerMinuteCents: number }> {
  const p = '[text/process-steps/02-run-transcription/whisper-diarization]'
  
  try {
    const whisperDiarizationModel = typeof options.whisperDiarization === 'string'
      ? options.whisperDiarization
      : 'medium.en'
    
    const modelInfo = TRANSCRIPTION_SERVICES_CONFIG.whisperDiarization.models.find(
      m => m.modelId === whisperDiarizationModel
    ) || TRANSCRIPTION_SERVICES_CONFIG.whisperDiarization.models.find(
      m => m.modelId === 'medium.en'
    )
    
    if (!modelInfo) {
      throw new Error(`Model information for ${whisperDiarizationModel} not available`)
    }
    
    const { modelId, costPerMinuteCents } = modelInfo
    
    await ensureWhisperDiarizationEnv()
    
    const audioFilePath = `${finalPath}.wav`
    const pythonPath = './build/pyenv/whisper-diarization/bin/python'
    const scriptPath = './build/bin/whisper-diarize.py'
    
    l.dim(`${p} Running whisper-diarization with model: ${modelId}`)
    
    const diarizationArgs = [
      scriptPath,
      '-a', audioFilePath,
      '--whisper-model', modelId,
      '--device', 'cpu'
    ]
    
    if (options.speakerLabels === false) {
      diarizationArgs.push('--no-stem')
    }
    
    l.dim(`${p} Executing: ${pythonPath} ${diarizationArgs.join(' ')}`)
    
    const { stdout, stderr } = await execPromise(
      `${pythonPath} ${diarizationArgs.join(' ')}`,
      { 
        maxBuffer: 50000 * 1024,
        cwd: process.cwd(),
        timeout: 300000
      }
    )
    
    l.dim(`${p} Whisper-diarization completed`)
    
    const combinedOutput = stdout + '\n' + stderr
    const transcript = formatWhisperDiarizationTranscript(combinedOutput)
    
    if (!transcript || transcript.trim().length === 0) {
      throw new Error('No transcription output generated by whisper-diarization')
    }
    
    if (transcript.includes('Using fallback whisper-only transcription')) {
      l.warn(`${p} Diarization fell back to whisper-only mode`)
    }
    
    l.dim(`${p} Formatted transcript generated successfully`)
    
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