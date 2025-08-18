import { err } from '@/logging'
import { createCloudflareClient } from '@/save/cloudflare/client'

let cachedApiToken: string | null = null

export async function getR2ApiToken(): Promise<string | null> {
  const p = '[save/cloudflare/token-manager]'
  
  const existingToken = process.env['CLOUDFLARE_R2_API_TOKEN'] || process.env['CLOUDFLARE_API_TOKEN']
  if (existingToken) {
    return existingToken
  }
  
  if (cachedApiToken) {
    return cachedApiToken
  }
  
  const accountId = process.env['CLOUDFLARE_ACCOUNT_ID']
  const email = process.env['CLOUDFLARE_EMAIL']
  const globalApiKey = process.env['CLOUDFLARE_GLOBAL_API_KEY']
  
  if (!accountId || !email || !globalApiKey) {
    err(`${p} Missing Cloudflare credentials for automatic token generation`)
    return null
  }
  
  const apiToken = await createApiTokenWithPermissions(accountId)
  if (!apiToken) {
    return null
  }
  
  cachedApiToken = apiToken
  return cachedApiToken
}

async function createApiTokenWithPermissions(accountId: string): Promise<string | null> {
  const p = '[save/cloudflare/token-manager]'
  
  try {
    const client = createCloudflareClient()
    
    const permResponse = await client.accounts.tokens.permissionGroups.list({
      account_id: accountId
    })
    
    const permissionGroups = Array.isArray(permResponse) ? permResponse : (permResponse as any)?.result || []
    
    const allPermissions = permissionGroups.filter((perm: any) => 
      perm.name === 'Workers R2 Storage:Read' ||
      perm.name === 'Workers R2 Storage:Write' ||
      perm.name === 'Vectorize Read' ||
      perm.name === 'Vectorize Write' ||
      perm.name === 'Workers AI Read' ||
      perm.name === 'Workers AI Write' ||
      perm.name.includes('R2') ||
      perm.name.includes('Vectorize') ||
      perm.name.includes('Workers AI')
    )
    
    if (allPermissions.length === 0) {
      err(`${p} Could not find required permissions in account`)
      return null
    }
    
    const tokenResponse = await client.accounts.tokens.create({
      account_id: accountId,
      name: `autoshow-unified-${Date.now()}`,
      policies: [
        {
          effect: 'allow',
          permission_groups: allPermissions.map((perm: any) => ({
            id: perm.id,
            meta: {}
          })),
          resources: {
            [`com.cloudflare.api.account.${accountId}`]: '*'
          }
        }
      ]
    })
    
    if (!tokenResponse?.value) {
      err(`${p} API token created but value not returned`)
      return null
    }
    
    const { updateEnvVariable } = await import('../../config/env-writer')
    await updateEnvVariable('CLOUDFLARE_API_TOKEN', tokenResponse.value)
    
    return tokenResponse.value
  } catch (error) {
    err(`${p} Error creating API token: ${(error as Error).message}`)
    return null
  }
}

export function clearCachedToken(): void {
  cachedApiToken = null
}