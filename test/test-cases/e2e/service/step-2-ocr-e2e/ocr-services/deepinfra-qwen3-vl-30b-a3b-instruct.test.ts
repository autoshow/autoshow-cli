import { defineOCRServiceTest } from '../../../../../test-utils/define-ocr-service-test'
import { deepinfraOcr } from './cases'

defineOCRServiceTest({
  ...deepinfraOcr,
  models: ['Qwen/Qwen3-VL-30B-A3B-Instruct'],
  expectedService: 'deepinfra',
})

