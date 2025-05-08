import { env } from 'node:process'
import { openai } from '@ai-sdk/openai'
import { generateText } from 'ai'
import { tool } from 'ai'
import { z } from 'zod'
import { spawnSync } from 'node:child_process'

export const config = {
  github: {
    owner: env.GH_OWNER,
    repo: env.GH_REPO,
    token: env.GH_TOKEN
  }
}

export function validateConfig(): void {
  if (!config.github.owner) {
    throw new Error('Environment variable GH_OWNER is not set.')
  }
  if (!config.github.repo) {
    throw new Error('Environment variable GH_REPO is not set.')
  }
  if (!config.github.token) {
    throw new Error('Environment variable GH_TOKEN is not set.')
  }
}

export const fetchCommitDiff = tool({
  description: 'A tool to retrieve the diff for a GitHub commit.',
  parameters: z.object({
    owner: z.string(),
    repo: z.string(),
    sha: z.string()
  }),
  execute: async ({ owner, repo, sha }: { owner: string, repo: string, sha: string }): Promise<string> => {
    console.log('VERBOSE: fetchCommitDiff called with:', owner, repo, sha)
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits/${sha}`,
      {
        headers: {
          Accept: 'application/vnd.github.v3.diff',
          Authorization: `Bearer ${config.github.token}`
        }
      }
    )
    console.log('VERBOSE: fetchCommitDiff response status:', response.status)
    if (!response.ok) {
      if (response.status === 404) {
        console.warn('WARN: Commit not found in GitHub remote. Trying local git show...')
        const localDiff = spawnSync('git', ['show', sha, '--patch'], {
          encoding: 'utf-8'
        })
        if (localDiff.status === 0 && localDiff.stdout) {
          return localDiff.stdout
        }
      }
      throw new Error(
        `Failed to fetch commit diff for ${sha}: ${response.status} - ${response.statusText}`
      )
    }
    return await response.text()
  }
})

export async function fetchCompareCommits(base: string, head: string): Promise<string[]> {
  console.log('VERBOSE: fetchCompareCommits called with base:', base, 'head:', head)
  const { owner, repo, token } = config.github
  const compareUrl = `https://api.github.com/repos/${owner}/${repo}/compare/${base}...${head}`
  console.log('VERBOSE: compareUrl:', compareUrl)
  const compareResponse = await fetch(compareUrl, {
    headers: {
      Accept: 'application/vnd.github.v3+json',
      Authorization: `Bearer ${token}`
    }
  })
  console.log('VERBOSE: fetchCompareCommits response status:', compareResponse.status)
  if (!compareResponse.ok) {
    const bodyText = await compareResponse.text()
    console.log(`DEBUG: Compare response body = ${bodyText}`)
    throw new Error(
      `Failed to compare commits: ${compareResponse.status} - ${compareResponse.statusText}`
    )
  }
  const compareData = await compareResponse.json() as { commits: Array<{ sha: string }> }
  console.log('VERBOSE: compareData fetched successfully, commits count:', compareData.commits?.length)
  if (!compareData.commits) {
    throw new Error('No commits found in the specified commit range.')
  }
  const commits = compareData.commits.map((c: { sha: string }) => c.sha)
  if (!commits.length) {
    throw new Error('No commits available in the comparison data.')
  }
  return commits
}

export async function resolveCommits(): Promise<string[]> {
  console.log('VERBOSE: Starting resolveCommits()...')
  let commitRange = env.GITHUB_COMMIT_RANGE
  let commitsToReview: string[] = []
  console.log('DEBUG: GITHUB_COMMIT_RANGE:', env.GITHUB_COMMIT_RANGE)
  console.log('DEBUG: GITHUB_SHA:', env.GITHUB_SHA)

  if (commitRange && commitRange.includes('..') && !commitRange.includes('...')) {
    commitRange = commitRange.replace('..', '...')
    console.log(`DEBUG: Replaced two-dot with three-dot in commit range => ${commitRange}`)
  }

  if (commitRange && commitRange.includes('...')) {
    const [base, head] = commitRange.split('...')
    console.log(`DEBUG: Base commit = ${base}`)
    console.log(`DEBUG: Head commit = ${head}`)
    try {
      commitsToReview = await fetchCompareCommits(base!, head!)
    } catch (error) {
      console.error('Error fetching commit range:', error)
    }
  }

  if (commitsToReview.length === 0) {
    let singleCommit = commitRange || env.GITHUB_SHA
    if (!singleCommit) {
      if (!env.GITHUB_ACTIONS) {
        console.warn('DEBUG: GITHUB_SHA or GITHUB_COMMIT_RANGE not provided. Using HEAD for local testing.')
        singleCommit = 'HEAD'
      } else {
        throw new Error('No commit or commit range found in environment variables.')
      }
    }
    console.log('DEBUG: Using single commit flow with commit:', singleCommit)
    commitsToReview = [singleCommit]
  }
  console.log('VERBOSE: Returning commitsToReview:', commitsToReview)
  return commitsToReview
}

export async function generateCommitReview(sha: string): Promise<string> {
  console.log('VERBOSE: generateCommitReview called with sha:', sha)
  console.log('VERBOSE: Current config:', config)
  const { text } = await generateText({
    model: openai('gpt-4o'),
    system: `You are an AI assistant that reviews code changes in a commit.
    - Summarize key modifications.
    - Flag potential security issues or code smells.
    - Suggest best practices or improvements where relevant.
    - Be concise but thorough in your review.`,
    prompt: `
    The commit to analyze is ${sha} in the ${config.github.owner}/${config.github.repo} repository.
    If you need the diff, call the "fetchCommitDiff" tool with:
    {
      "owner": "${config.github.owner!}",
      "repo": "${config.github.repo!}",
      "sha": "${sha}"
    }.
    `,
    tools: {
      fetchCommitDiff
    },
    maxSteps: 2
  })
  console.log('VERBOSE: AI review generation complete. Received text:', text)
  return text
}

async function runCommitReview(): Promise<void> {
  try {
    console.log('VERBOSE: Starting runCommitReview()...')
    validateConfig()
    console.log('VERBOSE: Configuration validated successfully')
    const commitsToReview = await resolveCommits()
    console.log('VERBOSE: Commits to review:', commitsToReview)
    console.log('=== AI Commit-by-Commit Review ===')
    for (const sha of commitsToReview) {
      const reviewText = await generateCommitReview(sha)
      console.log(`--- Review for commit ${sha} ---`)
      console.log(reviewText)
      console.log('---------------------------------')
    }
    console.log('=================================')
  } catch (error) {
    console.error('Error running commit-by-commit review agent:', error)
    process.exit(1)
  }
}

if (import.meta.url.endsWith('ai-review.ts')) {
  runCommitReview()
}