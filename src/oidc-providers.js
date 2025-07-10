const { ClientCredentials, AuthorizationCode, ResourceOwnerPassword } = require('simple-oauth2');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

class OIDCProvider {
  constructor(config) {
    this.config = config;
    this.discoveryDocument = null;
    this.jwksClient = null;
    this.tokenCache = null;
    this.tokenExpiry = null;
  }

  async initialize() {
    if (this.config.discoveryUrl) {
      await this.loadDiscoveryDocument();
    }
  }

  async loadDiscoveryDocument() {
    try {
      console.log(`🔍 Loading OIDC discovery document from ${this.config.discoveryUrl}...`);
      const response = await axios.get(this.config.discoveryUrl);
      this.discoveryDocument = response.data;
      
      // Set up JWKS client if available
      if (this.discoveryDocument.jwks_uri) {
        this.jwksClient = jwksClient({
          jwksUri: this.discoveryDocument.jwks_uri,
          cache: true,
          cacheMaxEntries: 5,
          cacheMaxAge: 600000 // 10 minutes
        });
      }
      
      console.log('✅ OIDC discovery document loaded successfully');
    } catch (error) {
      console.error('❌ Failed to load OIDC discovery document:', error.message);
      throw new Error(`OIDC discovery failed: ${error.message}`);
    }
  }

  async getToken() {
    // Check token cache
    if (this.tokenCache && this.tokenExpiry && new Date() < this.tokenExpiry) {
      console.log('✅ Using cached token');
      return {
        value: this.tokenCache,
        expiresAt: this.tokenExpiry
      };
    }

    // Get new token
    const token = await this.requestToken();
    
    // Cache the token
    this.tokenCache = token.value;
    this.tokenExpiry = token.expiresAt;
    
    return token;
  }

  async requestToken() {
    throw new Error('requestToken must be implemented by subclass');
  }

  async validateToken(token) {
    if (!this.jwksClient) {
      console.warn('⚠️ No JWKS client available for token validation');
      return true;
    }

    try {
      const decoded = jwt.decode(token, { complete: true });
      const kid = decoded.header.kid;
      
      const key = await this.jwksClient.getSigningKey(kid);
      const signingKey = key.getPublicKey();
      
      jwt.verify(token, signingKey, {
        algorithms: ['RS256'],
        audience: this.config.audience,
        issuer: this.discoveryDocument.issuer
      });
      
      console.log('✅ Token validation successful');
      return true;
    } catch (error) {
      console.error('❌ Token validation failed:', error.message);
      return false;
    }
  }
}

class GenericOIDCProvider extends OIDCProvider {
  constructor(config) {
    super(config);
    
    // Build OAuth2 client configuration
    const oauth2Config = {
      client: {
        id: this.config.clientId,
        secret: this.config.clientSecret
      }
    };

    // Use discovery document if available
    if (this.config.discoveryUrl) {
      // Will be populated after initialization
      this.oauth2ClientConfig = oauth2Config;
    } else {
      // Manual configuration
      oauth2Config.auth = {
        tokenHost: this.config.tokenHost || this.config.issuer,
        tokenPath: this.config.tokenPath || '/token',
        authorizePath: this.config.authorizePath || '/authorize'
      };
      
      if (this.config.revokePath) {
        oauth2Config.auth.revokePath = this.config.revokePath;
      }
      
      this.setupOAuth2Client(oauth2Config);
    }
  }

  async initialize() {
    await super.initialize();
    
    if (this.discoveryDocument) {
      // Update OAuth2 client with discovery endpoints
      const oauth2Config = {
        ...this.oauth2ClientConfig,
        auth: {
          tokenHost: this.discoveryDocument.issuer,
          tokenPath: new URL(this.discoveryDocument.token_endpoint).pathname,
          authorizePath: new URL(this.discoveryDocument.authorization_endpoint).pathname
        }
      };
      
      if (this.discoveryDocument.revocation_endpoint) {
        oauth2Config.auth.revokePath = new URL(this.discoveryDocument.revocation_endpoint).pathname;
      }
      
      this.setupOAuth2Client(oauth2Config);
    }
  }

  setupOAuth2Client(config) {
    // Set up appropriate OAuth2 client based on grant type
    const grantType = this.config.grantType || 'client_credentials';
    
    switch (grantType) {
      case 'client_credentials':
        this.oauth2Client = new ClientCredentials(config);
        break;
      case 'authorization_code':
        this.oauth2Client = new AuthorizationCode(config);
        break;
      case 'password':
        this.oauth2Client = new ResourceOwnerPassword(config);
        break;
      default:
        this.oauth2Client = new ClientCredentials(config);
    }
  }

  async requestToken() {
    try {
      console.log(`🔐 Requesting OIDC token using ${this.config.grantType || 'client_credentials'} grant...`);
      
      const tokenParams = {};
      
      // Add scope if specified
      if (this.config.scope) {
        tokenParams.scope = this.config.scope;
      }
      
      // Add audience if specified (common in OIDC)
      if (this.config.audience) {
        tokenParams.audience = this.config.audience;
      }
      
      // Add resource if specified (Azure AD specific)
      if (this.config.resource) {
        tokenParams.resource = this.config.resource;
      }
      
      // Add custom parameters
      if (this.config.customParams) {
        Object.assign(tokenParams, this.config.customParams);
      }
      
      // Handle different grant types
      let accessToken;
      const grantType = this.config.grantType || 'client_credentials';
      
      switch (grantType) {
        case 'client_credentials':
          accessToken = await this.oauth2Client.getToken(tokenParams);
          break;
          
        case 'password':
          tokenParams.username = this.config.username;
          tokenParams.password = this.config.password;
          accessToken = await this.oauth2Client.getToken(tokenParams);
          break;
          
        case 'authorization_code':
          // This requires additional setup for authorization flow
          throw new Error('Authorization code flow not fully implemented for Kafka use case');
          
        default:
          accessToken = await this.oauth2Client.getToken(tokenParams);
      }
      
      console.log('✅ OIDC token obtained successfully');
      
      // Optionally validate the token
      if (this.config.validateToken) {
        await this.validateToken(accessToken.token.access_token);
      }
      
      return {
        value: accessToken.token.access_token,
        expiresAt: accessToken.token.expires_at || new Date(Date.now() + 3600000) // Default 1 hour
      };
    } catch (error) {
      console.error('❌ Failed to get OIDC token:', error.message);
      throw new Error(`OIDC authentication failed: ${error.message}`);
    }
  }
}

// Specialized providers that extend the generic OIDC provider
class AzureADProvider extends GenericOIDCProvider {
  constructor(config) {
    // Set Azure AD specific defaults
    const azureConfig = {
      ...config,
      discoveryUrl: config.discoveryUrl || 
        `https://login.microsoftonline.com/${config.tenantId}/v2.0/.well-known/openid-configuration`,
      scope: config.scope || `${config.clientId}/.default`,
      grantType: config.grantType || 'client_credentials'
    };
    
    super(azureConfig);
  }
}

class KeycloakProvider extends GenericOIDCProvider {
  constructor(config) {
    // Set Keycloak specific defaults
    const keycloakConfig = {
      ...config,
      discoveryUrl: config.discoveryUrl || 
        `${config.keycloakUrl}/realms/${config.realm}/.well-known/openid-configuration`,
      scope: config.scope || 'openid',
      grantType: config.grantType || 'client_credentials'
    };
    
    super(keycloakConfig);
  }
}

class OktaProvider extends GenericOIDCProvider {
  constructor(config) {
    // Set Okta specific defaults
    const oktaConfig = {
      ...config,
      discoveryUrl: config.discoveryUrl || 
        `https://${config.domain}/oauth2/${config.authorizationServerId || 'default'}/.well-known/openid-configuration`,
      scope: config.scope || 'openid',
      grantType: config.grantType || 'client_credentials'
    };
    
    super(oktaConfig);
  }
}

class Auth0Provider extends GenericOIDCProvider {
  constructor(config) {
    // Set Auth0 specific defaults
    const auth0Config = {
      ...config,
      discoveryUrl: config.discoveryUrl || 
        `https://${config.domain}/.well-known/openid-configuration`,
      scope: config.scope || 'openid profile',
      audience: config.audience || `https://${config.domain}/api/v2/`,
      grantType: config.grantType || 'client_credentials'
    };
    
    super(auth0Config);
  }
}

class GoogleProvider extends GenericOIDCProvider {
  constructor(config) {
    // Set Google specific defaults
    const googleConfig = {
      ...config,
      discoveryUrl: config.discoveryUrl || 
        'https://accounts.google.com/.well-known/openid-configuration',
      scope: config.scope || 'openid email profile',
      grantType: config.grantType || 'authorization_code'
    };
    
    super(googleConfig);
  }
}

// Factory function to create the appropriate OIDC provider
async function createOIDCProvider(vendor, config) {
  let provider;
  
  switch (vendor) {
    case 'azure-ad':
    case 'azure':
      provider = new AzureADProvider(config);
      break;
    case 'keycloak':
      provider = new KeycloakProvider(config);
      break;
    case 'okta':
      provider = new OktaProvider(config);
      break;
    case 'auth0':
      provider = new Auth0Provider(config);
      break;
    case 'google':
      provider = new GoogleProvider(config);
      break;
    case 'generic':
    case 'oidc':
    default:
      provider = new GenericOIDCProvider(config);
  }
  
  // Initialize the provider (load discovery document, etc.)
  await provider.initialize();
  
  return provider;
}

module.exports = {
  OIDCProvider,
  GenericOIDCProvider,
  AzureADProvider,
  KeycloakProvider,
  OktaProvider,
  Auth0Provider,
  GoogleProvider,
  createOIDCProvider
};
