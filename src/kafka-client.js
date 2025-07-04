const { Kafka } = require('kafkajs');
const fs = require('fs').promises;
const chalk = require('chalk');
const crypto = require('crypto');
const { generateAuthToken } = require('aws-msk-iam-sasl-signer-js');

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
            // Confluent Cloud uses SASL_SSL with PLAIN mechanism
            kafkaConfig.ssl = true;
            kafkaConfig.sasl = {
              mechanism: 'plain', // Confluent Cloud typically uses PLAIN
              username: this.config.sasl.username,
              password: this.config.sasl.password
            };
            break;

          case 'aiven':
            // Aiven uses SASL_SSL with SCRAM-SHA-256
            kafkaConfig.ssl = await this.buildSslConfig();
            kafkaConfig.sasl = {
              mechanism: 'scram-sha-256', // Aiven typically uses SCRAM-SHA-256
              username: this.config.sasl.username,
              password: this.config.sasl.password
            };
            break;

          case 'confluent-platform':
            // Confluent Platform can use various mechanisms
            kafkaConfig.ssl = true; // Usually requires SSL
            kafkaConfig.sasl = {
              mechanism: mechanism,
              username: this.config.sasl.username,
              password: this.config.sasl.password
            };
            break;

          case 'redpanda':
            // Redpanda can use various mechanisms, SSL depends on configuration
            if (this.config.ssl !== false) {
              kafkaConfig.ssl = true; // Default to SSL for Redpanda
            }
            kafkaConfig.sasl = {
              mechanism: mechanism,
              username: this.config.sasl.username,
              password: this.config.sasl.password
            };
            break;

          case 'apache':
          default:
            // Apache Kafka - SSL depends on configuration
            if (this.config.ssl !== false) {
              kafkaConfig.ssl = true; // Default to SSL for security
            }
            kafkaConfig.sasl = {
              mechanism: mechanism,
              username: this.config.sasl.username,
              password: this.config.sasl.password
            };
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
  }

  async getTopics() {
    try {
      // Get all topic metadata at once
      const metadata = await this.admin.fetchTopicMetadata();
      console.log(`📊 Found ${metadata.topics.length} topics in cluster`);
      
      // Debug: Log the first topic structure if available
      if (metadata.topics.length > 0) {
        console.log('🔍 Debug: First topic structure:', JSON.stringify(metadata.topics[0], null, 2));
      }
      
      // Process each topic
      const topicsWithMetadata = await Promise.all(
        metadata.topics.map(async (topic) => {
          try {
            const topicName = topic.name;
            
            // Debug: Log topic info
            console.log(`📋 Processing topic: ${topicName} (partitions: ${topic.partitions?.length || 0})`);
            
            // Get topic configurations based on vendor
            let configs = {};
            try {
              configs = await this.getTopicConfigsByVendor(topicName);
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
            return topicInfo;
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
      return groupDetails;
    } catch (error) {
      console.error('❌ Failed to fetch consumer groups:', error.message);
      throw error;
    }
  }

  async getClusterInfo() {
    try {
      const metadata = await this.admin.fetchTopicMetadata();
      const clusterInfo = await this.admin.describeCluster();
      
      return {
        clusterId: clusterInfo.clusterId,
        controller: clusterInfo.controller,
        brokers: clusterInfo.brokers.map(broker => ({
          nodeId: broker.nodeId,
          host: broker.host,
          port: broker.port,
          rack: broker.rack
        })),
        topics: metadata.topics.length
      };
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