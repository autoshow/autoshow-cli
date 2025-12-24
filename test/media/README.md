# Media Command Tests

This directory contains comprehensive tests for the media commands in autoshow-cli.

## Test Files

### 1. `media-download.test.ts`
End-to-end CLI tests for the `media download` command that downloads audio from URLs listed in markdown files.

**Test Cases:**
- Downloads audio from URLs in a markdown file (default settings)
- Downloads audio with verbose output enabled

**Features:**
- Creates test markdown files with sample URLs
- Verifies downloaded files exist and contain audio data
- Cleans up test files after execution
- Renames output files with sequential numbering

### 2. `media-convert.test.ts`
End-to-end CLI tests for the `media convert` command that converts local audio/video files to optimized MP3 format.

**Test Cases:**
- Converts a single media file
- Converts all media files in a directory
- Converts with custom output directory
- Converts with verbose output enabled

**Features:**
- Creates test media files using ffmpeg
- Supports multiple media file formats (MP4, MKV, AVI, MOV, etc.)
- Verifies converted files exist and contain audio data
- Cleans up test fixtures after execution
- Tests both default and custom output directories

### 3. `save-audio-files.test.ts`
Unit tests for the `save-audio-files.ts` module functions.

**Test Cases for `sanitizeFilename()`:**
- Converts uppercase to lowercase
- Replaces spaces with hyphens
- Removes special characters
- Collapses multiple hyphens
- Removes leading and trailing hyphens
- Preserves file extensions
- Handles files without extensions
- Handles complex filenames with special characters

**Test Cases for `convertLocalAudioFiles()`:**
- Rejects non-existent files
- Rejects non-existent directories
- Rejects directories with no media files
- Accepts and converts single video file
- Accepts and converts directory with multiple media files
- Uses default output directory when not specified

**Features:**
- Creates isolated test fixtures
- Uses ffmpeg to generate test media files
- Verifies output file creation and content
- Comprehensive error handling tests
- Cleans up all test artifacts

### 4. `save-audio-urls.test.ts`
Unit tests for the `save-audio-urls.ts` module functions.

**Test Cases for `downloadAudioFromUrls()`:**
- Rejects non-markdown files
- Rejects non-existent files
- Rejects markdown files with no URLs
- Extracts URLs from markdown file
- Handles URLs with parentheses at end
- Handles URLs with angle brackets
- Handles both http and https URLs
- Handles complex markdown with multiple URL formats
- Verifies markdown parsing for download functionality

**URL Extraction Tests:**
- Inline URLs: `https://example.com/video`
- Markdown links: `[Text](https://example.com/video)`
- Angle brackets: `<https://example.com/video>`
- Parenthetical URLs: `(https://example.com/video)`
- List URLs
- URLs in code blocks
- Multiple URL formats in complex markdown

**Features:**
- Creates test markdown files with various URL formats
- Verifies URL extraction regex patterns
- Tests edge cases (parentheses, brackets, protocols)
- Comprehensive markdown parsing validation
- Cleans up test fixtures

## Running the Tests

### Run All Media Tests
```bash
bun test:media
```

### Run Individual Test Suites
```bash
# Download command tests
bun test:media:download

# Convert command tests
bun test:media:convert

# save-audio-files unit tests
bun test:media:save-audio-files

# save-audio-urls unit tests
bun test:media:save-audio-urls
```

## Prerequisites

### Required Tools
- **ffmpeg**: Required for media conversion tests
  - macOS: `brew install ffmpeg`
  - Ubuntu/Debian: `apt-get install ffmpeg`
  - Tests will be skipped if ffmpeg is not available

- **yt-dlp**: Required for download tests
  - macOS: `brew install yt-dlp`
  - Ubuntu/Debian: `apt-get install yt-dlp`
  - Tests may fail if yt-dlp is not available

### Environment Setup
- Tests use the `.env` file for configuration
- Tests create temporary files in `test/media/test-fixtures/`
- Tests output results to the `output/` directory
- All temporary files are cleaned up after test execution

## Test Output

### File Naming Convention
Output files are renamed with sequential numbering:
```
01-{original-name}-{test-name}.mp3
02-{original-name}-{test-name}.mp3
...
```

### Logs
Test output is logged to:
- `stdout` (console)
- `spec.log` (test reporter log file)

## Test Architecture

### CLI Tests (E2E)
- Execute actual CLI commands using `exec()`
- Verify command exit codes
- Check for expected output files
- Validate file content and size
- Rename output files for organization

### Unit Tests
- Test individual functions in isolation
- Mock file system operations where appropriate
- Verify error handling and edge cases
- Test input validation
- Verify output correctness

### Test Isolation
- Each test creates its own fixtures
- Tests clean up after themselves
- Tests run sequentially to avoid conflicts
- Before/after hooks manage test lifecycle

## Coverage

The test suite covers:
- ✅ Command-line interface
- ✅ File input validation
- ✅ Directory processing
- ✅ URL extraction from markdown
- ✅ Filename sanitization
- ✅ Error handling
- ✅ Output directory management
- ✅ Verbose logging options
- ✅ Multiple media format support
- ✅ Default vs custom output paths

## Continuous Integration

These tests are designed to run in CI/CD environments:
- Tests skip gracefully if required tools are missing
- Tests handle existing output files
- Tests provide detailed logging
- Tests clean up all artifacts
- Tests run with `--test-concurrency=1` to avoid conflicts
