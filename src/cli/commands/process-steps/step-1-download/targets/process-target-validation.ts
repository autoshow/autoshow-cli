import { CLIUsageError } from '~/utils/error-handler'
import type { ProcessCommand, RuntimeOptions } from '~/types'
import { collectExplicitOcrTargets } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-targets'
import { collectSttTargets } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-targets'

export const buildUnsupportedExtractInputMessage = (
  input: string
): string => `Could not classify extract input "${input}". Verify the file type or route it explicitly as media or document content.`

export const validateWriteStep2ProviderSelection = (command: ProcessCommand, opts: RuntimeOptions): void => {
  if (command !== 'write') {
    return
  }

  const sttTargets = collectSttTargets(opts)
  if (sttTargets.length > 1) {
    throw CLIUsageError('write accepts at most one STT provider (--whisper-stt, --reverb-stt, --*-stt).')
  }

  const ocrTargets = collectExplicitOcrTargets(opts)
  if (ocrTargets.length > 1) {
    throw CLIUsageError('write accepts at most one OCR provider (--ocrmypdf, --paddle-ocr, --mistral-ocr, --glm-ocr, --kimi-ocr, --openai-ocr, --anthropic-ocr, --gemini-ocr, --deepinfra-ocr, --aws-textract, --gcloud-docai).')
  }
}
