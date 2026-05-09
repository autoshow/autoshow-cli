import { commandSupportsInputFamily, isExtractCommand } from '~/cli/commands/process-steps/process-command-kinds'
import { resolveOcrStep2ExecutionFromFormat, resolveSttStep2Execution } from '~/cli/commands/process-steps/step-2-extract/step-2-shared/resolved-step2'
import type { InputFamily, ProcessCommand, ResolvedInputRouting, RuntimeOptions } from '~/types'
import { classifyInputFamily, isLikelyUrl, resolveDocumentFormatHint } from '../input/input-classifier'

export const describeUnsupportedInputForCommand = (
  command: ProcessCommand,
  family: InputFamily
): string => {
  if (isExtractCommand(command)) {
    if (family === 'unsupported') {
      return 'extract could not classify this input; verify the file type or route it explicitly as media or document content'
    }
    return 'extract only processes media, documents, images, HTML articles, and X Space links'
  }

  return 'unsupported input'
}

export const resolveInputRoutingForCommand = async (
  command: ProcessCommand,
  target: string,
  opts?: Pick<
    RuntimeOptions,
    | 'urlBackendExplicit'
    | 'urlBackend'
    | 'step2SelectionOrigins'
    | 'useReverb'
    | 'whisperModel'
    | 'whisperModels'
    | 'gcloudSttModel'
    | 'gcloudSttModels'
    | 'awsSttModel'
    | 'awsSttModels'
    | 'deepinfraSttModel'
    | 'deepinfraSttModels'
    | 'deapiSttModel'
    | 'deapiSttModels'
    | 'elevenlabsSttModel'
    | 'elevenlabsSttModels'
    | 'deepgramSttModel'
    | 'deepgramSttModels'
    | 'sonioxSttModel'
    | 'sonioxSttModels'
    | 'speechmaticsSttModel'
    | 'speechmaticsSttModels'
    | 'revSttModel'
    | 'revSttModels'
    | 'groqSttModel'
    | 'groqSttModels'
    | 'grokSttModel'
    | 'grokSttModels'
    | 'mistralSttModel'
    | 'mistralSttModels'
    | 'assemblyaiSttModel'
    | 'assemblyaiSttModels'
    | 'gladiaSttModel'
    | 'gladiaSttModels'
    | 'happyscribeSttModel'
    | 'happyscribeSttModels'
    | 'supadataSttModel'
    | 'supadataSttModels'
    | 'useTesseract'
    | 'useOcrmypdf'
    | 'usePaddleOcr'
    | 'mistralOcrModel'
    | 'mistralOcrModels'
    | 'glmOcrModel'
    | 'glmOcrModels'
    | 'kimiOcrModel'
    | 'kimiOcrModels'
    | 'openaiOcrModel'
    | 'openaiOcrModels'
    | 'anthropicOcrModel'
    | 'anthropicOcrModels'
    | 'geminiOcrModel'
    | 'geminiOcrModels'
    | 'deepinfraOcrModel'
    | 'deepinfraOcrModels'
    | 'deapiOcrModel'
    | 'deapiOcrModels'
    | 'useEpubBun'
    | 'useEpubCalibre'
  >
): Promise<ResolvedInputRouting> => {
  const family = await classifyInputFamily(target, opts)
  const documentFormatHint = await resolveDocumentFormatHint(target, family)
  const resolvedStep2: ResolvedInputRouting['resolvedStep2'] = family === 'x_space'
    ? { route: 'unsupported' as const, sourceKind: 'unsupported' as const }
    : family === 'media'
    ? resolveSttStep2Execution((opts ?? {}) as Parameters<typeof resolveSttStep2Execution>[0])
    : family === 'document' || family === 'html_article'
      ? resolveOcrStep2ExecutionFromFormat(
          documentFormatHint ?? (family === 'html_article' ? 'html' : 'pdf'),
          {
            ...(opts ?? {}),
            localHtmlDocument: family === 'html_article' && !isLikelyUrl(target)
          } as Parameters<typeof resolveOcrStep2ExecutionFromFormat>[1]
        )
      : {
          route: 'unsupported',
          sourceKind: 'unsupported'
        }
  const supported = family !== 'unsupported' && commandSupportsInputFamily(command, family)
  const step2Route = resolvedStep2.route
  const extractRoute = family === 'x_space' && supported
    ? 'x-space'
    : step2Route === 'stt'
    ? 'media'
    : step2Route === 'ocr' || step2Route === 'article' || step2Route === 'native-document'
      ? 'document'
      : undefined

  return {
    family,
    step2Route,
    resolvedStep2,
    ...(extractRoute ? { extractRoute } : {}),
    supported,
    ...(!supported && isExtractCommand(command)
      ? { skipReason: describeUnsupportedInputForCommand(command, family) }
      : {})
  }
}
