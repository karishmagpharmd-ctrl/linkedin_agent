# LinkedIn Auto Poster

A lightweight, standalone, schedule-driven LinkedIn Auto Poster. On a daily schedule, this tool picks a random topic from a list, generates an on-brand post using Google Gemini (adopting a custom calibrated voice), renders a high-quality PNG banner image, and publishes them to LinkedIn.

No database, no web server, no dashboard, and no complex framework.

## Niche Integration: Karishma Persona
The text generation is pre-configured to reflect the exact style guidelines of the **Karishma** brand persona:
*   **Warm-First, Truth-Second**: Authentic connection and hopeful realism.
*   **Structural Layout**: Short paragraphs and short single-sentence lines.
*   **Clean Design**: Absolutely no emojis and no stacked hashtags on LinkedIn.
*   **Logical Connectives**: Uses pay-off connectors like "That's exactly why" and opens pain-first.

---

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Run Interactive Setup
This will download the required Poppins fonts, check your API credentials, guide you through minting a LinkedIn access token, and generate your `.env` file.
```bash
npm run setup
```

### 3. Generate a local dry run preview
This generates a fresh post and writes a `preview-banner.png` image file to the project root without publishing anything to LinkedIn.
```bash
npm run preview
```

### 4. Publish manually
Publishes a live post with its generated banner to your LinkedIn feed.
```bash
npm run post
```

---

## Configuration & Commands

### NPM Scripts
*   `npm run setup`: Starts the interactive configuration wizard.
*   `npm run preview`: Generates a post preview and banner mockup (`preview-banner.png`) locally.
*   `npm run post`: Generates and publishes a post to LinkedIn.
*   `npm run token`: Mints a fresh LinkedIn Access Token using local OAuth.

### Topic List (`topics.txt`)
Modify `topics.txt` to add or remove posting topics.
*   Write one topic per line.
*   Lines starting with `#` and empty lines are ignored.
*   Support optional steering context after the `::` separator.
*   *Note*: The full line is sent to Gemini for post generation, but only the text **before** `::` will be rendered as the headline on the image banner.

Example:
```text
The illusion of patient brand loyalty in Gen Z::how dermatologists lose patients if they rely on past reputation instead of modern visibility
```

---

## GitHub Actions & Scheduling

This tool is configured to run automatically using GitHub Actions. It is scheduled to publish a post daily at **09:00 IST (03:30 UTC)**.

For full configuration steps on setting up GitHub Secrets and Client credentials, refer to the [Setup Guide](AUTOPOST_SETUP.md).

## Token Maintenance Warning

> [!WARNING]
> **LinkedIn Access Tokens are valid for 60 days.** 
> When automated runs start failing with authentication errors, you must re-mint a token using `npm run token` (or `npm run setup`) and update your `.env` file and GitHub Action secrets.
