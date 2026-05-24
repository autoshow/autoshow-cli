import { isAbsolute, join, resolve } from 'node:path'

const DEFAULT_OUTPUT_ROOT = './output'

export const getOutputRoot = (): string =>
  process.env['AUTOSHOW_OUTPUT_DIR']?.trim() || DEFAULT_OUTPUT_ROOT

export const getOutputRootAbsolute = (projectRoot = process.cwd()): string => {
  const outputRoot = getOutputRoot()
  return isAbsolute(outputRoot) ? outputRoot : resolve(projectRoot, outputRoot)
}

export const joinOutputRoot = (...segments: string[]): string =>
  join(getOutputRoot(), ...segments)
