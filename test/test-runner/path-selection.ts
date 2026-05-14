const E2E_PREFIX = 'test/test-cases/e2e/'
const TEST_CASES_PREFIX = 'test/test-cases/'
const TEST_PRICE_PREFIX = 'test/test-price/'

export const normalizePathFilter = (pathFilter: string): string => {
  return pathFilter
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/\/+$/, '')
}

export const matchPathFilters = (file: string, pathFilters: string[]): boolean => {
  return pathFilters.some(pathFilter => {
    const normalizedFilter = normalizePathFilter(pathFilter)
    const prefix = normalizedFilter.endsWith('/') ? normalizedFilter : `${normalizedFilter}/`
    return file === normalizedFilter || file.startsWith(prefix)
  })
}

export const resolveSelectedFiles = (allFiles: string[], pathFilters: string[]): string[] => {
  if (pathFilters.length === 0) {
    return allFiles
  }

  const selectedFiles = allFiles.filter(file => matchPathFilters(file, pathFilters))
  if (selectedFiles.length === 0) {
    throw new Error(`No tests matched path filters: ${pathFilters.join(', ')}`)
  }

  return selectedFiles
}

const formatSelectionPath = (pathFilter: string): string => {
  const normalized = normalizePathFilter(pathFilter)
  if (normalized.startsWith(TEST_PRICE_PREFIX)) {
    return normalized.slice(TEST_PRICE_PREFIX.length)
  }
  if (normalized.startsWith(E2E_PREFIX)) {
    return normalized.slice(E2E_PREFIX.length)
  }
  if (normalized.startsWith(TEST_CASES_PREFIX)) {
    return normalized.slice(TEST_CASES_PREFIX.length)
  }
  return normalized
}

export const formatSelectedPathsLabel = (pathFilters: string[]): string => {
  return `Selected paths: ${pathFilters.map(formatSelectionPath).join(', ')}`
}

export const formatSelectedPriceSuitesLabel = (pathFilters: string[]): string => {
  return `Selected price suites: ${pathFilters.map(formatSelectionPath).join(', ')}`
}
