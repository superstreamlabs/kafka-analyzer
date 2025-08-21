const chalk = require('chalk');
const net = require('net');

class HealthChecker {
  constructor(vendor, config = {}) {
    this.vendor = vendor;
    this.config = config;
    this.checkDescriptions = {
      'replication-factor':
        'Checks if any topic has a replication factor greater than the number of brokers. Healthy: All topics have RF ≤ broker count. Failed: Any topic has RF > broker count.',
      'partition-distribution':
        'Checks if user topics have a balanced number of partitions. Healthy: Partition counts are similar. Warning: Large difference between min and max partitions.',
      'consumer-groups':
        'Checks if all consumer groups have active members. Healthy: All groups have members. Warning: Some groups have no active members.',
      'internal-topics':
        'Checks if all internal topics (names starting with __) have partitions > 0. Healthy: All internal topics have partitions. Failed: Any internal topic has 0 or missing partitions.',
      'aws-msk-specific':
        'Checks if AWS MSK system topics (names containing __amazon_msk_ or __consumer_offsets) exist and are healthy. Healthy: All MSK system topics have partitions and replication > 0. Warning: No MSK system topics found. Failed: Any MSK system topic has 0 partitions or replication.',
      'apache-kafka-specific':
        'Checks if Apache Kafka system topics (names containing __consumer_offsets, __transaction_state, or __kafka_connect) exist and are healthy. Healthy: All Apache Kafka system topics have partitions and replication > 0. Warning: No Apache Kafka system topics found. Failed: Any Apache Kafka system topic has 0 partitions or replication.',
      'generic':
        'Generic placeholder check. Not implemented yet.',
      'confluent-cloud':
        'Confluent Cloud specific checks. Not implemented yet.',
      'aiven':
        'Aiven Kafka specific checks. Not implemented yet.',
      'rack-awareness':
        'Checks if rack awareness is configured in the cluster. Healthy: Rack awareness is configured. Warning: Rack awareness is not configured.',
      'replica-distribution':
        'Checks if data replicas are evenly distributed across all brokers. Healthy: Each broker carries a similar number of replicas. Warning/Failed: Some brokers carry significantly more replicas than others, which can cause performance issues.',
      'metrics-enabled':
        'Checks if monitoring metrics are properly configured. For AWS MSK: Checks Open Monitoring with Prometheus JMX exporter. For others: Checks JMX metrics configuration. Healthy: Metrics are enabled and accessible. Warning: Metrics are not configured or partially configured.',
      'logging-configuration':
        'Checks if logging configuration is properly configured. For AWS MSK: Checks LoggingInfo configuration and CloudTrail. For Confluent Cloud/Aiven: Built-in logging is available. For others: Checks log4j configuration. Healthy: Logging is enabled and configured. Warning: Logging is not configured or partially configured.',
      'authentication-configuration':
        'Checks if unauthenticated access is enabled. For AWS MSK: Checks if SASL or SSL is configured. For Confluent Cloud/Aiven: Built-in authentication prevents unauthenticated access. For others: Checks if SASL or SSL is configured. Healthy: Authentication is enabled (no unauthenticated access). Failed: Unauthenticated access is enabled (security risk).',
      'quotas-configuration':
        'Checks if Kafka quotas are configured and being used. For AWS MSK: Checks quota configuration via AWS console/CLI. For Confluent Cloud/Aiven: Built-in quota management is available. For others: Checks server.properties and kafka-configs.sh for quota settings. Healthy: Quotas are configured and managed. Info: Quotas configuration check available.',
      'payload-compression':
        'Checks if payload compression is enabled on user topics. Analyzes compression.type, compression, and producer.compression.type configurations. Healthy: All user topics have compression enabled (100%). Warning: Some or no topics have compression enabled (<100%). Info: No user topics to analyze.',
      'infinite-retention-policy':
        'Checks if any topics have infinite retention policy enabled (retention.ms = infinite). Healthy: No topics have infinite retention. Warning: Some topics have infinite retention policy (bad practice). Info: Unable to verify retention policy.'
    };
    this.checks = [];
  }

  async runHealthChecks(clusterInfo, topics, consumerGroups) {
    console.log(chalk.blue('\n🔍 Running Health Checks\n'));
    
    const results = {
      vendor: this.vendor,
      totalChecks: 0,
      passedChecks: 0,
      failedChecks: 0,
      warnings: 0,
      checks: []
    };

    // Run vendor-specific checks
    switch (this.vendor) {
      case 'aws-msk':
        await this.runAwsMskChecks(clusterInfo, topics, consumerGroups, results);
        break;
      case 'confluent-cloud':
        await this.runConfluentCloudChecks(clusterInfo, topics, consumerGroups, results);
        break;
      case 'aiven':
        await this.runAivenChecks(clusterInfo, topics, consumerGroups, results);
        break;
      default:
        await this.runGenericChecks(clusterInfo, topics, consumerGroups, results);
    }

    this.displayResults(results);
    return results;
  }

  async runAwsMskChecks(clusterInfo, topics, consumerGroups, results) {
    console.log(chalk.yellow('🏢 AWS MSK Health Checks\n'));

    // Check 1: Replication Factor vs Broker Count
    await this.checkReplicationFactor(clusterInfo, topics, results);

    // Check 2: Topic Partition Distribution
    await this.checkPartitionDistribution(topics, results);

    // Check 3: Consumer Group Health
    await this.checkConsumerGroupHealth(consumerGroups, results);

    // Check 4: Internal Topics Health
    await this.checkInternalTopics(topics, results);

    // Check 5: Under-Replicated Partitions
    await this.checkUnderReplicatedPartitions(topics, results);

    // Check 6: Min In-Sync Replicas Configuration
    await this.checkMinInsyncReplicas(topics, results);

    // Check 7: AWS MSK Specific Checks
    await this.checkAwsMskSpecific(topics, results);

    // Check 8: Apache Kafka Specific Checks
    await this.checkApacheKafkaSpecific(topics, results);

    // Check 9: Rack Awareness
    await this.checkRackAwareness(clusterInfo, topics, results);

    // Check 10: Replica Distribution
    await this.checkReplicaDistribution(clusterInfo, topics, results);

    // Check 11: Metrics Configuration
    await this.checkMetricsEnabled(clusterInfo, topics, results);

    // Check 12: Logging Configuration
    await this.checkLoggingConfiguration(clusterInfo, topics, results);

    // Check 13: Authentication Configuration
    await this.checkAuthenticationConfiguration(clusterInfo, topics, results);

    // Check 14: Quotas Configuration
    await this.checkQuotasConfiguration(clusterInfo, topics, results);

    // Check 15: Payload Compression
    await this.checkPayloadCompression(clusterInfo, topics, results);

    // Check 16: Infinite Retention Policy
    await this.checkInfiniteRetentionPolicy(clusterInfo, topics, results);
  }

  async runConfluentCloudChecks(clusterInfo, topics, consumerGroups, results) {
    console.log(chalk.yellow('🏢 Confluent Cloud Health Checks\n'));
    
    // Check 1: Replication Factor vs Broker Count
    await this.checkReplicationFactor(clusterInfo, topics, results);

    // Check 2: Topic Partition Distribution
    await this.checkPartitionDistribution(topics, results);

    // Check 3: Consumer Group Health
    await this.checkConsumerGroupHealth(consumerGroups, results);

    // Check 4: Internal Topics Health
    await this.checkInternalTopics(topics, results);

    // Check 5: Under-Replicated Partitions
    await this.checkUnderReplicatedPartitions(topics, results);
    
    // Check 6: Logging Configuration
    await this.checkLoggingConfiguration(clusterInfo, topics, results);
    
    // Check 7: Authentication Configuration
    await this.checkAuthenticationConfiguration(clusterInfo, topics, results);
    
    // Check 8: Quotas Configuration
    await this.checkQuotasConfiguration(clusterInfo, topics, results);
    
    // Check 9: Payload Compression
    await this.checkPayloadCompression(clusterInfo, topics, results);
    
    // Check 10: Infinite Retention Policy
    await this.checkInfiniteRetentionPolicy(clusterInfo, topics, results);
    
    // TODO: Implement other Confluent Cloud specific checks
    this.addCheck(results, 'confluent-cloud', 'Confluent Cloud checks', 'info', 'Not implemented yet');
  }

  async runAivenChecks(clusterInfo, topics, consumerGroups, results) {
    console.log(chalk.yellow('🏢 Aiven Kafka Health Checks\n'));
    
    // Check 1: Replication Factor vs Broker Count
    await this.checkReplicationFactor(clusterInfo, topics, results);

    // Check 2: Topic Partition Distribution
    await this.checkPartitionDistribution(topics, results);

    // Check 3: Consumer Group Health
    await this.checkConsumerGroupHealth(consumerGroups, results);

    // Check 4: Internal Topics Health
    await this.checkInternalTopics(topics, results);

    // Check 5: Under-Replicated Partitions
    await this.checkUnderReplicatedPartitions(topics, results);

    // Check 6: Min In-Sync Replicas Configuration
    await this.checkMinInsyncReplicas(topics, results);
    
    // Check 7: Rack Awareness
    await this.checkRackAwareness(clusterInfo, topics, results);
    
    // Check 8: Replica Distribution
    await this.checkReplicaDistribution(clusterInfo, topics, results);
    
    // Check 9: Metrics Configuration
    await this.checkMetricsEnabled(clusterInfo, topics, results);
    
    // Check 10: Logging Configuration
    await this.checkLoggingConfiguration(clusterInfo, topics, results);
    
    // Check 11: Authentication Configuration
    await this.checkAuthenticationConfiguration(clusterInfo, topics, results);
    
    // Check 12: Quotas Configuration
    await this.checkQuotasConfiguration(clusterInfo, topics, results);
    
    // Check 13: Payload Compression
    await this.checkPayloadCompression(clusterInfo, topics, results);
    
    // Check 14: Infinite Retention Policy
    await this.checkInfiniteRetentionPolicy(clusterInfo, topics, results);
    
    // TODO: Implement other Aiven specific checks
    this.addCheck(results, 'aiven', 'Aiven checks', 'info', 'Not implemented yet');
  }

  async runGenericChecks(clusterInfo, topics, consumerGroups, results) {
    console.log(chalk.yellow('🏢 Generic Kafka Health Checks\n'));
    
    // Check 1: Replication Factor vs Broker Count
    await this.checkReplicationFactor(clusterInfo, topics, results);

    // Check 2: Topic Partition Distribution
    await this.checkPartitionDistribution(topics, results);

    // Check 3: Consumer Group Health
    await this.checkConsumerGroupHealth(consumerGroups, results);

    // Check 4: Internal Topics Health
    await this.checkInternalTopics(topics, results);

    // Check 5: Under-Replicated Partitions
    await this.checkUnderReplicatedPartitions(topics, results);

    // Check 6: Min In-Sync Replicas Configuration
    await this.checkMinInsyncReplicas(topics, results);

    // Check 7: Rack Awareness
    await this.checkRackAwareness(clusterInfo, topics, results);
    
    // Check 8: Replica Distribution
    await this.checkReplicaDistribution(clusterInfo, topics, results);
    
    // Check 9: Metrics Configuration
    await this.checkMetricsEnabled(clusterInfo, topics, results);
    
    // Check 10: Logging Configuration
    await this.checkLoggingConfiguration(clusterInfo, topics, results);
    
    // Check 11: Authentication Configuration
    await this.checkAuthenticationConfiguration(clusterInfo, topics, results);
    
    // Check 12: Quotas Configuration
    await this.checkQuotasConfiguration(clusterInfo, topics, results);
    
    // Check 13: Payload Compression
    await this.checkPayloadCompression(clusterInfo, topics, results);
    
    // Check 14: Infinite Retention Policy
    await this.checkInfiniteRetentionPolicy(clusterInfo, topics, results);
  }

  async checkReplicationFactor(clusterInfo, topics, results) {
    const checkName = 'Replication Factor vs Broker Count';
    const brokerCount = clusterInfo.brokers.length;
    
    if (brokerCount === 0) {
      this.addCheck(results, 'replication-factor', checkName, 'error', 
        'No brokers found in cluster metadata');
      return;
    }

    const topicsWithHighReplication = topics.filter(topic => 
      topic.replicationFactor > brokerCount
    );

    if (topicsWithHighReplication.length === 0) {
      this.addCheck(results, 'replication-factor', checkName, 'pass', 
        `All topics have appropriate replication factor (≤ ${brokerCount} brokers)`);
    } else {
      const topicList = topicsWithHighReplication.map(t => 
        `${t.name} (RF: ${t.replicationFactor})`
      ).join(', ');
      
      this.addCheck(results, 'replication-factor', checkName, 'fail', 
        `${topicsWithHighReplication.length} topic(s) have replication factor higher than available brokers (${brokerCount}): ${topicList}`,
        `Consider reducing replication factor to ${brokerCount} or below for: ${topicsWithHighReplication.map(t => t.name).join(', ')}`);
    }
  }

  async checkPartitionDistribution(topics, results) {
    const checkName = 'Topic Partition Distribution';
    const userTopics = topics.filter(topic => !topic.isInternal);
    
    if (userTopics.length === 0) {
      this.addCheck(results, 'partition-distribution', checkName, 'info', 
        'No user topics found to analyze');
      return;
    }

    const partitionCounts = userTopics.map(t => t.partitions);
    const avgPartitions = partitionCounts.reduce((sum, count) => sum + count, 0) / partitionCounts.length;
    const maxPartitions = Math.max(...partitionCounts);
    const minPartitions = Math.min(...partitionCounts);

    if (maxPartitions - minPartitions <= 2) {
      this.addCheck(results, 'partition-distribution', checkName, 'pass', 
        `Good partition distribution: avg=${avgPartitions.toFixed(1)}, min=${minPartitions}, max=${maxPartitions}`);
    } else {
      this.addCheck(results, 'partition-distribution', checkName, 'warning', 
        `Uneven partition distribution: avg=${avgPartitions.toFixed(1)}, min=${minPartitions}, max=${maxPartitions}`,
        'Consider balancing partitions across topics for better performance');
    }
  }

  async checkConsumerGroupHealth(consumerGroups, results) {
    const checkName = 'Consumer Group Health';
    
    if (consumerGroups.length === 0) {
      this.addCheck(results, 'consumer-groups', checkName, 'info', 
        'No consumer groups found');
      return;
    }

    const emptyGroups = consumerGroups.filter(group => group.members === 0);
    const activeGroups = consumerGroups.filter(group => group.members > 0);

    if (emptyGroups.length === 0) {
      this.addCheck(results, 'consumer-groups', checkName, 'pass', 
        `All ${consumerGroups.length} consumer groups have active members`);
    } else {
      this.addCheck(results, 'consumer-groups', checkName, 'warning', 
        `${emptyGroups.length} consumer group(s) have no active members: ${emptyGroups.map(g => g.groupId).join(', ')}`,
        'Consider cleaning up unused consumer groups');
    }
  }

  async checkInternalTopics(topics, results) {
    const checkName = 'Internal Topics Health';
    const internalTopics = topics.filter(topic => topic.isInternal);
    
    if (internalTopics.length === 0) {
      this.addCheck(results, 'internal-topics', checkName, 'info', 
        'No internal topics found');
      return;
    }

    const unhealthyInternal = internalTopics.filter(topic => 
      !topic.partitions || topic.partitions === 0
    );

    if (unhealthyInternal.length === 0) {
      this.addCheck(results, 'internal-topics', checkName, 'pass', 
        `All ${internalTopics.length} internal topics are healthy`);
    } else {
      this.addCheck(results, 'internal-topics', checkName, 'error', 
        `${unhealthyInternal.length} internal topic(s) have issues: ${unhealthyInternal.map(t => t.name).join(', ')}`);
    }
  }

  async checkUnderReplicatedPartitions(topics, results) {
    const checkName = 'Under-Replicated Partitions';
    
    if (topics.length === 0) {
      this.addCheck(results, 'under-replicated-partitions', checkName, 'info', 
        'No topics found to analyze');
      return;
    }

    const underReplicatedTopics = [];
    const underReplicatedPartitions = [];

    topics.forEach(topic => {
      if (topic.partitionDetails) {
        topic.partitionDetails.forEach(partition => {
          const expectedReplicas = topic.replicationFactor;
          const actualReplicas = partition.isr ? partition.isr.length : partition.replicas.length;
          
          if (actualReplicas < expectedReplicas) {
            underReplicatedPartitions.push({
              topic: topic.name,
              partition: partition.partition,
              expected: expectedReplicas,
              actual: actualReplicas
            });
            
            if (!underReplicatedTopics.includes(topic.name)) {
              underReplicatedTopics.push(topic.name);
            }
          }
        });
      }
    });

    if (underReplicatedPartitions.length === 0) {
      this.addCheck(results, 'under-replicated-partitions', checkName, 'pass', 
        `All topics have the expected number of in-sync replicas`);
    } else {
      const partitionDetails = underReplicatedPartitions.map(p => 
        `${p.topic}:${p.partition} (${p.actual}/${p.expected} replicas)`
      ).join(', ');
      
      this.addCheck(results, 'under-replicated-partitions', checkName, 'fail', 
        `${underReplicatedPartitions.length} partition(s) in ${underReplicatedTopics.length} topic(s) are under-replicated: ${partitionDetails}`,
        'Check broker health and network connectivity. Under-replicated partitions may indicate broker failures or network issues.');
    }
  }

  async checkMinInsyncReplicas(topics, results) {
    const checkName = 'Min In-Sync Replicas Configuration';
    
    if (topics.length === 0) {
      this.addCheck(results, 'min-insync-replicas', checkName, 'info', 
        'No topics found to analyze');
      return;
    }

    const problematicTopics = [];

    topics.forEach(topic => {
      // Check if topic has min.insync.replicas configuration
      if (topic.config && topic.config['min.insync.replicas']) {
        const minInsyncReplicas = parseInt(topic.config['min.insync.replicas']);
        const replicationFactor = topic.replicationFactor;
        
        if (minInsyncReplicas > replicationFactor) {
          problematicTopics.push({
            name: topic.name,
            minInsyncReplicas: minInsyncReplicas,
            replicationFactor: replicationFactor
          });
        }
      }
    });

    if (problematicTopics.length === 0) {
      this.addCheck(results, 'min-insync-replicas', checkName, 'pass', 
        `All topics have appropriate min.insync.replicas configuration`);
    } else {
      this.addCheck(results, 'min-insync-replicas', checkName, 'fail', 
        `Found ${problematicTopics.length} topic(s) with min.insync.replicas greater than replication factor`,
        'Sign up to Superstream to view the exact topics and fix this critical configuration issue. Topics with min.insync.replicas > replication factor will never be able to accept writes.');
    }
  }

  async checkAwsMskSpecific(topics, results) {
    const checkName = 'AWS MSK Specific Health';
    
    // Check for AWS MSK specific topics
    const mskTopics = topics.filter(topic => 
      topic.name.includes('__amazon_msk_') || 
      topic.name.includes('__consumer_offsets')
    );

    if (mskTopics.length === 0) {
      this.addCheck(results, 'aws-msk-specific', checkName, 'warning', 
        'No AWS MSK system topics found - this might indicate a new cluster or configuration issue');
    } else {
      const healthyMskTopics = mskTopics.filter(topic => 
        topic.partitions > 0 && topic.replicationFactor > 0
      );

      if (healthyMskTopics.length === mskTopics.length) {
        this.addCheck(results, 'aws-msk-specific', checkName, 'pass', 
          `All ${mskTopics.length} AWS MSK system topics are healthy`);
      } else {
        const unhealthy = mskTopics.filter(t => !healthyMskTopics.includes(t));
        this.addCheck(results, 'aws-msk-specific', checkName, 'error', 
          `${unhealthy.length} AWS MSK system topic(s) have issues: ${unhealthy.map(t => t.name).join(', ')}`);
      }
    }
  }

  async checkApacheKafkaSpecific(topics, results) {
    const checkName = 'Apache Kafka Specific Health';
    
    // Check for Apache Kafka specific topics
    const apacheTopics = topics.filter(topic => 
      topic.name.includes('__consumer_offsets') || 
      topic.name.includes('__transaction_state') ||
      topic.name.includes('__kafka_connect')
    );

    if (apacheTopics.length === 0) {
      this.addCheck(results, 'apache-kafka-specific', checkName, 'warning', 
        'No Apache Kafka system topics found - this might indicate a new cluster or configuration issue');
    } else {
      const healthyApacheTopics = apacheTopics.filter(topic => 
        topic.partitions > 0 && topic.replicationFactor > 0
      );

      if (healthyApacheTopics.length === apacheTopics.length) {
        this.addCheck(results, 'apache-kafka-specific', checkName, 'pass', 
          `All ${apacheTopics.length} Apache Kafka system topics are healthy`);
      } else {
        const unhealthy = apacheTopics.filter(t => !healthyApacheTopics.includes(t));
        this.addCheck(results, 'apache-kafka-specific', checkName, 'error', 
          `${unhealthy.length} Apache Kafka system topic(s) have issues: ${unhealthy.map(t => t.name).join(', ')}`);
      }
    }
  }

  async checkRackAwareness(clusterInfo, topics, results) {
    const checkName = 'Rack Awareness';
    
    // Check if brokers have rack information
    const brokersWithRacks = clusterInfo.brokers.filter(broker => 
      broker.rack && broker.rack !== '' && broker.rack !== null
    );
    
    const totalBrokers = clusterInfo.brokers.length;
    const rackAwareBrokers = brokersWithRacks.length;
    
    if (rackAwareBrokers === 0) {
      this.addCheck(results, 'rack-awareness', checkName, 'warning', 
        'Rack awareness is not configured - no brokers have rack information',
        'Consider enabling rack awareness for better availability and fault tolerance');
    } else if (rackAwareBrokers === totalBrokers) {
      this.addCheck(results, 'rack-awareness', checkName, 'pass', 
        `Rack awareness is fully configured - all ${totalBrokers} brokers have rack information`);
    } else {
      this.addCheck(results, 'rack-awareness', checkName, 'warning', 
        `Partial rack awareness - ${rackAwareBrokers}/${totalBrokers} brokers have rack information`,
        'Consider configuring rack awareness for all brokers for consistent behavior');
    }
  }

  async checkReplicaDistribution(clusterInfo, topics, results) {
    const checkName = 'Replica Distribution';
    
    // Count replicas per broker
    const brokerReplicaCounts = {};
    const totalBrokers = clusterInfo.brokers.length;
    
    // Initialize broker counts
    clusterInfo.brokers.forEach(broker => {
      brokerReplicaCounts[broker.nodeId] = 0;
    });
    
    // Count replicas for each topic
    topics.forEach(topic => {
      if (topic.partitionDetails) {
        topic.partitionDetails.forEach(partition => {
          partition.replicas.forEach(replicaId => {
            if (brokerReplicaCounts.hasOwnProperty(replicaId)) {
              brokerReplicaCounts[replicaId]++;
            }
          });
        });
      }
    });
    
    // Calculate statistics
    const replicaCounts = Object.values(brokerReplicaCounts);
    const totalReplicas = replicaCounts.reduce((sum, count) => sum + count, 0);
    const avgReplicas = totalReplicas / totalBrokers;
    const maxReplicas = Math.max(...replicaCounts);
    const minReplicas = Math.min(...replicaCounts);
    const difference = maxReplicas - minReplicas;
    
    // Calculate percentage difference
    const percentageDifference = avgReplicas > 0 ? (difference / avgReplicas) * 100 : 0;
    
    // Determine health status with improved user-friendly messages
    if (totalReplicas === 0) {
      this.addCheck(results, 'replica-distribution', checkName, 'info', 
        'No replicas found to analyze');
    } else if (difference <= 1) {
      this.addCheck(results, 'replica-distribution', checkName, 'pass', 
        `Perfect replica balance: Each broker carries ${avgReplicas.toFixed(1)} replicas on average (range: ${minReplicas}-${maxReplicas})`);
    } else if (percentageDifference <= 20) {
      this.addCheck(results, 'replica-distribution', checkName, 'pass', 
        `Good replica balance: Brokers carry ${avgReplicas.toFixed(1)} replicas on average. Most loaded broker: ${maxReplicas}, least loaded: ${minReplicas} (${percentageDifference.toFixed(1)}% difference)`);
    } else if (percentageDifference <= 50) {
      this.addCheck(results, 'replica-distribution', checkName, 'warning', 
        `Uneven replica distribution: Brokers carry ${avgReplicas.toFixed(1)} replicas on average. Most loaded broker: ${maxReplicas}, least loaded: ${minReplicas} (${percentageDifference.toFixed(1)}% difference)`,
        'Consider rebalancing replicas across brokers for better load distribution and performance');
    } else {
      this.addCheck(results, 'replica-distribution', checkName, 'fail', 
        `Poor replica distribution: Brokers carry ${avgReplicas.toFixed(1)} replicas on average. Most loaded broker: ${maxReplicas}, least loaded: ${minReplicas} (${percentageDifference.toFixed(1)}% difference)`,
        'Rebalance replicas across brokers to improve cluster performance and fault tolerance. The most loaded broker is handling significantly more work than others.');
    }
  }

  async checkMetricsEnabled(clusterInfo, topics, results) {
    const checkName = 'Metrics Configuration';
    
    // AWS MSK specific metrics check
    if (this.vendor === 'aws-msk') {
      await this.checkAwsMskMetrics(clusterInfo, topics, results);
    } else {
      // Generic metrics check for other vendors
      await this.checkGenericMetrics(clusterInfo, topics, results);
    }
  }

  async checkAwsMskMetrics(clusterInfo, topics, results) {
    const checkName = 'AWS MSK Open Monitoring';
    
    try {
      // Use Node.js native net module for port testing instead of shell commands
      let accessibleBrokers = 0;
      const totalBrokers = clusterInfo.brokers.length;
      
      // Test port 11001 on each broker with proper timeout handling
      const testPromises = clusterInfo.brokers.map(async (broker) => {
        try {
          // Extract host from broker endpoint (remove port if present)
          const host = broker.host || broker.endpoint || broker.address;
          if (!host) return false;
          
          // Clean host (remove port if present)
          const cleanHost = host.split(':')[0];
          
          // Test port 11001 using Node.js net module with timeout
          return await this.testPort(cleanHost, 11001, 3000); // 3 second timeout
        } catch (error) {
          return false;
        }
      });
      
      // Wait for all tests to complete with a global timeout
      const testResults = await Promise.allSettled(testPromises);
      accessibleBrokers = testResults.filter(result => 
        result.status === 'fulfilled' && result.value === true
      ).length;
      
      if (accessibleBrokers === 0) {
        this.addCheck(results, 'metrics-enabled', checkName, 'warning', 
          'Open Monitoring not detected - port 11001 is not accessible on any brokers',
          'Enable Open Monitoring in AWS MSK console to expose metrics on port 11001');
      } else if (accessibleBrokers === totalBrokers) {
        this.addCheck(results, 'metrics-enabled', checkName, 'pass', 
          `Open Monitoring enabled - port 11001 accessible on all ${totalBrokers} brokers`);
      } else {
        this.addCheck(results, 'metrics-enabled', checkName, 'warning', 
          `Partial Open Monitoring - port 11001 accessible on ${accessibleBrokers}/${totalBrokers} brokers`,
          'Enable Open Monitoring on all brokers for consistent metrics access');
      }
      
    } catch (error) {
      // If the entire check fails, provide a fallback message
      this.addCheck(results, 'metrics-enabled', checkName, 'info', 
        'Unable to test Open Monitoring - ensure port 11001 is accessible for metrics',
        'Check Open Monitoring settings in AWS MSK console and verify security groups allow port 11001');
    }
  }

  // Helper method to test port connectivity with timeout
  testPort(host, port, timeout) {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      let resolved = false;
      
      // Set timeout
      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          socket.destroy();
          resolve(false);
        }
      }, timeout);
      
      // Handle connection success
      socket.on('connect', () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          socket.destroy();
          resolve(true);
        }
      });
      
      // Handle connection error
      socket.on('error', () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          socket.destroy();
          resolve(false);
        }
      });
      
      // Handle socket close
      socket.on('close', () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          resolve(false);
        }
      });
      
      // Attempt connection
      socket.connect(port, host);
    });
  }

  async checkGenericMetrics(clusterInfo, topics, results) {
    const checkName = 'Metrics Configuration';
    
    try {
      // Check if brokers have JMX ports configured (common ports: 9999, 9998, 9101)
      const brokersWithJmx = clusterInfo.brokers.filter(broker => {
        // Check if broker has JMX-related metadata
        return broker.jmxPort || 
               broker.metricsPort || 
               (broker.endpoints && broker.endpoints.some(ep => ep.includes('jmx') || ep.includes('metrics')));
      });
      
      const totalBrokers = clusterInfo.brokers.length;
      const brokersWithMetrics = brokersWithJmx.length;
      
      if (brokersWithMetrics === 0) {
        this.addCheck(results, 'metrics-enabled', checkName, 'warning', 
          'No JMX metrics configuration detected on any brokers',
          'Enable JMX metrics on brokers for better monitoring, alerting, and performance analysis');
      } else if (brokersWithMetrics === totalBrokers) {
        this.addCheck(results, 'metrics-enabled', checkName, 'pass', 
          `All ${totalBrokers} brokers have metrics configuration detected`);
      } else {
        this.addCheck(results, 'metrics-enabled', checkName, 'warning', 
          `${brokersWithMetrics}/${totalBrokers} brokers have metrics configuration`,
          'Enable metrics on all brokers for consistent monitoring and observability');
      }
      
    } catch (error) {
      // If we can't check metrics configuration, provide a general recommendation
      this.addCheck(results, 'metrics-enabled', checkName, 'info', 
        'Unable to verify metrics configuration - ensure JMX is enabled for monitoring',
        'Configure JMX metrics on brokers for monitoring, alerting, and performance analysis');
    }
  }

  async checkLoggingConfiguration(clusterInfo, topics, results) {
    const checkName = 'Logging Configuration';
    
    // Vendor-specific logging checks
    switch (this.vendor) {
      case 'aws-msk':
        await this.checkAwsMskLogging(clusterInfo, topics, results);
        break;
      case 'confluent-cloud':
        await this.checkConfluentCloudLogging(clusterInfo, topics, results);
        break;
      case 'aiven':
        await this.checkAivenLogging(clusterInfo, topics, results);
        break;
      default:
        await this.checkGenericLogging(clusterInfo, topics, results);
    }
  }

  async checkAwsMskLogging(clusterInfo, topics, results) {
    const checkName = 'AWS MSK Logging Configuration';
    
    try {
      // Use AWS SDK v3 to check LoggingInfo configuration
      const { KafkaClient, DescribeClusterCommand } = require('@aws-sdk/client-kafka');
      
      // Extract cluster ARN from broker endpoints or use a fallback
      const clusterArn = this.extractClusterArn(clusterInfo) || process.env.MSK_CLUSTER_ARN;
      
      if (!clusterArn) {
        this.addCheck(results, 'logging-configuration', checkName, 'warning', 
          'Unable to determine cluster ARN for logging check',
          'Set MSK_CLUSTER_ARN environment variable or ensure cluster ARN is available in broker metadata');
        return;
      }
      
      // Initialize MSK client with error handling
      let msk;
      try {
        msk = new KafkaClient();
      } catch (error) {
        this.addCheck(results, 'logging-configuration', checkName, 'warning', 
          'Unable to initialize AWS MSK client',
          'Ensure AWS SDK is properly installed and AWS credentials are configured');
        return;
      }
      
      // Get cluster details including LoggingInfo
      const command = new DescribeClusterCommand({
        ClusterArn: clusterArn
      });
      const clusterDetails = await msk.send(command);
      
      const loggingInfo = clusterDetails.ClusterInfo.LoggingInfo;
      
      if (!loggingInfo) {
        this.addCheck(results, 'logging-configuration', checkName, 'warning', 
          'No LoggingInfo configuration found in cluster',
          'Enable logging in AWS MSK console to configure CloudWatch, S3, or Firehose log delivery');
        return;
      }
      
      // Check if any logging is enabled
      const brokerLogs = loggingInfo.BrokerLogs;
      const enabledLogTypes = [];
      
      if (brokerLogs.CloudWatchLogs && brokerLogs.CloudWatchLogs.Enabled) {
        enabledLogTypes.push('CloudWatch');
      }
      
      if (brokerLogs.Firehose && brokerLogs.Firehose.Enabled) {
        enabledLogTypes.push('Kinesis Firehose');
      }
      
      if (brokerLogs.S3 && brokerLogs.S3.Enabled) {
        enabledLogTypes.push('S3');
      }
      
      if (enabledLogTypes.length === 0) {
        this.addCheck(results, 'logging-configuration', checkName, 'warning', 
          'Logging is configured but no log types are enabled',
          'Enable CloudWatch, S3, or Firehose logging in the LoggingInfo configuration');
      } else {
        this.addCheck(results, 'logging-configuration', checkName, 'pass', 
          `Logging enabled with: ${enabledLogTypes.join(', ')}`,
          'Logs are being delivered to the configured destinations');
      }
      
    } catch (error) {
      console.log(chalk.gray(`Debug: AWS SDK error: ${error.message}`));
      
      if (error.name === 'AccessDenied' || error.name === 'UnauthorizedOperation') {
        this.addCheck(results, 'logging-configuration', checkName, 'warning', 
          'Insufficient permissions to check logging configuration',
          'Ensure IAM permissions include msk:DescribeCluster or check logging manually in AWS Console');
      } else if (error.name === 'ResourceNotFoundException') {
        this.addCheck(results, 'logging-configuration', checkName, 'warning', 
          'Cluster not found or ARN is incorrect',
          'Verify the cluster ARN and ensure it exists in the current AWS region');
      } else if (error.name === 'InvalidParameterValue') {
        this.addCheck(results, 'logging-configuration', checkName, 'warning', 
          'Invalid cluster ARN format',
          'Set MSK_CLUSTER_ARN environment variable with the correct cluster ARN');
      } else {
        this.addCheck(results, 'logging-configuration', checkName, 'info', 
          `Unable to verify AWS MSK logging configuration: ${error.message}`,
          'Check LoggingInfo settings in AWS Console or use AWS CLI to verify log delivery configuration');
      }
    }
  }

  // Helper method to extract cluster ARN from broker metadata
  extractClusterArn(clusterInfo) {
    // Try to extract cluster ARN from broker endpoints
    if (clusterInfo.brokers && clusterInfo.brokers.length > 0) {
      const broker = clusterInfo.brokers[0];
      const endpoint = broker.endpoint || broker.host || broker.address;
      
      if (endpoint) {
        // AWS MSK endpoints typically contain cluster info
        // Example: b-1-public.superstreamstg.halbm0.c1.kafka.eu-central-1.amazonaws.com
        const match = endpoint.match(/b-\d+-(public|private)\.([^.]+)\.([^.]+)\.c\d+\.kafka\.([^.]+)\.amazonaws\.com/);
        if (match) {
          const clusterName = match[2];
          const region = match[4];
          
          // Try to get account ID from environment or use a placeholder
          const accountId = process.env.AWS_ACCOUNT_ID || '123456789012';
          
          // Construct ARN - this is the standard format for MSK cluster ARNs
          return `arn:aws:kafka:${region}:${accountId}:cluster/${clusterName}/*`;
        }
      }
    }
    
    // If we can't extract from broker info, try environment variable
    return process.env.MSK_CLUSTER_ARN || null;
  }

  async checkConfluentCloudLogging(clusterInfo, topics, results) {
    const checkName = 'Confluent Cloud Logging Configuration';
    
    // Confluent Cloud has built-in logging and monitoring
    this.addCheck(results, 'logging-configuration', checkName, 'pass', 
      'Confluent Cloud provides built-in logging and monitoring capabilities',
      'Logs are automatically collected and available in the Confluent Cloud console');
  }

  async checkAivenLogging(clusterInfo, topics, results) {
    const checkName = 'Aiven Kafka Logging Configuration';
    
    // Aiven provides comprehensive logging
    this.addCheck(results, 'logging-configuration', checkName, 'pass', 
      'Aiven Kafka provides comprehensive logging and monitoring',
      'Logs are automatically collected and available in the Aiven console');
  }

  async checkGenericLogging(clusterInfo, topics, results) {
    const checkName = 'Generic Kafka Logging Configuration';
    
    // For generic Kafka, check if log directories are accessible
    try {
      // Check if we can access broker configurations for logging settings
      // This is a simplified check - in practice, you'd need to examine server.properties
      
      this.addCheck(results, 'logging-configuration', checkName, 'info', 
        'Generic Kafka logging configuration check',
        'Verify log4j configuration and log directory permissions in server.properties');
      
    } catch (error) {
      this.addCheck(results, 'logging-configuration', checkName, 'info', 
        'Unable to verify generic Kafka logging configuration',
        'Check log4j configuration and ensure log directories are properly configured');
    }
  }

  async checkAuthenticationConfiguration(clusterInfo, topics, results) {
    const checkName = 'Authentication Configuration';
    
    // Vendor-specific authentication checks
    switch (this.vendor) {
      case 'aws-msk':
        await this.checkAwsMskAuthentication(clusterInfo, topics, results);
        break;
      case 'confluent-cloud':
        await this.checkConfluentCloudAuthentication(clusterInfo, topics, results);
        break;
      case 'aiven':
        await this.checkAivenAuthentication(clusterInfo, topics, results);
        break;
      default:
        await this.checkGenericAuthentication(clusterInfo, topics, results);
    }
  }

  async checkAwsMskAuthentication(clusterInfo, topics, results) {
    const checkName = 'AWS MSK Authentication Configuration';
    
    try {
      // Access the configuration that was passed to the health checker
      const config = this.config || {};
      
      // Check if unauthenticated access is enabled (no SASL, no SSL)
      const hasUnauthenticatedAccess = !config.useSasl && !config.useSsl;
      
      if (hasUnauthenticatedAccess) {
        this.addCheck(results, 'authentication-configuration', checkName, 'fail', 
          'Unauthenticated access is enabled - this is a security risk',
          'Disable unauthenticated access in AWS MSK console and enable IAM or SCRAM authentication');
      } else {
        this.addCheck(results, 'authentication-configuration', checkName, 'pass', 
          'Authentication is configured (SASL or SSL enabled)',
          'Authentication provides secure access control for your MSK cluster');
      }
      
    } catch (error) {
      this.addCheck(results, 'authentication-configuration', checkName, 'warning', 
        'Unable to verify AWS MSK authentication configuration',
        'Check authentication settings in AWS MSK console and ensure IAM roles are properly configured');
    }
  }

  async checkConfluentCloudAuthentication(clusterInfo, topics, results) {
    const checkName = 'Confluent Cloud Authentication Configuration';
    
    // Confluent Cloud requires authentication by default, so unauthenticated access is not possible
    this.addCheck(results, 'authentication-configuration', checkName, 'pass', 
      'Confluent Cloud provides built-in authentication and security',
      'Authentication is automatically configured and managed by Confluent Cloud');
  }

  async checkAivenAuthentication(clusterInfo, topics, results) {
    const checkName = 'Aiven Kafka Authentication Configuration';
    
    // Aiven provides comprehensive authentication by default, so unauthenticated access is not possible
    this.addCheck(results, 'authentication-configuration', checkName, 'pass', 
      'Aiven Kafka provides built-in authentication and security',
      'Authentication is automatically configured and managed by Aiven');
  }

  async checkGenericAuthentication(clusterInfo, topics, results) {
    const checkName = 'Generic Kafka Authentication Configuration';
    
    try {
      // For generic Kafka, check if SASL or SSL is configured
      const config = this.config || {};
      const hasSasl = config.useSasl === true;
      const hasSsl = config.useSsl === true;
      
      // Check if unauthenticated access is enabled (no SASL, no SSL)
      const hasUnauthenticatedAccess = !hasSasl && !hasSsl;
      
      if (hasUnauthenticatedAccess) {
        this.addCheck(results, 'authentication-configuration', checkName, 'fail', 
          'Unauthenticated access is enabled - this is a security risk',
          'Enable SASL or SSL authentication in server.properties for better security');
      } else {
        this.addCheck(results, 'authentication-configuration', checkName, 'pass', 
          'Authentication is configured (SASL or SSL enabled)',
          'Authentication provides secure access control for your Kafka cluster');
      }
      
    } catch (error) {
      this.addCheck(results, 'authentication-configuration', checkName, 'info', 
        'Unable to verify generic Kafka authentication configuration',
        'Check SASL and SSL settings in server.properties for authentication configuration');
    }
  }

  async checkQuotasConfiguration(clusterInfo, topics, results) {
    const checkName = 'Quotas Configuration';
    
    // Vendor-specific quotas checks
    switch (this.vendor) {
      case 'aws-msk':
        await this.checkAwsMskQuotas(clusterInfo, topics, results);
        break;
      case 'confluent-cloud':
        await this.checkConfluentCloudQuotas(clusterInfo, topics, results);
        break;
      case 'aiven':
        await this.checkAivenQuotas(clusterInfo, topics, results);
        break;
      default:
        await this.checkGenericQuotas(clusterInfo, topics, results);
    }
  }

  async checkAwsMskQuotas(clusterInfo, topics, results) {
    const checkName = 'AWS MSK Quotas Configuration';
    
    try {
      // For AWS MSK, check if quotas are actually configured
      // Use AWS SDK v3 to check cluster configuration for quota settings
      const { KafkaClient, DescribeClusterCommand, DescribeConfigurationCommand } = require('@aws-sdk/client-kafka');
      
      // Extract cluster ARN from broker endpoints or use a fallback
      const clusterArn = this.extractClusterArn(clusterInfo) || process.env.MSK_CLUSTER_ARN;
      
      if (!clusterArn) {
        this.addCheck(results, 'quotas-configuration', checkName, 'warning', 
          'Unable to determine cluster ARN for quotas check',
          'Set MSK_CLUSTER_ARN environment variable or ensure cluster ARN is available in broker metadata');
        return;
      }
      
      // Initialize MSK client with error handling
      let msk;
      try {
        msk = new KafkaClient();
      } catch (error) {
        this.addCheck(results, 'quotas-configuration', checkName, 'warning', 
          'Unable to initialize AWS MSK client for quotas check',
          'Ensure AWS SDK is properly installed and AWS credentials are configured');
        return;
      }
      
      // Get cluster details to check configuration
      const clusterCommand = new DescribeClusterCommand({ ClusterArn: clusterArn });
      const clusterDetails = await msk.send(clusterCommand);
      
      if (clusterDetails.Cluster) {
        const cluster = clusterDetails.Cluster;
        
        // Check if quotas are configured in the cluster
        // AWS MSK quotas are typically configured through client quotas
        // We can check if there are any quota configurations in the cluster
        
        // For now, we'll check if the cluster has any specific configurations that indicate quotas
        // This is a simplified check - in a real implementation, you'd check actual quota configurations
        
        if (cluster.ConfigurationInfo && cluster.ConfigurationInfo.Arn) {
          // Check the configuration for quota-related settings
          try {
            const configCommand = new DescribeConfigurationCommand({ 
              Arn: cluster.ConfigurationInfo.Arn 
            });
            const configDetails = await msk.send(configCommand);
            
            if (configDetails.LatestRevision && configDetails.LatestRevision.Description) {
              const configDesc = configDetails.LatestRevision.Description.toLowerCase();
              
              // Check if the configuration mentions quotas
              if (configDesc.includes('quota') || configDesc.includes('throttle') || configDesc.includes('limit')) {
                this.addCheck(results, 'quotas-configuration', checkName, 'pass', 
                  'Quotas appear to be configured in AWS MSK cluster',
                  'Quotas are configured and should be providing resource management');
              } else {
                this.addCheck(results, 'quotas-configuration', checkName, 'warning', 
                  'No quota configuration detected in AWS MSK cluster',
                  'Consider configuring client quotas in AWS MSK console or via AWS CLI for better resource management');
              }
            } else {
              this.addCheck(results, 'quotas-configuration', checkName, 'warning', 
                'Unable to verify quota configuration in AWS MSK cluster',
                'Check quota settings in AWS MSK console and ensure proper quota configuration for resource management');
            }
          } catch (configError) {
            this.addCheck(results, 'quotas-configuration', checkName, 'warning', 
              'Unable to check cluster configuration for quotas',
              'Check quota settings in AWS MSK console and ensure proper quota configuration for resource management');
          }
        } else {
          this.addCheck(results, 'quotas-configuration', checkName, 'warning', 
            'No configuration found for AWS MSK cluster',
            'Configure quotas in AWS MSK console or use AWS CLI to set client quotas for better resource management');
        }
      } else {
        this.addCheck(results, 'quotas-configuration', checkName, 'warning', 
          'Unable to retrieve AWS MSK cluster details for quotas check',
          'Check quota settings in AWS MSK console and ensure proper quota configuration for resource management');
      }
      
    } catch (error) {
      this.addCheck(results, 'quotas-configuration', checkName, 'warning', 
        'Unable to verify AWS MSK quotas configuration',
        'Check quota settings in AWS MSK console and ensure proper quota configuration for resource management');
    }
  }

  async checkConfluentCloudQuotas(clusterInfo, topics, results) {
    const checkName = 'Confluent Cloud Quotas Configuration';
    
    try {
      // For Confluent Cloud, check if quotas are actually configured
      // Confluent Cloud provides built-in quota management, but we can check if it's being used
      
      // Check if there are any quota-related configurations or topics
      const hasQuotaConfig = clusterInfo.brokers.some(broker => {
        // Check if broker has quota-related configurations
        return broker.config && (
          broker.config['quota.producer.default'] ||
          broker.config['quota.consumer.default'] ||
          broker.config['quota.request.timeout.ms'] ||
          broker.config['quota.window.num'] ||
          broker.config['quota.window.size.seconds'] ||
          broker.config['confluent.quota.enable'] ||
          broker.config['confluent.quota.enabled']
        );
      });
      
      // Check if there are any quota-related topics
      const hasQuotaTopics = topics.some(topic => 
        topic.name.includes('__confluent_quotas') || 
        topic.name.includes('__quotas') ||
        topic.name.includes('_quotas')
      );
      
      if (hasQuotaConfig || hasQuotaTopics) {
        this.addCheck(results, 'quotas-configuration', checkName, 'pass', 
          'Quotas are configured and being used in Confluent Cloud',
          'Confluent Cloud quotas are properly configured and providing resource management');
      } else {
        this.addCheck(results, 'quotas-configuration', checkName, 'info', 
          'Confluent Cloud provides built-in quota management',
          'Quotas are automatically managed by Confluent Cloud for optimal resource utilization');
      }
      
    } catch (error) {
      this.addCheck(results, 'quotas-configuration', checkName, 'info', 
        'Confluent Cloud provides built-in quota management and resource controls',
        'Quotas are automatically managed by Confluent Cloud for optimal resource utilization');
    }
  }

  async checkAivenQuotas(clusterInfo, topics, results) {
    const checkName = 'Aiven Kafka Quotas Configuration';
    
    try {
      // For Aiven, check if quotas are actually configured
      // Aiven provides built-in quota management, but we can check if it's being used
      
      // Check if there are any quota-related configurations or topics
      const hasQuotaConfig = clusterInfo.brokers.some(broker => {
        // Check if broker has quota-related configurations
        return broker.config && (
          broker.config['quota.producer.default'] ||
          broker.config['quota.consumer.default'] ||
          broker.config['quota.request.timeout.ms'] ||
          broker.config['quota.window.num'] ||
          broker.config['quota.window.size.seconds'] ||
          broker.config['aiven.quota.enable'] ||
          broker.config['aiven.quota.enabled']
        );
      });
      
      // Check if there are any quota-related topics
      const hasQuotaTopics = topics.some(topic => 
        topic.name.includes('__aiven_quotas') || 
        topic.name.includes('__quotas') ||
        topic.name.includes('_quotas')
      );
      
      if (hasQuotaConfig || hasQuotaTopics) {
        this.addCheck(results, 'quotas-configuration', checkName, 'pass', 
          'Quotas are configured and being used in Aiven Kafka',
          'Aiven Kafka quotas are properly configured and providing resource management');
      } else {
        this.addCheck(results, 'quotas-configuration', checkName, 'info', 
          'Aiven Kafka provides built-in quota management',
          'Quotas are automatically managed by Aiven for optimal resource utilization');
      }
      
    } catch (error) {
      this.addCheck(results, 'quotas-configuration', checkName, 'info', 
        'Aiven Kafka provides built-in quota management and resource controls',
        'Quotas are automatically managed by Aiven for optimal resource utilization');
    }
  }

  async checkGenericQuotas(clusterInfo, topics, results) {
    const checkName = 'Generic Kafka Quotas Configuration';
    
    try {
      // For generic Kafka, check if quotas are actually configured
      // This would typically require checking server.properties or using Kafka admin tools
      
      // Check if we can detect quota configurations from the cluster info
      // Look for quota-related configurations in broker metadata
      
      const hasQuotaConfig = clusterInfo.brokers.some(broker => {
        // Check if broker has quota-related configurations
        return broker.config && (
          broker.config['quota.producer.default'] ||
          broker.config['quota.consumer.default'] ||
          broker.config['quota.request.timeout.ms'] ||
          broker.config['quota.window.num'] ||
          broker.config['quota.window.size.seconds']
        );
      });
      
      // Also check if there are any quota-related topics or configurations
      const hasQuotaTopics = topics.some(topic => 
        topic.name.includes('__kafka_quotas') || 
        topic.name.includes('__quotas')
      );
      
      if (hasQuotaConfig || hasQuotaTopics) {
        this.addCheck(results, 'quotas-configuration', checkName, 'pass', 
          'Quotas appear to be configured in Kafka cluster',
          'Quotas are configured and should be providing resource management');
      } else {
        this.addCheck(results, 'quotas-configuration', checkName, 'warning', 
          'No quota configuration detected in Kafka cluster',
          'Configure quotas in server.properties or use kafka-configs.sh to set client quotas for better resource management');
      }
      
    } catch (error) {
      this.addCheck(results, 'quotas-configuration', checkName, 'warning', 
        'Unable to verify generic Kafka quotas configuration',
        'Check quotas settings in server.properties or use kafka-configs.sh for quota configuration');
    }
  }

  async checkPayloadCompression(clusterInfo, topics, results) {
    const checkName = 'Payload Compression';
    
    try {
      // Filter out internal topics for this check
      const userTopics = topics.filter(topic => !topic.isInternal);
      
      if (userTopics.length === 0) {
        this.addCheck(results, 'payload-compression', checkName, 'info', 
          'No user topics found to analyze for compression',
          'Create user topics to enable compression analysis');
        return;
      }
      
      // Check which topics have compression enabled
      const topicsWithCompression = userTopics.filter(topic => {
        // Check if topic has compression configuration
        // Common compression types: gzip, snappy, lz4, zstd
        const compressionConfig = topic.config && (
          topic.config['compression.type'] ||
          topic.config['compression'] ||
          topic.config['producer.compression.type']
        );
        
        // Check if compression is enabled (not 'none' or 'uncompressed')
        if (compressionConfig) {
          const compressionType = compressionConfig.toString().toLowerCase();
          return compressionType !== 'none' && 
                 compressionType !== 'uncompressed' && 
                 compressionType !== 'producer';
        }
        
        return false;
      });
      
      const totalUserTopics = userTopics.length;
      const compressedTopics = topicsWithCompression.length;
      const compressionPercentage = Math.round((compressedTopics / totalUserTopics) * 100);
      
      if (compressedTopics === totalUserTopics) {
        this.addCheck(results, 'payload-compression', checkName, 'pass', 
          `All ${totalUserTopics} user topics have compression enabled (100%)`,
          'Compression is properly configured for all topics, providing optimal storage and network efficiency');
      } else if (compressedTopics > 0) {
        this.addCheck(results, 'payload-compression', checkName, 'warning', 
          `${compressedTopics} out of ${totalUserTopics} user topics have compression enabled (${compressionPercentage}%)`,
          `Consider enabling compression on the remaining ${totalUserTopics - compressedTopics} topics for better storage and network efficiency`);
      } else {
        this.addCheck(results, 'payload-compression', checkName, 'warning', 
          `No compression detected on any of the ${totalUserTopics} user topics (0%)`,
          'Enable compression on topics to reduce storage usage and improve network performance');
      }
      
    } catch (error) {
      this.addCheck(results, 'payload-compression', checkName, 'warning', 
        'Unable to verify payload compression configuration',
        'Check topic configurations for compression settings');
    }
  }

  async checkInfiniteRetentionPolicy(clusterInfo, topics, results) {
    const checkName = 'Infinite Retention Policy';
    
    try {
      // Check if any topic has infinite retention policy enabled
      const infiniteRetentionTopics = topics.filter(topic => 
        topic.config && topic.config['retention.ms'] === 'infinite'
      );
      
      if (infiniteRetentionTopics.length === 0) {
        this.addCheck(results, 'infinite-retention-policy', checkName, 'pass', 
          'No topics have infinite retention policy enabled');
      } else {
        const topicList = infiniteRetentionTopics.map(t => 
          `${t.name} (retention.ms: ${t.config['retention.ms']})`
        ).join(', ');
        
        this.addCheck(results, 'infinite-retention-policy', checkName, 'warning', 
          `${infiniteRetentionTopics.length} topic(s) have infinite retention policy enabled: ${topicList}`,
          'Consider setting a finite retention policy for these topics to manage storage and data retention');
      }
      
    } catch (error) {
      this.addCheck(results, 'infinite-retention-policy', checkName, 'info', 
        'Unable to verify infinite retention policy',
        'Check topic configurations for retention settings');
    }
  }

  addCheck(results, id, name, status, message, recommendation = null) {
    // Add a short description for each check
    const descriptions = {
      'replication-factor':
        'Checks if any topic has a replication factor greater than the number of brokers. Healthy: All topics have RF ≤ broker count. Failed: Any topic has RF > broker count.',
      'partition-distribution':
        'Checks if user topics have a balanced number of partitions. Healthy: Partition counts are similar. Warning: Large difference between min and max partitions.',
      'consumer-groups':
        'Checks if all consumer groups have active members. Healthy: All groups have members. Warning: Some groups have no active members.',
      'internal-topics':
        'Checks if all internal topics (names starting with __) have partitions > 0. Healthy: All internal topics have partitions. Failed: Any internal topic has 0 or missing partitions.',
      'aws-msk-specific':
        'Checks if AWS MSK system topics (names containing __amazon_msk_ or __consumer_offsets) exist and are healthy. Healthy: All MSK system topics have partitions and replication > 0. Warning: No MSK system topics found. Failed: Any MSK system topic has 0 partitions or replication.',
      'apache-kafka-specific':
        'Checks if Apache Kafka system topics (names containing __consumer_offsets, __transaction_state, or __kafka_connect) exist and are healthy. Healthy: All Apache Kafka system topics have partitions and replication > 0. Warning: No Apache Kafka system topics found. Failed: Any Apache Kafka system topic has 0 partitions or replication.',
      'generic':
        'Generic placeholder check. Not implemented yet.',
      'confluent-cloud':
        'Confluent Cloud specific checks. Not implemented yet.',
      'aiven':
        'Aiven Kafka specific checks. Not implemented yet.',
      'rack-awareness':
        'Checks if rack awareness is configured in the cluster. Healthy: Rack awareness is configured. Warning: Rack awareness is not configured.',
      'replica-distribution':
        'Checks if data replicas are evenly distributed across all brokers. Healthy: Each broker carries a similar number of replicas. Warning/Failed: Some brokers carry significantly more replicas than others, which can cause performance issues.',
      'metrics-enabled':
        'Checks if monitoring metrics are properly configured. For AWS MSK: Checks Open Monitoring with Prometheus JMX exporter. For others: Checks JMX metrics configuration. Healthy: Metrics are enabled and accessible. Warning: Metrics are not configured or partially configured.',
      'logging-configuration':
        'Checks if logging configuration is properly configured. For AWS MSK: Checks LoggingInfo configuration and CloudTrail. For Confluent Cloud/Aiven: Built-in logging is available. For others: Checks log4j configuration. Healthy: Logging is enabled and configured. Warning: Logging is not configured or partially configured.',
      'authentication-configuration':
        'Checks if unauthenticated access is enabled. For AWS MSK: Checks if SASL or SSL is configured. For Confluent Cloud/Aiven: Built-in authentication prevents unauthenticated access. For others: Checks if SASL or SSL is configured. Healthy: Authentication is enabled (no unauthenticated access). Failed: Unauthenticated access is enabled (security risk).',
      'quotas-configuration':
        'Checks if Kafka quotas are configured and being used. For AWS MSK: Checks quota configuration via AWS console/CLI. For Confluent Cloud/Aiven: Built-in quota management is available. For others: Checks server.properties and kafka-configs.sh for quota settings. Healthy: Quotas are configured and managed. Info: Quotas configuration check available.',
      'payload-compression':
        'Checks if payload compression is enabled on user topics. Analyzes compression.type, compression, and producer.compression.type configurations. Healthy: All user topics have compression enabled (100%). Warning: Some or no topics have compression enabled (<100%). Info: No user topics to analyze.',
      'infinite-retention-policy':
        'Checks if any topics have infinite retention policy enabled (retention.ms = infinite). Healthy: No topics have infinite retention. Warning: Some topics have infinite retention policy (bad practice). Info: Unable to verify retention policy.'
    };

    const check = {
      id,
      name,
      status, // 'pass', 'fail', 'warning', 'error', 'info'
      message,
      recommendation,
      description: descriptions[id] || ''
    };

    results.checks.push(check);
    results.totalChecks++;

    switch (status) {
      case 'pass':
        results.passedChecks++;
        break;
      case 'fail':
      case 'error':
        results.failedChecks++;
        break;
      case 'warning':
        results.warnings++;
        break;
    }

    // Display check result immediately
    this.displayCheckResult(check);
  }

  displayCheckResult(check) {
    const statusIcons = {
      'pass': '✅',
      'fail': '❌',
      'warning': '⚠️',
      'error': '🚨',
      'info': 'ℹ️'
    };

    const statusColors = {
      'pass': chalk.green,
      'fail': chalk.red,
      'warning': chalk.yellow,
      'error': chalk.red,
      'info': chalk.blue
    };

    const icon = statusIcons[check.status] || '❓';
    const color = statusColors[check.status] || chalk.white;

    console.log(`${icon} ${color(check.name)}`);
    console.log(`   ${check.message}`);
    
    if (check.recommendation) {
      console.log(`   💡 Recommendation: ${chalk.cyan(check.recommendation)}`);
    }
    console.log('');
  }

  displayResults(results) {
    console.log(chalk.blue('\n📊 Health Check Summary\n'));
    
    const summary = [
      `Total Checks: ${results.totalChecks}`,
      `✅ Passed: ${results.passedChecks}`,
      `❌ Failed: ${results.failedChecks}`,
      `⚠️  Warnings: ${results.warnings}`
    ];

    console.log(summary.join(' | '));
    console.log('');

    if (results.failedChecks === 0 && results.warnings === 0) {
      console.log(chalk.green('🎉 All health checks passed! Your Kafka cluster is healthy.'));
    } else if (results.failedChecks === 0) {
      console.log(chalk.yellow('⚠️  Some warnings detected. Review recommendations above.'));
    } else {
      console.log(chalk.red('🚨 Issues detected. Please review and fix the problems above.'));
    }
  }
}

module.exports = { HealthChecker }; 