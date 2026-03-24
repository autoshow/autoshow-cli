# Image Setup

Setup and prerequisite notes for `image`.

## Outline

- [Runtime Setup](#runtime-setup)
- [Service Environment](#service-environment)
- [Related Tests](#related-tests)

## Runtime Setup

There are no local image-generation models in this project.

```bash
# optional confirmation step; image providers are API-based
bun as setup --step image
```

## Service Environment

```bash
OPENAI_API_KEY=...
GEMINI_API_KEY=...
MINIMAX_API_KEY=...
```

## Related Tests

```bash
bun t test/test-cases/e2e/step-5-image-gen-e2e/openai-image-gen.test.ts
bun t test/test-cases/e2e/step-5-image-gen-e2e/gemini-image-gen.test.ts
bun t test/test-cases/e2e/step-5-image-gen-e2e/minimax-image-gen.test.ts
```
