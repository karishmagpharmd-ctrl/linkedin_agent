import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { execSync } from 'node:child_process';
import { mintToken } from './lib/linkedin-oauth.mjs';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function downloadFont(filename, url) {
  const fontDir = path.resolve('assets/fonts');
  if (!fs.existsSync(fontDir)) {
    fs.mkdirSync(fontDir, { recursive: true });
  }
  const destPath = path.join(fontDir, filename);
  if (fs.existsSync(destPath)) {
    return;
  }
  console.log(`Downloading font: ${filename}...`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download font ${filename}: ${response.status} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  fs.writeFileSync(destPath, Buffer.from(arrayBuffer));
}

async function ensureFonts() {
  const fontUrls = {
    'Poppins-Bold.ttf': 'https://raw.githubusercontent.com/google/fonts/main/ofl/poppins/Poppins-Bold.ttf',
    'Poppins-SemiBold.ttf': 'https://raw.githubusercontent.com/google/fonts/main/ofl/poppins/Poppins-SemiBold.ttf',
    'Poppins-Regular.ttf': 'https://raw.githubusercontent.com/google/fonts/main/ofl/poppins/Poppins-Regular.ttf'
  };

  console.log('Verifying font files...');
  try {
    for (const [filename, url] of Object.entries(fontUrls)) {
      await downloadFont(filename, url);
    }
    console.log('✓ Font files verification complete.');
  } catch (err) {
    console.error(`Warning: Failed to auto-download Poppins fonts: ${err.message}`);
    console.error('Make sure to put Poppins-Regular.ttf, Poppins-SemiBold.ttf, and Poppins-Bold.ttf into the assets/fonts/ folder manually.');
  }
}

async function validateGeminiKey(key) {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
    if (res.ok) {
      return { valid: true };
    }
    return { valid: false, error: `${res.status} ${res.statusText}` };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

async function validateLinkedinToken(token) {
  try {
    const res = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (res.ok) {
      const data = await res.json();
      return { valid: true, name: data.name };
    }
    return { valid: false, error: `${res.status} ${res.statusText}` };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

function checkGitHubCli() {
  try {
    if (!fs.existsSync('.git')) return false;
    execSync('gh auth status', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  console.log('======================================================================');
  console.log('                 LINKEDIN AUTO POSTER SETUP WIZARD                   ');
  console.log('======================================================================\n');

  await ensureFonts();

  console.log('\n--- 1. GOOGLE GEMINI CONFIGURATION ---');
  let geminiKey = '';
  while (true) {
    geminiKey = await question('Enter your Google Gemini API Key: ');
    geminiKey = geminiKey.trim();
    if (!geminiKey) {
      console.log('Gemini API key cannot be empty.');
      continue;
    }
    console.log('Validating Gemini API key...');
    const result = await validateGeminiKey(geminiKey);
    if (result.valid) {
      console.log('✓ Gemini API Key validated successfully.');
      break;
    } else {
      console.log(`✗ Validation failed: ${result.error}`);
      const proceed = await question('Do you want to use this key anyway? (y/N): ');
      if (proceed.toLowerCase() === 'y') break;
    }
  }

  console.log('\n--- 2. LINKEDIN ACCOUNT SCOPE ---');
  const postAsOrg = await question('Will you be posting to a LinkedIn Company Page? (y/N): ');
  let orgId = '';
  if (postAsOrg.toLowerCase() === 'y') {
    while (true) {
      orgId = await question('Enter your LinkedIn Organization ID: ');
      orgId = orgId.trim();
      if (orgId) break;
      console.log('Organization ID cannot be empty.');
    }
  }

  console.log('\n--- 3. LINKEDIN OAUTH / TOKEN CREATION ---');
  console.log('To publish posts, we need a LinkedIn Access Token.');
  console.log('Options:');
  console.log('  [1] Enter an existing Access Token');
  console.log('  [2] Mint a new Access Token using Client ID & Client Secret');
  
  let linkedinToken = '';
  let clientId = '';
  let clientSecret = '';

  while (true) {
    const choice = await question('Select an option (1/2): ');
    if (choice === '1') {
      linkedinToken = await question('Enter your LinkedIn Access Token: ');
      linkedinToken = linkedinToken.trim();
      break;
    } else if (choice === '2') {
      clientId = await question('Enter LinkedIn Client ID: ');
      clientSecret = await question('Enter LinkedIn Client Secret: ');
      clientId = clientId.trim();
      clientSecret = clientSecret.trim();

      if (!clientId || !clientSecret) {
        console.log('Client ID and Client Secret cannot be empty. Try again.');
        continue;
      }

      console.log('Starting mintToken OAuth flow...');
      try {
        const tokenInfo = await mintToken({ clientId, clientSecret, organizationId: orgId });
        linkedinToken = tokenInfo.access_token;
        console.log('✓ Successfully minted LinkedIn Access Token.');
        break;
      } catch (err) {
        console.error(`✗ OAuth failed: ${err.message}`);
        console.log('Falling back to option selection.');
      }
    } else {
      console.log('Invalid selection.');
    }
  }

  // Validate LinkedIn token
  let resolvedName = 'Karishma';
  if (linkedinToken) {
    console.log('Validating LinkedIn Access Token...');
    const result = await validateLinkedinToken(linkedinToken);
    if (result.valid) {
      resolvedName = result.name;
      console.log(`✓ Access Token valid. Connected as: ${resolvedName}`);
    } else {
      console.log(`✗ LinkedIn token validation failed: ${result.error}`);
      console.log('We will still write it to config, but posting may fail.');
    }
  }

  console.log('\n--- 4. BANNER CONFIGURATION ---');
  const bannerBrandInput = await question(`Enter Banner Brand/Name [Default: ${resolvedName}]: `);
  const bannerBrand = bannerBrandInput.trim() || resolvedName;

  console.log('\n--- 5. TOPIC SELECTION ---');
  const editTopics = await question('Do you want to configure your topics.txt list now? (y/N): ');
  if (editTopics.toLowerCase() === 'y') {
    console.log('\nEnter topics one-by-one. Press Enter on an empty line to finish.');
    console.log('Format: Headline::Steering context (e.g. AI workflows::make it practical)');
    const customTopics = [];
    while (true) {
      const line = await question(`Topic #${customTopics.length + 1}: `);
      if (!line.trim()) break;
      customTopics.push(line.trim());
    }
    if (customTopics.length > 0) {
      fs.writeFileSync('topics.txt', customTopics.join('\n') + '\n');
      console.log('✓ Saved customized topics to topics.txt');
    }
  }

  // Write .env
  console.log('\nWriting config to .env...');
  const envContent = `GEMINI_API_KEY=${geminiKey}
GEMINI_MODEL=gemini-2.0-flash

# LinkedIn API Config
LINKEDIN_ACCESS_TOKEN=${linkedinToken}
LINKEDIN_ORGANIZATION_ID=${orgId}

# LinkedIn OAuth App Credentials
LINKEDIN_CLIENT_ID=${clientId}
LINKEDIN_CLIENT_SECRET=${clientSecret}

# Auto Poster Behavior
INCLUDE_BANNER=true
BANNER_BRAND=${bannerBrand}
DRY_RUN=false
`;
  fs.writeFileSync('.env', envContent);
  console.log('✓ Generated .env successfully.');

  // Push secrets to GitHub if possible
  if (checkGitHubCli()) {
    console.log('\n--- 6. GITHUB ACTIONS INTEGRATION ---');
    const pushSecrets = await question('GitHub Repository and CLI detected. Push tokens to GitHub Secrets? (y/N): ');
    if (pushSecrets.toLowerCase() === 'y') {
      try {
        console.log('Configuring GitHub Secrets...');
        execSync(`gh secret set GEMINI_API_KEY --body "${geminiKey}"`);
        execSync(`gh secret set LINKEDIN_ACCESS_TOKEN --body "${linkedinToken}"`);
        if (orgId) {
          execSync(`gh secret set LINKEDIN_ORGANIZATION_ID --body "${orgId}"`);
        }
        console.log('✓ All secrets successfully pushed to GitHub!');
      } catch (err) {
        console.error(`✗ Failed to push secrets: ${err.message}`);
      }
    }
  }

  console.log('\n======================================================================');
  console.log('SETUP WIZARD COMPLETED!');
  console.log('----------------------------------------------------------------------');
  console.log('Commands:');
  console.log('  npm run preview  - Preview post generation and banner output locally');
  console.log('  npm run post     - Publish a live post to LinkedIn');
  console.log('======================================================================\n');

  rl.close();
}

main().catch(err => {
  console.error(`Fatal setup error: ${err.message}`);
  rl.close();
  process.exit(1);
});
