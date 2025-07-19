
import { Transformer, TransformerRequest } from '@/types/transformer';
import { request } from 'undici';

const GITHUB_COPILOT_TOKEN_URL = 'https://api.github.com/copilot_internal/v2/token';
const GITHUB_COPILOT_CHAT_URL = 'https://api.githubcopilot.com/chat/completions';

export class GithubCopilotTransformer implements Transformer {
  name = 'GithubCopilot';
  endPoint = GITHUB_COPILOT_CHAT_URL;

  private temporaryToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(private accessToken: string) {}

  private async getTemporaryToken(): Promise<string> {
    if (this.temporaryToken && this.tokenExpiresAt > Date.now()) {
      return this.temporaryToken;
    }

    const { body } = await request(GITHUB_COPILOT_TOKEN_URL, {
      method: 'GET',
      headers: {
        'authorization': `token ${this.accessToken}`,
        'user-agent': 'GithubCopilot/1.155.0',
      },
    });

    const { token, expires_at } = await body.json();
    this.temporaryToken = token;
    this.tokenExpiresAt = expires_at * 1000;

    return this.temporaryToken;
  }

  async transform(req: TransformerRequest): Promise<any> {
    const temporaryToken = await this.getTemporaryToken();
    req.headers['authorization'] = `Bearer ${temporaryToken}`;
    return req;
  }
}
