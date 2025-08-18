import { Command } from 'commander'
import { promises as fs } from 'fs'
import { dirname } from 'path'

export interface FileData {
  path: string
  content: string
}

const p = '[parse]'

function extractFilePath(line: string): string | null {
  if (!line.trim()) return null
  
  let cleanLine = line.trim()
  
  if (cleanLine.startsWith('## ')) {
    cleanLine = cleanLine.substring(3).trim()
  }
  
  if (cleanLine.startsWith('**') && cleanLine.endsWith('**')) {
    cleanLine = cleanLine.substring(2, cleanLine.length - 2).trim()
  }
  
  const prefixPatterns = [
    /^File:\s*(.+)$/i,
    /^New file:\s*(.+)$/i,
    /^Modified file:\s*(.+)$/i,
    /^Updated file:\s*(.+)$/i,
    /^Create file:\s*(.+)$/i,
    /^Add file:\s*(.+)$/i,
    /^Delete file:\s*(.+)$/i,
    /^Move file:\s*(.+)$/i,
    /^Rename file:\s*(.+)$/i,
    /^Path:\s*(.+)$/i,
    /^Location:\s*(.+)$/i
  ]
  
  for (const pattern of prefixPatterns) {
    const match = cleanLine.match(pattern)
    if (match) {
      const extractedPath = match[1]?.trim()
      if (extractedPath && isValidFilePath(extractedPath)) {
        console.log(`${p} Extracted path from prefix pattern: ${extractedPath}`)
        return extractedPath
      }
    }
  }
  
  if (isValidFilePath(cleanLine)) {
    console.log(`${p} Using direct path format: ${cleanLine}`)
    return cleanLine
  }
  
  console.log(`${p} Rejected potential path: ${cleanLine}`)
  return null
}

function isValidFilePath(path: string): boolean {
  if (!path || typeof path !== 'string') {
    console.log(`${p} Path validation failed: empty or non-string`)
    return false
  }
  
  if (!path.includes('/')) {
    console.log(`${p} Path validation failed: no forward slashes`)
    return false
  }
  
  const shellCommands = ['echo', 'cat', 'ls', 'cd', 'mkdir', 'rm', 'cp', 'mv', 'touch', 'grep', 'find', 'awk', 'sed', 'curl', 'wget', 'npm', 'yarn', 'node', 'git', 'docker', 'sudo']
  const firstWord = path.split(/\s+/)[0]?.toLowerCase()
  if (shellCommands.includes(firstWord)) {
    console.log(`${p} Path validation failed: starts with shell command "${firstWord}"`)
    return false
  }
  
  if (path.includes('http://') || path.includes('https://')) {
    console.log(`${p} Path validation failed: contains URL`)
    return false
  }
  
  const shellOperators = ['>', '>>', '|', '&&', '||', ';', '`', '$', '$(', '${']
  if (shellOperators.some(op => path.includes(op))) {
    console.log(`${p} Path validation failed: contains shell operators`)
    return false
  }
  
  if (path.includes(' ') && !path.startsWith('"') && !path.startsWith("'")) {
    const words = path.split(/\s+/)
    if (words.length > 3) {
      console.log(`${p} Path validation failed: too many unquoted words (${words.length})`)
      return false
    }
  }
  
  const validExtensions = ['.ts', '.js', '.tsx', '.jsx', '.md', '.json', '.css', '.scss', '.html', '.vue', '.py', '.go', '.rs', '.java', '.cpp', '.c', '.h', '.php', '.rb', '.swift', '.kt', '.dart', '.yml', '.yaml', '.xml', '.toml', '.ini', '.env', '.gitignore', '.dockerignore', '.txt']
  const hasValidExtension = validExtensions.some(ext => path.toLowerCase().endsWith(ext))
  
  if (!hasValidExtension) {
    console.log(`${p} Path validation failed: no valid file extension`)
    return false
  }
  
  const commonHeaders = ['overview', 'usage', 'examples', 'setup', 'configuration', 'installation', 'getting started', 'api', 'reference', 'guide', 'tutorial', 'documentation', 'readme', 'changelog', 'license', 'contributing']
  const pathLower = path.toLowerCase()
  const isCommonHeader = commonHeaders.some(header => pathLower.includes(header) && !pathLower.includes('/'))
  
  if (isCommonHeader) {
    console.log(`${p} Path validation failed: appears to be a common header`)
    return false
  }
  
  if (path.startsWith('/') || path.includes('..') || path.includes('//')) {
    console.log(`${p} Path validation failed: absolute path or contains .. or //`)
    return false
  }
  
  console.log(`${p} Path validation passed: ${path}`)
  return true
}

async function parseMarkdown(content: string): Promise<FileData[]> {
  console.log(`${p} Starting markdown parsing`)
  
  const lines = content.split('\n')
  const files: FileData[] = []
  let currentFile: FileData | null = null
  let inCodeBlock = false
  let codeBlockContent: string[] = []
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    
    const filePath = extractFilePath(line)
    if (filePath && !inCodeBlock) {
      if (currentFile && codeBlockContent.length > 0) {
        currentFile.content = codeBlockContent.join('\n').trim()
        files.push(currentFile)
        console.log(`${p} Added file: ${currentFile.path} (${currentFile.content.length} chars)`)
      }
      
      console.log(`${p} Found file path: ${filePath}`)
      currentFile = { path: filePath, content: '' }
      codeBlockContent = []
    }
    else if (line.startsWith('```') && currentFile) {
      if (!inCodeBlock) {
        inCodeBlock = true
        console.log(`${p} Entering code block for ${currentFile.path}`)
      } else {
        inCodeBlock = false
        console.log(`${p} Exiting code block for ${currentFile.path}`)
      }
    } else if (inCodeBlock && currentFile) {
      codeBlockContent.push(line)
    }
  }
  
  if (currentFile && codeBlockContent.length > 0) {
    currentFile.content = codeBlockContent.join('\n').trim()
    files.push(currentFile)
    console.log(`${p} Added final file: ${currentFile.path} (${currentFile.content.length} chars)`)
  }
  
  console.log(`${p} Parsed ${files.length} files from markdown`)
  files.forEach(file => console.log(`${p} File: ${file.path} (${file.content.length} chars)`))
  return files
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await fs.access(path)
    return true
  } catch {
    return false
  }
}

async function ensureDirectory(filePath: string): Promise<void> {
  const dir = dirname(filePath)
  try {
    await fs.mkdir(dir, { recursive: true })
    console.log(`${p} Ensured directory exists: ${dir}`)
  } catch (error) {
    console.error(`${p} Error creating directory ${dir}:`, error)
    throw error
  }
}

async function deleteFile(filePath: string): Promise<void> {
  try {
    if (await fileExists(filePath)) {
      await fs.unlink(filePath)
      console.log(`${p} Deleted existing file: ${filePath}`)
    } else {
      console.log(`${p} File doesn't exist, skipping deletion: ${filePath}`)
    }
  } catch (error) {
    console.error(`${p} Error deleting file ${filePath}:`, error)
    throw error
  }
}

async function writeFile(filePath: string, content: string): Promise<void> {
  try {
    await ensureDirectory(filePath)
    await fs.writeFile(filePath, content, 'utf8')
    console.log(`${p} Wrote file: ${filePath}`)
  } catch (error) {
    console.error(`${p} Error writing file ${filePath}:`, error)
    throw error
  }
}

async function processFiles(files: FileData[]): Promise<void> {
  console.log(`${p} Processing ${files.length} files`)
  
  if (files.length === 0) {
    console.log(`${p} No files to process`)
    return
  }
  
  const deletePromises = files.map(file => deleteFile(file.path))
  await Promise.all(deletePromises)
  console.log(`${p} Completed deletion phase`)
  
  const writePromises = files.map(file => writeFile(file.path, file.content))
  await Promise.all(writePromises)
  console.log(`${p} Completed write phase`)
}

async function main(): Promise<void> {
  const program = new Command()
  
  program
    .name('parse')
    .description('Parse markdown file and update project files')
    .version('1.0.0')
    .argument('<markdown-file>', 'path to markdown file containing file definitions')
    .option('-d, --dry-run', 'show what would be done without making changes')
    .action(async (markdownFile, options) => {
      try {
        console.log(`${p} Reading markdown file: ${markdownFile}`)
        
        const exists = await fileExists(markdownFile)
        if (!exists) {
          console.error(`${p} Error: Markdown file not found: ${markdownFile}`)
          process.exit(1)
        }
        
        const content = await fs.readFile(markdownFile, 'utf8')
        console.log(`${p} Successfully read markdown file`)
        
        const files = await parseMarkdown(content)
        
        if (files.length === 0) {
          console.log(`${p} No files found in markdown`)
          return
        }
        
        if (options.dryRun) {
          console.log(`${p} Dry run mode - no changes will be made`)
          console.log(`${p} Files that would be processed:`)
          files.forEach(file => {
            console.log(`  - ${file.path} (${file.content.length} characters)`)
          })
          return
        }
        
        await processFiles(files)
        console.log(`${p} Successfully updated all files`)
        
      } catch (error) {
        console.error(`${p} Fatal error:`, error)
        process.exit(1)
      }
    })
  
  await program.parseAsync(process.argv)
}

main().catch(error => {
  console.error(`${p} Unhandled error:`, error)
  process.exit(1)
})