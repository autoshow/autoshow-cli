import { Command } from 'commander'
import { env } from '@/node-utils'
import { l, err } from '@/logging'
async function displayPermissions(data: any): Promise<void> {
  const p = '[text/commands/cloudflare]'
  l.success('\nAvailable Permission Groups:')
  l.success('============================\n')
  
  const vectorizeRelated = data.result.filter((perm: any) => 
    perm.name.toLowerCase().includes('vectorize') ||
    perm.name.toLowerCase().includes('worker') ||
    perm.name.toLowerCase().includes('analytics') ||
    perm.name.toLowerCase().includes('ai gateway')
  )
  
  if (vectorizeRelated.length > 0) {
    l.success('Potentially Vectorize-related permissions:')
    vectorizeRelated.forEach((perm: any) => {
      l.opts(`\n- ${perm.name}`)
      l.dim(`  ID: ${perm.id}`)
      if (perm.scopes && perm.scopes.length > 0) {
        l.dim(`  Scopes: ${perm.scopes.join(', ')}`)
      }
    })
    l.opts('')
  }
  
  l.success('\nAll available permissions:')
  l.success('--------------------------')
  data.result.forEach((perm: any) => {
    l.dim(`- ${perm.name} (${perm.id})`)
  })
  
  l.success(`\nTotal permission groups: ${data.result.length}`)
  l.dim(`${p} Permission groups displayed successfully`)
}
export const cloudflareCommand = new Command('cloudflare')
  .description('Manage Cloudflare tokens and permissions for Vectorize')
cloudflareCommand
  .command('list-permissions')
  .description('List all available permission groups for your account')
  .action(async () => {
    const p = '[text/commands/cloudflare]'
    l.step('\nListing Cloudflare Permissions\n')
    
    const accountId = env['CLOUDFLARE_ACCOUNT_ID']
    const email = env['CLOUDFLARE_EMAIL']
    const globalKey = env['CLOUDFLARE_GLOBAL_API_KEY']
    
    if (!accountId) {
      err('Please set CLOUDFLARE_ACCOUNT_ID in your .env file')
      process.exit(1)
    }
    
    let apiToken = env['CLOUDFLARE_API_TOKEN']
    let headers: any = {
      'Content-Type': 'application/json'
    }
    
    if (apiToken) {
      l.dim(`${p} Using API token for authentication`)
      headers['Authorization'] = `Bearer ${apiToken}`
    } else if (email && globalKey) {
      l.dim(`${p} Using global API key for authentication`)
      headers['X-Auth-Email'] = email
      headers['X-Auth-Key'] = globalKey
    } else {
      err('\nTo list permissions, you need either:')
      err('1. CLOUDFLARE_API_TOKEN in your .env file, OR')
      err('2. Both CLOUDFLARE_EMAIL and CLOUDFLARE_GLOBAL_API_KEY')
      err('\nYou can find your global API key at:')
      err('https://dash.cloudflare.com/profile/api-tokens')
      err('(Look for "Global API Key" and click "View")')
      process.exit(1)
    }
    
    try {
      l.dim(`${p} Fetching permission groups from Cloudflare API`)
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/tokens/permission_groups`,
        { headers }
      )
      
      if (!response.ok) {
        const errorText = await response.text()
        l.dim(`${p} Primary authentication failed, attempting fallback`)
        
        if (apiToken && email && globalKey) {
          l.dim(`${p} Retrying with global API key`)
          
          const retryResponse = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${accountId}/tokens/permission_groups`,
            {
              headers: {
                'X-Auth-Email': email,
                'X-Auth-Key': globalKey,
                'Content-Type': 'application/json'
              }
            }
          )
          
          if (retryResponse.ok) {
            const data = await retryResponse.json() as any
            l.dim(`${p} Successfully fetched permissions with global API key`)
            await displayPermissions(data)
            return
          }
        }
        
        throw new Error(`Failed to fetch permission groups: ${errorText}`)
      }
      
      const data = await response.json() as any
      l.dim(`${p} Successfully fetched ${data.result?.length || 0} permission groups`)
      await displayPermissions(data)
      
    } catch (error) {
      err(`${p} Error fetching permissions: ${error}`)
      err('\nIf you\'re having authorization issues, make sure you have set:')
      err('- CLOUDFLARE_EMAIL=your-email@example.com')
      err('- CLOUDFLARE_GLOBAL_API_KEY=your-global-api-key')
      process.exit(1)
    }
  })
cloudflareCommand
  .command('create-vectorize-token')
  .description('Create a new API token with Vectorize permissions')
  .option('--name <name>', 'Token name', 'Vectorize API Token')
  .action(async (options) => {
    const p = '[text/commands/cloudflare]'
    l.step(`\nCreating Vectorize API Token: ${options.name}\n`)
    
    const accountId = env['CLOUDFLARE_ACCOUNT_ID']
    const email = env['CLOUDFLARE_EMAIL']
    const globalKey = env['CLOUDFLARE_GLOBAL_API_KEY']
    
    if (!accountId) {
      err('Please set CLOUDFLARE_ACCOUNT_ID in your .env file')
      process.exit(1)
    }
    
    if (!email || !globalKey) {
      err('\nTo create a new token, you need to use your global API key.')
      err('Please add these to your .env file:')
      err('CLOUDFLARE_EMAIL=your-email@example.com')
      err('CLOUDFLARE_GLOBAL_API_KEY=your-global-api-key')
      err('\nYou can find your global API key at:')
      err('https://dash.cloudflare.com/profile/api-tokens')
      err('(Look for "Global API Key" and click "View")')
      process.exit(1)
    }
    
    l.dim(`${p} Fetching available permissions`)
    
    try {
      const permResponse = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/tokens/permission_groups`,
        {
          headers: {
            'X-Auth-Email': email,
            'X-Auth-Key': globalKey,
            'Content-Type': 'application/json'
          }
        }
      )
      
      if (!permResponse.ok) {
        throw new Error(`Failed to fetch permissions: ${await permResponse.text()}`)
      }
      
      const permData = await permResponse.json() as any
      l.dim(`${p} Found ${permData.result?.length || 0} available permissions`)
      
      const requiredPerms = permData.result.filter((perm: any) => 
        perm.name === 'Vectorize Read' ||
        perm.name === 'Vectorize Write' ||
        perm.name.includes('Workers Scripts') ||
        perm.name.includes('Workers KV Storage') ||
        perm.name.includes('Workers Routes') ||
        perm.name.includes('Account Analytics') ||
        perm.name.includes('Analytics')
      )
      
      if (requiredPerms.length === 0) {
        err('Could not find required permissions. Available permissions:')
        permData.result.forEach((perm: any) => {
          l.dim(`- ${perm.name} (${perm.id})`)
        })
        process.exit(1)
      }
      
      const hasVectorizePerms = requiredPerms.some((perm: any) => 
        perm.name === 'Vectorize Read' || perm.name === 'Vectorize Write'
      )
      
      if (!hasVectorizePerms) {
        l.warn('\n⚠️  WARNING: Vectorize permissions not found in the list!')
        l.warn('The token may not work properly for Vectorize operations.')
        l.warn('\nExpected permissions:')
        l.warn('- Vectorize Read')
        l.warn('- Vectorize Write')
      }
      
      l.success('\nFound permissions to include:')
      requiredPerms.forEach((perm: any) => {
        l.dim(`- ${perm.name}`)
      })
      
      const tokenBody = {
        name: options.name,
        policies: [
          {
            effect: 'allow',
            permission_groups: requiredPerms.map((perm: any) => ({
              id: perm.id,
              meta: {}
            })),
            resources: {
              [`com.cloudflare.api.account.${accountId}`]: '*'
            }
          }
        ]
      }
      
      l.dim(`${p} Creating API token with ${requiredPerms.length} permissions`)
      const createResponse = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/tokens`,
        {
          method: 'POST',
          headers: {
            'X-Auth-Email': email,
            'X-Auth-Key': globalKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(tokenBody)
        }
      )
      
      if (!createResponse.ok) {
        const errorText = await createResponse.text()
        let errorData
        try {
          errorData = JSON.parse(errorText)
          if (errorData.errors?.[0]?.message) {
            throw new Error(`Failed to create token: ${errorData.errors[0].message}`)
          }
        } catch (e) {
          l.dim(`${p} Failed to parse error response`)
        }
        throw new Error(`Failed to create token: ${errorText}`)
      }
      
      const tokenData = await createResponse.json() as any
      l.dim(`${p} Token creation API call completed`)
      
      if (!tokenData.result?.value) {
        l.warn('\n⚠️  Token created but value not returned in response.')
        l.warn('This might be a Cloudflare API limitation.')
        l.warn('\nPlease create the token manually via the dashboard:')
        l.warn('1. Go to https://dash.cloudflare.com/profile/api-tokens')
        l.warn('2. Click "Create Token"')
        l.warn('3. Use "Custom token" template')
        l.warn('4. Add the permissions shown above')
        l.warn('5. Set Account Resources to your account')
        l.warn('6. Create and copy the token')
      } else {
        l.success('\n✅ Token created successfully!')
        l.success('\nIMPORTANT: Save this token value, it will only be shown once:')
        l.success('='.repeat(60))
        l.success(tokenData.result.value)
        l.success('='.repeat(60))
        l.success('\nUpdate your .env file:')
        l.success(`CLOUDFLARE_API_TOKEN=${tokenData.result.value}`)
      }
      
      l.success('\nToken details:')
      l.dim(`- Name: ${tokenData.result.name}`)
      l.dim(`- ID: ${tokenData.result.id}`)
      l.dim(`- Status: ${tokenData.result.status || 'active'}`)
      
    } catch (error) {
      err(`${p} Error creating token: ${error}`)
      err('\nIf automated token creation fails, please create manually:')
      err('1. Go to https://dash.cloudflare.com/profile/api-tokens')
      err('2. Click "Create Token"')
      err('3. Choose "Custom token" template')
      err('4. Name it "Vectorize API Token"')
      err('5. Add these permissions:')
      err('   - Account → Vectorize → Read')
      err('   - Account → Vectorize → Write')
      err('   - Account → Workers Scripts → Edit')
      err('   - Account → Workers KV Storage → Edit')
      err('   - Account → Workers Routes → Edit')
      err('   - Account → Account Analytics → Read')
      err('6. Set Account Resources to: Include → Your Account')
      err('7. Create the token and copy it to your .env file')
      process.exit(1)
    }
  })
cloudflareCommand
  .command('test-token')
  .description('Test if your current API token works with Vectorize')
  .action(async () => {
    const p = '[text/commands/cloudflare]'
    l.step('\nTesting Cloudflare API Token\n')
    
    const accountId = env['CLOUDFLARE_ACCOUNT_ID']
    const apiToken = env['CLOUDFLARE_API_TOKEN']
    
    if (!accountId || !apiToken) {
      err('Please set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in your .env file')
      process.exit(1)
    }
    
    try {
      l.dim(`${p} Testing token validity`)
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/tokens/verify`,
        {
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      )
      
      const data = await response.json() as any
      
      if (response.ok && data.success) {
        l.success('✅ Token is valid!')
        l.dim(`- Token ID: ${data.result.id}`)
        l.dim(`- Status: ${data.result.status}`)
        if (data.result.expires_on) {
          l.dim(`- Expires: ${data.result.expires_on}`)
        }
        
        l.dim(`${p} Testing Vectorize API access`)
        const vectorizeResponse = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${accountId}/vectorize/v2/indexes`,
          {
            headers: {
              'Authorization': `Bearer ${apiToken}`,
              'Content-Type': 'application/json'
            }
          }
        )
        
        if (vectorizeResponse.ok) {
          const vectorizeData = await vectorizeResponse.json() as any
          l.success('✅ Token has access to Vectorize API!')
          l.dim(`${p} Found ${vectorizeData.result?.length || 0} existing indexes`)
        } else if (vectorizeResponse.status === 403) {
          err('❌ Token does NOT have access to Vectorize API')
          err('Please create a new token with Vectorize permissions')
          err('Run: npm run as -- text cloudflare create-vectorize-token')
        } else {
          l.warn(`⚠️  Unexpected response from Vectorize API: ${vectorizeResponse.status}`)
        }
      } else {
        err('❌ Token is invalid or doesn\'t have proper permissions')
        err(`Error: ${data.errors?.[0]?.message || 'Unknown error'}`)
      }
      
    } catch (error) {
      err(`${p} Error testing token: ${error}`)
      process.exit(1)
    }
  })