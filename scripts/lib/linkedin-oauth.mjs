import http from 'node:http';
import crypto from 'node:crypto';
import { exec } from 'node:child_process';
import os from 'node:os';

export function mintToken({ clientId, clientSecret, organizationId, port = 8000 }) {
  return new Promise((resolve, reject) => {
    const state = crypto.randomBytes(16).toString('hex');
    const redirectUri = `http://localhost:${port}/callback`;
    const scope = organizationId
      ? 'w_organization_social profile openid email'
      : 'w_member_social profile openid email';

    const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=${encodeURIComponent(scope)}`;

    const server = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url, `http://${req.headers.host}`);
        if (url.pathname === '/callback') {
          const code = url.searchParams.get('code');
          const returnedState = url.searchParams.get('state');
          const error = url.searchParams.get('error');
          const errorDescription = url.searchParams.get('error_description');

          if (error) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end(`<h1>Authentication Failed</h1><p>${errorDescription || error}</p>`);
            server.close();
            reject(new Error(`OAuth Error: ${errorDescription || error}`));
            return;
          }

          if (returnedState !== state) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end('<h1>CSRF Verification Failed</h1><p>State parameter mismatch.</p>');
            server.close();
            reject(new Error('State mismatch (possible CSRF attack)'));
            return;
          }

          if (!code) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end('<h1>Authorization Code Missing</h1>');
            server.close();
            reject(new Error('No authorization code was returned by LinkedIn.'));
            return;
          }

          // Exchange auth code for access token
          const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
              grant_type: 'authorization_code',
              code,
              redirect_uri: redirectUri,
              client_id: clientId,
              client_secret: clientSecret
            })
          });

          if (!tokenRes.ok) {
            const errText = await tokenRes.text();
            res.writeHead(500, { 'Content-Type': 'text/html' });
            res.end('<h1>Token Exchange Failed</h1>');
            server.close();
            reject(new Error(`Failed to exchange code for access token: ${tokenRes.status} ${tokenRes.statusText} - ${errText}`));
            return;
          }

          const tokenData = await tokenRes.json();
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<h1>Authorization Successful!</h1><p>You can close this tab and return to the console.</p>');
          server.close();
          resolve(tokenData);
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found');
        }
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`Internal Server Error: ${err.message}`);
        server.close();
        reject(err);
      }
    });

    server.listen(port, '127.0.0.1', () => {
      console.log(`Local OAuth callback server listening at http://127.0.0.1:${port}`);
      console.log(`Attempting to open the browser for authorization...`);
      openBrowser(authUrl);
    });

    server.on('error', (err) => {
      reject(err);
    });
  });
}

function openBrowser(url) {
  const platform = os.platform();
  let cmd;
  if (platform === 'win32') {
    cmd = `start "" "${url.replace(/&/g, '^&')}"`;
  } else if (platform === 'darwin') {
    cmd = `open "${url}"`;
  } else {
    cmd = `xdg-open "${url}"`;
  }
  exec(cmd, (err) => {
    if (err) {
      console.log(`\n======================================================================`);
      console.log(`ACTION REQUIRED: Please open the following URL in your browser:`);
      console.log(url);
      console.log(`======================================================================\n`);
    }
  });
}
