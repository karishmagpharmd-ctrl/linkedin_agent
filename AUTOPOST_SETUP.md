# LinkedIn Developer & Auto Poster Setup Guide

This guide walks you through setting up a LinkedIn Developer Application to get your Client ID and Client Secret, minting tokens, and configuring the automated daily GitHub Actions workflow.

---

## Part 1: Registering a LinkedIn Developer App

To use the automated posting and token minting commands, you must register an application on the LinkedIn Developer Portal.

1.  Go to the [LinkedIn Developer Portal](https://developer.linkedin.com/) and sign in.
2.  Click **Create app**.
3.  Fill out the required information:
    *   **App name**: e.g., `LinkedIn Auto Poster`
    *   **LinkedIn Page**: Associate it with your personal company page or business profile.
    *   **App logo**: Upload any square image.
4.  Once created, navigate to the **Auth** tab:
    *   Find your **Client ID** and **Client Secret**. Copy these into your `.env` file as `LINKEDIN_CLIENT_ID` and `LINKEDIN_CLIENT_SECRET`.
    *   Under **OAuth 2.0 settings**, add the following Redirect URL:
        `http://localhost:8000/callback`
5.  Navigate to the **Products** tab and request access to the following products:
    *   **Share on LinkedIn** (provides member social posting permission `w_member_social`).
    *   **Sign In with LinkedIn using OpenID Connect** (provides profile info permissions).
    *   *(Optional)* **Community Management API** (if posting as a Company Page, which requires `w_organization_social`).
6.  Wait for LinkedIn to approve access (usually instant for member shares).

---

## Part 2: Minting Your First Access Token

1.  Make sure `LINKEDIN_CLIENT_ID` and `LINKEDIN_CLIENT_SECRET` are defined in your `.env`.
2.  Run the token command:
    ```bash
    npm run token
    ```
3.  The console will output an authorization URL and try to open it in your browser.
4.  Log in to LinkedIn, approve permissions, and the browser will display "Authorization Successful!".
5.  Return to your terminal, copy the printed access token, and set it in your `.env` as `LINKEDIN_ACCESS_TOKEN`.

---

## Part 3: Deploying to GitHub Actions

To run this tool automatically on a daily schedule, push it to a private GitHub repository and set up environment secrets.

### Required Secrets
Go to your GitHub Repository -> **Settings** -> **Secrets and variables** -> **Actions** and add these repository secrets:

1.  `GEMINI_API_KEY`: Your Google Gemini API Key.
2.  `LINKEDIN_ACCESS_TOKEN`: The 60-day token generated during Part 2.
3.  `LINKEDIN_ORGANIZATION_ID`: *(Optional)* Your company page ID if posting as an organization.

### Optional Variables
Go to **Settings** -> **Secrets and variables** -> **Actions** -> **Variables** tab to add these repository variables:

1.  `GEMINI_MODEL`: Defaults to `gemini-2.5-flash` if not set.
2.  `BANNER_BRAND`: The name printed at the bottom-left of the banner image.

---

## Part 4: Manual Triggers
You can manually run the workflow from the **Actions** tab on GitHub:
1.  Go to the **Actions** page of your repository.
2.  Select **LinkedIn Auto Poster**.
3.  Click **Run workflow**.
4.  You can optionally override the topic with custom text or custom steering instruction:
    *   Example: `Why SEO ranks higher than Reels::make this clinical and data-driven`
5.  You can also trigger multiple test posts sequentially by setting `repeat_count`.
