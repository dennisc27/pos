/**
 * eBay OAuth 2.0 Authentication Service
 * Handles OAuth flow, token management, and token refresh for eBay API
 */

export class eBayAuth {
  /**
   * @param {Object} config - Configuration object
   * @param {string} config.clientId - eBay App ID (Client ID)
   * @param {string} config.clientSecret - eBay Client Secret
   * @param {string} config.redirectUri - OAuth redirect URI
   * @param {boolean} [config.sandbox=false] - Use sandbox environment
   */
  constructor(config) {
    if (!config.clientId || !config.clientSecret) {
      throw new Error('eBay auth requires clientId and clientSecret');
    }

    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.redirectUri = config.redirectUri;
    this.sandbox = config.sandbox || false;
    this.baseUrl = this.sandbox
      ? 'https://api.sandbox.ebay.com'
      : 'https://api.ebay.com';
    this.authBaseUrl = this.sandbox
      ? 'https://auth.sandbox.ebay.com'
      : 'https://auth.ebay.com';
  }

  /**
   * Generate OAuth authorization URL
   * @param {string[]} [scopes=['https://api.ebay.com/oauth/api_scope/sell.inventory']] - OAuth scopes
   * @returns {string} Authorization URL
   */
  getAuthorizationUrl(scopes = ['https://api.ebay.com/oauth/api_scope/sell.inventory']) {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
    });
    return `${this.authBaseUrl}/oauth2/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   * @param {string} authorizationCode - Authorization code from OAuth callback
   * @returns {Promise<{accessToken: string, refreshToken: string, expiresAt: Date}>}
   * @throws {Error} If token exchange fails
   */
  async exchangeCodeForToken(authorizationCode) {
    if (!authorizationCode) {
      throw new Error('Authorization code is required');
    }

    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

    try {
      const response = await fetch(`${this.baseUrl}/identity/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${credentials}`,
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: authorizationCode,
          redirect_uri: this.redirectUri,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error_description 
          || errorData.error 
          || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
      }

      const data = await response.json();

      if (!data.access_token) {
        throw new Error('Invalid token response from eBay');
      }

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: new Date(Date.now() + (data.expires_in * 1000)),
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to exchange authorization code: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Refresh access token using refresh token
   * @param {string} refreshToken - Refresh token
   * @returns {Promise<{accessToken: string, expiresAt: Date}>}
   * @throws {Error} If token refresh fails
   */
  async refreshAccessToken(refreshToken) {
    if (!refreshToken) {
      throw new Error('Refresh token is required');
    }

    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

    try {
      const response = await fetch(`${this.baseUrl}/identity/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${credentials}`,
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error_description 
          || errorData.error 
          || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
      }

      const data = await response.json();

      if (!data.access_token) {
        throw new Error('Invalid token response from eBay');
      }

      return {
        accessToken: data.access_token,
        expiresAt: new Date(Date.now() + (data.expires_in * 1000)),
        // Note: eBay may return a new refresh_token, but it's optional
        refreshToken: data.refresh_token || refreshToken,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to refresh access token: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Get valid access token (refresh if needed)
   * @param {string} storedToken - Currently stored access token
   * @param {string} storedRefreshToken - Currently stored refresh token
   * @param {Date|string} expiresAt - Token expiration date
   * @returns {Promise<string>} Valid access token
   * @throws {Error} If token refresh fails
   */
  async getValidToken(storedToken, storedRefreshToken, expiresAt) {
    if (!storedToken || !storedRefreshToken) {
      throw new Error('Stored token and refresh token are required');
    }

    const expirationDate = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
    const bufferTime = 60000; // 1 minute buffer

    // Check if token is still valid (with 1 minute buffer)
    if (expirationDate > new Date(Date.now() + bufferTime)) {
      return storedToken;
    }

    // Token expired or expiring soon, refresh it
    const refreshed = await this.refreshAccessToken(storedRefreshToken);
    return refreshed.accessToken;
  }

  /**
   * Validate token expiration
   * @param {Date|string} expiresAt - Token expiration date
   * @returns {boolean} True if token is valid, false if expired
   */
  isTokenValid(expiresAt) {
    if (!expiresAt) {
      return false;
    }

    const expirationDate = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
    const bufferTime = 60000; // 1 minute buffer
    return expirationDate > new Date(Date.now() + bufferTime);
  }
}

export default eBayAuth;

