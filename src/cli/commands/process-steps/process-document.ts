import { writeFile } from '~/utils/cli-utils'
import { validateData } from '~/utils/validate/validation'
import {
  ExtractionOptionsSchema,
  type ExtractionOptions,
  type ProcessDocumentOutput
} from '~/types'
import { computeActualCosts, computeEstimatedCosts } from '~/utils/pricing/compute-costs'
import { computeActualProcessingTimes, computeEstimatedProcessingTimes } from '~/utils/pricing/compute-processing-time'
import { downloadDocument } from './step-1-download/document/dl-document'
import { runExtract } from './step-2-document/run-extract'
import { runWithLogContext } from '~/logger'

export const processDocument = async (
  filePath: string,
  rawOpts: Partial<ExtractionOptions>
): Promise<ProcessDocumentOutput> => {
  const opts = validateData(ExtractionOptionsSchema, {
    filePath,
    outputDir: rawOpts.outputDir || './output',
    dpi: rawOpts.dpi ?? 300,
    languages: rawOpts.languages ?? 'eng',
    oem: rawOpts.oem ?? 1,
    psm: rawOpts.psm ?? 3,
    outputFormat: rawOpts.outputFormat ?? 'text',
    password: rawOpts.password,
    pageSeparator: rawOpts.pageSeparator ?? '\n\n',
    renderConcurrency: rawOpts.renderConcurrency,
    ocrConcurrency: rawOpts.ocrConcurrency,
    preserveInterwordSpaces: rawOpts.preserveInterwordSpaces ?? false,
    rotate: rawOpts.rotate ?? 0,
    ...(rawOpts.useOcrmypdf ? { useOcrmypdf: true } : {}),
    ...(rawOpts.usePaddleOcr ? { usePaddleOcr: true } : {}),
    ...(rawOpts.mistralOcrModel ? { mistralOcrModel: rawOpts.mistralOcrModel } : {}),
    ...(rawOpts.useEpubBun ? { useEpubBun: true } : {}),
    ...(rawOpts.useEpubCalibre ? { useEpubCalibre: true } : {})
  }, 'document extraction options')

  const prepared = await runWithLogContext({ step: 'step-1-download' }, async () =>
    await downloadDocument(filePath, opts.outputDir, opts.password)
  )

  const { outputDir, step1Metadata, effectiveFilePath, tempCleanup } = prepared
  const extractFilePath = effectiveFilePath ?? filePath

  let result: Awaited<ReturnType<typeof runExtract>>
  try {
    result = await runWithLogContext({ step: 'step-2-document' }, async () =>
      await runExtract(extractFilePath, step1Metadata, opts)
    )
  } finally {
    if (tempCleanup) await tempCleanup()
  }

  const { result: extractionResult, step2Metadata } = result

  const estimated = computeEstimatedCosts({
    mistralOcrModel: opts.mistralOcrModel,
    extractPageCount: step1Metadata.pageCount,
  })
  const actual = computeActualCosts({ step2: step2Metadata })
  const cost = { estimated, actual }

  const estimatedTiming = computeEstimatedProcessingTimes({
    mistralOcrModel: opts.mistralOcrModel,
    extractPageCount: step1Metadata.pageCount,
  })
  const actualTiming = computeActualProcessingTimes({
    step1: step1Metadata,
    step2: step2Metadata,
  })
  const timing = estimatedTiming.steps.length > 0 || actualTiming.steps.length > 0
    ? { estimated: estimatedTiming, actual: actualTiming }
    : undefined

  await writeFile(`${outputDir}/metadata.json`, JSON.stringify({
    step1: step1Metadata,
    step2: step2Metadata,
    cost,
    ...(timing ? { timing } : {}),
  }, null, 2))

  const isEpubInspectMode = step2Metadata.extractionMethod === 'epub-bun' || step2Metadata.extractionMethod === 'epub-calibre'

  // Strict --out behavior: write only the requested primary artifact
  if (!isEpubInspectMode) {
    const outputFormat = opts.outputFormat ?? 'text'
    if (outputFormat === 'text') {
      await writeFile(`${outputDir}/extraction.txt`, extractionResult.text)
    } else if (outputFormat === 'json') {
      await writeFile(`${outputDir}/extraction.json`, JSON.stringify(extractionResult, null, 2))
    } else if (outputFormat === 'tsv') {
      const tsv = extractionResult.pages.map(p => `${p.pageNumber}\t${p.text.replace(/\n/g, ' ')}`).join('\n')
      await writeFile(`${outputDir}/extraction.tsv`, tsv)
    } else if (outputFormat === 'hocr') {
      const hocr = extractionResult.pages.map(p => `<div class="page" data-page="${p.pageNumber}">${p.text}</div>`).join('\n')
      await writeFile(`${outputDir}/extraction.hocr`, hocr)
    }
  }

  return {
    result: extractionResult,
    step1Metadata,
    step2Metadata,
    outputDir
  }
}
