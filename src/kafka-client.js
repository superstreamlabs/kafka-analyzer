const { Kafka, logLevel } = require('kafkajs');
const { Kafka: ConfluentKafka } = require('@confluentinc/kafka-javascript').KafkaJS;
const fs = require('fs').promises;
const chalk = require('chalk');
const crypto = require('crypto');
const { generateAuthToken } = require('aws-msk-iam-sasl-signer-js');
const { createOIDCProvider } = require('./oidc-providers');
const { createOAuthProvider } = require('./oauth-providers'); // Keep legacy support

// Utility function to handle BigInt serialization
function serializeBigInt(obj) {
  return JSON.parse(JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  ));
}

class KafkaClient {
  constructor(config) {
    this.config = config;
    this.kafka = null;
    this.admin = null;
    this.connected = false;
  }

  async connect() {
    try {
      const kafkaConfig = {
        clientId: 'superstream-analyzer',
        brokers: this.config.brokers,
        connectionTimeout: 3000,
        requestTimeout: 30000,
        retry: {
          initialRetryTime: 100,
          retries: 8
        }
      };

      // Handle authentication based on vendor and configuration
      if (this.config.useSasl && this.config.sasl) {
        const vendor = this.config.vendor;
        const mechanism = this.config.sasl.mechanism;

        console.log(`🔐 Setting up ${vendor} authentication with ${mechanism}...`);

        // Check if we should use OIDC
        const useOIDC = mechanism === 'oauthbearer' && 
                       (this.config.sasl.discoveryUrl || 
                        this.config.sasl.useOIDC || 
                        ['azure', 'azure-ad', 'keycloak', 'okta', 'auth0', 'google', 'oidc'].includes(vendor));

        // Vendor-specific authentication handling
        switch (vendor) {
          case 'aws-msk':
            if (mechanism === 'oauthbearer') {
              // AWS MSK IAM authentication
              console.log('🔐 Using AWS MSK IAM authentication...');
              
              const region = this.extractRegionFromBrokers();
              console.log(`🌍 Using AWS region: ${region}`);
              
              kafkaConfig.ssl = true; // MSK with IAM requires SSL
              kafkaConfig.sasl = {
                mechanism: 'oauthbearer',
                oauthBearerProvider: async () => {
                  console.log('🔐 Generating IAM auth token...');
                  try {
                    const authTokenResponse = await generateAuthToken({ region: region });
                    console.log('✅ Auth token generated successfully');
                    return {
                      value: authTokenResponse.token
                    };
                  } catch (tokenError) {
                    console.error('❌ Failed to generate auth token:', tokenError);
                    throw tokenError;
                  }
                }
              };
            } else {
              // AWS MSK SCRAM or other mechanisms
              kafkaConfig.ssl = true; // MSK requires SSL
              kafkaConfig.sasl = {
                mechanism: mechanism,
                username: this.config.sasl.username,
                password: this.config.sasl.password
              };
            }
            break;

          case 'confluent-cloud':
            // Use official Confluent Cloud methodology
            console.log('🔐 Confluent Cloud: Using official connection methodology');
            
            // Validate credentials
            if (!this.config.sasl.username || !this.config.sasl.password) {
              throw new Error('Confluent Cloud requires both API Key (username) and API Secret (password)');
            }
            
            console.log(`🔑 Username (API Key): ${this.config.sasl.username ? '***' + this.config.sasl.username.slice(-4) : 'NOT SET'}`);
            console.log(`🔑 Password (API Secret): ${this.config.sasl.password ? '***' + this.config.sasl.password.slice(-4) : 'NOT SET'}`);
            console.log(`🌐 Brokers: ${JSON.stringify(this.config.brokers)}`);
            
            // Use official Confluent Cloud configuration format
            const confluentConfig = {
              'bootstrap.servers': this.config.brokers.join(','),
              'security.protocol': 'SASL_SSL',
              'sasl.mechanisms': 'PLAIN',
              'sasl.username': this.config.sasl.username,
              'sasl.password': this.config.sasl.password,
              'session.timeout.ms': 45000,
              'client.id': 'superstream-analyzer'
            };
            
            console.log('🚀 Using official Confluent Cloud configuration:');
            console.log(`   Security Protocol: SASL_SSL`);
            console.log(`   SASL Mechanism: PLAIN`);
            console.log(`   Session Timeout: 45000ms`);
            console.log(`   Client ID: superstream-analyzer`);
            
            // Create Confluent Kafka client
            this.confluentKafka = new ConfluentKafka();
            this.admin = this.confluentKafka.admin(confluentConfig);
            
            console.log('💡 If authentication fails, try:');
            console.log('   1. Verify API Key/Secret are correct');
            console.log('   2. Check API Key permissions (kafka-cluster:read, describe)');
            console.log('   3. Ensure cluster is active and broker URL is correct');
            console.log('   4. Try regenerating API Key/Secret in Confluent Cloud console');
            
            // Connect using official method
            await this.admin.connect();
            console.log('✅ Connected to Confluent Cloud successfully using official methodology');
            return true;

          case 'aiven':
            // Aiven uses SASL_SSL with SCRAM-SHA-256 or OAuth
            kafkaConfig.ssl = await this.buildSslConfig();
            if (mechanism === 'oauthbearer' && useOIDC) {
              const oidcProvider = await createOIDCProvider('oidc', {
                ...this.config.sasl,
                discoveryUrl: this.config.sasl.discoveryUrl,
                clientId: this.config.sasl.clientId,
                clientSecret: this.config.sasl.clientSecret,
                tokenHost: this.config.sasl.host || this.config.sasl.tokenHost,
                tokenPath: this.config.sasl.path || this.config.sasl.tokenPath,
                scope: this.config.sasl.scope,
                audience: this.config.sasl.audience,
                validateToken: this.config.sasl.validateToken
              });
              
              kafkaConfig.sasl = {
                mechanism: 'oauthbearer',
                oauthBearerProvider: async () => {
                  return await oidcProvider.getToken();
                }
              };
            } else if (mechanism === 'oauthbearer') {
              // Legacy OAuth support
              const oauthProvider = createOAuthProvider('generic', {
                clientId: this.config.sasl.clientId,
                clientSecret: this.config.sasl.clientSecret,
                tokenHost: this.config.sasl.host || this.config.sasl.tokenHost,
                tokenPath: this.config.sasl.path || this.config.sasl.tokenPath
              });
              
              kafkaConfig.sasl = {
                mechanism: 'oauthbearer',
                oauthBearerProvider: async () => {
                  return await oauthProvider.getToken();
                }
              };
            } else {
              kafkaConfig.sasl = {
                mechanism: 'scram-sha-256', // Aiven typically uses SCRAM-SHA-256
                username: this.config.sasl.username,
                password: this.config.sasl.password
              };
            }
            break;

          case 'confluent-platform':
            // Confluent Platform can use various mechanisms
            kafkaConfig.ssl = true; // Usually requires SSL
            if (mechanism === 'oauthbearer' && useOIDC) {
              const oidcProvider = await createOIDCProvider('oidc', {
                ...this.config.sasl,
                validateToken: this.config.sasl.validateToken
              });
              
              kafkaConfig.sasl = {
                mechanism: 'oauthbearer',
                oauthBearerProvider: async () => {
                  return await oidcProvider.getToken();
                }
              };
            } else {
              kafkaConfig.sasl = {
                mechanism: mechanism,
                username: this.config.sasl.username,
                password: this.config.sasl.password
              };
            }
            break;

          case 'redpanda':
            // Redpanda can use various mechanisms, SSL depends on configuration
            if (this.config.ssl !== false) {
              kafkaConfig.ssl = true; // Default to SSL for Redpanda
            }
            if (mechanism === 'oauthbearer' && useOIDC) {
              const oidcProvider = await createOIDCProvider('oidc', {
                ...this.config.sasl,
                validateToken: this.config.sasl.validateToken
              });
              
              kafkaConfig.sasl = {
                mechanism: 'oauthbearer',
                oauthBearerProvider: async () => {
                  return await oidcProvider.getToken();
                }
              };
            } else {
              kafkaConfig.sasl = {
                mechanism: mechanism,
                username: this.config.sasl.username,
                password: this.config.sasl.password
              };
            }
            break;

          case 'azure':
          case 'azure-ad':
          case 'azure-event-hubs':
            // Azure Event Hubs with OAuth
            console.log('🔐 Using Azure AD OIDC authentication...');
            kafkaConfig.ssl = true; // Azure requires SSL
            
            if (mechanism === 'oauthbearer') {
              const azureProvider = await createOIDCProvider('azure-ad', {
                tenantId: this.config.sasl.tenantId,
                clientId: this.config.sasl.clientId,
                clientSecret: this.config.sasl.clientSecret,
                scope: this.config.sasl.scope || `${this.config.sasl.clientId}/.default`,
                discoveryUrl: this.config.sasl.discoveryUrl,
                validateToken: this.config.sasl.validateToken
              });
              
              kafkaConfig.sasl = {
                mechanism: 'oauthbearer',
                oauthBearerProvider: async () => {
                  return await azureProvider.getToken();
                }
              };
            } else {
              // Fallback to connection string based auth
              kafkaConfig.sasl = {
                mechanism: mechanism,
                username: this.config.sasl.username || '$ConnectionString',
                password: this.config.sasl.password || this.config.sasl.connectionString
              };
            }
            break;

          case 'keycloak':
            // Keycloak OIDC authentication
            console.log('🔐 Using Keycloak OIDC authentication...');
            kafkaConfig.ssl = this.config.ssl !== false; // SSL recommended
            
            if (mechanism === 'oauthbearer') {
              const keycloakProvider = await createOIDCProvider('keycloak', {
                keycloakUrl: this.config.sasl.keycloakUrl,
                realm: this.config.sasl.realm,
                clientId: this.config.sasl.clientId,
                clientSecret: this.config.sasl.clientSecret,
                scope: this.config.sasl.scope,
                discoveryUrl: this.config.sasl.discoveryUrl,
                validateToken: this.config.sasl.validateToken,
                grantType: this.config.sasl.grantType
              });
              
              kafkaConfig.sasl = {
                mechanism: 'oauthbearer',
                oauthBearerProvider: async () => {
                  return await keycloakProvider.getToken();
                }
              };
            }
            break;

          case 'okta':
            // Okta OIDC authentication
            console.log('🔐 Using Okta OIDC authentication...');
            kafkaConfig.ssl = true; // SSL required for OAuth
            
            if (mechanism === 'oauthbearer') {
              const oktaProvider = await createOIDCProvider('okta', {
                domain: this.config.sasl.domain,
                clientId: this.config.sasl.clientId,
                clientSecret: this.config.sasl.clientSecret,
                authorizationServerId: this.config.sasl.authorizationServerId,
                scope: this.config.sasl.scope,
                discoveryUrl: this.config.sasl.discoveryUrl,
                validateToken: this.config.sasl.validateToken
              });
              
              kafkaConfig.sasl = {
                mechanism: 'oauthbearer',
                oauthBearerProvider: async () => {
                  return await oktaProvider.getToken();
                }
              };
            }
            break;

          case 'auth0':
            // Auth0 OIDC authentication
            console.log('🔐 Using Auth0 OIDC authentication...');
            kafkaConfig.ssl = true; // SSL required for OAuth
            
            if (mechanism === 'oauthbearer') {
              const auth0Provider = await createOIDCProvider('auth0', {
                domain: this.config.sasl.domain,
                clientId: this.config.sasl.clientId,
                clientSecret: this.config.sasl.clientSecret,
                audience: this.config.sasl.audience,
                scope: this.config.sasl.scope,
                discoveryUrl: this.config.sasl.discoveryUrl,
                validateToken: this.config.sasl.validateToken
              });
              
              kafkaConfig.sasl = {
                mechanism: 'oauthbearer',
                oauthBearerProvider: async () => {
                  return await auth0Provider.getToken();
                }
              };
            }
            break;

          case 'google':
            // Google OIDC authentication
            console.log('🔐 Using Google OIDC authentication...');
            kafkaConfig.ssl = true; // SSL required for OAuth
            
            if (mechanism === 'oauthbearer') {
              const googleProvider = await createOIDCProvider('google', {
                clientId: this.config.sasl.clientId,
                clientSecret: this.config.sasl.clientSecret,
                scope: this.config.sasl.scope,
                discoveryUrl: this.config.sasl.discoveryUrl,
                validateToken: this.config.sasl.validateToken
              });
              
              kafkaConfig.sasl = {
                mechanism: 'oauthbearer',
                oauthBearerProvider: async () => {
                  return await googleProvider.getToken();
                }
              };
            }
            break;

          case 'oidc':
          case 'custom-oauth':
            // Generic OIDC provider
            console.log('🔐 Using generic OIDC authentication...');
            kafkaConfig.ssl = this.config.ssl !== false;
            
            if (mechanism === 'oauthbearer') {
              const oidcProvider = await createOIDCProvider('oidc', {
                ...this.config.sasl,
                validateToken: this.config.sasl.validateToken
              });
              
              kafkaConfig.sasl = {
                mechanism: 'oauthbearer',
                oauthBearerProvider: async () => {
                  return await oidcProvider.getToken();
                }
              };
            }
            break;

          case 'apache':
          default:
            // Apache Kafka - SSL depends on configuration
            if (this.config.ssl !== false) {
              kafkaConfig.ssl = true; // Default to SSL for security
            }
            
            if (mechanism === 'oauthbearer' && useOIDC) {
              // Generic OIDC for Apache Kafka
              const oidcProvider = await createOIDCProvider('oidc', {
                ...this.config.sasl,
                validateToken: this.config.sasl.validateToken
              });
              
              kafkaConfig.sasl = {
                mechanism: 'oauthbearer',
                oauthBearerProvider: async () => {
                  return await oidcProvider.getToken();
                }
              };
            } else {
              kafkaConfig.sasl = {
                mechanism: mechanism,
                username: this.config.sasl.username,
                password: this.config.sasl.password
              };
            }
            break;
        }
      } else if (this.config.vendor === 'aws-msk') {
        // AWS MSK without SASL - still needs SSL
        console.log('🔐 AWS MSK detected - enabling SSL for security');
        kafkaConfig.ssl = true;
      }

      this.admin = new Kafka(kafkaConfig).admin();
      await this.admin.connect();
      console.log('✅ Connected to Kafka cluster successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to connect to Kafka cluster:', error.message);
      throw error;
    }
  }

  extractRegionFromBrokers() {
    // Extract region from broker URLs
    for (const broker of this.config.brokers) {
      const match = broker.match(/\.([a-z0-9-]+)\.amazonaws\.com/);
      if (match) {
        return match[1];
      }
    }
    // Default to eu-central-1 if not found
    return 'eu-central-1';
  }

  async disconnect() {
    if (this.admin) {
      await this.admin.disconnect();
      console.log('Disconnected from Kafka cluster');
    }
    if (this.confluentKafka) {
      // Confluent Kafka client cleanup if needed
      this.confluentKafka = null;
    }
  }

  async getTopics() {
    try {
      // Get all topic metadata at once
      const metadata = await this.admin.fetchTopicMetadata();
      
      // Handle different metadata structures for different clients
      let topics = [];
      if (metadata.topics && Array.isArray(metadata.topics)) {
        topics = metadata.topics;
      } else if (metadata && Array.isArray(metadata)) {
        topics = metadata;
      } else {
        console.warn('⚠️  Unexpected metadata structure:', JSON.stringify(metadata, null, 2));
        topics = [];
      }
      
      console.log(`📊 Found ${topics.length} topics in cluster`);
      
      // Debug: Log the first topic structure if available
      if (topics.length > 0) {
        // Handle BigInt serialization for debugging
        const debugTopic = serializeBigInt(topics[0]);
        console.log('🔍 Debug: First topic structure:', JSON.stringify(debugTopic, null, 2));
      }
      
      // Process each topic
      const topicsWithMetadata = await Promise.all(
        topics.map(async (topic) => {
          try {
            const topicName = topic.name;
            
            // Debug: Log topic info
            console.log(`📋 Processing topic: ${topicName} (partitions: ${topic.partitions?.length || 0})`);
            
            // Get topic configurations based on vendor
            let configs = {};
            try {
              if (this.config.vendor === 'confluent-cloud' && this.confluentKafka) {
                // For Confluent Cloud, we might need to handle configs differently
                console.log(`📋 Getting configs for Confluent Cloud topic: ${topicName}`);
                // TODO: Implement Confluent Cloud specific config fetching if needed
              } else {
                configs = await this.getTopicConfigsByVendor(topicName);
              }
            } catch (configError) {
              console.warn(`Warning: Could not fetch configs for topic ${topicName}: ${configError.message}`);
            }

            // Calculate replication factor from partitions
            const replicationFactor = topic.partitions && topic.partitions.length > 0 
              ? topic.partitions[0].replicas?.length || 0
              : 0;

            console.log(`📊 Topic ${topicName}: ${topic.partitions?.length || 0} partitions, ${replicationFactor} replication factor`);

            // Parse topic data based on vendor
            const topicInfo = this.parseTopicDataByVendor(topicName, topic, configs, replicationFactor);
            
            // Handle BigInt serialization for the final result
            const serializedTopicInfo = serializeBigInt(topicInfo);
            
            return serializedTopicInfo;
          } catch (error) {
            console.error(`❌ Error processing topic ${topic.name}:`, error.message);
            return {
              name: topic.name,
              partitions: 0,
              replicationFactor: 0,
              config: {},
              error: error.message,
              vendor: this.config.vendor
            };
          }
        })
      );

      return topicsWithMetadata;
    } catch (error) {
      console.error('❌ Failed to fetch topics:', error.message);
      throw error;
    }
  }

  async getTopicConfigsByVendor(topicName) {
    const vendor = this.config.vendor;
    
    try {
      // Check if admin client supports describeConfigs
      if (!this.admin.describeConfigs) {
        console.warn(`⚠️  Admin client does not support describeConfigs for vendor: ${vendor}`);
        return {};
      }
      
      const configResponse = await this.admin.describeConfigs({
        resources: [{
          type: 2, // Topic resource type
          name: topicName
        }]
      });
      
      if (!configResponse.resources[0] || !configResponse.resources[0].configEntries) {
        return {};
      }

      const configs = configResponse.resources[0].configEntries.reduce((acc, entry) => {
        acc[entry.name] = {
          value: entry.value,
          isDefault: entry.isDefault,
          isSensitive: entry.isSensitive
        };
        return acc;
      }, {});

      // Vendor-specific config processing
      switch (vendor) {
        case 'aws-msk':
          return this.processAwsMskConfigs(configs);
        case 'confluent-cloud':
          return this.processConfluentCloudConfigs(configs);
        case 'aiven':
          return this.processAivenConfigs(configs);
        default:
          return configs;
      }
    } catch (error) {
      throw error;
    }
  }

  parseTopicDataByVendor(topicName, topic, configs, replicationFactor) {
    const vendor = this.config.vendor;
    
    const baseInfo = {
      name: topicName,
      partitions: topic.partitions.length,
      replicationFactor: replicationFactor,
      config: configs,
      isInternal: topicName.startsWith('__'),
      errorCode: topic.errorCode || 0,
      errorMessage: topic.errorCode !== 0 ? 'Topic has errors' : null,
      vendor: vendor
    };

    // Vendor-specific parsing
    switch (vendor) {
      case 'aws-msk':
        return this.parseAwsMskTopic(topicName, topic, baseInfo);
      case 'confluent-cloud':
        return this.parseConfluentCloudTopic(topicName, topic, baseInfo);
      case 'aiven':
        return this.parseAivenTopic(topicName, topic, baseInfo);
      case 'confluent-platform':
        return this.parseConfluentPlatformTopic(topicName, topic, baseInfo);
      case 'redpanda':
        return this.parseRedpandaTopic(topicName, topic, baseInfo);
      default:
        return this.parseApacheTopic(topicName, topic, baseInfo);
    }
  }

  // AWS MSK specific parsing
  parseAwsMskTopic(topicName, topic, baseInfo) {
    return {
      ...baseInfo,
      partitionDetails: topic.partitions.map(partition => ({
        id: partition.partitionId,
        leader: partition.leader,
        replicas: partition.replicas,
        isr: partition.isr || []
      })),
      awsMetadata: {
        region: this.extractRegionFromBrokers(),
        clusterType: 'msk'
      }
    };
  }

  // Confluent Cloud specific parsing
  parseConfluentCloudTopic(topicName, topic, baseInfo) {
    return {
      ...baseInfo,
      partitionDetails: topic.partitions.map(partition => ({
        id: partition.partitionId,
        leader: partition.leader,
        replicas: partition.replicas,
        isr: partition.isr || []
      })),
      confluentMetadata: {
        cloudProvider: 'aws', // or 'gcp', 'azure'
        clusterType: 'cloud'
      }
    };
  }

  // Aiven specific parsing
  parseAivenTopic(topicName, topic, baseInfo) {
    return {
      ...baseInfo,
      partitionDetails: topic.partitions.map(partition => ({
        id: partition.partitionId,
        leader: partition.leader,
        replicas: partition.replicas,
        isr: partition.isr || []
      })),
      aivenMetadata: {
        cloudProvider: 'aws', // or 'gcp', 'azure'
        clusterType: 'managed'
      }
    };
  }

  // Confluent Platform specific parsing
  parseConfluentPlatformTopic(topicName, topic, baseInfo) {
    return {
      ...baseInfo,
      partitionDetails: topic.partitions.map(partition => ({
        id: partition.partitionId,
        leader: partition.leader,
        replicas: partition.replicas,
        isr: partition.isr || []
      }))
    };
  }

  // Redpanda specific parsing
  parseRedpandaTopic(topicName, topic, baseInfo) {
    return {
      ...baseInfo,
      partitionDetails: topic.partitions.map(partition => ({
        id: partition.partitionId,
        leader: partition.leader,
        replicas: partition.replicas,
        isr: partition.isr || []
      }))
    };
  }

  // Apache Kafka specific parsing
  parseApacheTopic(topicName, topic, baseInfo) {
    return {
      ...baseInfo,
      partitionDetails: topic.partitions.map(partition => ({
        id: partition.partitionId,
        leader: partition.leader,
        replicas: partition.replicas,
        isr: partition.isr || []
      }))
    };
  }

  // Vendor-specific config processing
  processAwsMskConfigs(configs) {
    return {
      ...configs,
      retention: {
        bytes: configs['retention.bytes']?.value,
        ms: configs['retention.ms']?.value
      },
      cleanup: {
        policy: configs['cleanup.policy']?.value
      }
    };
  }

  processConfluentCloudConfigs(configs) {
    return {
      ...configs,
      retention: {
        bytes: configs['retention.bytes']?.value,
        ms: configs['retention.ms']?.value
      },
      cleanup: {
        policy: configs['cleanup.policy']?.value
      },
      confluent: {
        valueSchemaCompatibility: configs['confluent.value.schema.compatibility']?.value,
        keySchemaCompatibility: configs['confluent.key.schema.compatibility']?.value
      }
    };
  }

  processAivenConfigs(configs) {
    return {
      ...configs,
      retention: {
        bytes: configs['retention.bytes']?.value,
        ms: configs['retention.ms']?.value
      },
      cleanup: {
        policy: configs['cleanup.policy']?.value
      }
    };
  }

  async getConsumerGroups() {
    try {
      // Check if admin client supports listGroups
      if (!this.admin.listGroups) {
        console.warn(`⚠️  Admin client does not support listGroups for vendor: ${this.config.vendor}`);
        return [];
      }
      
      const groups = await this.admin.listGroups();
      const groupDetails = await Promise.all(
        groups.groups.map(async (group) => {
          try {
            const details = await this.admin.describeGroup(group.groupId);
            return {
              groupId: group.groupId,
              protocolType: details.protocolType,
              members: details.members.length,
              state: details.state
            };
          } catch (error) {
            return {
              groupId: group.groupId,
              protocolType: 'unknown',
              members: 0,
              state: 'error'
            };
          }
        })
      );
      // Handle BigInt serialization for consumer groups
      const serializedGroupDetails = serializeBigInt(groupDetails);
      
      return serializedGroupDetails;
    } catch (error) {
      console.error('❌ Failed to fetch consumer groups:', error.message);
      throw error;
    }
  }

  async getClusterInfo() {
    try {
      // Check if admin client supports describeCluster
      if (!this.admin.describeCluster) {
        console.warn(`⚠️  Admin client does not support describeCluster for vendor: ${this.config.vendor}`);
        return {
          clusterId: 'unknown',
          controller: null,
          brokers: [],
          topics: 0
        };
      }
      
      const metadata = await this.admin.fetchTopicMetadata();
      const clusterInfo = await this.admin.describeCluster();
      
      // Handle different metadata structures
      let topics = [];
      if (metadata.topics && Array.isArray(metadata.topics)) {
        topics = metadata.topics;
      } else if (metadata && Array.isArray(metadata)) {
        topics = metadata;
      }
      
      const clusterData = {
        clusterId: clusterInfo.clusterId || 'unknown',
        controller: clusterInfo.controller,
        brokers: clusterInfo.brokers ? clusterInfo.brokers.map(broker => ({
          nodeId: broker.nodeId,
          host: broker.host,
          port: broker.port,
          rack: broker.rack
        })) : [],
        topics: topics.length
      };
      
      // Handle BigInt serialization for cluster info
      const serializedClusterData = serializeBigInt(clusterData);
      
      return serializedClusterData;
    } catch (error) {
      console.error('❌ Failed to fetch cluster info:', error.message);
      throw error;
    }
  }

  async buildSslConfig() {
    const sslConfig = {
      rejectUnauthorized: this.config.ssl?.rejectUnauthorized !== false
    };

    // Load certificate files if provided
    if (this.config.ssl?.ca) {
      try {
        sslConfig.ca = await fs.readFile(this.config.ssl.ca);
      } catch (error) {
        throw new Error(`Failed to read CA certificate file: ${error.message}`);
      }
    }

    if (this.config.ssl?.cert) {
      try {
        sslConfig.cert = await fs.readFile(this.config.ssl.cert);
      } catch (error) {
        throw new Error(`Failed to read client certificate file: ${error.message}`);
      }
    }

    if (this.config.ssl?.key) {
      try {
        sslConfig.key = await fs.readFile(this.config.ssl.key);
      } catch (error) {
        throw new Error(`Failed to read client private key file: ${error.message}`);
      }
    }

    return sslConfig;
  }

  async getTopicInformation() {
    if (!this.connected) {
      throw new Error('Not connected to Kafka cluster');
    }

    try {
      // Get cluster metadata
      const metadata = await this.admin.fetchTopicMetadata();
      console.log(chalk.gray(`Debug: Metadata structure:`, JSON.stringify(metadata, null, 2)));
      
      // Get topic list
      const topics = await this.admin.listTopics();
      
      // Get detailed topic information
      const topicDetails = await this.getDetailedTopicInfo(topics);
      
      // Get cluster information
      const clusterInfo = await this.getClusterInfo(metadata);
      
      // Build comprehensive topic information
      const topicInfo = {
        clusterInfo,
        topics: topicDetails,
        summary: this.buildSummary(topicDetails)
      };

      return topicInfo;

    } catch (error) {
      throw new Error(`Failed to retrieve topic information: ${error.message}`);
    }
  }

  async getDetailedTopicInfo(topicNames) {
    const topicDetails = [];

    for (const topicName of topicNames) {
      try {
        // Get topic metadata
        const topicMetadata = await this.admin.fetchTopicMetadata({ topics: [topicName] });
        const topic = topicMetadata.topics[0];

        if (!topic) {
          continue;
        }

        // Get topic configurations
        const configs = await this.getTopicConfigs(topicName);

        // Build topic information
        const topicInfo = {
          name: topicName,
          partitions: topic.partitions.map(partition => ({
            id: partition.partitionId,
            leader: partition.leader,
            replicas: partition.replicas,
            isr: partition.isr,
            offlineReplicas: partition.offlineReplicas || []
          })),
          configs: configs,
          isInternal: topicName.startsWith('__'),
          errorCode: topic.errorCode || 0
        };

        topicDetails.push(topicInfo);

      } catch (error) {
        // Log error but continue with other topics
        console.warn(`Warning: Failed to get details for topic ${topicName}: ${error.message}`);
        
        // Add basic topic info even if detailed info fails
        topicDetails.push({
          name: topicName,
          partitions: [],
          configs: {},
          isInternal: topicName.startsWith('__'),
          errorCode: -1,
          error: error.message
        });
      }
    }

    return topicDetails;
  }

  async getTopicConfigs(topicName) {
    try {
      const configs = await this.admin.describeConfigs({
        resources: [{
          type: 2, // Topic resource type
          name: topicName
        }]
      });

      const topicConfigs = {};
      
      if (configs.resources[0] && configs.resources[0].configEntries) {
        configs.resources[0].configEntries.forEach(config => {
          topicConfigs[config.name] = {
            value: config.value,
            source: config.source,
            isDefault: config.isDefault,
            isSensitive: config.isSensitive
          };
        });
      }

      return topicConfigs;

    } catch (error) {
      // Return empty configs if we can't retrieve them
      console.warn(`Warning: Failed to get configs for topic ${topicName}: ${error.message}`);
      return {};
    }
  }

  async getTopicOffsets(topicName) {
    if (!this.connected) {
      throw new Error('Not connected to Kafka cluster');
    }

    try {
      const offsets = await this.admin.fetchTopicOffsets(topicName);
      return offsets.map(offset => ({
        partition: offset.partition,
        offset: offset.offset,
        high: offset.high,
        low: offset.low
      }));
    } catch (error) {
      throw new Error(`Failed to get offsets for topic ${topicName}: ${error.message}`);
    }
  }

  async getClusterMetrics() {
    if (!this.connected) {
      throw new Error('Not connected to Kafka cluster');
    }

    try {
      const metadata = await this.admin.fetchTopicMetadata();
      
      const metrics = {
        totalBrokers: metadata.brokers.length,
        totalTopics: metadata.topics.length,
        totalPartitions: metadata.topics.reduce((sum, topic) => sum + topic.partitions.length, 0),
        timestamp: new Date().toISOString()
      };

      return metrics;
    } catch (error) {
      throw new Error(`Failed to get cluster metrics: ${error.message}`);
    }
  }

  isConnected() {
    return this.connected;
  }

  getConfig() {
    return {
      brokers: this.config.brokers,
      security: this.config.security,
      timeout: this.config.timeout
    };
  }
}

module.exports = { KafkaClient };