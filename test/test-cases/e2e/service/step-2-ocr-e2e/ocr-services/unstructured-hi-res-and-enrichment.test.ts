import { defineOCRServiceTest } from '../../../../../test-utils/define-ocr-service-test'
import { unstructuredOcr } from './cases'

defineOCRServiceTest({
  ...unstructuredOcr,
  models: ['hi_res_and_enrichment'],
  expectedService: 'unstructured',
})

