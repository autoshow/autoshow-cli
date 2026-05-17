import { afterEach, expect, test } from 'bun:test'
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runCommand } from '../../test-utils/test-helpers'

const tempDirs: string[] = []

const makeTempRoot = async (prefix: string): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), prefix))
  tempDirs.push(root)
  return root
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

const writePackageJson = async (root: string): Promise<string> => {
  await mkdir(root, { recursive: true })
  await writeFile(join(root, 'package.json'), `${JSON.stringify({
    name: 'sock-fixture',
    version: '1.2.3',
    dependencies: {
      '@scope/runtime': '^2.0.0',
      valibot: '1.3.1'
    },
    devDependencies: {
      '@types/bun': '1.3.12'
    }
  }, null, 2)}\n`)
  return root
}

const writeEmptyEnvFile = async (root: string): Promise<string> => {
  const path = join(root, 'empty.env')
  await writeFile(path, '')
  return path
}

const writeFakeSocket = async (root: string): Promise<{ bin: string, log: string }> => {
  const bin = join(root, 'socket')
  const log = join(root, 'socket.log')
  await writeFile(bin, `#!/usr/bin/env bash
set -u
if [ -n "\${SOCKET_FAKE_LOG:-}" ]; then
  printf 'env:%s:%s\\n' "\${SOCKET_SECURITY_API_TOKEN:-}" "\${SOCKET_CLI_API_TOKEN:-}" >> "\${SOCKET_FAKE_LOG}"
  printf 'cwd:%s\\n' "$PWD" >> "\${SOCKET_FAKE_LOG}"
  printf 'args:' >> "\${SOCKET_FAKE_LOG}"
  for arg in "$@"; do
    printf '<%s>' "$arg" >> "\${SOCKET_FAKE_LOG}"
  done
  printf '\\n' >> "\${SOCKET_FAKE_LOG}"
fi
if [ "\${SOCKET_FAKE_FAIL:-}" = "1" ]; then
  echo 'Socket auth failure: missing scope' >&2
  echo '{"ok":false,"error":"auth"}'
  exit 1
fi
echo '{"ok":true,"source":"fake-socket"}'
`)
  await chmod(bin, 0o755)
  return { bin, log }
}

const readJson = async (path: string): Promise<Record<string, unknown>> =>
  JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>

const getSection = (output: string, heading: string, nextHeading?: string): string => {
  const start = output.indexOf(heading)
  expect(start).toBeGreaterThanOrEqual(0)
  const sectionStart = start + heading.length
  const end = nextHeading ? output.indexOf(nextHeading, sectionStart) : output.length
  expect(end).toBeGreaterThan(sectionStart)
  return output.slice(sectionStart, end)
}

test('sock help is registered under setup utilities and exposes read-only flags', async () => {
  const rootHelp = await runCommand(['src/cli/create-cli.ts', '--help'], { env: { NO_COLOR: '1' } })
  const commandHelp = await runCommand(['src/cli/create-cli.ts', 'sock', '--help'], { env: { NO_COLOR: '1' } })

  expect(rootHelp.exitCode).toBe(0)
  expect(commandHelp.exitCode).toBe(0)

  const setupSection = getSection(rootHelp.stdout, '  Setup & Utilities\n', '  Processing & Generation\n')
  const processingSection = getSection(rootHelp.stdout, '  Processing & Generation\n')
  expect(setupSection).toContain('    sock')
  expect(processingSection).not.toContain('    sock')

  expect(commandHelp.stdout).toContain('Write a read-only Socket dependency insight report')
  expect(commandHelp.stdout).toContain('--socket-bin')
  expect(commandHelp.stdout).toContain('--skip-scan')
  expect(commandHelp.stdout).toContain('--skip-fix')
  expect(commandHelp.stdout).toContain('--skip-package-scores')
  expect(commandHelp.stdout).toContain('--max-deep')
  expect(commandHelp.stdout).toContain('--minimum-release-age')
  expect(commandHelp.stdout).toContain('--no-major-updates')
  expect(commandHelp.stdout).toContain('--token-help')
  expect(commandHelp.stdout).toContain('--no-apply-fixes')
})

test('sock reports missing Socket binary with install guidance', async () => {
  const root = await makeTempRoot('autoshow-sock-missing-bin-')
  const project = await writePackageJson(join(root, 'project'))
  const envFile = await writeEmptyEnvFile(root)

  const result = await runCommand([
    'src/cli/create-cli.ts',
    'sock',
    project,
    '--socket-bin',
    join(root, 'missing-socket'),
    '--out',
    join(root, 'report')
  ], {
    env: {
      NO_COLOR: '1',
      ENV_FILE: envFile,
      SOCKET_SECURITY_API_TOKEN: '',
      SOCKET_CLI_API_TOKEN: ''
    }
  })

  expect(result.exitCode).toBe(2)
  expect(`${result.stdout}\n${result.stderr}`).toContain('Socket CLI binary not found')
  expect(`${result.stdout}\n${result.stderr}`).toContain('does not install it')
})

test('sock token-help prints minimal scope guidance', async () => {
  const result = await runCommand(['src/cli/create-cli.ts', 'sock', '--token-help'], { env: { NO_COLOR: '1' } })

  expect(result.exitCode).toBe(0)
  expect(result.stdout).toContain('Do not select all scopes.')
  expect(result.stdout).toContain('packages:list')
  expect(result.stdout).toContain('full-scans:create')
  expect(result.stdout).toContain('full-scans:list')
  expect(result.stdout).toContain('security-policy:read')
  expect(result.stdout).toContain('license-policy:read')
  expect(result.stdout).toContain('Not needed for v1')
  expect(result.stdout).toContain('API token management')
  expect(result.stdout).toContain('historical trend scopes')
  expect(result.stdout).toContain('SOCKET_SECURITY_API_TOKEN')
  expect(result.stdout).toContain('SOCKET_CLI_API_TOKEN')
})

test('sock writes dependency inventory and skipped Socket steps without credentials', async () => {
  const root = await makeTempRoot('autoshow-sock-inventory-')
  const project = await writePackageJson(join(root, 'project'))
  const envFile = await writeEmptyEnvFile(root)
  const { bin, log } = await writeFakeSocket(root)
  const reportDir = join(root, 'report')

  const result = await runCommand([
    'src/cli/create-cli.ts',
    'sock',
    project,
    '--socket-bin',
    bin,
    '--out',
    reportDir
  ], {
    env: {
      NO_COLOR: '1',
      ENV_FILE: envFile,
      SOCKET_SECURITY_API_TOKEN: '',
      SOCKET_CLI_API_TOKEN: '',
      SOCKET_FAKE_LOG: log
    }
  })

  expect(result.exitCode).toBe(0)
  const summary = await readJson(join(reportDir, 'summary.json'))
  const inventory = summary['inventory'] as Record<string, unknown>
  const dependencies = inventory['dependencies'] as Array<Record<string, unknown>>
  const steps = summary['steps'] as Array<Record<string, unknown>>

  expect(inventory['packageName']).toBe('sock-fixture')
  expect(dependencies.map((dependency) => dependency['packageSpecifier'])).toEqual([
    '@scope/runtime@^2.0.0',
    'valibot@1.3.1',
    '@types/bun@1.3.12'
  ])
  expect(steps.map((step) => step['status'])).toEqual(['skipped', 'skipped', 'skipped'])
  expect(await readdir(join(reportDir, 'raw'))).toEqual([])
  await expect(readFile(log, 'utf8')).rejects.toThrow()
})

test('sock invokes Socket Fix as recommendation-only and passes compatible token env', async () => {
  const root = await makeTempRoot('autoshow-sock-fix-')
  const project = await writePackageJson(join(root, 'project'))
  const envFile = await writeEmptyEnvFile(root)
  const { bin, log } = await writeFakeSocket(root)
  const reportDir = join(root, 'report')

  const result = await runCommand([
    'src/cli/create-cli.ts',
    'sock',
    project,
    '--socket-bin',
    bin,
    '--out',
    reportDir,
    '--max-deep',
    '1',
    '--minimum-release-age',
    '7d',
    '--no-major-updates'
  ], {
    env: {
      NO_COLOR: '1',
      ENV_FILE: envFile,
      SOCKET_SECURITY_API_TOKEN: '',
      SOCKET_CLI_API_TOKEN: 'socket-token',
      SOCKET_FAKE_LOG: log
    }
  })

  expect(result.exitCode).toBe(0)
  const logText = await readFile(log, 'utf8')
  expect(logText).toContain('env:socket-token:socket-token')
  expect(logText).toContain('args:<fix><--no-apply-fixes><--show-affected-direct-dependencies><--json><--minimum-release-age><7d><--no-major-updates>')
  expect(logText).not.toContain('--apply-fixes')

  const summary = await readJson(join(reportDir, 'summary.json'))
  const steps = summary['steps'] as Array<Record<string, unknown>>
  expect(steps.map((step) => step['status'])).toEqual(['completed', 'completed', 'completed'])
  expect(await readdir(join(reportDir, 'raw'))).toContain('006_socket-fix.json')
})

test('sock records Socket auth failures without failing the report command', async () => {
  const root = await makeTempRoot('autoshow-sock-auth-failure-')
  const project = await writePackageJson(join(root, 'project'))
  const envFile = await writeEmptyEnvFile(root)
  const { bin, log } = await writeFakeSocket(root)
  const reportDir = join(root, 'report')

  const result = await runCommand([
    'src/cli/create-cli.ts',
    'sock',
    project,
    '--socket-bin',
    bin,
    '--out',
    reportDir,
    '--skip-package-scores',
    '--skip-fix'
  ], {
    env: {
      NO_COLOR: '1',
      ENV_FILE: envFile,
      SOCKET_SECURITY_API_TOKEN: 'socket-token',
      SOCKET_CLI_API_TOKEN: '',
      SOCKET_FAKE_LOG: log,
      SOCKET_FAKE_FAIL: '1'
    }
  })

  expect(result.exitCode).toBe(0)
  const summary = await readJson(join(reportDir, 'summary.json'))
  const steps = summary['steps'] as Array<Record<string, unknown>>
  expect(steps.map((step) => step['status'])).toEqual(['skipped', 'failed', 'skipped'])

  const rawFiles = await readdir(join(reportDir, 'raw'))
  expect(rawFiles).toContain('001_project-scan.stderr.txt')
  expect(await readFile(join(reportDir, 'raw', '001_project-scan.stderr.txt'), 'utf8')).toContain('Socket auth failure')
  expect(`${result.stdout}\n${result.stderr}`).toContain('Socket report completed with 1 failed step(s)')
})
