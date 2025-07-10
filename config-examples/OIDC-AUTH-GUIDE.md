# OIDC Authentication Guide for Kafka Analyzer

This guide explains how to configure OIDC (OpenID Connect) authentication for the SuperStream Kafka Analyzer.

## Overview

The Kafka Analyzer now supports generic OIDC authentication, making it compatible with any OIDC-compliant identity provider. This includes:

- Azure Active Directory (Azure AD / Entra ID)
- Keycloak
- Okta
- Auth0
- Google Identity Platform
- AWS Cognito
- PingFederate
- Any other OIDC-compliant provider

## Key Features

### 1. **OIDC Discovery Support**
The analyzer can automatically discover OIDC endpoints using the well-known discovery document:
```json
{
  "discoveryUrl": "https://auth.example.com/.well-known/openid-configuration"
}
```

### 2. **Token Validation**
Optional JWT token validation using JWKS (JSON Web Key Sets):
```json
{
  "validateToken": true
}
```

### 3. **Token Caching**
Tokens are automatically cached to reduce authentication overhead.

### 4. **Multiple Grant Types**
Support for various OAuth 2.0 grant types:
- `client_credentials` (default)
- `password` (Resource Owner Password)
- `authorization_code` (requires additional setup)

## Configuration Examples

### Generic OIDC Configuration

```json
{
  "kafka": {
    "brokers": ["kafka1.example.com:9093"],
    "clientId": "superstream-analyzer",
    "vendor": "oidc",
    "useSasl": true,
    "sasl": {
      "mechanism": "oauthbearer",
      "discoveryUrl": "https://auth.example.com/.well-known/openid-configuration",
      "clientId": "your-client-id",
      "clientSecret": "your-client-secret",
      "scope": "openid kafka:read kafka:write",
      "audience": "https://kafka.example.com",
      "grantType": "client_credentials",
      "validateToken": true
    }
  }
}
```

### Azure AD Configuration

```json
{
  "kafka": {
    "brokers": ["your-kafka-broker.servicebus.windows.net:9093"],
    "clientId": "superstream-analyzer",
    "vendor": "azure-ad",
    "useSasl": true,
    "sasl": {
      "mechanism": "oauthbearer",
      "tenantId": "your-tenant-id",
      "clientId": "your-client-id",
      "clientSecret": "your-client-secret",
      "scope": "your-client-id/.default",
      "validateToken": true
    }
  }
}
```

### Keycloak Configuration

```json
{
  "kafka": {
    "brokers": ["kafka1.example.com:9093"],
    "clientId": "superstream-analyzer",
    "vendor": "keycloak",
    "useSasl": true,
    "sasl": {
      "mechanism": "oauthbearer",
      "keycloakUrl": "https://keycloak.example.com",
      "realm": "your-realm",
      "clientId": "kafka-client",
      "clientSecret": "your-client-secret",
      "scope": "openid kafka-access",
      "validateToken": true
    }
  }
}
```

### Okta Configuration

```json
{
  "kafka": {
    "brokers": ["kafka1.example.com:9093"],
    "clientId": "superstream-analyzer",
    "vendor": "okta",
    "useSasl": true,
    "sasl": {
      "mechanism": "oauthbearer",
      "domain": "your-okta-domain.okta.com",
      "clientId": "your-client-id",
      "clientSecret": "your-client-secret",
      "authorizationServerId": "default",
      "scope": "openid kafka:access",
      "validateToken": true
    }
  }
}
```

### Auth0 Configuration

```json
{
  "kafka": {
    "brokers": ["kafka1.example.com:9093"],
    "clientId": "superstream-analyzer",
    "vendor": "auth0",
    "useSasl": true,
    "sasl": {
      "mechanism": "oauthbearer",
      "domain": "your-tenant.auth0.com",
      "clientId": "your-client-id",
      "clientSecret": "your-client-secret",
      "audience": "https://kafka.example.com/api",
      "scope": "openid profile kafka:read kafka:write",
      "validateToken": true
    }
  }
}
```

## Configuration Parameters

### Required Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `mechanism` | Must be `oauthbearer` for OIDC | `"oauthbearer"` |
| `clientId` | OAuth client ID | `"kafka-client"` |
| `clientSecret` | OAuth client secret | `"your-secret"` |

### Optional Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `discoveryUrl` | OIDC discovery endpoint | Auto-generated for known vendors |
| `scope` | OAuth scopes | `"openid"` |
| `audience` | Token audience | Provider-specific |
| `grantType` | OAuth grant type | `"client_credentials"` |
| `validateToken` | Enable JWT validation | `false` |
| `tokenHost` | Manual token endpoint host | From discovery |
| `tokenPath` | Manual token endpoint path | From discovery |
| `authorizePath` | Manual authorize endpoint | From discovery |
| `jwksUri` | Manual JWKS endpoint | From discovery |
| `customParams` | Additional token parameters | `{}` |

## Vendor-Specific Notes

### Azure AD
- Discovery URL is automatically generated using tenant ID
- Default scope is `{clientId}/.default`
- Supports both v1.0 and v2.0 endpoints

### Keycloak
- Discovery URL is automatically generated using realm
- Supports multiple grant types
- Can use service accounts or user credentials

### Okta
- Discovery URL uses authorization server ID
- Default authorization server is `"default"`
- Supports custom authorization servers

### Auth0
- Requires audience parameter
- Discovery URL uses Auth0 domain
- Supports custom claims

## Manual Configuration (Without Discovery)

If your OIDC provider doesn't support discovery, you can manually configure endpoints:

```json
{
  "sasl": {
    "mechanism": "oauthbearer",
    "clientId": "your-client-id",
    "clientSecret": "your-client-secret",
    "tokenHost": "https://auth.example.com",
    "tokenPath": "/oauth/token",
    "authorizePath": "/oauth/authorize",
    "jwksUri": "https://auth.example.com/.well-known/jwks.json",
    "scope": "openid kafka:access",
    "audience": "https://kafka.example.com"
  }
}
```

## Kafka Broker Configuration

Your Kafka brokers must be configured to accept OAUTHBEARER authentication. Example configuration:

```properties
# Kafka broker configuration
listeners=SASL_SSL://0.0.0.0:9093
security.inter.broker.protocol=SASL_SSL
sasl.enabled.mechanisms=OAUTHBEARER
sasl.mechanism.inter.broker.protocol=OAUTHBEARER

# OIDC configuration
sasl.oauthbearer.jwks.endpoint.url=https://auth.example.com/.well-known/jwks.json
sasl.oauthbearer.expected.audience=https://kafka.example.com
sasl.oauthbearer.expected.issuer=https://auth.example.com
```

## Troubleshooting

### Common Issues

1. **Token validation fails**
   - Ensure `jwksUri` is accessible
   - Check token audience and issuer claims
   - Verify clock synchronization

2. **Discovery fails**
   - Check discovery URL is correct
   - Ensure network connectivity
   - Verify CORS settings if applicable

3. **Authentication fails**
   - Verify client credentials
   - Check scope permissions
   - Ensure grant type is supported

### Debug Mode

Enable detailed logging by setting environment variables:
```bash
export DEBUG=kafka*
export NODE_ENV=development
```

## Security Best Practices

1. **Always use SSL/TLS** for Kafka connections with OIDC
2. **Enable token validation** in production environments
3. **Use short token lifetimes** and implement token refresh
4. **Restrict scopes** to minimum required permissions
5. **Rotate client secrets** regularly
6. **Monitor authentication logs** for suspicious activity

## Migration from Legacy OAuth

If you're migrating from the legacy OAuth implementation:

1. Change `vendor` from `custom-oauth` to `oidc`
2. Add `discoveryUrl` if available
3. Enable `validateToken` for better security
4. Update scope format to match OIDC standards

## Support

For issues or questions:
- Check the main README troubleshooting section
- Verify your OIDC provider documentation
- Ensure Kafka broker OIDC configuration is correct
- Contact the SuperStream team at team@superstream.ai
