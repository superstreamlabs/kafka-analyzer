# SuperStream Kafka Analyzer - Configuration Examples

This directory contains configuration examples for different Kafka vendors. Each vendor has specific authentication requirements and SSL settings.

## ⚠️ Important: Vendor Field Requirement

**The `vendor` field is required for authentication mechanisms that are vendor-specific:**

- **AWS MSK IAM**: Must use `"vendor": "aws-msk"`
- **OAuth/OIDC**: Must specify the vendor (e.g., `"aws-msk"`, `"confluent-cloud"`, `"oidc"`)
- **Other mechanisms**: Vendor field helps optimize connection settings

If you get an error about missing vendor field, add the appropriate vendor value to your configuration.

## 🔐 Authentication Methods Supported

- **PLAINTEXT** - No authentication (development only)
- **SASL/PLAIN** - Username/password authentication
- **SASL/SCRAM** - Secure password authentication
- **AWS MSK IAM** - AWS Identity and Access Management
- **OIDC/OAuth 2.0** - Modern token-based authentication

📚 **For detailed OIDC setup, see [OIDC-AUTH-GUIDE.md](OIDC-AUTH-GUIDE.md)**

## Vendor-Specific Authentication Requirements

### AWS MSK (Amazon Managed Streaming for Apache Kafka)

**IAM Authentication (Port 9198):**
```json
{
  "kafka": {
    "brokers": ["your-msk-cluster.amazonaws.com:9198"],
    "clientId": "superstream-analyzer",
    "vendor": "aws-msk",
    "useSasl": true,
    "sasl": {
      "mechanism": "oauthbearer"
    }
  },
  "file": {
    "outputDir": "./kafka-analysis",
    "formats": ["json", "csv", "html"],
    "includeMetadata": true
  }
}
```

**AWS MSK IAM Authentication (Port 9198):**
```json
{
  "kafka": {
    "brokers": ["your-msk-cluster.amazonaws.com:9198"],
    "clientId": "superstream-analyzer",
    "vendor": "aws-msk",
    "useSasl": true,
    "sasl": {
      "mechanism": "AWS_MSK_IAM",
      "accessKeyId": "AKIA...",
      "secretAccessKey": "...",
      "authorizationIdentity": "arn:aws:iam::123456789012:user/your-iam-user"
    }
  },
  "file": {
    "outputDir": "./kafka-analysis",
    "formats": ["json", "csv", "html"],
    "includeMetadata": true
  }
}
```

**Note**: For AWS MSK IAM authentication, you can either:
1. Provide AWS credentials in the config file (as shown above)
2. Set `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` environment variables
3. Use AWS IAM roles (if running on EC2 or ECS)

**SCRAM Authentication (Port 9096):**
```json
{
  "kafka": {
    "brokers": ["your-msk-cluster.amazonaws.com:9096"],
    "clientId": "superstream-analyzer",
    "vendor": "aws-msk",
    "useSasl": true,
    "sasl": {
      "mechanism": "scram-sha-512",
      "username": "your-username",
      "password": "your-password"
    }
  },
  "file": {
    "outputDir": "./kafka-analysis",
    "formats": ["json", "csv", "html"],
    "includeMetadata": true
  }
}
```

### Confluent Cloud

**API Key Authentication (Single Broker URL):**
```json
{
  "kafka": {
    "brokers": ["pkc-xxxxx.us-central1.gcp.confluent.cloud:9092"],
    "clientId": "superstream-analyzer",
    "vendor": "confluent-cloud",
    "useSasl": true,
    "sasl": {
      "mechanism": "PLAIN",
      "username": "your-api-key",
      "password": "your-api-secret"
    }
  },
  "file": {
    "outputDir": "./kafka-analysis",
    "formats": ["json", "csv", "html"],
    "includeMetadata": true
  }
}
```

### Aiven Kafka

**SCRAM Authentication:**
```json
{
  "kafka": {
    "brokers": ["your-aiven-cluster.aivencloud.com:12345"],
    "clientId": "superstream-analyzer",
    "vendor": "aiven",
    "useSasl": true,
    "sasl": {
      "mechanism": "scram-sha-256",
      "username": "your-username",
      "password": "your-password"
    }
  },
  "file": {
    "outputDir": "./kafka-analysis",
    "formats": ["json", "csv", "html"],
    "includeMetadata": true
  }
}
```

### Confluent Platform

**Various SASL Mechanisms:**
```json
{
  "kafka": {
    "brokers": ["localhost:9092"],
    "clientId": "superstream-analyzer",
    "vendor": "confluent-platform",
    "useSasl": true,
    "sasl": {
      "mechanism": "plain",
      "username": "your-username",
      "password": "your-password"
    }
  },
  "file": {
    "outputDir": "./kafka-analysis",
    "formats": ["json", "csv", "html"],
    "includeMetadata": true
  }
}
```

### Redpanda

**Configurable Authentication:**
```json
{
  "kafka": {
    "brokers": ["localhost:9092"],
    "clientId": "superstream-analyzer",
    "vendor": "redpanda",
    "useSasl": true,
    "sasl": {
      "mechanism": "scram-sha-256",
      "username": "your-username",
      "password": "your-password"
    }
  },
  "file": {
    "outputDir": "./kafka-analysis",
    "formats": ["json", "csv", "html"],
    "includeMetadata": true
  }
}
```

### Apache Kafka (Self-hosted)

**Standard SASL:**
```json
{
  "kafka": {
    "brokers": ["localhost:9092"],
    "clientId": "superstream-analyzer",
    "vendor": "apache",
    "useSasl": true,
    "sasl": {
      "mechanism": "plain",
      "username": "your-username",
      "password": "your-password"
    }
  },
  "file": {
    "outputDir": "./kafka-analysis",
    "formats": ["json", "csv", "html"],
    "includeMetadata": true
  }
}
```

## OIDC Authentication Examples

### Generic OIDC Provider

**Basic OIDC Configuration:**
```json
{
  "kafka": {
    "brokers": ["kafka.example.com:9093"],
    "clientId": "superstream-analyzer",
    "vendor": "oidc",
    "useSasl": true,
    "sasl": {
      "mechanism": "oauthbearer",
      "discoveryUrl": "https://auth.example.com/.well-known/openid-configuration",
      "clientId": "kafka-client",
      "clientSecret": "your-client-secret",
      "scope": "openid kafka:read kafka:write",
      "grantType": "client_credentials"
    }
  },
  "file": {
    "outputDir": "./kafka-analysis",
    "formats": ["json", "csv", "html"],
    "includeMetadata": true
  }
}
```

### Azure Active Directory

**Azure AD OIDC:**
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
  },
  "file": {
    "outputDir": "./kafka-analysis",
    "formats": ["json", "csv", "html"],
    "includeMetadata": true
  }
}
```

### Keycloak

**Keycloak OIDC:**
```json
{
  "kafka": {
    "brokers": ["kafka.example.com:9093"],
    "clientId": "superstream-analyzer",
    "vendor": "keycloak",
    "useSasl": true,
    "sasl": {
      "mechanism": "oauthbearer",
      "keycloakUrl": "https://keycloak.example.com",
      "realm": "kafka-realm",
      "clientId": "kafka-client",
      "clientSecret": "your-client-secret",
      "scope": "openid kafka-access"
    }
  },
  "file": {
    "outputDir": "./kafka-analysis",
    "formats": ["json", "csv", "html"],
    "includeMetadata": true
  }
}
```

### Okta

**Okta OIDC:**
```json
{
  "kafka": {
    "brokers": ["kafka.example.com:9093"],
    "clientId": "superstream-analyzer",
    "vendor": "okta",
    "useSasl": true,
    "sasl": {
      "mechanism": "oauthbearer",
      "domain": "your-domain.okta.com",
      "clientId": "your-client-id",
      "clientSecret": "your-client-secret",
      "authorizationServerId": "default",
      "scope": "openid kafka:access"
    }
  },
  "file": {
    "outputDir": "./kafka-analysis",
    "formats": ["json", "csv", "html"],
    "includeMetadata": true
  }
}
```

### Auth0

**Auth0 OIDC:**
```json
{
  "kafka": {
    "brokers": ["kafka.example.com:9093"],
    "clientId": "superstream-analyzer",
    "vendor": "auth0",
    "useSasl": true,
    "sasl": {
      "mechanism": "oauthbearer",
      "domain": "your-tenant.auth0.com",
      "clientId": "your-client-id",
      "clientSecret": "your-client-secret",
      "audience": "https://kafka.example.com/api",
      "scope": "openid profile kafka:read kafka:write"
    }
  },
  "file": {
    "outputDir": "./kafka-analysis",
    "formats": ["json", "csv", "html"],
    "includeMetadata": true
  }
}
```

## Important Notes

1. **SSL Requirements:**
   - AWS MSK: Always requires SSL
   - Confluent Cloud: Always requires SSL
   - Aiven: Always requires SSL
   - Confluent Platform: Usually requires SSL
   - Redpanda: Configurable, defaults to SSL
   - Apache Kafka: Configurable, defaults to SSL for security
   - OIDC: Always requires SSL (port 9093)

2. **SASL Mechanisms:**
   - AWS MSK IAM: `oauthbearer` (uses AWS credentials)
   - AWS MSK SCRAM: `scram-sha-512`
   - Confluent Cloud: `plain`
   - Aiven: `scram-sha-256`
   - OIDC: `oauthbearer` (uses OAuth 2.0 tokens)
   - Others: Configurable (`plain`, `scram-sha-256`, `scram-sha-512`)

3. **Port Requirements:**
   - AWS MSK IAM: Port 9198
   - AWS MSK SCRAM: Port 9096
   - OIDC: Port 9093 (SASL_SSL)
   - Others: Usually port 9092 (SSL) or 9093 (SASL_PLAINTEXT)

4. **OIDC-Specific Notes:**
   - Auto-discovery: Most providers support `.well-known/openid-configuration`
   - Token validation: Enable `validateToken` for enhanced security
   - Grant types: `client_credentials` is recommended for Kafka clients
   - Scopes: Configure appropriate scopes for Kafka operations
   - Caching: Tokens are automatically cached to improve performance

4. **File Output Configuration:**
   - `outputDir`: Directory where output files will be saved
   - `formats`: Array of output formats (`json`, `csv`, `html`, `txt`)
   - `includeMetadata`: Whether to include metadata in output files (default: true)
   - `includeTimestamp`: Whether to include timestamp in output filenames (default: true)
     - `true`: Files will be named like `kafka-analysis-1703123456789.json`
     - `false`: Files will be named like `kafka-analysis.json`

## Usage

```bash
# Using a config file
npx superstream-kafka-analyzer --config config-examples/aws-msk-iam.json

# Interactive mode (will prompt for vendor selection)
npx superstream-kafka-analyzer
```

## 📁 Available Examples

### 1. **Basic Local Development** (`config.example.json`)
- **Use case**: Local Kafka cluster (Docker, local installation)
- **Authentication**: None (PLAINTEXT)
- **Port**: 9092
- **Best for**: Development and testing

### 2. **SASL Authentication** (`config.example.sasl.json`)
- **Use case**: On-premise Kafka with SASL authentication
- **Authentication**: SASL_PLAINTEXT with PLAIN mechanism
- **Port**: 9092
- **Best for**: Production on-premise clusters

### 3. **AWS MSK with SCRAM** (`config.example.aws-msk.json`)
- **Use case**: AWS MSK cluster with SCRAM authentication
- **Authentication**: SASL_SSL with SCRAM-SHA-512
- **Port**: 9092
- **Best for**: Development/testing MSK clusters

### 4. **AWS MSK with IAM** (`config.example.aws-msk-iam.json`)
- **Use case**: AWS MSK cluster with IAM authentication
- **Authentication**: SASL_SSL with AWS_MSK_IAM
- **Port**: 9098
- **Best for**: Production MSK clusters

### 5. **Confluent Cloud** (`config.example.confluent-cloud.json`)
- **Use case**: Confluent Cloud managed Kafka
- **Authentication**: SASL_SSL with PLAIN mechanism (Official methodology)
- **Port**: 9092
- **Best for**: Cloud-managed Kafka with Confluent
- **Library**: Uses official `@confluentinc/kafka-javascript` library

### 5a. **Confluent Cloud Properties** (`config.example.confluent-cloud.properties`)
- **Use case**: Confluent Cloud with official properties format
- **Authentication**: SASL_SSL with PLAIN mechanism
- **Port**: 9092
- **Best for**: Reference for official Confluent Cloud configuration format

### 6. **Confluent Platform** (`config.example.confluent-platform.json`)
- **Use case**: On-premise Confluent Platform
- **Authentication**: SASL_PLAINTEXT with PLAIN mechanism
- **Port**: 9092
- **Best for**: Enterprise Confluent deployments

### 7. **Aiven Kafka** (`config.example.aiven-kafka.json`)
- **Use case**: Aiven managed Kafka service
- **Authentication**: SASL_SSL with PLAIN mechanism
- **Port**: Custom (e.g., 12345)
- **Best for**: Cloud-managed Kafka with Aiven

### 8. **Redpanda** (`config.example.redpanda.json`)
- **Use case**: Redpanda streaming platform
- **Authentication**: SASL_PLAINTEXT with SCRAM-SHA-256
- **Port**: 9092
- **Best for**: High-performance streaming with Redpanda

### 9. **Apache Kafka - PLAIN Authentication** (`config.example.apache-kafka.json`)
- **Use case**: Self-hosted Apache Kafka with SASL authentication
- **Authentication**: SASL_PLAINTEXT with PLAIN mechanism
- **Port**: 9092
- **Best for**: Production Apache Kafka clusters with simple authentication

### 10. **Apache Kafka - Development** (`config.example.apache-kafka-plaintext.json`)
- **Use case**: Local Apache Kafka cluster without authentication
- **Authentication**: None (PLAINTEXT)
- **Port**: 9092
- **Best for**: Development and testing Apache Kafka clusters

### 11. **Apache Kafka - SCRAM Authentication** (`config.example.apache-kafka-scram.json`)
- **Use case**: Self-hosted Apache Kafka with SCRAM authentication
- **Authentication**: SASL_PLAINTEXT with SCRAM-SHA-256
- **Port**: 9092
- **Best for**: Production Apache Kafka clusters with secure authentication

### 12. **Generic OIDC Authentication** (`config.example.oidc.json`)
- **Use case**: Any Kafka cluster with OIDC authentication
- **Authentication**: SASL_SSL with OAUTHBEARER mechanism
- **Port**: 9093
- **Best for**: Modern authentication with any OIDC provider

### 13. **Azure Active Directory** (`config.example.azure-ad-oauth.json`)
- **Use case**: Kafka clusters with Azure AD authentication
- **Authentication**: SASL_SSL with OAUTHBEARER mechanism
- **Port**: 9093
- **Best for**: Enterprise environments using Azure AD

### 14. **Keycloak Authentication** (`config.example.keycloak-oauth.json`)
- **Use case**: Kafka clusters with Keycloak authentication
- **Authentication**: SASL_SSL with OAUTHBEARER mechanism
- **Port**: 9093
- **Best for**: On-premise or cloud deployments using Keycloak

### 15. **Okta Authentication** (`config.example.okta-oauth.json`)
- **Use case**: Kafka clusters with Okta authentication
- **Authentication**: SASL_SSL with OAUTHBEARER mechanism
- **Port**: 9093
- **Best for**: Enterprise environments using Okta

### 16. **Auth0 Authentication** (`config.example.auth0-oidc.json`)
- **Use case**: Kafka clusters with Auth0 authentication
- **Authentication**: SASL_SSL with OAUTHBEARER mechanism
- **Port**: 9093
- **Best for**: Applications using Auth0 for identity management

### 17. **Generic OAuth Provider** (`config.example.generic-oauth.json`)
- **Use case**: Any OAuth 2.0 compatible provider
- **Authentication**: SASL_SSL with OAUTHBEARER mechanism
- **Port**: 9093
- **Best for**: Custom OAuth implementations

## 🚀 Quick Start

1. **Copy** the appropriate example file:
   ```bash
   cp config-examples/config.example.confluent-cloud.json my-config.json
   ```

2. **Edit** the configuration with your actual values:
   - Replace broker URLs
   - Update authentication credentials
   - Adjust output settings

3. **Run** the analyzer:
   ```bash
   npx superstream-kafka-analyzer --config my-config.json
   ```

## 🔧 Configuration Reference

### Kafka Configuration
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `brokers` | array | Yes | Array of broker URLs (host:port) |
| `clientId` | string | Yes | Client identifier |
| `useSasl` | boolean | No | Enable SASL authentication |
| `sasl.mechanism` | string | No* | SASL mechanism (plain, scram-sha-256, oauthbearer) |
| `sasl.username` | string | No* | Username/API key |
| `sasl.password` | string | No* | Password/API secret |

*Required if `useSasl` is true

### OIDC Configuration (when mechanism is `oauthbearer`)
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sasl.discoveryUrl` | string | No | OIDC discovery endpoint URL |
| `sasl.clientId` | string | Yes | OAuth client ID |
| `sasl.clientSecret` | string | Yes | OAuth client secret |
| `sasl.scope` | string | No | OAuth scopes (default: "openid") |
| `sasl.audience` | string | No | Token audience |
| `sasl.grantType` | string | No | Grant type (default: "client_credentials") |
| `sasl.validateToken` | boolean | No | Enable JWT token validation |
| `sasl.tenantId` | string | No | Azure AD tenant ID |
| `sasl.domain` | string | No | Okta/Auth0 domain |
| `sasl.realm` | string | No | Keycloak realm |
| `sasl.keycloakUrl` | string | No | Keycloak base URL |

### File Configuration
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `outputDir` | string | Yes | Output directory path |
| `formats` | array | Yes | Output formats (json, csv, html, txt) |
| `includeMetadata` | boolean | No | Include metadata in output |
| `includeTimestamp` | boolean | No | Include timestamp in output filenames |

## 🔐 Authentication Methods by Platform

### PLAINTEXT (Local Development)
```json
{
  "kafka": {
    "brokers": ["localhost:9092"],
    "useSasl": false
  }
}
```

### SASL_PLAINTEXT (On-premise)
```json
{
  "kafka": {
    "brokers": ["kafka.example.com:9092"],
    "useSasl": true,
    "sasl": {
      "mechanism": "PLAIN",
      "username": "user",
      "password": "pass"
    }
  }
}
```

### SASL_SSL (Cloud Providers)
```json
{
  "kafka": {
    "brokers": ["pkc-xxxxx.region.cloud:9092"],
    "useSasl": true,
    "sasl": {
      "mechanism": "PLAIN",
      "username": "API_KEY",
      "password": "API_SECRET"
    }
  }
}
```

### AWS MSK IAM
```json
{
  "kafka": {
    "brokers": ["b-1.cluster.region.amazonaws.com:9098"],
    "useSasl": true,
    "sasl": {
      "mechanism": "AWS_MSK_IAM",
      "accessKeyId": "AKIA...",
      "secretAccessKey": "..."
    }
  }
}
```

### SCRAM-SHA-256 (Redpanda)
```json
{
  "kafka": {
    "brokers": ["redpanda.example.com:9092"],
    "useSasl": true,
    "sasl": {
      "mechanism": "SCRAM-SHA-256",
      "username": "user",
      "password": "pass"
    }
  }
}
```

### OIDC/OAuth 2.0 (Modern Authentication)
```json
{
  "kafka": {
    "brokers": ["kafka.example.com:9093"],
    "useSasl": true,
    "sasl": {
      "mechanism": "oauthbearer",
      "discoveryUrl": "https://auth.example.com/.well-known/openid-configuration",
      "clientId": "kafka-client",
      "clientSecret": "your-client-secret",
      "scope": "openid kafka:read kafka:write",
      "grantType": "client_credentials"
    }
  }
}
```

### Apache Kafka
- Standard Kafka protocol, widely used for self-hosted and on-premise deployments
- Supports PLAINTEXT (no authentication), SASL/PLAIN, and SASL/SCRAM mechanisms
- Use PLAINTEXT for local development only; always enable authentication for production
- Common ports: 9092 (PLAINTEXT/SASL_PLAINTEXT), 9093 (SSL/SASL_SSL)
- Use `config.example.apache-kafka.json` for PLAIN, `config.example.apache-kafka-scram.json` for SCRAM, and `config.example.apache-kafka-plaintext.json` for no authentication

## 🌐 Platform-Specific Notes

### Confluent Cloud
- Get broker URL from your cluster overview (single endpoint)
- Use API Key as username, API Secret as password
- Uses official Confluent Cloud methodology with `@confluentinc/kafka-javascript` library
- Always uses SASL_SSL with PLAIN mechanism
- Only one broker URL is needed (not multiple endpoints)
- Session timeout set to 45000ms as per official recommendations

### Confluent Platform
- Standard Kafka protocol with SASL authentication
- Can use PLAIN, SCRAM, or OAuth mechanisms
- Supports both SASL_PLAINTEXT and SASL_SSL

### AWS MSK
- SCRAM: Use port 9092 with SCRAM-SHA-512
- IAM: Use port 9098 with AWS_MSK_IAM mechanism
- Get broker URLs from MSK console

### Aiven Kafka
- Uses custom port numbers (not 9092)
- Default username is `avnadmin`
- Get connection details from Aiven console

### Redpanda
- Compatible with Kafka protocol
- Supports SCRAM-SHA-256 authentication
- Can use standard Kafka tools and libraries

## 🚨 Security Notes

- **Never commit** configuration files with real credentials
- **Use environment variables** for sensitive data in production
- **Rotate credentials** regularly
- **Use IAM roles** when possible (AWS MSK)
- **Enable SSL/TLS** for production environments

## 📞 Support

For issues with specific configurations:
1. Check the main README troubleshooting section
2. Verify your broker URLs and credentials
3. Ensure network connectivity to your Kafka cluster
4. Check platform-specific documentation for authentication details 