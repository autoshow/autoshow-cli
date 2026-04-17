import { expect, test } from 'bun:test'

type WiringExpectation = {
  path: string
  includes: string[]
  excludes: string[]
}

const PHASE_2_WIRING_EXPECTATIONS: WiringExpectation[] = [
  {
    path: 'src/cli/commands/process-steps/process-stt.ts',
    includes: ['./step-2-stt/media', './step-2-stt/orchestrator', './step-2-stt/batch'],
    excludes: ['./step-2-stt/stt-media-cache', './step-2-stt/run-stt', './step-2-stt/stt-batch/stt-batch-policy', './step-2-stt/stt-batch/stt-batch-coordinator']
  },
  {
    path: 'src/cli/commands/process-steps/process-video.ts',
    includes: ['./step-2-stt/media', './step-2-stt/orchestrator'],
    excludes: ['./step-2-stt/stt-media-cache', './step-2-stt/run-stt']
  },
  {
    path: 'src/cli/commands/process-steps/process-ocr.ts',
    includes: ['./step-2-ocr/orchestrator'],
    excludes: ['./step-2-ocr/run-ocr']
  },
  {
    path: 'src/cli/commands/process-steps/step-1-download/targets/handle-process-target.ts',
    includes: ['step-2-stt/batch'],
    excludes: ['step-2-stt/stt-batch/stt-batch']
  },
  {
    path: 'src/cli/commands/process-steps/step-1-download/targets/directory-target.ts',
    includes: ['../../step-2-stt/batch'],
    excludes: ['../../step-2-stt/stt-batch/stt-batch']
  },
  {
    path: 'src/cli/commands/process-steps/step-1-download/targets/url-list-target.ts',
    includes: ['../../step-2-stt/batch'],
    excludes: ['../../step-2-stt/stt-batch/stt-batch']
  },
  {
    path: 'src/cli/commands/process-steps/step-1-download/targets/youtube-collection-target.ts',
    includes: ['../../step-2-stt/batch'],
    excludes: ['../../step-2-stt/stt-batch/stt-batch']
  },
  {
    path: 'src/cli/commands/process-steps/step-1-download/targets/target-utils.ts',
    includes: ['step-2-stt/batch'],
    excludes: ['step-2-stt/stt-batch/stt-run-state']
  },
  {
    path: 'src/cli/commands/process-steps/step-1-download/targets/single-target.ts',
    includes: ['step-2-stt/batch'],
    excludes: ['step-2-stt/stt-batch/stt-batch-coordinator']
  },
  {
    path: 'src/cli/commands/process-steps/resume-missing/resume-registry.ts',
    includes: ['step-2-ocr/resume', 'step-2-stt/resume'],
    excludes: ['step-2-ocr/resume-ocr-batch', 'step-2-stt/stt-batch/resume-stt-batch']
  },
  {
    path: 'src/cli/commands/setup-and-utilities/cache/define-cache-command.ts',
    includes: ['step-2-stt/media'],
    excludes: ['step-2-stt/stt-media-cache']
  },
  {
    path: 'src/cli/commands/setup-and-utilities/models/define-models-command.ts',
    includes: ['step-2-stt/bootstrap'],
    excludes: ['step-2-stt/stt-local/whisper/whisper']
  },
  {
    path: 'src/cli/commands/setup-and-utilities/report/define-report-command.ts',
    includes: ['step-2-stt/report', 'step-2-ocr/report'],
    excludes: ['./stt-consensus-report', './ocr-consensus-report']
  },
  {
    path: 'src/cli/commands/setup-and-utilities/report/generate-stt-consensus-report.ts',
    includes: ['step-2-stt/report'],
    excludes: ['./stt-consensus-report']
  },
  {
    path: 'src/utils/stt-consensus-report.ts',
    includes: ['step-2-stt/report'],
    excludes: ['setup-and-utilities/report/stt-consensus-report']
  },
  {
    path: 'src/utils/ocr-consensus-report.ts',
    includes: ['step-2-ocr/report'],
    excludes: ['setup-and-utilities/report/ocr-consensus-report']
  }
]

test('phase 2 higher-level STT/OCR callers route through the feature-root facades', async () => {
  for (const expectation of PHASE_2_WIRING_EXPECTATIONS) {
    const source = await Bun.file(expectation.path).text()

    for (const expected of expectation.includes) {
      expect(source, `${expectation.path} should include ${expected}`).toContain(expected)
    }

    for (const legacy of expectation.excludes) {
      expect(source, `${expectation.path} should not include ${legacy}`).not.toContain(legacy)
    }
  }
})
