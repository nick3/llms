
import { request } from 'undici';

const GITHUB_COPILOT_CLIENT_ID = 'Iv1.b507a08c87ecfe98';
const GITHUB_DEVICE_CODE_URL = 'https://github.com/login/device/code';
const GITHUB_ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token';

interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

interface AccessTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

async function getDeviceCode(): Promise<DeviceCodeResponse> {
  const { body } = await request(GITHUB_DEVICE_CODE_URL, {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ client_id: GITHUB_COPILOT_CLIENT_ID }),
  });

  const response = await body.json() as DeviceCodeResponse;
  return response;
}

async function pollForAccessToken(deviceCode: string, initialInterval: number, signal?: AbortSignal) {
  // Start with 5 second polling interval (GitHub recommended minimum)
  let pollInterval = Math.max(5, initialInterval);
  let backoffMultiplier = 1.0;
  const maxBackoff = 60; // Maximum 60 seconds between polls
  const maxRetries = 3; // Maximum consecutive network errors before giving up
  let consecutiveErrors = 0;

  while (true) {
    // Check if operation was cancelled
    if (signal?.aborted) {
      console.log('Polling cancelled by user');
      return null;
    }

    // Wait before polling (except for first iteration)
    if (backoffMultiplier > 1.0) {
      const waitTime = Math.min(pollInterval * backoffMultiplier, maxBackoff) * 1000;
      console.log(`Waiting ${waitTime / 1000} seconds before next poll...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    } else if (pollInterval > initialInterval) {
      await new Promise(resolve => setTimeout(resolve, pollInterval * 1000));
    } else {
      await new Promise(resolve => setTimeout(resolve, pollInterval * 1000));
    }

    try {
      const { body } = await request(GITHUB_ACCESS_TOKEN_URL, {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'content-type': 'application/json',
          'user-agent': 'github-copilot-auth/1.0'
        },
        body: JSON.stringify({
          client_id: GITHUB_COPILOT_CLIENT_ID,
          device_code: deviceCode,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        }),
        signal, // Pass abort signal to request
      });

      const response = await body.json() as AccessTokenResponse;
      
      // Reset consecutive error count on successful request
      consecutiveErrors = 0;

      if (response.error) {
        switch (response.error) {
          case 'authorization_pending':
            // User hasn't completed authorization yet, continue polling
            console.log('Waiting for user authorization...');
            break;
            
          case 'slow_down':
            // GitHub wants us to slow down polling - implement exponential backoff
            backoffMultiplier = Math.min(backoffMultiplier * 2.0, maxBackoff / pollInterval);
            console.log(`Rate limited. Slowing down polling (backoff multiplier: ${backoffMultiplier.toFixed(1)})`);
            break;
            
          case 'expired_token':
            console.error('Device code has expired. Please restart the authorization process.');
            return null;
            
          case 'access_denied':
            console.error('User denied authorization.');
            return null;
            
          case 'incorrect_client_credentials':
            console.error('Invalid client credentials.');
            return null;
            
          default:
            console.error(`Authorization error: ${response.error_description || response.error}`);
            return null;
        }
      } else if (response.access_token) {
        // Success! We got the access token
        return response.access_token;
      } else {
        console.error('Invalid response: missing access token');
        return null;
      }
      
    } catch (error) {
      consecutiveErrors++;
      console.error(`Network error during polling (attempt ${consecutiveErrors}/${maxRetries}):`, error);
      
      // If we hit max consecutive errors, give up
      if (consecutiveErrors >= maxRetries) {
        console.error('Maximum consecutive errors reached. Giving up.');
        return null;
      }
      
      // Apply exponential backoff for network errors too
      backoffMultiplier = Math.min(backoffMultiplier * 1.5, maxBackoff / pollInterval);
    }
  }
}

async function main() {
  try {
    const { device_code, user_code, verification_uri, interval, expires_in } = await getDeviceCode();

    console.log(`Your GitHub Copilot user code: ${user_code}`);
    console.log(`Please open this URL in your browser: ${verification_uri}`);
    
    // Automatically open the URL
    try {
        // Dynamically import open module
        const { execSync } = await import('child_process');
        const os = await import('os');
        
        // Use platform-specific command to open URL
        const platform = os.platform();
        if (platform === 'darwin') {
            execSync(`open "${verification_uri}"`);
        } else if (platform === 'win32') {
            execSync(`start "" "${verification_uri}"`);
        } else {
            execSync(`xdg-open "${verification_uri}"`);
        }
    } catch (e) {
        console.log('Could not automatically open browser. Please open the URL manually.')
    }


    console.log(`The code will expire in ${expires_in / 60} minutes.`);
    console.log('Waiting for you to authorize in the browser...');
    console.log('Press Ctrl+C to cancel...');

    // Create AbortController for cancellation support
    const abortController = new AbortController();
    
    // Handle Ctrl+C gracefully
    process.on('SIGINT', () => {
      console.log('\nCancelling authorization...');
      abortController.abort();
      process.exit(0);
    });

    const accessToken = await pollForAccessToken(device_code, interval, abortController.signal);

    if (accessToken) {
      console.log('\nSuccessfully authorized!');
      console.log('Your GitHub Copilot access token is:');
      console.log(accessToken);
      console.log('\nPlease add this to your config.json or .env file as GITHUB_COPILOT_ACCESS_TOKEN.');
    } else {
      console.log('\nAuthorization failed.');
    }
  } catch (error) {
    console.error('An error occurred during the authorization process:', error);
  }
}

main();
