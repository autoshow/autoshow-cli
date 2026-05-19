# sock

Write a read-only Socket dependency insight report for a JavaScript package.

`sock` is a Setup & Utilities command. It inventories direct dependencies from `package.json`, runs Socket analysis through an existing system `socket` binary when credentials allow it, and writes report artifacts without editing manifests or lockfiles.

## Usage

```bash
bun as sock [target] [flags]
```

`[target]` defaults to the current directory. It can be either:

- a project directory containing `package.json`
- a direct path to a `package.json` file

## Output

By default, reports are written to:

```text
project/reports/socket/<timestamp>_sock/
```

Each report contains:

| File | Description |
|------|-------------|
| `summary.md` | Human-readable dependency inventory, Socket step status, raw output links, and next-step guidance |
| `summary.json` | Machine-readable report summary |
| `dependency-inventory.json` | Direct dependency inventory preserving current package version specs |
| `raw/` | Captured stdout/stderr and parsed JSON from Socket CLI commands |

`sock` treats unhealthy Socket results as findings, not as CLI failures. Authentication failures, missing scopes, or JSON parse failures are recorded in the report while local dependency inventory still writes.

## Socket CLI Requirement

`sock` requires an existing system Socket CLI binary. It does not install Socket.

Use `--socket-bin <path>` when `socket` is not on `PATH`:

```bash
bun as sock --socket-bin /usr/local/bin/socket
```

If the binary is missing, the command exits with install guidance before writing report files.

## Read-Only Behavior

`sock` never applies package upgrades or Socket Fix changes.

When upgrade guidance is enabled, AutoShow invokes Socket Fix as recommendation-only:

```bash
socket fix --no-apply-fixes --show-affected-direct-dependencies --json
```

Any changes to `package.json`, `bun.lock`, or other manifests must be reviewed and applied manually after reading the report.

## Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--socket-bin <path>` | `socket` | Socket CLI binary to execute |
| `--out <dir>` | `project/reports/socket/<timestamp>_sock` | Report output directory |
| `--skip-scan` | `false` | Skip Socket full project scan creation |
| `--skip-fix` | `false` | Skip recommendation-only Socket Fix analysis |
| `--skip-package-scores` | `false` | Skip Socket package shallow and deep score lookups |
| `--max-deep <n>` | `10` | Maximum number of direct dependencies to score with `socket package deep` |
| `--minimum-release-age <duration>` | none | Pass a minimum release age duration to Socket Fix recommendations |
| `--no-major-updates` | `false` | Ask Socket Fix to avoid major-version upgrade recommendations |
| `--token-help` | `false` | Print minimal Socket API token scope guidance and exit |

## Socket Steps

`sock` performs these steps:

1. Read `package.json` and inventory direct dependencies from `dependencies`, `devDependencies`, `peerDependencies`, and `optionalDependencies`.
2. Run package scoring for direct dependencies with `socket package shallow ... --json`.
3. Run deeper scoring for up to `--max-deep` direct dependencies with `socket package deep ... --json`.
4. Run a project scan with `socket scan create --report --tmp --no-interactive --json <target>`.
5. Run upgrade/security guidance with `socket fix --no-apply-fixes --show-affected-direct-dependencies --json`.

Use the skip flags to omit any Socket-powered phase while still writing local inventory.

## Token Setup

Run this for exact token guidance:

```bash
bun as sock --token-help
```

Do not select all scopes.

For this read-only report, use only:

- `packages:list` for package score and Socket Fix metadata
- `full-scans:create` for project scan creation and Socket Fix analysis
- `full-scans:list` for scan report retrieval
- `security-policy:read` for policy report evaluation

Optional future scope:

- `license-policy:read` only if a future `--license` report mode is added

Not needed for v1:

- API token management scopes
- audit log scopes
- repository create, update, or delete scopes
- policy update scopes
- webhook scopes
- integration scopes
- triage update scopes
- threat-feed scopes
- telemetry scopes
- wrapper scopes
- historical trend scopes

Set either token variable:

```bash
export SOCKET_SECURITY_API_TOKEN=...
# or
export SOCKET_CLI_API_TOKEN=...
```

If only one is set, `sock` passes it through to Socket under both names for compatibility with Socket docs and examples.

## Examples

```bash
# Analyze the current project
bun as sock

# Analyze another package
bun as sock packages/app

# Write to a custom report directory
bun as sock --out project/reports/socket/current

# Use an explicit Socket CLI binary
bun as sock --socket-bin /opt/homebrew/bin/socket

# Inventory plus package scores only
bun as sock --skip-scan --skip-fix

# Scan and fix guidance only
bun as sock --skip-package-scores

# Limit deep package scoring and tune upgrade recommendations
bun as sock --max-deep 5 --minimum-release-age 7d --no-major-updates
```
