export type RunResult = {
  stdout: string
  stderr: string
  exitCode: number
}

export type RunOptions = {
  cwd?: string
  env?: Record<string, string | undefined>
  allowFailure?: boolean
}

export type SetupPlatform = 'darwin' | 'linux' | 'unknown'

export type ModelWeight = { url: string, filename: string }

export type ModelWeights = { model: ModelWeight }
