# AutoShow Bun CLI v0.1 Release

Historical note: this file is retained as an archive marker for the original `v0.1` release narrative.

It does not describe the current runtime contract. The modern CLI is v2-only:

- run manifests use `run.json`
- batch manifests use `batch.json`
- provider subruns use `result.json` plus optional `checkpoint.json`
- write outputs are JSON-only (`text.json`)
- config requires `version: 2`

For current usage, see:

- [`README.md`](../README.md)
- [`docs/commands.md`](./commands.md)
- the command-specific docs under `docs/commands/`
