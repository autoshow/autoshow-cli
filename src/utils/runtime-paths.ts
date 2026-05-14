import { join, resolve } from 'node:path'

export const PROJECT_ROOT = resolve(import.meta.dir, '../..')
export const RUNTIME_DIR = join(PROJECT_ROOT, 'runtime')
export const RUNTIME_BIN_DIR = join(RUNTIME_DIR, 'bin')
export const ytDlpManagedBinaryPath = join(RUNTIME_BIN_DIR, 'yt-dlp')
