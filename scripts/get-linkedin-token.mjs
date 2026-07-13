import { mintToken } from './lib/linkedin-oauth.mjs';

async function main() {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  const organizationId = process.env.LINKEDIN_ORGANIZATION_ID;

  if (!clientId || !clientSecret) {
    console.error('Error: Both LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET environment variables must be defined.');
    console.error('Please specify them in your .env file.');
    process.exit(1);
  }

  try {
    console.log('Starting LinkedIn OAuth token minting flow...');
    const tokenInfo = await mintToken({ clientId, clientSecret, organizationId });
    
    console.log('\n======================================================================');
    console.log('TOKEN MINTING SUCCESSFUL!');
    console.log('======================================================================');
    console.log(`Access Token: ${tokenInfo.access_token}`);
    console.log(`Expires In:   ${tokenInfo.expires_in} seconds (~${Math.round(tokenInfo.expires_in / 86400)} days)`);
    if (tokenInfo.refresh_token) {
      console.log(`Refresh Token: ${tokenInfo.refresh_token}`);
    }
    console.log('======================================================================');
    console.log('Please copy the Access Token above and paste it into your .env file.');
  } catch (err) {
    console.error('\nFailed to mint token:', err.message);
    process.exit(1);
  }
}

main();
