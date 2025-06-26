# SuperStream Kafka Analyzer - Configuration Examples

This directory contains configuration examples for different Kafka vendors. Each vendor has specific authentication requirements and SSL settings.

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

**API Key Authentication:**
```json
{
  "kafka": {
    "brokers": ["your-cluster.confluent.cloud:9092"],
    "clientId": "superstream-analyzer",
    "vendor": "confluent-cloud",
    "useSasl": true,
    "sasl": {
      "mechanism": "plain",
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

## Important Notes

1. **SSL Requirements:**
   - AWS MSK: Always requires SSL
   - Confluent Cloud: Always requires SSL
   - Aiven: Always requires SSL
   - Confluent Platform: Usually requires SSL
   - Redpanda: Configurable, defaults to SSL
   - Apache Kafka: Configurable, defaults to SSL for security

2. **SASL Mechanisms:**
   - AWS MSK IAM: `oauthbearer` (uses AWS credentials)
   - AWS MSK SCRAM: `scram-sha-512`
   - Confluent Cloud: `plain`
   - Aiven: `scram-sha-256`
   - Others: Configurable (`plain`, `scram-sha-256`, `scram-sha-512`)

3. **Port Requirements:**
   - AWS MSK IAM: Port 9198
   - AWS MSK SCRAM: Port 9096
   - Others: Usually port 9092 (SSL) or 9093 (SASL_PLAINTEXT)

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
- **Authentication**: SASL_SSL with PLAIN mechanism
- **Port**: 9092
- **Best for**: Cloud-managed Kafka with Confluent

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
| `sasl.mechanism` | string | No* | SASL mechanism |
| `sasl.username` | string | No* | Username/API key |
| `sasl.password` | string | No* | Password/API secret |

*Required if `useSasl` is true

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

### Apache Kafka
- Standard Kafka protocol, widely used for self-hosted and on-premise deployments
- Supports PLAINTEXT (no authentication), SASL/PLAIN, and SASL/SCRAM mechanisms
- Use PLAINTEXT for local development only; always enable authentication for production
- Common ports: 9092 (PLAINTEXT/SASL_PLAINTEXT), 9093 (SSL/SASL_SSL)
- Use `config.example.apache-kafka.json` for PLAIN, `config.example.apache-kafka-scram.json` for SCRAM, and `config.example.apache-kafka-plaintext.json` for no authentication

## 🌐 Platform-Specific Notes

### Confluent Cloud
- Get broker URLs from your cluster overview
- Use API Key as username, API Secret as password
- Always uses SASL_SSL with PLAIN mechanism

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