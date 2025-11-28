/**
 * Shopify Admin API Authentication Service
 * Handles Admin API access token authentication for Shopify
 */

export class ShopifyAuth {
  /**
   * @param {Object} config - Configuration object
   * @param {string} config.shopName - Shopify shop name (e.g., 'mystore' without .myshopify.com)
   * @param {string} config.accessToken - Admin API Access Token
   * @param {string} [config.apiVersion='2024-01'] - Shopify API version
   */
  constructor(config) {
    if (!config.shopName || !config.accessToken) {
      throw new Error('Shopify auth requires shopName and accessToken');
    }

    this.shopName = config.shopName.replace('.myshopify.com', ''); // Remove domain if provided
    this.accessToken = config.accessToken;
    this.apiVersion = config.apiVersion || '2024-01';
  }

  /**
   * Get base URL for Shopify Admin API
   * @returns {string} Base URL
   */
  getBaseUrl() {
    return `https://${this.shopName}.myshopify.com/admin/api/${this.apiVersion}`;
  }

  /**
   * Get GraphQL endpoint URL
   * @returns {string} GraphQL endpoint URL
   */
  getGraphQLUrl() {
    return `https://${this.shopName}.myshopify.com/admin/api/${this.apiVersion}/graphql.json`;
  }

  /**
   * Get request headers with authentication
   * @returns {Object} Headers object
   */
  getHeaders() {
    return {
      'X-Shopify-Access-Token': this.accessToken,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Validate shop name format
   * @param {string} shopName - Shop name to validate
   * @returns {boolean} True if valid format
   */
  static isValidShopName(shopName) {
    if (!shopName || typeof shopName !== 'string') {
      return false;
    }

    // Shopify shop names: lowercase alphanumeric and hyphens, 3-63 chars
    const shopNamePattern = /^[a-z0-9-]{3,63}$/;
    return shopNamePattern.test(shopName.replace('.myshopify.com', ''));
  }

  /**
   * Validate access token format (basic check)
   * @param {string} accessToken - Access token to validate
   * @returns {boolean} True if valid format
   */
  static isValidAccessToken(accessToken) {
    if (!accessToken || typeof accessToken !== 'string') {
      return false;
    }

    // Shopify access tokens are typically 32+ character strings
    return accessToken.length >= 32;
  }

  /**
   * Validate configuration
   * @returns {Object} Validation result with isValid and errors
   */
  validate() {
    const errors = [];

    if (!ShopifyAuth.isValidShopName(this.shopName)) {
      errors.push('Invalid shop name format');
    }

    if (!ShopifyAuth.isValidAccessToken(this.accessToken)) {
      errors.push('Invalid access token format');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

export default ShopifyAuth;

