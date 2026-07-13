# Build Prompt — LinkedIn Auto Poster

Paste everything below into an AI coding agent (Claude Code, Cursor, etc.) as a single prompt to recreate this tool from scratch.

---

Build a standalone **LinkedIn Auto Poster**: a tool that, on a daily schedule, generates one fresh LinkedIn post with Google Gemini, renders an on-brand PNG banner image, uploads the image to LinkedIn, and publishes the post — all with no database, no web server, no dashboard, and no web framework.

## Stack and constraints
- Node.js 20+, plain ES modules (`"type": "module"`), built-in `fetch` (no axios/node-fetch).
- Exactly **one** runtime dependency: `@napi-rs/canvas` (for banner rendering).
- Scheduling via **GitHub Actions** (cron) — no always-on server.
- Secrets via environment variables / GitHub Actions secrets. Never hardcode keys.
- All HTTP calls hand-written against the official Gemini and LinkedIn REST APIs.

## Files to create

### `package.json`
- `"private": true`, `"type": "module"`, `engines.node >= 20`.
- Scripts:
  - `setup` → `node scripts/setup.mjs`
  - `post` → `node --env-file-if-exists=.env scripts/generate-and-post.mjs`
  - `preview` → `node --env-file-if-exists=.env scripts/generate-and-post.mjs --dry-run`
  - `token` → `node --env-file-if-exists=.env scripts/get-linkedin-token.mjs`
- Dependency: `@napi-rs/canvas`.

### `.env.example`
Keys: `GEMINI_API_KEY`, `LINKEDIN_ACCESS_TOKEN`, `LINKEDIN_ORGANIZATION_ID` (blank unless posting as a Company Page), `GEMINI_MODEL=gemini-2.5-flash`, `POST_TOPICS`, `INCLUDE_BANNER=true`, `BANNER_BRAND=Your Name`, `DRY_RUN=false`, plus `LINKEDIN_CLIENT_ID` and `LINKEDIN_CLIENT_SECRET` for token minting.

### `topics.txt`
One topic per line. Blank lines and lines starting with `#` are ignored. Support optional steering context after `::` — the **full line** is sent to Gemini, but **only the text before `::`** is used as the banner headline. Example:
```
AI agents in everyday business workflows::make this practical for solo operators and small teams
```

### `scripts/lib/make-banner.mjs` — exports `makeBanner(topic, brand)`
- Render a 1200×627 PNG with `@napi-rs/canvas`; return a PNG `Buffer`.
- Register three Poppins fonts from `assets/fonts/` (Bold, SemiBold, Regular); throw a clear error if a font file is missing. Register only once (guard with a module-level flag).
- Background: diagonal linear gradient from `#1e3a8a` to `#4338ca`. Add two faint translucent white circles as decoration.
- Top-left: a small blue accent bar (`#60a5fa`) next to an `INSIGHTS` eyebrow label.
- Headline: auto-fit the topic headline by stepping font size from 76px down to 42px until it fits within `WIDTH - 180` across at most 3 lines. Word-wrap with measureText; if it still overflows, truncate the last line with an ellipsis.
- Bottom-left: the brand name in SemiBold with a small blue dot after it.

### `scripts/lib/linkedin-image.mjs` — exports `uploadImageToLinkedIn({ token, ownerUrn, imageBuffer })`
Two-step LinkedIn asset upload:
1. POST `https://api.linkedin.com/v2/assets?action=registerUpload` with header `X-Restli-Protocol-Version: 2.0.0` and body `registerUploadRequest` using recipe `urn:li:digitalmediaRecipe:feedshare-image`, the owner URN, and a service relationship of type `OWNER` / `urn:li:userGeneratedContent`. Parse out `uploadUrl` and `asset`.
2. PUT the raw image bytes to `uploadUrl` with `Content-Type: image/png`. If the PUT returns 400 or 405, retry as POST. Return the `asset` URN. Throw descriptive errors on failure.

### `scripts/lib/linkedin-oauth.mjs` — exports `mintToken({ clientId, clientSecret, organizationId, port = 8000 })`
Local 3-legged OAuth: spin up a `node:http` server on `127.0.0.1:8000` with redirect `http://localhost:8000/callback`. Generate a random `state` (crypto). Scope = `w_organization_social profile openid email` when an org ID is present, else `w_member_social profile openid email`. Open the browser to `https://www.linkedin.com/oauth/v2/authorization` (cross-platform `open`/`start`/`xdg-open`; fall back to printing the URL). On callback, validate `state`, then exchange the `code` at `https://www.linkedin.com/oauth/v2/accessToken` (form-encoded). Always close the server. Return the parsed token JSON.

### `scripts/get-linkedin-token.mjs`
Thin CLI wrapper: read `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` / `LINKEDIN_ORGANIZATION_ID` from env, call `mintToken`, and print the access token.

### `scripts/generate-and-post.mjs` — main entry point
1. Detect dry run from `--dry-run` flag or `DRY_RUN=true`.
2. Require `GEMINI_API_KEY`. Require `LINKEDIN_ACCESS_TOKEN` unless dry run.
3. Read topics from `POST_TOPICS` (comma-separated) if set, else from `topics.txt`. Pick one at random.
4. **Generate text:** pick a random "angle" from a fixed list (contrarian hot take, first-person story, surprising stat / "Did you know", scannable 3–5 item list, provocative question, practical mini-framework, "lesson learned the hard way", future prediction with reasoning). POST to `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key=...` with `generationConfig: { temperature: 1.1, topP: 0.95 }`. The prompt must: ask for an original LinkedIn post on the topic using the chosen angle, demand a strong first-line hook, varied non-templated structure, short paragraphs, ending with a question plus 3–5 hashtags, return ONLY the post text, and explicitly ban clichéd openers ("In today's rapidly evolving landscape", "In the world of", "Let's dive in", "Imagine a world"). Wrap the call in retry-with-backoff (delays 3s/6s/12s/24s) on HTTP 429/500/503.
5. **Resolve author:** if `LINKEDIN_ORGANIZATION_ID` is set, author = `urn:li:organization:{id}`. Otherwise GET `https://api.linkedin.com/v2/userinfo` with the bearer token, use `sub` → `urn:li:person:{sub}` and `name` as the default brand.
6. **Banner:** headline = text before `::`. Brand = `BANNER_BRAND` or the resolved profile/brand name. If `INCLUDE_BANNER !== 'false'`, render the banner. If banner generation/upload fails, log a warning and fall back to a text-only post (never crash the post).
7. **Dry run:** write `preview-banner.png`, print the generated post to stdout, and exit without publishing.
8. **Publish:** if there's a banner, upload it to get the asset URN. POST `https://api.linkedin.com/v2/ugcPosts` with `X-Restli-Protocol-Version: 2.0.0`, `lifecycleState: PUBLISHED`, `MemberNetworkVisibility: PUBLIC`, `ShareContent` with `shareCommentary.text`, and `shareMediaCategory` = `IMAGE` (with media `status: READY`, the asset URN, and the headline as title) or `NONE`. Log the returned `x-restli-id` post ID.
9. On any error, print the message and set a non-zero exit code.

### `scripts/setup.mjs` — interactive setup wizard
Prompt for the Gemini key and validate it (GET the Gemini models list). Ask whether to post as a Company Page (capture org ID if yes). Accept an existing LinkedIn token or mint one via `mintToken`. Validate the token via `/v2/userinfo`. Ask for a banner brand (default to the profile name). Collect topics interactively (blank line to finish; fall back to sensible defaults). Write `topics.txt` and `.env`. If inside a git repo and the `gh` CLI is authenticated, offer to push `GEMINI_API_KEY`, `LINKEDIN_ACCESS_TOKEN`, and (if set) `LINKEDIN_ORGANIZATION_ID` as GitHub Actions secrets via `gh secret set`.

### `.github/workflows/linkedin-auto-post.yml`
- Triggers: `schedule` cron `30 3 * * *` (09:00 IST) **and** `workflow_dispatch` with optional inputs: `topic` (override), `repeat_count` (manual-test count, default 1), `repeat_delay_seconds` (default 120).
- Concurrency group `linkedin-auto-post`, `cancel-in-progress: false`.
- Job on `ubuntu-latest`: checkout, setup Node 20 with npm cache, `npm ci --ignore-scripts --no-audit --no-fund`, then a loop that validates `repeat_count`/`repeat_delay_seconds` are non-negative integers and runs `node scripts/generate-and-post.mjs` that many times, sleeping `delay` seconds between runs.
- Env from secrets: `GEMINI_API_KEY`, `LINKEDIN_ACCESS_TOKEN`, `LINKEDIN_ORGANIZATION_ID`; from vars: `GEMINI_MODEL`; `POST_TOPICS` from the dispatch `topic` input; `INCLUDE_BANNER: "true"`; `BANNER_BRAND` set to the desired brand string.

### `assets/fonts/`
Include `Poppins-Bold.ttf`, `Poppins-SemiBold.ttf`, `Poppins-Regular.ttf`.

### `.gitignore`
Ignore `.env`, `node_modules`, and `preview-banner.png`.

### `README.md` and `AUTOPOST_SETUP.md`
Document the quick start (`npm install && npm run setup && npm run preview`), the required GitHub secrets, the `topics.txt` `::` convention, the four npm commands, the daily schedule, and the maintenance note that LinkedIn tokens expire (~60 days) and must be re-minted when publishing fails with an auth error.

## Acceptance criteria
- `npm install && npm run preview` produces `preview-banner.png` and prints a non-templated post without publishing.
- `npm run post` publishes a real post with an attached banner and logs the post ID.
- A banner failure degrades gracefully to a text-only post.
- The committed workflow runs the post on schedule and can be triggered manually with a topic override.
- No secrets are committed; all config flows through env vars / GitHub secrets.
