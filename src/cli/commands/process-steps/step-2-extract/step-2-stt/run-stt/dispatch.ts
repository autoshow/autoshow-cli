import type {
  Step2Metadata,
  SttTarget,
  SttTargetOptions,
  TranscriptionResult,
  WhisperProgressWindow
} from '~/types'
import { runWhisperTranscribe } from '../stt-local/whisper/run-whisper'
import { runReverbTranscribe } from '../stt-local/reverb/run-reverb'
import { runGroqTranscribe } from '../stt-services/groq/run-whisper-groq'
import { runGrokStt } from '../stt-services/grok/run-grok-stt'
import { runDeepinfraTranscribe } from '../stt-services/deepinfra/run-deepinfra-stt'
import { runDeapiStt } from '../stt-services/deapi/run-deapi-stt'
import { runElevenLabsTranscribe } from '../stt-services/elevenlabs/run-elevenlabs-stt'
import { runDeepgramTranscribe } from '../stt-services/deepgram/run-deepgram-stt'
import { runSonioxStt } from '../stt-services/soniox/run-soniox-stt'
import { runSpeechmaticsStt } from '../stt-services/speechmatics/run-speechmatics-stt'
import { runRevStt } from '../stt-services/rev/run-rev-stt'
import { runMistralStt } from '../stt-services/mistral/run-mistral-stt'
import { runAssemblyAiTranscribe } from '../stt-services/assemblyai/run-assemblyai-stt'
import { runGladiaStt } from '../stt-services/gladia/run-gladia-stt'
import { runHappyScribeStt } from '../stt-services/happyscribe/run-happyscribe-stt'
import { runSupadataStt } from '../stt-services/supadata/run-supadata-stt'
import { runScrapeCreatorsStt } from '../stt-services/scrapecreators/run-scrapecreators-stt'
import { runOpenaiStt } from '../stt-services/openai-stt/run-openai-stt'
import { runGeminiStt } from '../stt-services/gemini-stt/run-gemini-stt'
import { runGlmStt } from '../stt-services/glm-stt/run-glm-stt'
import { runTogetherStt } from '../stt-services/together/run-together-stt'
import { runGcloudStt } from '../stt-services/gcloud/run-gcloud-stt'
import { runAwsStt } from '../stt-services/aws/run-aws-stt'
import { ensureSttTargetSetup as ensureSttTargetSetupViaBroker } from '../bootstrap'
import { assertNever } from '~/utils/validate/assert-never'

export const ensureSttTargetSetup = async (
  target: Pick<SttTarget, 'service' | 'model'>
): Promise<void> =>
  await ensureSttTargetSetupViaBroker(target)

export const dispatchStt = async (
  target: SttTarget,
  audioPath: string,
  outputDir: string,
  segmentOffsetMinutes: number,
  options: SttTargetOptions,
  segmentNumber?: number,
  totalSegments?: number,
  whisperProgress?: WhisperProgressWindow | undefined
): Promise<{ result: TranscriptionResult, metadata: Step2Metadata }> => {
  if (target.service === 'reverb') {
    return await runReverbTranscribe(audioPath, outputDir, {
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments,
      reverbVerbatimicity: options.reverbVerbatimicity
    })
  }

  if (target.service === 'elevenlabs') {
    return await runElevenLabsTranscribe(audioPath, outputDir, {
      model: target.model,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments,
      diarizationOptions: target.diarizationOptions
    })
  }

  if (target.service === 'gcloud') {
    return await runGcloudStt(audioPath, outputDir, {
      model: target.model,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments,
      diarizationOptions: target.diarizationOptions
    })
  }

  if (target.service === 'deepgram') {
    return await runDeepgramTranscribe(audioPath, outputDir, {
      model: target.model,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments
    })
  }

  if (target.service === 'deepinfra') {
    return await runDeepinfraTranscribe(audioPath, outputDir, {
      model: target.model,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments,
      audioDurationSeconds: options.audioDurationSeconds
    })
  }

  if (target.service === 'deapi') {
    return await runDeapiStt(audioPath, outputDir, {
      model: target.model,
      sourceUrl: options.sourceUrl,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments,
      audioDurationSeconds: options.audioDurationSeconds,
      runMode: options.runMode,
      lifecycle: options.asyncLifecycle
    })
  }

  if (target.service === 'soniox') {
    return await runSonioxStt(audioPath, outputDir, {
      model: target.model,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments,
      diarizationOptions: target.diarizationOptions,
      audioDurationSeconds: options.audioDurationSeconds,
      runMode: options.runMode,
      lifecycle: options.asyncLifecycle
    })
  }

  if (target.service === 'speechmatics') {
    return await runSpeechmaticsStt(audioPath, outputDir, {
      model: target.model,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments,
      diarizationOptions: target.diarizationOptions,
      audioDurationSeconds: options.audioDurationSeconds,
      runMode: options.runMode,
      lifecycle: options.asyncLifecycle
    })
  }

  if (target.service === 'rev') {
    return await runRevStt(audioPath, outputDir, {
      model: target.model,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments,
      diarizationOptions: target.diarizationOptions,
      audioDurationSeconds: options.audioDurationSeconds,
      runMode: options.runMode,
      lifecycle: options.asyncLifecycle
    })
  }

  if (target.service === 'aws') {
    return await runAwsStt(audioPath, outputDir, {
      model: target.model,
      region: target.awsRegion,
      bucket: target.awsBucket,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments,
      diarizationOptions: target.diarizationOptions,
      audioDurationSeconds: options.audioDurationSeconds,
      runMode: options.runMode,
      lifecycle: options.asyncLifecycle
    })
  }

  if (target.service === 'groq') {
    return await runGroqTranscribe(audioPath, outputDir, {
      model: target.model,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments,
      audioDurationSeconds: options.audioDurationSeconds
    })
  }

  if (target.service === 'grok') {
    return await runGrokStt(audioPath, outputDir, {
      model: target.model,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments
    })
  }

  if (target.service === 'whisper') {
    return await runWhisperTranscribe(audioPath, outputDir, {
      model: target.model,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments,
      audioDurationSeconds: options.audioDurationSeconds,
      segmentStartSeconds: whisperProgress?.segmentStartSeconds,
      segmentDurationSeconds: whisperProgress?.segmentDurationSeconds,
      totalDurationSeconds: whisperProgress?.totalDurationSeconds,
      preserveJson: true
    })
  }

  if (target.service === 'mistral') {
    return await runMistralStt(audioPath, outputDir, {
      model: target.model,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments,
      diarizationOptions: target.diarizationOptions,
      passController: options.mistralPassController
    })
  }

  if (target.service === 'assemblyai') {
    return await runAssemblyAiTranscribe(audioPath, outputDir, {
      model: target.model,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments,
      diarizationOptions: target.diarizationOptions,
      audioDurationSeconds: options.audioDurationSeconds,
      runMode: options.runMode,
      lifecycle: options.asyncLifecycle
    })
  }

  if (target.service === 'gladia') {
    return await runGladiaStt(audioPath, outputDir, {
      model: target.model,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments,
      diarizationOptions: target.diarizationOptions,
      audioDurationSeconds: options.audioDurationSeconds,
      runMode: options.runMode,
      lifecycle: options.asyncLifecycle
    })
  }

  if (target.service === 'happyscribe') {
    return await runHappyScribeStt(audioPath, outputDir, {
      model: target.model,
      happyscribeOrganizationId: options.happyscribeOrganizationId,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments,
      audioDurationSeconds: options.audioDurationSeconds,
      runMode: options.runMode,
      lifecycle: options.asyncLifecycle
    })
  }

  if (target.service === 'supadata') {
    return await runSupadataStt(audioPath, outputDir, {
      model: target.model,
      sourceUrl: options.sourceUrl,
      language: options.language,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments,
      audioDurationSeconds: options.audioDurationSeconds,
      runMode: options.runMode,
      lifecycle: options.asyncLifecycle
    })
  }

  if (target.service === 'scrapecreators') {
    return await runScrapeCreatorsStt(audioPath, outputDir, {
      model: target.model,
      sourceUrl: options.sourceUrl,
      language: options.language,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments
    })
  }

  if (target.service === 'openai-stt') {
    return await runOpenaiStt(audioPath, outputDir, {
      model: target.model,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments,
      audioDurationSeconds: options.audioDurationSeconds
    })
  }

  if (target.service === 'gemini-stt') {
    return await runGeminiStt(audioPath, outputDir, {
      model: target.model,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments,
      audioDurationSeconds: options.audioDurationSeconds
    })
  }

  if (target.service === 'glm-stt') {
    return await runGlmStt(audioPath, outputDir, {
      model: target.model,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments,
      audioDurationSeconds: options.audioDurationSeconds
    })
  }

  if (target.service === 'together') {
    return await runTogetherStt(audioPath, outputDir, {
      model: target.model,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments,
      audioDurationSeconds: options.audioDurationSeconds
    })
  }

  if (target.service === 'youtube-captions') {
    throw new Error('youtube-captions is resolved before STT provider dispatch')
  }

  assertNever(target.service)
}
