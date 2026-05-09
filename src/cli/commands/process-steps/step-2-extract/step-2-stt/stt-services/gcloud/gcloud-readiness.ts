import type {
  GcloudProjectBillingState,
  GcloudSttReadiness
} from '~/types'
import {
  hasGcloudCli,
  readAccessToken,
  readProjectBilling,
  readProjectId,
  resolveGcloudCliBinary,
  verifyServiceApiEnabled,
  verifySpeechApiEnabled
} from './gcloud-cli'

export const readGcloudSttReadiness = async (): Promise<GcloudSttReadiness> => {
  if (!hasGcloudCli()) {
    return {
      hasCli: false,
      authConfigured: false,
      details: {
        cli: 'not found',
        auth: 'skipped',
        project: 'skipped',
        billing: 'skipped',
        speechApi: 'skipped',
        textToSpeechApi: 'skipped',
        documentAiApi: 'skipped',
        storageApi: 'skipped'
      }
    }
  }

  const cliPath = resolveGcloudCliBinary() ?? 'gcloud'
  const authState = await readAccessToken()
  const projectState = await readProjectId()
  const billingState: GcloudProjectBillingState = authState.ok && projectState.ok && projectState.projectId
    ? await readProjectBilling(projectState.projectId)
    : { detail: 'skipped' }
  const apiState = authState.ok && projectState.ok && projectState.projectId
    ? await verifySpeechApiEnabled(projectState.projectId)
    : { ok: false, detail: 'skipped' }
  const documentAiApiState = authState.ok && projectState.ok && projectState.projectId
    ? await verifyServiceApiEnabled(projectState.projectId, 'documentai.googleapis.com')
    : { ok: false, detail: 'skipped' }
  const textToSpeechApiState = authState.ok && projectState.ok && projectState.projectId
    ? await verifyServiceApiEnabled(projectState.projectId, 'texttospeech.googleapis.com')
    : { ok: false, detail: 'skipped' }
  const storageApiState = authState.ok && projectState.ok && projectState.projectId
    ? await verifyServiceApiEnabled(projectState.projectId, 'storage.googleapis.com')
    : { ok: false, detail: 'skipped' }

  return {
    hasCli: true,
    authConfigured: authState.ok,
    ...(projectState.projectId ? { projectId: projectState.projectId } : {}),
    ...(billingState.billingAccountId ? { billingAccountId: billingState.billingAccountId } : {}),
    ...(authState.ok && projectState.ok ? { billingEnabled: billingState.billingEnabled === true } : {}),
    ...(authState.ok && projectState.ok ? { speechApiEnabled: apiState.ok } : {}),
    ...(authState.ok && projectState.ok ? { textToSpeechApiEnabled: textToSpeechApiState.ok } : {}),
    ...(authState.ok && projectState.ok ? { documentAiApiEnabled: documentAiApiState.ok } : {}),
    ...(authState.ok && projectState.ok ? { storageApiEnabled: storageApiState.ok } : {}),
    details: {
      cli: cliPath,
      auth: authState.detail,
      project: projectState.projectId ?? projectState.detail,
      billing: authState.ok && projectState.ok ? billingState.detail : 'skipped',
      speechApi: authState.ok && projectState.ok ? apiState.detail : 'skipped',
      textToSpeechApi: authState.ok && projectState.ok ? textToSpeechApiState.detail : 'skipped',
      documentAiApi: authState.ok && projectState.ok ? documentAiApiState.detail : 'skipped',
      storageApi: authState.ok && projectState.ok ? storageApiState.detail : 'skipped'
    }
  }
}
