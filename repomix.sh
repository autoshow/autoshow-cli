#!/bin/zsh

INCLUDE_PATHS=(
  "**/*"
  # "*"
  # "test"
  # "src"
  # "docs"
  # "config"
)

IGNORE_PATHS=(
  "new-*.md"
  "TODO.md"
  "repomix.sh"
  "project/reports"
  "project/links/all-all-links.md"
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
EOF

  echo "Created temporary instruction file: $INSTRUCTION_FILE"
fi

OUTPUT_FILE="new-llm-1.md"
COUNTER=2

while [ -f "$OUTPUT_FILE" ]; do
  OUTPUT_FILE="new-llm-$COUNTER.md"
  COUNTER=$((COUNTER + 1))
done

npx repomix \
  --instruction-file-path "$INSTRUCTION_FILE" \
  --include "$INCLUDE_STRING" \
  --ignore "$IGNORE_STRING" \
  --style markdown \
  --output "$OUTPUT_FILE" \
  --token-count-encoding "o200k_base" \
  --top-files-len 20 \
  --no-git-sort-by-changes \
  --no-file-summary \
  --no-security-check

EXIT_CODE=$?
if [ $EXIT_CODE -eq 0 ]; then
  echo "Successfully created $OUTPUT_FILE"
else
  echo "Error running repomix command"
fi

if [ -n "$TEMP_DIR" ]; then
  rm -rf "$TEMP_DIR"
fi

exit $EXIT_CODE
