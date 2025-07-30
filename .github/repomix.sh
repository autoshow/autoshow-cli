#!/bin/zsh

INCLUDE_PATHS=(
  ".github"
  "content"
  "docs/01-content-and-feed-inputs.md"
  "input"
  # "**/*"
  "src/*.ts"
  # "src/image"
  "src/text"
  # "src/tts"
  "src/commander.ts"
  "workflows"
  ".env.example"
  ".tts-config.json"
  "package.json"
  "tsconfig.json"
  "README.md"
)

IGNORE_PATHS=(
  ".github/workflows/review.yml"
  ".github/ai-review.ts"
  ".github/FUNDING.yml"
  "content"
  # "docs"
  "output"
  "python_env"
  "test"
  "src/text/workflows"
  "src/text/prompts/sections.ts"
  "whisper.cpp"
  ".gitignore"
  "LICENSE"
  "new-*.md"
  "TODO.md"
)

INCLUDE_STRING=$(IFS=,; echo "${INCLUDE_PATHS[*]}")
IGNORE_STRING=$(IFS=,; echo "${IGNORE_PATHS[*]}")

INSTRUCTION_FILE="repomix-instruction.md"
TEMP_DIR=""

if [ ! -f "$INSTRUCTION_FILE" ]; then
  TEMP_DIR=$(mktemp -d)
  INSTRUCTION_FILE="$TEMP_DIR/repomix-instruction-temp.md"

  cat > "$INSTRUCTION_FILE" << 'EOF'
I'm going to ask you to refactor my code, write a new feature, or fix a bug.

- Any time you are refactoring, building a new feature, or fixing a bug, add a few logging functions to track what is happening and help debug when the application fails.
- In your responses when you respond with code, you will respond with the entire code files with no comments.
- Include one or two sentences before the code file explaining what has been changed, do not write the explanation as comments in the code file.
- Do not include any comments in the code at all.
- Aside from the instructions above and given below, you will not make any changes to the code files. You will only add or remove code specific to the requested refactor, feature, or bug fix.
- Only respond with code files if there are changes (either additions or subtractions), do not respond with code files that are identical to the code files I gave you.
- Always use ESM, async/await, try catch, and the latest version of Node.js (22 as of now). Avoid for and while loops in favor of map functions. Avoid if-else statements unless very minimal and when no other appropriate solutions exist.
- Do not use dynamic imports, all imports should be declared at the top of the file.
- Do not use semi-colons.
- Always write `.ts` files with TypeScript. Infer types whenever possible, when types must be declared keep them minimal and inlined instead of named. Always include return types.
- Treat environment variables from `process` as if they come from an index signature, so it must be accessed like `process.env['OPENAI_API_KEY']` instead of `process.env.OPENAI_API_KEY`.
EOF

  echo "Created temporary instruction file: $INSTRUCTION_FILE"
fi

OUTPUT_FILE="new-llm-1.md"
COUNTER=2

while [ -f "$OUTPUT_FILE" ]; do
  OUTPUT_FILE="new-llm-$COUNTER.md"
  COUNTER=$((COUNTER + 1))
done

repomix \
  --instruction-file-path "$INSTRUCTION_FILE" \
  --include "$INCLUDE_STRING" \
  --ignore "$IGNORE_STRING" \
  --style markdown \
  --output "$OUTPUT_FILE" \
  --token-count-encoding "o200k_base" \
  --top-files-len 50 \
  --no-git-sort-by-changes \
  --no-file-summary

EXIT_CODE=$?
if [ $EXIT_CODE -eq 0 ]; then
  echo "Successfully created $OUTPUT_FILE"
else
  echo "Error running repomix command"
fi

if [ -n "$TEMP_DIR" ]; then
  rm -rf "$TEMP_DIR"
  echo "Removed temporary directory and instruction file"
fi

exit $EXIT_CODE