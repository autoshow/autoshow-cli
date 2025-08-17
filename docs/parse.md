# parse

A CLI tool that parses markdown files containing code blocks and automatically updates your project files. It reads a specially formatted markdown file where file paths are defined as H2 headers followed by their content in code blocks, then deletes and rewrites those files in your project.

## Installation

Install dependencies:

```bash
npm install
```

## Usage

Run the parser using npm:

```bash
npm run parse new-llm-1.md
```

### Options

- `-d, --dry-run` - Preview what files would be changed without making any modifications
- `-h, --help` - Display help information
- `-V, --version` - Display version number

## Markdown Format

The markdown file must follow this exact format:

1. File paths are specified as H2 headers (`##`)
2. File content follows immediately in a code block with triple backticks
3. Multiple files can be defined in a single markdown file

### Example Input

```markdown
## src/types.ts

\`\`\`typescript
export interface User {
  id: string
  name: string
}
\`\`\`

## src/utils/helpers.ts

\`\`\`typescript
export function formatName(name: string): string {
  return name.trim().toLowerCase()
}
\`\`\`

## package.json

\`\`\`json
{
  "name": "my-app",
  "version": "1.0.0"
}
\`\`\`
```

## How It Works

1. **Parse**: The tool reads your markdown file and extracts all file paths and their contents
2. **Delete**: All existing files at the specified paths are deleted
3. **Create**: New files are created with the parsed content
4. **Directories**: Any necessary directories are automatically created

## Examples

### Basic Usage

```bash
npm run parse changes.md
```

This will parse `changes.md` and update all specified files in your project.

### Dry Run

Preview changes without modifying files:

```bash
npm run parse changes.md -- --dry-run
```

Output:
```
[parse] Dry run mode - no changes will be made
[parse] Files that would be processed:
  - src/types.ts (125 characters)
  - src/utils/helpers.ts (89 characters)
  - package.json (45 characters)
```

### Processing Multiple Files

Create a markdown file `refactor.md`:

```markdown
## src/components/Button.ts

\`\`\`typescript
export function Button(label: string): string {
  return `<button>${label}</button>`
}
\`\`\`

## src/components/Input.ts

\`\`\`typescript
export function Input(type: string): string {
  return `<input type="${type}" />`
}
\`\`\`
```

Run the parser:

```bash
npm run parse refactor.md
```

Output:
```
[parse] Reading markdown file: refactor.md
[parse] Successfully read markdown file
[parse] Starting markdown parsing
[parse] Found file path: src/components/Button.ts
[parse] Found file path: src/components/Input.ts
[parse] Parsed 2 files from markdown
[parse] Processing 2 files
[parse] Deleted existing file: src/components/Button.ts
[parse] Deleted existing file: src/components/Input.ts
[parse] Completed deletion phase
[parse] Ensured directory exists: src/components
[parse] Wrote file: src/components/Button.ts
[parse] Wrote file: src/components/Input.ts
[parse] Completed write phase
[parse] Successfully updated all files
```

## Important Notes

- **Destructive Operation**: This tool deletes existing files before creating new ones. Always use `--dry-run` first to preview changes
- **No Backup**: Deleted files are not backed up. Ensure you have version control or backups before running
- **Directory Creation**: Directories are created automatically if they don't exist
- **File Paths**: Paths are relative to where you run the command
- **Code Block Language**: The language identifier after triple backticks (e.g., \`\`\`typescript) is optional and ignored by the parser

## Error Handling

The tool will exit with an error if:
- The specified markdown file doesn't exist
- File system operations fail (permissions, disk space, etc.)
- The markdown file contains no valid file definitions

## Tips

1. Always run with `--dry-run` first to verify the changes
2. Use version control to track changes and allow rollback if needed
3. Keep your markdown files organized by feature or refactoring task
4. The tool processes all files in parallel for better performance