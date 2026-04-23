# YouTube Cookies

Use this when `yt-dlp` hits a YouTube sign-in prompt or `Sign in to confirm you're not a bot`.

## TL;DR

Preferred:

```dotenv
YTDLP_COOKIES_FROM_BROWSER=chrome
```

Fallback:

```dotenv
YTDLP_COOKIES=/absolute/path/to/cookies.txt
```

Key rules:

- `YTDLP_COOKIES` takes precedence over `YTDLP_COOKIES_FROM_BROWSER`.
- If `YTDLP_COOKIES` is set but unreadable, AutoShow warns and does not fall back.
- `bun as setup --doctor` shows the active cookie mode and whether the file is readable.

## Fastest Fix: Browser Import

Use this if `yt-dlp` can read a browser profile on the current machine.

1. In the browser profile already logged into YouTube, open:

```text
https://www.youtube.com/robots.txt
```

2. Add one of these to `.env`:

```dotenv
YTDLP_COOKIES_FROM_BROWSER=chrome
# YTDLP_COOKIES_FROM_BROWSER=chrome:Default
# YTDLP_COOKIES_FROM_BROWSER=firefox
# YTDLP_COOKIES_FROM_BROWSER=brave
# YTDLP_COOKIES_FROM_BROWSER=msedge
```

3. Retry the exact command that failed:

```bash
bun as extract "https://www.youtube.com/watch?v=YOUR_VIDEO_ID"
```

4. Verify:

```bash
bun as setup --doctor
```

## Fallback: Export `cookies.txt`

Use this if browser import does not work or you want a dedicated cookie jar for this project.

1. Open a fresh private/incognito window.
2. Log into YouTube there.
3. In the same tab, open:

```text
https://www.youtube.com/robots.txt
```

4. Export only `youtube.com` cookies to a Netscape/Mozilla `cookies.txt` file.

High-leverage notes:

- Do not use a DevTools snippet like `document.cookie`. It cannot read `HttpOnly` auth cookies.
- For a fresh private/incognito export, use a conforming browser exporter such as `Get cookies.txt LOCALLY` for Chrome or `cookies.txt` for Firefox.
- Do not commit the exported file.

5. Put the file somewhere stable, for example:

```bash
mkdir -p runtime/auth
cp ~/Downloads/cookies.txt runtime/auth/youtube.cookies.txt
chmod 600 runtime/auth/youtube.cookies.txt 2>/dev/null || true
```

6. Point `.env` at the file:

```dotenv
YTDLP_COOKIES=/absolute/path/to/runtime/auth/youtube.cookies.txt
```

Use a real absolute path. Do not use `~` in `.env`.

7. Retry the command and run:

```bash
bun as setup --doctor
```

8. Quick sanity check:

```bash
head -n 1 /absolute/path/to/runtime/auth/youtube.cookies.txt
```

Expected:

```text
# Netscape HTTP Cookie File
```

`# HTTP Cookie File` also works.

## If It Still Fails

- `cookies-file` shows as missing in doctor: fix or remove `YTDLP_COOKIES`. AutoShow will not fall back while that env var is set.
- Browser import still fails: try a more specific profile such as `chrome:Default`.
- Firefox or another browser still gets blocked: also set `YTDLP_USER_AGENT` to that browser's full user-agent string.
- Cookies still are not enough: use `YTDLP_EXTRACTOR_ARGS` for a PO token or client override.

## References

- yt-dlp FAQ: https://github.com/yt-dlp/yt-dlp/wiki/FAQ#how-do-i-pass-cookies-to-yt-dlp
- yt-dlp Extractors: https://github.com/yt-dlp/yt-dlp/wiki/Extractors#exporting-youtube-cookies
- yt-dlp PO Token Guide: https://github.com/yt-dlp/yt-dlp/wiki/PO-Token-Guide
- MDN `document.cookie`: https://developer.mozilla.org/en-US/docs/Web/API/Document/cookie
