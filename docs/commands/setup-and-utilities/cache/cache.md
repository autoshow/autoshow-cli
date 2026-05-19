# cache

Manage the persistent STT media cache used by hosted transcription workflows.

## Usage

```bash
bun as cache <action>
```

`<action>` must be one of:

| Action | Behavior |
|--------|----------|
| `prune` | Remove cache entries older than the configured max age, then remove least-recently used entries until the cache is below the configured size limit |
| `clear` | Remove all cached STT media entries |

## Cache Location

By default, cached media lives under:

```text
~/.cache/autoshow-cli/media
```

Set `AUTOSHOW_CACHE_DIR` to choose a different cache root. The command appends `media/` under that root.

## Prune Limits

`cache prune` uses these environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `AUTOSHOW_CACHE_MAX_GB` | `20` | Maximum cache size in GB before least-recently used entries are removed |
| `AUTOSHOW_CACHE_MAX_AGE_DAYS` | `30` | Maximum entry age before entries are removed |

## Examples

```bash
# Prune expired or over-limit entries
bun as cache prune

# Remove all cached STT media
bun as cache clear

# Prune a custom cache root
AUTOSHOW_CACHE_DIR=input/autoshow-cache bun as cache prune
```

## Related Flags

STT runs can control cache use per run:

| Flag | Description |
|------|-------------|
| `--refresh-cache` | Rebuild cache entries touched by this run |
| `--no-cache` | Bypass the media cache for this run |
