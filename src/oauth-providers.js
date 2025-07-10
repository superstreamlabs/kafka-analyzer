const { ClientCredentials } = require('simple-oauth2');
const axios = require('axios');

class OAuthProvider {
  constructor(config) {
    this.config = config;
  }

  async getToken() {
    throw new Error('getToken must be implemented by subclass');
  }
}

class AzureADOAuthProvider extends OAuthProvider {
  constructor(config) {
    super(config);
    
    // Azure AD specific configuration
    this.tenantId = config.tenantId;
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.scope = config.scope || '.default';
    
    // Build Azure AD URLs
    const baseUrl = `https://login.microsoftonline.com/${this.tenantId}`;
    
    this.oauth2Client = new ClientCredentials({
      client: {
        id: this.clientId,
        secret: this.clientSecret
      },
      auth: {
        tokenHost: baseUrl,
        tokenPath: '/oauth2/v2.0/token',
        authorizePath: '/oauth2/v2.0/authorize'
      }
    });
  }

  async getToken() {
    try {
      console.log('🔐 Requesting Azure AD OAuth token...');
      
      const tokenParams = {
        scope: this.scope
      };
      
      const accessToken = await this.oauth2Client.getToken(tokenParams);
      
      console.log('✅ Azure AD token obtained successfully');
      
      return {
        value: accessToken.token.access_token,
        expiresAt: accessToken.token.expires_at
      };
    } catch (error) {
      console.error('❌ Failed to get Azure AD token:', error.message);
      throw new Error(`Azure AD OAuth failed: ${error.message}`);
    }
  }
}

class GenericOAuthProvider extends OAuthProvider {
  constructor(config) {
    super(config);
    
    // Generic OAuth configuration
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.tokenHost = config.tokenHost || config.host;
    this.tokenPath = config.tokenPath || config.path;
    this.scope = config.scope;
    this.audience = config.audience;
    this.grantType = config.grantType || 'client_credentials';
    
    this.oauth2Client = new ClientCredentials({
      client: {
        id: this.clientId,
        secret: this.clientSecret
      },
      auth: {
        tokenHost: this.tokenHost,
        tokenPath: this.tokenPath
      }
    });
  }

  async getToken() {
    try {
      console.log(`🔐 Requesting OAuth token from ${this.tokenHost}...`);
      
      const tokenParams = {};
      
      if (this.scope) {
        tokenParams.scope = this.scope;
      }
      
      if (this.audience) {
        tokenParams.audience = this.audience;
      }
      
      const accessToken = await this.oauth2Client.getToken(tokenParams);
      
      console.log('✅ OAuth token obtained successfully');
      
      return {
        value: accessToken.token.access_token,
        expiresAt: accessToken.token.expires_at
      };
    } catch (error) {
      console.error('❌ Failed to get OAuth token:', error.message);
      throw new Error(`OAuth authentication failed: ${error.message}`);
    }
  }
}

class KeycloakOAuthProvider extends OAuthProvider {
  constructor(config) {
    super(config);
    
    // Keycloak specific configuration
    this.realm = config.realm;
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.keycloakUrl = config.keycloakUrl;
    this.scope = config.scope || 'openid';
    
    const baseUrl = `${this.keycloakUrl}/realms/${this.realm}`;
    
    this.oauth2Client = new ClientCredentials({
      client: {
        id: this.clientId,
        secret: this.clientSecret
      },
      auth: {
        tokenHost: this.keycloakUrl,
        tokenPath: `/realms/${this.realm}/protocol/openid-connect/token`
      }
    });
  }

  async getToken() {
    try {
      console.log(`🔐 Requesting Keycloak OAuth token from realm ${this.realm}...`);
      
      const tokenParams = {
        scope: this.scope
      };
      
      const accessToken = await this.oauth2Client.getToken(tokenParams);
      
      console.log('✅ Keycloak token obtained successfully');
      
      return {
        value: accessToken.token.access_token,
        expiresAt: accessToken.token.expires_at
      };
    } catch (error) {
      console.error('❌ Failed to get Keycloak token:', error.message);
      throw new Error(`Keycloak OAuth failed: ${error.message}`);
    }
  }
}

class OktaOAuthProvider extends OAuthProvider {
  constructor(config) {
    super(config);
    
    // Okta specific configuration
    this.domain = config.domain;
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.scope = config.scope || 'openid';
    this.authorizationServerId = config.authorizationServerId || 'default';
    
    const baseUrl = `https://${this.domain}`;
    
    this.oauth2Client = new ClientCredentials({
      client: {
        id: this.clientId,
        secret: this.clientSecret
      },
      auth: {
        tokenHost: baseUrl,
        tokenPath: `/oauth2/${this.authorizationServerId}/v1/token`
      }
    });
  }

  async getToken() {
    try {
      console.log(`🔐 Requesting Okta OAuth token from ${this.domain}...`);
      
      const tokenParams = {
        scope: this.scope
      };
      
      const accessToken = await this.oauth2Client.getToken(tokenParams);
      
      console.log('✅ Okta token obtained successfully');
      
      return {
        value: accessToken.token.access_token,
        expiresAt: accessToken.token.expires_at
      };
    } catch (error) {
      console.error('❌ Failed to get Okta token:', error.message);
      throw new Error(`Okta OAuth failed: ${error.message}`);
    }
  }
}

// Factory function to create the appropriate OAuth provider
function createOAuthProvider(vendor, config) {
  switch (vendor) {
    case 'azure-ad':
      return new AzureADOAuthProvider(config);
    case 'keycloak':
      return new KeycloakOAuthProvider(config);
    case 'okta':
      return new OktaOAuthProvider(config);
    case 'generic':
    default:
      return new GenericOAuthProvider(config);
  }
}

module.exports = {
  OAuthProvider,
  AzureADOAuthProvider,
  GenericOAuthProvider,
  KeycloakOAuthProvider,
  OktaOAuthProvider,
  createOAuthProvider
};
