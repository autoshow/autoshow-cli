import { l, err } from '@/logging'

interface CloudflareApiToken {
  value: string
  id: string
  name: string
}

let cachedApiToken: string | null = null

export async function getR2ApiToken(): Promise<string | null> {
  const p = '[save/services/r2-token-manager]'
  
  const existingR2Token = process.env['CLOUDFLARE_R2_API_TOKEN']
  if (existingR2Token) {
    l.dim(`${p} Using existing R2 API token from environment`)
    return existingR2Token
  }
  
  if (cachedApiToken) {
    l.dim(`${p} Using cached R2 API token`)
    return cachedApiToken
  }
  
  const accountId = process.env['CLOUDFLARE_ACCOUNT_ID']
  const email = process.env['CLOUDFLARE_EMAIL']
  const globalApiKey = process.env['CLOUDFLARE_GLOBAL_API_KEY']
  
  if (!accountId || !email || !globalApiKey) {
    err(`${p} Missing Cloudflare credentials for automatic token generation`)
    return null
  }
  
  l.dim(`${p} Creating new R2 API token with permissions`)
  const apiToken = await createApiTokenWithR2Permissions(accountId, email, globalApiKey)
  if (!apiToken) {
    return null
  }
  
  cachedApiToken = apiToken
  return cachedApiToken
}

async function createApiTokenWithR2Permissions(accountId: string, email: string, globalApiKey: string): Promise<string | null> {
  const p = '[save/services/r2-token-manager]'
  
  try {
    l.dim(`${p} Fetching available permission groups`)
    const permResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/tokens/permission_groups`,
      {
        headers: {
          'X-Auth-Email': email,
          'X-Auth-Key': globalApiKey,
          'Content-Type': 'application/json'
        }
      }
    )
    
    if (!permResponse.ok) {
      const errorText = await permResponse.text()
      err(`${p} Failed to fetch permission groups: ${errorText}`)
      return null
    }
    
    const permData = await permResponse.json()
    
    const r2Permissions = permData.result.filter((perm: any) => 
      perm.name === 'Workers R2 Storage:Read' ||
      perm.name === 'Workers R2 Storage:Write' ||
      perm.name.includes('R2')
    )
    
    if (r2Permissions.length === 0) {
      err(`${p} Could not find R2 permissions in account`)
      return null
    }
    
    l.dim(`${p} Found ${r2Permissions.length} R2 permission groups`)
    
    const tokenBody = {
      name: `autoshow-r2-${Date.now()}`,
      policies: [
        {
          effect: 'allow',
          permission_groups: r2Permissions.map((perm: any) => ({
            id: perm.id,
            meta: {}
          })),
          resources: {
            [`com.cloudflare.api.account.${accountId}`]: '*'
          }
        }
      ]
    }
    
    l.dim(`${p} Creating API token with R2 permissions`)
    const createResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/tokens`,
      {
        method: 'POST',
        headers: {
          'X-Auth-Email': email,
          'X-Auth-Key': globalApiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(tokenBody)
      }
    )
    
    if (!createResponse.ok) {
      const errorText = await createResponse.text()
      err(`${p} Failed to create API token: ${errorText}`)
      return null
    }
    
    const tokenData = await createResponse.json() as { result: CloudflareApiToken }
    
    if (!tokenData.result?.value) {
      err(`${p} API token created but value not returned`)
      return null
    }
    
    l.dim(`${p} Successfully created API token with ID: ${tokenData.result.id}`)
    
    const { updateEnvVariable } = await import('../../config/utils/env-writer')
    await updateEnvVariable('CLOUDFLARE_R2_API_TOKEN', tokenData.result.value)
    
    return tokenData.result.value
  } catch (error) {
    err(`${p} Error creating API token: ${(error as Error).message}`)
    return null
  }
}

export function clearCachedToken(): void {
  const p = '[save/services/r2-token-manager]'
  l.dim(`${p} Clearing cached R2 token`)
  cachedApiToken = null
}