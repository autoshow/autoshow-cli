# AutoShow CLI Architecture Diagrams

Consolidated architecture diagrams covering the same system content in a smaller set of broader, more naturally grouped views.

## Outline

- [Diagrams](#diagrams)

## Diagrams

1. [System Overview & CLI Surface](diagrams/01-system-overview-cli.md) - High-level architecture, command routing, interceptors, and the flag system
2. [Input Routing & Batch Orchestration](diagrams/02-input-routing-batch.md) - Target classification, single-item routing, command/input matrix, and batch flows
3. [Processing Pipelines](diagrams/03-processing-pipelines.md) - Media and document execution paths from download/detect through extraction/transcription and optional LLM/generation steps
4. [Providers, Models & Setup](diagrams/04-providers-and-setup.md) - LLM provider selection, model options, runtime setup sequence, and per-command dependency requirements
5. [Types, Metadata & Output Layout](diagrams/05-types-and-output.md) - Output directory structure, runtime layout, and the full type system by pipeline step
6. [End-to-End Execution Reference](diagrams/06-end-to-end-reference.md) - Full command trace plus environment variable reference
