import { afterEach, beforeEach, expect, test } from 'bun:test'
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadConfig } from '~/cli/commands/setup-and-utilities/config/config-loader'
import {
  readGcloudSttReadiness,
  setupGcloudStt
} from '~/cli/commands/process-steps/step-2-stt/stt-services/gcloud/gcloud'
import { runCommand } from '../../test-utils/test-helpers'

const DEFAULT_BILLING_ACCOUNT = '01D4B7-CFA65B-62F49E'

type FakeGcloudProject = {
  name?: string | undefined
  organizationId?: string | undefined
  folderId?: string | undefined
  accessible?: boolean | undefined
  billingAccountId?: string | undefined
  speechApiEnabled: boolean
}

type FakeGcloudState = {
  authConfigured: boolean
  activeProjectId?: string | undefined
  openBillingAccounts: string[]
  projects: Record<string, FakeGcloudProject>
}

let tempDir = ''
let configPath = ''
let statePath = ''
let originalPath = ''
let originalGcloudState = ''
let originalGcloudBin = ''

const writeFakeGcloudBinary = async (targetPath: string): Promise<void> => {
  await writeFile(targetPath, `#!/usr/bin/env bun
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const statePath = process.env['AUTOSHOW_TEST_GCLOUD_STATE']
if (!statePath) {
  console.error('missing AUTOSHOW_TEST_GCLOUD_STATE')
  process.exit(1)
}

const defaultState = {
  authConfigured: false,
  openBillingAccounts: [],
  projects: {}
}

const readState = () => existsSync(statePath)
  ? JSON.parse(readFileSync(statePath, 'utf8'))
  : defaultState
const writeState = (state) => writeFileSync(statePath, JSON.stringify(state))
const args = process.argv.slice(2)
const readFlag = (name) => {
  const index = args.indexOf(name)
  if (index >= 0) {
    return args[index + 1]
  }
  const prefix = name + '='
  const inline = args.find((arg) => arg.startsWith(prefix))
  return inline ? inline.slice(prefix.length) : undefined
}
const hasFlag = (name) => args.includes(name)
const normalizeBillingAccountId = (value) => value ? value.replace(/^billingAccounts\\//, '') : undefined
const readProject = (state, projectId) => state.projects?.[projectId]
const requireProject = (state, projectId) => {
  const project = readProject(state, projectId)
  if (!project) {
    console.error('Project [' + projectId + '] not found.')
    process.exit(1)
  }
  if (project.accessible === false) {
    console.error('Permission denied for project [' + projectId + ']')
    process.exit(1)
  }
  return project
}

if (args[0] === 'auth' && args[1] === 'print-access-token') {
  const state = readState()
  if (!state.authConfigured) {
    console.error('Not authenticated')
    process.exit(1)
  }
  console.log('fake-access-token')
  process.exit(0)
}

if (args[0] === 'config' && args[1] === 'get-value' && args[2] === 'project') {
  const state = readState()
  console.log(state.activeProjectId ?? '(unset)')
  process.exit(0)
}

if (args[0] === 'config' && args[1] === 'set' && args[2] === 'project') {
  const projectId = args[3]
  if (!projectId) {
    console.error('missing project id')
    process.exit(1)
  }
  const state = readState()
  state.activeProjectId = projectId
  writeState(state)
  console.log('Updated property [core/project].')
  process.exit(0)
}

if (args[0] === 'projects' && args[1] === 'describe') {
  const state = readState()
  const projectId = args[2]
  if (!projectId) {
    console.error('missing project id')
    process.exit(1)
  }
  requireProject(state, projectId)
  const format = readFlag('--format')
  if (format === 'value(projectId)') {
    console.log(projectId)
  } else {
    console.log(JSON.stringify({ projectId }))
  }
  process.exit(0)
}

if (args[0] === 'projects' && args[1] === 'create') {
  const state = readState()
  const projectId = args[2]
  if (!state.authConfigured) {
    console.error('Not authenticated')
    process.exit(1)
  }
  if (!projectId) {
    console.error('missing project id')
    process.exit(1)
  }
  if (readProject(state, projectId)) {
    console.error('Project [' + projectId + '] already exists.')
    process.exit(1)
  }
  state.projects[projectId] = {
    name: readFlag('--name') ?? projectId,
    organizationId: readFlag('--organization'),
    folderId: readFlag('--folder'),
    speechApiEnabled: false
  }
  if (hasFlag('--set-as-default')) {
    state.activeProjectId = projectId
  }
  writeState(state)
  console.log('Created [https://cloudresourcemanager.googleapis.com/v1/projects/' + projectId + '].')
  process.exit(0)
}

if (args[0] === 'billing' && args[1] === 'accounts' && args[2] === 'list') {
  const state = readState()
  if (!state.authConfigured) {
    console.error('Not authenticated')
    process.exit(1)
  }
  const format = readFlag('--format')
  const accountNames = state.openBillingAccounts.map((accountId) => 'billingAccounts/' + accountId)
  if (format === 'value(name)') {
    console.log(accountNames.join('\\n'))
  } else {
    console.log(JSON.stringify(accountNames.map((name) => ({ name, open: true }))))
  }
  process.exit(0)
}

if (args[0] === 'billing' && args[1] === 'projects' && args[2] === 'describe') {
  const state = readState()
  const projectId = args[3]
  if (!projectId) {
    console.error('missing project id')
    process.exit(1)
  }
  const project = requireProject(state, projectId)
  const billingAccountId = normalizeBillingAccountId(project.billingAccountId)
  console.log(JSON.stringify({
    projectId,
    billingEnabled: Boolean(billingAccountId),
    ...(billingAccountId ? { billingAccountName: 'billingAccounts/' + billingAccountId } : {})
  }))
  process.exit(0)
}

if (args[0] === 'billing' && args[1] === 'projects' && args[2] === 'link') {
  const state = readState()
  const projectId = args[3]
  const billingAccountId = normalizeBillingAccountId(readFlag('--billing-account'))
  if (!state.authConfigured) {
    console.error('Not authenticated')
    process.exit(1)
  }
  if (!projectId || !billingAccountId) {
    console.error('missing billing account or project id')
    process.exit(1)
  }
  if (!state.openBillingAccounts.includes(billingAccountId)) {
    console.error('Unknown billing account [' + billingAccountId + ']')
    process.exit(1)
  }
  const project = requireProject(state, projectId)
  project.billingAccountId = billingAccountId
  writeState(state)
  console.log('Linked billing account [' + billingAccountId + '].')
  process.exit(0)
}

if (args[0] === 'services' && args[1] === 'list') {
  const state = readState()
  const projectId = readFlag('--project')
  if (!projectId) {
    console.error('missing project id')
    process.exit(1)
  }
  const project = requireProject(state, projectId)
  if (project.speechApiEnabled) {
    console.log('speech.googleapis.com')
  }
  process.exit(0)
}

if (args[0] === 'services' && args[1] === 'enable' && args[2] === 'speech.googleapis.com') {
  const state = readState()
  const projectId = readFlag('--project')
  if (!state.authConfigured) {
    console.error('Not authenticated')
    process.exit(1)
  }
  if (!projectId) {
    console.error('missing project id')
    process.exit(1)
  }
  const project = requireProject(state, projectId)
  if (!project.billingAccountId) {
    console.error('Billing not enabled')
    process.exit(1)
  }
  project.speechApiEnabled = true
  writeState(state)
  console.log('Enabled service [speech.googleapis.com].')
  process.exit(0)
}

console.error('Unsupported fake gcloud command: ' + args.join(' '))
process.exit(1)
`)
  await chmod(targetPath, 0o755)
}

const readFakeGcloudState = async (): Promise<FakeGcloudState> =>
  JSON.parse(await readFile(statePath, 'utf8')) as FakeGcloudState

const writeFakeGcloudState = async (state: FakeGcloudState): Promise<void> => {
  await writeFile(statePath, JSON.stringify(state))
}

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'autoshow-gcloud-setup-'))
  configPath = join(tempDir, 'autoshow.json')
  statePath = join(tempDir, 'gcloud-state.json')
  await writeFakeGcloudState({
    authConfigured: true,
    openBillingAccounts: [DEFAULT_BILLING_ACCOUNT],
    projects: {}
  })
  await writeFakeGcloudBinary(join(tempDir, 'gcloud'))

  originalPath = process.env['PATH'] ?? ''
  originalGcloudState = process.env['AUTOSHOW_TEST_GCLOUD_STATE'] ?? ''
  originalGcloudBin = process.env['AUTOSHOW_GCLOUD_BIN'] ?? ''
  process.env['PATH'] = `${tempDir}:${originalPath}`
  process.env['AUTOSHOW_TEST_GCLOUD_STATE'] = statePath
  process.env['AUTOSHOW_GCLOUD_BIN'] = join(tempDir, 'gcloud')
})

afterEach(async () => {
  process.env['PATH'] = originalPath
  if (originalGcloudState.length > 0) {
    process.env['AUTOSHOW_TEST_GCLOUD_STATE'] = originalGcloudState
  } else {
    delete process.env['AUTOSHOW_TEST_GCLOUD_STATE']
  }
  if (originalGcloudBin.length > 0) {
    process.env['AUTOSHOW_GCLOUD_BIN'] = originalGcloudBin
  } else {
    delete process.env['AUTOSHOW_GCLOUD_BIN']
  }
  await rm(tempDir, { recursive: true, force: true })
})

test('setupGcloudStt creates the project, auto-links the single billing account, enables speech, and saves the default model when requested', async () => {
  await setupGcloudStt({
    preferredProject: 'autoshow-gcloud-test',
    configPathOverride: configPath
  })

  expect(await readFakeGcloudState()).toEqual({
    authConfigured: true,
    activeProjectId: 'autoshow-gcloud-test',
    openBillingAccounts: [DEFAULT_BILLING_ACCOUNT],
    projects: {
      'autoshow-gcloud-test': {
        name: 'autoshow-gcloud-test',
        speechApiEnabled: true,
        billingAccountId: DEFAULT_BILLING_ACCOUNT
      }
    }
  })

  const config = await loadConfig(configPath)
  expect(config.defaults?.stt?.gcloudStt).toEqual(['chirp_3'])

  const readiness = await readGcloudSttReadiness()
  expect(readiness.projectId).toBe('autoshow-gcloud-test')
  expect(readiness.billingEnabled).toBe(true)
  expect(readiness.billingAccountId).toBe(DEFAULT_BILLING_ACCOUNT)
  expect(readiness.speechApiEnabled).toBe(true)
})

test('setupGcloudStt stays read-only when no project is provided', async () => {
  await setupGcloudStt({
    configPathOverride: configPath
  })

  expect(await readFakeGcloudState()).toEqual({
    authConfigured: true,
    openBillingAccounts: [DEFAULT_BILLING_ACCOUNT],
    projects: {}
  })
  expect(await Bun.file(configPath).exists()).toBe(false)
})

test('setup --gcloud suggests the bootstrap command when no project is configured', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'setup',
    '--gcloud'
  ])

  expect(result.exitCode).toBe(0)
  expect(`${result.stdout}\n${result.stderr}`).toContain('gcloud projects list')
  expect(`${result.stdout}\n${result.stderr}`).toContain('gcloud projects create PROJECT_ID --set-as-default')
  expect(`${result.stdout}\n${result.stderr}`).toContain('bun as setup --gcloud --gcloud-project PROJECT_ID')
  expect(`${result.stdout}\n${result.stderr}`).not.toContain('gcloud config set project PROJECT_ID')
})

test('setupGcloudStt does not overwrite an existing gcloud STT default', async () => {
  await writeFile(configPath, JSON.stringify({
    version: 2,
    defaults: {
      stt: {
        gcloudStt: ['custom-model']
      }
    }
  }))

  await setupGcloudStt({
    preferredProject: 'autoshow-gcloud-test',
    configPathOverride: configPath
  })

  const config = await loadConfig(configPath)
  expect(config.defaults?.stt?.gcloudStt).toEqual(['custom-model'])
})

test('setupGcloudStt can set the project and save defaults before auth is configured without creating the project', async () => {
  await writeFakeGcloudState({
    authConfigured: false,
    openBillingAccounts: [DEFAULT_BILLING_ACCOUNT],
    projects: {}
  })

  await setupGcloudStt({
    preferredProject: 'unauthed-project',
    configPathOverride: configPath
  })

  expect(await readFakeGcloudState()).toEqual({
    authConfigured: false,
    activeProjectId: 'unauthed-project',
    openBillingAccounts: [DEFAULT_BILLING_ACCOUNT],
    projects: {}
  })

  const config = await loadConfig(configPath)
  expect(config.defaults?.stt?.gcloudStt).toEqual(['chirp_3'])

  const readiness = await readGcloudSttReadiness()
  expect(readiness.authConfigured).toBe(false)
  expect(readiness.projectId).toBe('unauthed-project')
  expect(readiness.billingEnabled).toBeUndefined()
  expect(readiness.speechApiEnabled).toBeUndefined()
})

test('setupGcloudStt creates the project but stops before speech when billing cannot be inferred automatically', async () => {
  await writeFakeGcloudState({
    authConfigured: true,
    openBillingAccounts: ['111111-111111-111111', '222222-222222-222222'],
    projects: {}
  })

  await setupGcloudStt({
    preferredProject: 'multi-billing-project',
    configPathOverride: configPath
  })

  expect(await readFakeGcloudState()).toEqual({
    authConfigured: true,
    activeProjectId: 'multi-billing-project',
    openBillingAccounts: ['111111-111111-111111', '222222-222222-222222'],
    projects: {
      'multi-billing-project': {
        name: 'multi-billing-project',
        speechApiEnabled: false
      }
    }
  })

  const readiness = await readGcloudSttReadiness()
  expect(readiness.projectId).toBe('multi-billing-project')
  expect(readiness.billingEnabled).toBe(false)
  expect(readiness.speechApiEnabled).toBe(false)
})

test('setupGcloudStt uses an explicit billing account when multiple open accounts exist', async () => {
  await writeFakeGcloudState({
    authConfigured: true,
    openBillingAccounts: ['111111-111111-111111', '222222-222222-222222'],
    projects: {}
  })

  await setupGcloudStt({
    preferredProject: 'explicit-billing-project',
    preferredBillingAccount: '222222-222222-222222',
    configPathOverride: configPath
  })

  expect(await readFakeGcloudState()).toEqual({
    authConfigured: true,
    activeProjectId: 'explicit-billing-project',
    openBillingAccounts: ['111111-111111-111111', '222222-222222-222222'],
    projects: {
      'explicit-billing-project': {
        name: 'explicit-billing-project',
        billingAccountId: '222222-222222-222222',
        speechApiEnabled: true
      }
    }
  })
})

test('setupGcloudStt does not create a duplicate project when describe is permission denied', async () => {
  await writeFakeGcloudState({
    authConfigured: true,
    openBillingAccounts: [DEFAULT_BILLING_ACCOUNT],
    projects: {
      'blocked-project': {
        accessible: false,
        speechApiEnabled: false
      }
    }
  })

  await expect(setupGcloudStt({
    preferredProject: 'blocked-project',
    configPathOverride: configPath
  })).rejects.toThrow('Failed to access gcloud project "blocked-project"')

  expect(await readFakeGcloudState()).toEqual({
    authConfigured: true,
    openBillingAccounts: [DEFAULT_BILLING_ACCOUNT],
    projects: {
      'blocked-project': {
        accessible: false,
        speechApiEnabled: false
      }
    }
  })
  expect(await Bun.file(configPath).exists()).toBe(false)
})

test('setup command passes the extended gcloud bootstrap flags through to gcloud setup', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'setup',
    '--gcloud',
    '--gcloud-project',
    'cli-project',
    '--gcloud-billing-account',
    DEFAULT_BILLING_ACCOUNT,
    '--gcloud-project-name',
    'CLI Project',
    '--gcloud-organization',
    '123456789',
    '--config-path',
    configPath
  ])

  expect(result.exitCode).toBe(0)
  expect(await readFakeGcloudState()).toEqual({
    authConfigured: true,
    activeProjectId: 'cli-project',
    openBillingAccounts: [DEFAULT_BILLING_ACCOUNT],
    projects: {
      'cli-project': {
        name: 'CLI Project',
        organizationId: '123456789',
        billingAccountId: DEFAULT_BILLING_ACCOUNT,
        speechApiEnabled: true
      }
    }
  })

  const config = await loadConfig(configPath)
  expect(config.defaults?.stt?.gcloudStt).toEqual(['chirp_3'])
})
