const chalk = require('chalk');
const net = require('net');

class HealthChecker {
  constructor(vendor, config = {}, confluentConfig = null) {
    this.vendor = vendor;
    this.config = config;
    this.confluentConfig = confluentConfig;
    this.checks = [];
  }

  async checkDeadConsumerGroups(clusterInfo, topics, consumerGroups, results) {
    const checkName = 'Dead Consumer Groups';
    try {
      if (!Array.isArray(consumerGroups) || consumerGroups.length === 0) {
        this.addCheck(results, 'dead-consumer-groups', checkName, 'pass', '', 'No consumer groups found');
        return;
      }

      const deadGroups = consumerGroups.filter(g => {
        const state = (g && g.state) ? String(g.state).toLowerCase() : '';
        return state === 'dead';
      });

      if (deadGroups.length === 0) {
        this.addCheck(results, 'dead-consumer-groups', checkName, 'pass', '', 'No dead consumer groups found');
      } else {
        const details = deadGroups.map(g => `  ${g.groupId || 'unknown-group'}`).join('\n');
        this.addCheck(results, 'dead-consumer-groups', checkName, 'fail', 'low',
          `${deadGroups.length} dead consumer group(s) detected:\n${details}`,
          'Delete unused consumer groups to clean up cluster metadata');
      }
    } catch (error) {
      this.addCheck(results, 'dead-consumer-groups', checkName, 'fail', 'low',
        'Unable to verify dead consumer groups',
        'List groups and delete unused ones to reduce metadata clutter');
    }
  }

  parseTimestamp(value) {
    if (!value) return null;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const t = Date.parse(value);
      return isNaN(t) ? null : t;
    }
    return null;
  }

  async runHealthChecks(clusterInfo, topics, consumerGroups) {
    console.log(chalk.blue('\n🔍 Running Health Checks\n'));
    
    const results = {
      vendor: this.vendor,
      totalChecks: 0,
      passedChecks: 0,
      failedChecks: 0,
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

    // Check 17: Unclean Leader Election
    await this.checkUncleanLeaderElection(clusterInfo, topics, results);

    // Check 18: ACL Enforcement
    await this.checkAclEnforcement(clusterInfo, topics, results);

    // Check 19: Auto Topic Creation
    await this.checkAutoTopicCreation(clusterInfo, topics, results);

    // Check 20: Message Size Consistency
    await this.checkMessageSizeConsistency(clusterInfo, topics, results);

    // Check 21: Default Topic Replication
    await this.checkDefaultTopicReplication(clusterInfo, topics, results);

    // Check 22: Controlled Shutdown
    await this.checkControlledShutdown(clusterInfo, topics, results);
    
    // Check 23: Consumer Lag Threshold
    await this.checkConsumerLagThreshold(clusterInfo, topics, consumerGroups, results);
    
    // Check 24: Dead Consumer Groups
    await this.checkDeadConsumerGroups(clusterInfo, topics, consumerGroups, results);

    // Check 25: Single Partition Topics with High Throughput
    await this.checkSinglePartitionHighThroughput(clusterInfo, topics, results);
  }

  async runConfluentCloudChecks(clusterInfo, topics, consumerGroups, results) {
    console.log(chalk.yellow('🏢 Confluent Cloud Health Checks\n'));
    
    // Check 1: Topic Partition Distribution
    await this.checkPartitionDistribution(topics, results);

    // Check 2: Consumer Group Health
    await this.checkConsumerGroupHealth(consumerGroups, results);

    // Check 3: Internal Topics Health
    await this.checkInternalTopics(topics, results);

    // Check 4: Under-Replicated Partitions
    await this.checkUnderReplicatedPartitions(topics, results);
    
    // Check 5: Logging Configuration
    await this.checkLoggingConfiguration(clusterInfo, topics, results);
    
    // Check 6: Authentication Configuration
    await this.checkAuthenticationConfiguration(clusterInfo, topics, results);
    
    // Check 7: Quotas Configuration
    await this.checkQuotasConfiguration(clusterInfo, topics, results);
    
    // Check 8: Payload Compression
    await this.checkPayloadCompression(clusterInfo, topics, results);
    
    // Check 9: Infinite Retention Policy
    await this.checkInfiniteRetentionPolicy(clusterInfo, topics, results);
    
    // Check 10: ACL Enforcement
    await this.checkAclEnforcement(clusterInfo, topics, results);

    // Check 11: Consumer Lag Threshold
    await this.checkConsumerLagThreshold(clusterInfo, topics, consumerGroups, results);

    // Check 12: Dead Consumer Groups
    await this.checkDeadConsumerGroups(clusterInfo, topics, consumerGroups, results);

    // Check 13: Single Partition Topics with High Throughput
    await this.checkSinglePartitionHighThroughput(clusterInfo, topics, results);
    
    // TODO: Implement other Confluent Cloud specific checks
    this.addCheck(results, 'confluent-cloud', 'Confluent Cloud checks', 'pass', '', 'Not implemented yet');
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
    
    // Check 9: Logging Configuration
    await this.checkLoggingConfiguration(clusterInfo, topics, results);
    
    // Check 10: Authentication Configuration
    await this.checkAuthenticationConfiguration(clusterInfo, topics, results);
    
    // Check 11: Quotas Configuration
    await this.checkQuotasConfiguration(clusterInfo, topics, results);
    
    // Check 12: Payload Compression
    await this.checkPayloadCompression(clusterInfo, topics, results);
    
    // Check 13: Infinite Retention Policy
    await this.checkInfiniteRetentionPolicy(clusterInfo, topics, results);
    
    // Check 14: Auto Topic Creation
    await this.checkAutoTopicCreation(clusterInfo, topics, results);
    
    // Check 15: Message Size Consistency
    await this.checkMessageSizeConsistency(clusterInfo, topics, results);
    
    // Check 16: Controlled Shutdown
    await this.checkControlledShutdown(clusterInfo, topics, results);
    
    // Check 17: Consumer Lag Threshold
    await this.checkConsumerLagThreshold(clusterInfo, topics, consumerGroups, results);
    
    // Check 18: Dead Consumer Groups
    await this.checkDeadConsumerGroups(clusterInfo, topics, consumerGroups, results);
    
    // Check 19: Single Partition Topics with High Throughput
    await this.checkSinglePartitionHighThroughput(clusterInfo, topics, results);

    // Check 20: ACL Enforcement
    await this.checkAclEnforcement(clusterInfo, topics, results);
    
    // TODO: Implement other Aiven specific checks
    this.addCheck(results, 'aiven', 'Aiven checks', 'pass', '', 'Not implemented yet');
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
    
    // Check 15: Unclean Leader Election
    await this.checkUncleanLeaderElection(clusterInfo, topics, results);

    // Check 16: ACL Enforcement
    await this.checkAclEnforcement(clusterInfo, topics, results);

    // Check 17: Auto Topic Creation
    await this.checkAutoTopicCreation(clusterInfo, topics, results);

    // Check 18: Message Size Consistency
    await this.checkMessageSizeConsistency(clusterInfo, topics, results);

    // Check 19: Default Topic Replication
    await this.checkDefaultTopicReplication(clusterInfo, topics, results);

    // Check 20: Controlled Shutdown
    await this.checkControlledShutdown(clusterInfo, topics, results);
    
    // Check 21: Consumer Lag Threshold
    await this.checkConsumerLagThreshold(clusterInfo, topics, consumerGroups, results);
    
    // Check 22: Dead Consumer Groups
    await this.checkDeadConsumerGroups(clusterInfo, topics, consumerGroups, results);
    
    // Check 23: Single Partition Topics with High Throughput
    await this.checkSinglePartitionHighThroughput(clusterInfo, topics, results);
  }

  async checkSinglePartitionHighThroughput(clusterInfo, topics, results) {
    const checkName = 'Single Partition Topics with High Throughput';
    try {
      // We expect topic metadata to include partition count; throughput needs sampling.
      // Try to use topic metrics from clusterInfo if available; otherwise skip with info.
      const singlePartitionTopics = topics.filter(t => !t.isInternal && (t.partitions === 1 || (t.partitionDetails && t.partitionDetails.length === 1)));
      if (singlePartitionTopics.length === 0) {
        this.addCheck(results, 'single-partition-high-throughput', checkName, 'pass', '', 'No single-partition user topics');
        return;
      }

      // Try to read optional throughput info from topic.config or clusterInfo metrics
      // Expected optional fields in config: bytes.in.per.sec, bytesOutPerSec, or custom metrics mapping
      const thresholdBytesPerSec = 1 * 1024 * 1024; // 1MB/s
      const offenders = [];

      singlePartitionTopics.forEach(t => {
        const cfg = t.config || {};
        const candidates = [
          cfg['bytes.in.per.sec']?.value,
          cfg['bytesInPerSec']?.value,
          cfg['topic.bytes.in.per.sec']?.value,
          cfg['throughput.bytes.per.sec']?.value
        ];
        const numeric = candidates
          .map(v => (typeof v === 'string' ? parseFloat(v) : (typeof v === 'number' ? v : NaN)))
          .find(v => !isNaN(v));
        if (typeof numeric === 'number' && numeric > thresholdBytesPerSec) {
          offenders.push({ name: t.name, throughputBps: Math.round(numeric) });
        }
      });

      if (offenders.length === 0) {
        this.addCheck(results, 'single-partition-high-throughput', checkName, 'pass', '', 'No single-partition topics exceed 1MB/s throughput');
      } else {
        const lines = offenders
          .slice(0, 20)
          .map(o => `  ${o.name}: ${o.throughputBps} B/s`)
          .join('\n');
        this.addCheck(results, 'single-partition-high-throughput', checkName, 'fail', 'medium',
          `${offenders.length} single-partition topic(s) exceed 1MB/s throughput:\n${lines}`);
      }
    } catch (error) {
      this.addCheck(results, 'single-partition-high-throughput', checkName, 'fail', 'medium',
        'Unable to verify single-partition high throughput topics',
        'Provide topic throughput metrics or enable metrics collection to analyze throughput');
    }
  }

  async checkConsumerLagThreshold(clusterInfo, topics, consumerGroups, results) {
    const checkName = 'Consumer Lag Threshold';
    try {
      // Always compute lag using Kafka client (assume input lacks lag)
      if (!consumerGroups || consumerGroups.length === 0) {
        this.addCheck(results, 'consumer-lag-threshold', checkName, 'pass', '', 'No consumer groups found');
        return;
      }

      let analysis;
      try {
        const { KafkaClient } = require('./kafka-client.js');
        const client = new KafkaClient(this.config || {});
        await client.connect();
        const groupIds = consumerGroups.map(g => g.groupId).filter(Boolean);
        const computed = await client.computeLagForGroups(groupIds);
        await client.disconnect();

        const threshold = 10000;
        const laggingGroups = (computed || [])
          .filter(c => typeof c.totalLag === 'number' && c.totalLag > threshold)
          .map(c => ({ groupId: c.groupId, totalLag: c.totalLag, topics: c.topics }));

        analysis = {
          threshold,
          laggingGroups,
          hasIssues: laggingGroups.length > 0
        };
      } catch (lagErr) {
        this.addCheck(results, 'consumer-lag-threshold', checkName, 'fail', 'high',
          `Unable to compute consumer lag via offsets: ${lagErr.message}`,
          'Ensure client has permissions to fetch group offsets and topic end offsets');
        return;
      }

      if (!analysis.hasIssues) {
        this.addCheck(results, 'consumer-lag-threshold', checkName, 'pass', '',
          `All consumer groups are within lag threshold (≤ ${analysis.threshold})`);
      } else {
        const details = analysis.laggingGroups.map(g => {
          const lines = (g.topics || [])
            .slice(0, 10)
            .map(t => `  ${t.topic}: ${t.lag}`)
            .join('\n');
          return `${g.groupId}: totalLag=${g.totalLag}\n${lines}`;
        }).join('\n');
        this.addCheck(
          results,
          'consumer-lag-threshold',
          checkName,
          'fail',
          'high',
          `Detected ${analysis.laggingGroups.length} group(s) exceeding lag threshold (${analysis.threshold}): ${details}`,
          'Scale consumer instances, optimize processing logic, or increase partitions for parallelism'
        );
      }
    } catch (error) {
      this.addCheck(results, 'consumer-lag-threshold', checkName, 'fail', 'high',
        'Unable to analyze consumer lag threshold',
        'Ensure consumer group lag metrics are available and retry');
    }
  }

  async checkReplicationFactor(clusterInfo, topics, results) {
    const checkName = 'Replication Factor vs Broker Count';
    const brokerCount = clusterInfo.brokers.length;
    
    if (brokerCount === 0) {
      this.addCheck(results, 'replication-factor', checkName, 'fail', 'critical', 
        'No brokers found in cluster metadata');
      return;
    }

    const topicsWithHighReplication = topics.filter(topic => 
      topic.replicationFactor > brokerCount
    );

    if (topicsWithHighReplication.length === 0) {
      this.addCheck(results, 'replication-factor', checkName, 'pass', '',
        `All topics have appropriate replication factor (≤ ${brokerCount} brokers)`);
    } else {
      const topicList = topicsWithHighReplication.map(t => 
        `${t.name} (RF: ${t.replicationFactor})`
      ).join(', ');
      
      this.addCheck(results, 'replication-factor', checkName, 'fail', 'critical',
        `${topicsWithHighReplication.length} topic(s) have replication factor higher than available brokers (${brokerCount}): ${topicList}`,
        `Consider reducing replication factor to ${brokerCount} or below for: ${topicsWithHighReplication.map(t => t.name).join(', ')}`);
    }
  }

  async checkPartitionDistribution(topics, results) {
    const checkName = 'Topic Partition Distribution';
    const userTopics = topics.filter(topic => !topic.isInternal);
    
    if (userTopics.length === 0) {
      this.addCheck(results, 'partition-distribution', checkName, 'pass', '', 
        'No user topics found to analyze');
      return;
    }

    const partitionCounts = userTopics.map(t => t.partitions);
    const avgPartitions = partitionCounts.reduce((sum, count) => sum + count, 0) / partitionCounts.length;
    const maxPartitions = Math.max(...partitionCounts);
    const minPartitions = Math.min(...partitionCounts);

    if (maxPartitions - minPartitions <= 2) {
      this.addCheck(results, 'partition-distribution', checkName, 'pass', '',
        `Good partition distribution: avg=${avgPartitions.toFixed(1)}, min=${minPartitions}, max=${maxPartitions}`);
    } else {
      this.addCheck(results, 'partition-distribution', checkName, 'fail', 'medium',
        `Uneven partition distribution: avg=${avgPartitions.toFixed(1)}, min=${minPartitions}, max=${maxPartitions}`,
        'Consider balancing partitions across topics for better performance');
    }
  }

filterOutSystemConsumerGroups(consumerGroups) {
  return consumerGroups.filter(group => {
    const id = group && group.groupId ? group.groupId : '';
    if (id.startsWith('amazon.msk.canary.')) return false;
    if (id.startsWith('console-consumer-')) return false;
    return true;
  });
}

  async checkConsumerGroupHealth(consumerGroups, results) {
    const checkName = 'Consumer Group Health';

    consumerGroups = this.filterOutSystemConsumerGroups(consumerGroups);

    if (consumerGroups.length === 0) {
      this.addCheck(results, 'consumer-groups', checkName, 'pass', '', 
        'No consumer groups found');
      return;
    }

    const emptyGroups = consumerGroups.filter(group => group.members === 0);
    const activeGroups = consumerGroups.filter(group => group.members > 0);

    if (emptyGroups.length === 0) {
      this.addCheck(results, 'consumer-groups', checkName, 'pass', '',
        `All ${consumerGroups.length} consumer groups have active members`);
    } else {
      this.addCheck(results, 'consumer-groups', checkName, 'fail', 'low',
        `${emptyGroups.length} consumer group(s) have no active members: ${emptyGroups.map(g => g.groupId).join(', ')}`,
        'Consider cleaning up unused consumer groups');
    }
  }

  async checkInternalTopics(topics, results) {
    const checkName = 'Internal Topics Health';
    const internalTopics = topics.filter(topic => topic.isInternal);
    
    if (internalTopics.length === 0) {
      this.addCheck(results, 'internal-topics', checkName, 'pass', '', 
        'No internal topics found');
      return;
    }

    const unhealthyInternal = internalTopics.filter(topic => 
      !topic.partitions || topic.partitions === 0
    );

    if (unhealthyInternal.length === 0) {
      this.addCheck(results, 'internal-topics', checkName, 'pass', '',
        `All ${internalTopics.length} internal topics are healthy`);
    } else {
      this.addCheck(results, 'internal-topics', checkName, 'fail', 'critical',
        `${unhealthyInternal.length} internal topic(s) have issues: ${unhealthyInternal.map(t => t.name).join(', ')}`);
    }
  }

  async checkUnderReplicatedPartitions(topics, results) {
    const checkName = 'Under-Replicated Partitions';
    
    if (topics.length === 0) {
      this.addCheck(results, 'under-replicated-partitions', checkName, 'pass', '', 
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
      this.addCheck(results, 'under-replicated-partitions', checkName, 'pass', '',
        `All topics have the expected number of in-sync replicas`);
    } else {
      const partitionDetails = underReplicatedPartitions.map(p => 
        `${p.topic}:${p.partition} (${p.actual}/${p.expected} replicas)`
      ).join(', ');
      
      this.addCheck(results, 'under-replicated-partitions', checkName, 'fail', 'critical',
        `${underReplicatedPartitions.length} partition(s) in ${underReplicatedTopics.length} topic(s) are under-replicated: ${partitionDetails}`,
        'Check broker health and network connectivity. Under-replicated partitions may indicate broker failures or network issues.');
    }
  }

  async checkMinInsyncReplicas(topics, results) {
    const checkName = 'Min In-Sync Replicas Configuration';
    
    if (topics.length === 0) {
      this.addCheck(results, 'min-insync-replicas', checkName, 'pass', '', 
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
      this.addCheck(results, 'min-insync-replicas', checkName, 'pass', '',
        `All topics have appropriate min.insync.replicas configuration`);
    } else {
      this.addCheck(results, 'min-insync-replicas', checkName, 'fail', 'critical',
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
      this.addCheck(results, 'aws-msk-specific', checkName, 'fail', 'high', 
        'No AWS MSK system topics found - this might indicate a new cluster or configuration issue');
    } else {
      const healthyMskTopics = mskTopics.filter(topic => 
        topic.partitions > 0 && topic.replicationFactor > 0
      );

      if (healthyMskTopics.length === mskTopics.length) {
        this.addCheck(results, 'aws-msk-specific', checkName, 'pass', '',
          `All ${mskTopics.length} AWS MSK system topics are healthy`);
      } else {
        const unhealthy = mskTopics.filter(t => !healthyMskTopics.includes(t));
        this.addCheck(results, 'aws-msk-specific', checkName, 'fail', 'high',
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
      this.addCheck(results, 'apache-kafka-specific', checkName, 'fail', 'high', 
        'No Apache Kafka system topics found - this might indicate a new cluster or configuration issue');
    } else {
      const healthyApacheTopics = apacheTopics.filter(topic => 
        topic.partitions > 0 && topic.replicationFactor > 0
      );

      if (healthyApacheTopics.length === apacheTopics.length) {
        this.addCheck(results, 'apache-kafka-specific', checkName, 'pass', '',
          `All ${apacheTopics.length} Apache Kafka system topics are healthy`);
      } else {
        const unhealthy = apacheTopics.filter(t => !healthyApacheTopics.includes(t));
        this.addCheck(results, 'apache-kafka-specific', checkName, 'fail', 'high', 
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
      this.addCheck(results, 'rack-awareness', checkName, 'fail', 'medium',
        'Rack awareness is not configured - no brokers have rack information',
        'Consider enabling rack awareness for better availability and fault tolerance');
    } else if (rackAwareBrokers === totalBrokers) {
      this.addCheck(results, 'rack-awareness', checkName, 'pass', '',
        `Rack awareness is fully configured - all ${totalBrokers} brokers have rack information`);
    } else {
      this.addCheck(results, 'rack-awareness', checkName, 'fail', 'medium',
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
      this.addCheck(results, 'replica-distribution', checkName, 'pass', '', 
        'No replicas found to analyze');
    } else if (difference <= 1) {
      this.addCheck(results, 'replica-distribution', checkName, 'pass', '',
        `Perfect replica balance: Each broker carries ${avgReplicas.toFixed(1)} replicas on average (range: ${minReplicas}-${maxReplicas})`);
    } else if (percentageDifference <= 20) {
      this.addCheck(results, 'replica-distribution', checkName, 'pass', '',
        `Good replica balance: Brokers carry ${avgReplicas.toFixed(1)} replicas on average. Most loaded broker: ${maxReplicas}, least loaded: ${minReplicas} (${percentageDifference.toFixed(1)}% difference)`);
    } else if (percentageDifference <= 50) {
      this.addCheck(results, 'replica-distribution', checkName, 'fail', 'medium',
        `Uneven replica distribution: Brokers carry ${avgReplicas.toFixed(1)} replicas on average. Most loaded broker: ${maxReplicas}, least loaded: ${minReplicas} (${percentageDifference.toFixed(1)}% difference)`,
        'Consider rebalancing replicas across brokers for better load distribution and performance');
    } else {
      this.addCheck(results, 'replica-distribution', checkName, 'fail', 'medium',
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
        this.addCheck(results, 'metrics-enabled', checkName, 'fail', 'low', 
          'Open Monitoring not detected - port 11001 is not accessible on any brokers',
          'Enable Open Monitoring in AWS MSK console to expose metrics on port 11001');
      } else if (accessibleBrokers === totalBrokers) {
        this.addCheck(results, 'metrics-enabled', checkName, 'pass', '',
          `Open Monitoring enabled - port 11001 accessible on all ${totalBrokers} brokers`);
      } else {
        this.addCheck(results, 'metrics-enabled', checkName, 'fail', 'low', 
          `Partial Open Monitoring - port 11001 accessible on ${accessibleBrokers}/${totalBrokers} brokers`,
          'Enable Open Monitoring on all brokers for consistent metrics access');
      }
      
    } catch (error) {
      // If the entire check fails, provide a fallback message
      this.addCheck(results, 'metrics-enabled', checkName, 'fail', 'low', 
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
        this.addCheck(results, 'metrics-enabled', checkName, 'fail', 'low', 
          'No JMX metrics configuration detected on any brokers',
          'Enable JMX metrics on brokers for better monitoring, alerting, and performance analysis');
      } else if (brokersWithMetrics === totalBrokers) {
        this.addCheck(results, 'metrics-enabled', checkName, 'pass', '',
          `All ${totalBrokers} brokers have metrics configuration detected`);
      } else {
        this.addCheck(results, 'metrics-enabled', checkName, 'fail', 'low', 
          `${brokersWithMetrics}/${totalBrokers} brokers have metrics configuration`,
          'Enable metrics on all brokers for consistent monitoring and observability');
      }
      
    } catch (error) {
      // If we can't check metrics configuration, provide a general recommendation
      this.addCheck(results, 'metrics-enabled', checkName, 'fail', 'low', 
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
        this.addCheck(results, 'logging-configuration', checkName, 'fail', 'low', 
          'Unable to determine cluster ARN for logging check',
          'Set MSK_CLUSTER_ARN environment variable or ensure cluster ARN is available in broker metadata');
        return;
      }
      
      // Initialize MSK client with error handling
      let msk;
      try {
        msk = new KafkaClient();
      } catch (error) {
        this.addCheck(results, 'logging-configuration', checkName, 'fail', 'low', 
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
        this.addCheck(results, 'logging-configuration', checkName, 'fail', 'low', 
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
        this.addCheck(results, 'logging-configuration', checkName, 'fail', 'low', 
          'Logging is configured but no log types are enabled',
          'Enable CloudWatch, S3, or Firehose logging in the LoggingInfo configuration');
      } else {
        this.addCheck(results, 'logging-configuration', checkName, 'pass', '',
          `Logging enabled with: ${enabledLogTypes.join(', ')}`,
          'Logs are being delivered to the configured destinations');
      }
      
    } catch (error) {
      console.log(chalk.gray(`Debug: AWS SDK error: ${error.message}`));
      
      if (error.name === 'AccessDenied' || error.name === 'UnauthorizedOperation') {
        this.addCheck(results, 'logging-configuration', checkName, 'fail', 'low', 
          'Insufficient permissions to check logging configuration',
          'Ensure IAM permissions include msk:DescribeCluster or check logging manually in AWS Console');
      } else if (error.name === 'ResourceNotFoundException') {
        this.addCheck(results, 'logging-configuration', checkName, 'fail', 'low', 
          'Cluster not found or ARN is incorrect',
          'Verify the cluster ARN and ensure it exists in the current AWS region');
      } else if (error.name === 'InvalidParameterValue') {
        this.addCheck(results, 'logging-configuration', checkName, 'fail', 'low', 
          'Invalid cluster ARN format',
          'Set MSK_CLUSTER_ARN environment variable with the correct cluster ARN');
      } else {
        this.addCheck(results, 'logging-configuration', checkName, 'fail', 'low', 
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
    this.addCheck(results, 'logging-configuration', checkName, 'pass', '',
      'Confluent Cloud provides built-in logging and monitoring capabilities',
      'Logs are automatically collected and available in the Confluent Cloud console');
  }

  async checkAivenLogging(clusterInfo, topics, results) {
    const checkName = 'Aiven Kafka Logging Configuration';
    
    // Aiven provides comprehensive logging
    this.addCheck(results, 'logging-configuration', checkName, 'pass', '',
      'Aiven Kafka provides comprehensive logging and monitoring',
      'Logs are automatically collected and available in the Aiven console');
  }

  async checkGenericLogging(clusterInfo, topics, results) {
    const checkName = 'Generic Kafka Logging Configuration';
    
    // For generic Kafka, check if log directories are accessible
    try {
      // Check if we can access broker configurations for logging settings
      // This is a simplified check - in practice, you'd need to examine server.properties
      
      this.addCheck(results, 'logging-configuration', checkName, 'fail', 'low', 
        'Generic Kafka logging configuration check',
        'Verify log4j configuration and log directory permissions in server.properties');
    } catch (error) {
      this.addCheck(results, 'logging-configuration', checkName, 'fail', 'low', 
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
        this.addCheck(results, 'authentication-configuration', checkName, 'fail', 'critical',
          'Unauthenticated access is enabled - this is a security risk',
          'Disable unauthenticated access in AWS MSK console and enable IAM or SCRAM authentication');
      } else {
        this.addCheck(results, 'authentication-configuration', checkName, 'pass', '',
          'Authentication is configured (SASL or SSL enabled)',
          'Authentication provides secure access control for your MSK cluster');
      }
      
    } catch (error) {
      this.addCheck(results, 'authentication-configuration', checkName, 'fail', 'critical', 
        'Unable to verify AWS MSK authentication configuration',
        'Check authentication settings in AWS MSK console and ensure IAM roles are properly configured');
    }
  }

  async checkConfluentCloudAuthentication(clusterInfo, topics, results) {
    const checkName = 'Confluent Cloud Authentication Configuration';
    
    // Confluent Cloud requires authentication by default, so unauthenticated access is not possible
    this.addCheck(results, 'authentication-configuration', checkName, 'pass', '',
      'Confluent Cloud provides built-in authentication and security',
      'Authentication is automatically configured and managed by Confluent Cloud');
  }

  async checkAivenAuthentication(clusterInfo, topics, results) {
    const checkName = 'Aiven Kafka Authentication Configuration';
    
    // Aiven provides comprehensive authentication by default, so unauthenticated access is not possible
    this.addCheck(results, 'authentication-configuration', checkName, 'pass', '',
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
        this.addCheck(results, 'authentication-configuration', checkName, 'fail', 'critical',
          'Unauthenticated access is enabled - this is a security risk',
          'Enable SASL or SSL authentication in server.properties for better security');
      } else {
        this.addCheck(results, 'authentication-configuration', checkName, 'pass', '',
          'Authentication is configured (SASL or SSL enabled)',
          'Authentication provides secure access control for your Kafka cluster');
      }
      
    } catch (error) {
      this.addCheck(results, 'authentication-configuration', checkName, 'fail', 'critical', 
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
        this.addCheck(results, 'quotas-configuration', checkName, 'fail', 'low', 
          'Unable to determine cluster ARN for quotas check',
          'Set MSK_CLUSTER_ARN environment variable or ensure cluster ARN is available in broker metadata');
        return;
      }
      
      // Initialize MSK client with error handling
      let msk;
      try {
        msk = new KafkaClient();
      } catch (error) {
        this.addCheck(results, 'quotas-configuration', checkName, 'fail', 'low', 
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
                this.addCheck(results, 'quotas-configuration', checkName, 'pass', '',
                  'Quotas appear to be configured in AWS MSK cluster',
                  'Quotas are configured and should be providing resource management');
              } else {
                this.addCheck(results, 'quotas-configuration', checkName, 'fail', 'low', 
                  'No quota configuration detected in AWS MSK cluster',
                  'Consider configuring client quotas in AWS MSK console or via AWS CLI for better resource management');
              }
            } else {
              this.addCheck(results, 'quotas-configuration', checkName, 'fail', 'low', 
                'Unable to verify quota configuration in AWS MSK cluster',
                'Check quota settings in AWS MSK console and ensure proper quota configuration for resource management');
            }
          } catch (configError) {
            this.addCheck(results, 'quotas-configuration', checkName, 'fail', 'low', 
              'Unable to check cluster configuration for quotas',
              'Check quota settings in AWS MSK console and ensure proper quota configuration for resource management');
          }
        } else {
          this.addCheck(results, 'quotas-configuration', checkName, 'fail', 'low', 
            'No configuration found for AWS MSK cluster',
            'Configure quotas in AWS MSK console or use AWS CLI to set client quotas for better resource management');
        }
      } else {
        this.addCheck(results, 'quotas-configuration', checkName, 'fail', 'low', 
          'Unable to retrieve AWS MSK cluster details for quotas check',
          'Check quota settings in AWS MSK console and ensure proper quota configuration for resource management');
      }
      
    } catch (error) {
      this.addCheck(results, 'quotas-configuration', checkName, 'fail', 'low', 
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
        this.addCheck(results, 'quotas-configuration', checkName, 'pass', '',
          'Quotas are configured and being used in Confluent Cloud',
          'Confluent Cloud quotas are properly configured and providing resource management');
      } else {
        this.addCheck(results, 'quotas-configuration', checkName, 'pass', '', 
          'Confluent Cloud provides built-in quota management',
          'Quotas are automatically managed by Confluent Cloud for optimal resource utilization');
      }
      
    } catch (error) {
      this.addCheck(results, 'quotas-configuration', checkName, 'pass', '', 
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
        this.addCheck(results, 'quotas-configuration', checkName, 'pass', '',
          'Quotas are configured and being used in Aiven Kafka',
          'Aiven Kafka quotas are properly configured and providing resource management');
      } else {
        this.addCheck(results, 'quotas-configuration', checkName, 'pass', '', 
          'Aiven Kafka provides built-in quota management',
          'Quotas are automatically managed by Aiven for optimal resource utilization');
      }
      
    } catch (error) {
      this.addCheck(results, 'quotas-configuration', checkName, 'pass', '', 
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
        this.addCheck(results, 'quotas-configuration', checkName, 'pass', '',
          'Quotas appear to be configured in Kafka cluster',
          'Quotas are configured and should be providing resource management');
      } else {
        this.addCheck(results, 'quotas-configuration', checkName, 'fail', 'low', 
          'No quota configuration detected in Kafka cluster',
          'Configure quotas in server.properties or use kafka-configs.sh to set client quotas for better resource management');
      }
      
    } catch (error) {
      this.addCheck(results, 'quotas-configuration', checkName, 'fail', 'low', 
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
        this.addCheck(results, 'payload-compression', checkName, 'pass', '', 
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
        this.addCheck(results, 'payload-compression', checkName, 'pass', '',
          `All ${totalUserTopics} user topics have compression enabled (100%)`,
          'Compression is properly configured for all topics, providing optimal storage and network efficiency');
      } else if (compressedTopics > 0) {
        this.addCheck(results, 'payload-compression', checkName, 'fail', 'medium', 
          `${compressedTopics} out of ${totalUserTopics} user topics have compression enabled (${compressionPercentage}%)`,
          `Consider enabling compression on the remaining ${totalUserTopics - compressedTopics} topics for better storage and network efficiency`);
      } else {
        this.addCheck(results, 'payload-compression', checkName, 'fail', 'medium', 
          `No compression detected on any of the ${totalUserTopics} user topics (0%)`,
          'Enable compression on topics to reduce storage usage and improve network performance');
      }
      
    } catch (error) {
      this.addCheck(results, 'payload-compression', checkName, 'fail', 'medium', 
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
        this.addCheck(results, 'infinite-retention-policy', checkName, 'pass', '',
          'No topics have infinite retention policy enabled');
      } else {
        const topicList = infiniteRetentionTopics.map(t => 
          `${t.name} (retention.ms: ${t.config['retention.ms']})`
        ).join(', ');
        
        this.addCheck(results, 'infinite-retention-policy', checkName, 'fail', 'medium', 
          `${infiniteRetentionTopics.length} topic(s) have infinite retention policy enabled: ${topicList}`,
          'Consider setting a finite retention policy for these topics to manage storage and data retention');
      }
      
    } catch (error) {
      this.addCheck(results, 'infinite-retention-policy', checkName, 'fail', 'medium', 
        'Unable to verify infinite retention policy',
        'Check topic configurations for retention settings');
    }
  }

  async checkUncleanLeaderElection(clusterInfo, topics, results) {
    const checkName = 'Unclean Leader Election';

    try {
      // Check if any topic has unclean leader election enabled
      const existUncleanLeaderInTopics = topics.some(topic => 
        topic.config && topic.config['unclean.leader.election.enable'] && 
        (topic.config['unclean.leader.election.enable'].value === 'true' || topic.config['unclean.leader.election.enable'].value === true)
      );
      
      // Check if any broker has unclean leader election enabled
      const existUncleanLeaderInBrokers = clusterInfo.brokers.some(broker => 
        broker.config && broker.config['unclean.leader.election.enable'] && 
        (broker.config['unclean.leader.election.enable'].value === 'true' || broker.config['unclean.leader.election.enable'].value === true)
      );
      
      const issuesPresent = existUncleanLeaderInTopics || existUncleanLeaderInBrokers;
      
      if (!issuesPresent) {
        this.addCheck(results, 'unclean-leader-election', checkName, 'pass', '',
          'No topics or brokers have unclean leader election enabled');
        return;
      }
      
      this.addCheck(results, 'unclean-leader-election', checkName, 'fail', 'critical', 
        `Found configurations with unclean leader election enabled`,
        'Recommended: Set unclean.leader.election.enable=false at broker or topic level to prevent out-of-sync replicas from becoming leaders');
    } catch (error) {
      this.addCheck(results, 'unclean-leader-election', checkName, 'fail', 'critical', 
        'Unable to verify unclean leader election configuration',
        'Check topic and broker configurations for unclean.leader.election.enable setting');
    }
  }

  async checkAclEnforcement(clusterInfo, topics, results) {
    switch (this.vendor) {
      case 'confluent-cloud':
        await this.checkConfluentCloudAclEnforcement(clusterInfo, topics, results);
        break;
      default:
        await this.checkGenericAclEnforcement(clusterInfo, topics, results);
    }
  }

  async checkGenericAclEnforcement(clusterInfo, topics, results) {
    const checkName = 'ACL Enforcement';

    try {
      // Check if ACL enforcement is properly configured
      // For Apache Kafka and AWS MSK, we need to verify:
      // 1. authorizer.class.name is set (should be kafka.security.authorizer.AclAuthorizer)
      // 2. allow.everyone.if.no.acl.found=false
      
      let aclEnforcementEnabled = true;

      // Check broker configurations for ACL settings
      clusterInfo.brokers.forEach((broker) => {
        if (broker.config) {
          // Check for authorizer.class.name
          const authorizerClass = broker.config['authorizer.class.name'];
          if (!authorizerClass || !authorizerClass.value || authorizerClass.value !== 'kafka.security.authorizer.AclAuthorizer') {
            aclEnforcementEnabled = false;
          }

          // Check for allow.everyone.if.no.acl.found
          const allowEveryone = broker.config['allow.everyone.if.no.acl.found'];
          if (!allowEveryone || allowEveryone.value === undefined || allowEveryone.value !== 'false' && allowEveryone.value !== false) {
            aclEnforcementEnabled = false;
          }
        } else {
          aclEnforcementEnabled = false;
        }
      });

      if (aclEnforcementEnabled) {
        this.addCheck(results, 'acl-enforcement', checkName, 'pass', '',
          'ACL enforcement is properly configured - authorizer is enabled and allow.everyone.if.no.acl.found=false',
          'ACL enforcement is working correctly to prevent unauthorized access');
      } else {
        this.addCheck(results, 'acl-enforcement', checkName, 'fail', 'critical',
          'ACL enforcement is not properly configured',
          'Recommended: Set authorizer.class.name=kafka.security.authorizer.AclAuthorizer and allow.everyone.if.no.acl.found=false in server.properties for all brokers');
      }

    } catch (error) {
      this.addCheck(results, 'acl-enforcement', checkName, 'fail', 'critical',
        'Unable to verify ACL enforcement configuration',
        'Check server.properties for authorizer.class.name and allow.everyone.if.no.acl.found settings on all brokers');
    }
  }

  stripPortFromHost(host) {
    return host.replace(/:\d+$/, '');
  }

  async checkConfluentCloudAclEnforcement(clusterInfo, topics, results) {
    const checkName = 'ACL Enforcement';

    try {
      // Check if Confluent Cloud API credentials are available
      const { ConfluentService } = require('./confluent-service.js');

      if (!(this.confluentConfig && this.confluentConfig.resourceApiKey && this.confluentConfig.resourceApiSecret && this.confluentConfig.clusterId)) {
        console.log('🔒 Skipping Confluent Cloud ACL enforcement check: No API credentials (API key, API secret, cluster ID) provided');
        return;
      }

      const apiKey = this.confluentConfig?.resourceApiKey;
      const apiSecret = this.confluentConfig?.resourceApiSecret;
      const clusterId = this.confluentConfig?.clusterId;
      const restEndpoint = this.stripPortFromHost(this.config.brokers[0]);

      // Initialize Confluent service and check ACLs
      const confluentService = new ConfluentService(apiKey, apiSecret, clusterId, restEndpoint);
      const aclAnalysis = await confluentService.checkAclEnforcement(clusterId);

      if (!aclAnalysis.enabled) {
        this.addCheck(results, 'acl-enforcement', checkName, 'fail', 'critical',
          `Unable to verify Confluent Cloud ACL enforcement: ${aclAnalysis.reason}`,
          'Check API credentials and network connectivity to Confluent Cloud');
        return;
      }

      if (aclAnalysis.hasOverlyPermissiveRules) {
        this.addCheck(results, 'acl-enforcement', checkName, 'fail', 'critical',
          `Found ${aclAnalysis.issues.length} overly permissive ACL rules in Confluent Cloud`,
          'Review and restrict overly permissive ACL rules to follow least-privilege access patterns. Remove wildcard permissions and overly broad operations.');
      } else {
        this.addCheck(results, 'acl-enforcement', checkName, 'pass', '',
          `ACL enforcement is properly configured - ${aclAnalysis.aclCount} ACLs found with no overly permissive rules`,
          'ACL enforcement is working correctly with least-privilege access patterns');
      }

    } catch (error) {
      this.addCheck(results, 'acl-enforcement', checkName, 'fail', 'critical',
        `Unable to verify Confluent Cloud ACL enforcement: ${error.message}`,
        'Check Confluent Cloud API credentials and network connectivity');
    }
  }

  async checkAutoTopicCreation(clusterInfo, topics, results) {
    const checkName = 'Auto Topic Creation Configuration';
    
    try {
      // Check if auto topic creation is enabled in broker configurations
      let autoTopicCreationEnabled = false;
      let brokersWithAutoCreation = 0;
      const totalBrokers = clusterInfo.brokers.length;
      
      // Check each broker for auto.create.topics.enable setting
      clusterInfo.brokers.forEach((broker) => {
        if (broker.config) {
          const autoCreateTopics = broker.config['auto.create.topics.enable'];
          if (autoCreateTopics && (autoCreateTopics.value === 'true' || autoCreateTopics.value === true)) {
            autoTopicCreationEnabled = true;
            brokersWithAutoCreation++;
          }
        }
      });
      
      if (!autoTopicCreationEnabled) {
        this.addCheck(results, 'auto-topic-creation', checkName, 'pass', '',
          'Auto topic creation is disabled on all brokers',
          'Auto topic creation is properly disabled, preventing accidental topic creation with default configurations');
      } else {
        this.addCheck(results, 'auto-topic-creation', checkName, 'fail', 'critical',
          `Auto topic creation is enabled on ${brokersWithAutoCreation}/${totalBrokers} brokers - this is a security risk`,
          'Set auto.create.topics.enable=false for all brokers to prevent accidental topic creation with RF=1 and default configurations');
      }
    
    } catch (error) {
      this.addCheck(results, 'auto-topic-creation', checkName, 'fail', 'critical',
        'Unable to verify auto topic creation configuration',
        'Check configuration for auto.create.topics.enable setting on all brokers and ensure it is set to false');
    }
  }

  async checkMessageSizeConsistency(clusterInfo, topics, results) {
    const checkName = 'Message Size Consistency';
    
    try {
      // Check message size limits hierarchy across all brokers
      const issues = [];
      const brokerCount = clusterInfo.brokers.length;
      
      if (brokerCount === 0) {
        this.addCheck(results, 'message-size-consistency', checkName, 'fail', 'high', 
          'No brokers found in cluster metadata');
        return;
      }

      // Check each broker for message size configuration
      clusterInfo.brokers.forEach((broker, index) => {
        if (broker.config) {
          const messageMaxBytes = this.getConfigValue(broker.config, 'message.max.bytes');
          const replicaFetchMaxBytes = this.getConfigValue(broker.config, 'replica.fetch.max.bytes');
          const fetchMaxBytes = this.getConfigValue(broker.config, 'fetch.max.bytes');
          
          // Check hierarchy: message.max.bytes < replica.fetch.max.bytes < fetch.max.bytes
          if (messageMaxBytes && replicaFetchMaxBytes && fetchMaxBytes) {
            const msgMax = parseInt(messageMaxBytes);
            const replicaFetchMax = parseInt(replicaFetchMaxBytes);
            const fetchMax = parseInt(fetchMaxBytes);
            
            if (msgMax >= replicaFetchMax) {
              issues.push(`Broker ${broker.nodeId || index}: message.max.bytes (${msgMax}) should be < replica.fetch.max.bytes (${replicaFetchMax})`);
            }
            
            if (replicaFetchMax >= fetchMax) {
              issues.push(`Broker ${broker.nodeId || index}: replica.fetch.max.bytes (${replicaFetchMax}) should be < fetch.max.bytes (${fetchMax})`);
            }
          } else {
            // Missing configuration
            const missing = [];
            if (!messageMaxBytes) missing.push('message.max.bytes');
            if (!replicaFetchMaxBytes) missing.push('replica.fetch.max.bytes');
            if (!fetchMaxBytes) missing.push('fetch.max.bytes');
            
            issues.push(`Broker ${broker.nodeId || index}: Missing configuration: ${missing.join(', ')}`);
          }
        } else {
          issues.push(`Broker ${broker.nodeId || index}: No configuration available`);
        }
      });

      if (issues.length === 0) {
        this.addCheck(results, 'message-size-consistency', checkName, 'pass', '',
          'Message size limits are properly configured with correct hierarchy across all brokers',
          'Maintain hierarchy: producer max.request.size <= message.max.bytes < replica.fetch.max.bytes < fetch.max.bytes');
      } else {
        this.addCheck(results, 'message-size-consistency', checkName, 'fail', 'high',
          `Found ${issues.length} message size configuration issue(s): ${issues.join('; ')}`,
          'Configure proper hierarchy: message.max.bytes < replica.fetch.max.bytes < fetch.max.bytes. Typical values: message.max.bytes=1MB, replica.fetch.max.bytes=2MB, fetch.max.bytes=5MB');
      }
      
    } catch (error) {
      this.addCheck(results, 'message-size-consistency', checkName, 'fail', 'high',
        'Unable to verify message size consistency configuration',
        'Check broker configurations for message.max.bytes, replica.fetch.max.bytes, and fetch.max.bytes settings');
    }
  }

  async checkDefaultTopicReplication(clusterInfo, topics, results) {
    const checkName = 'Default Topic Replication';
    
    try {
      // Check default replication factor across all brokers
      const issues = [];
      const brokerCount = clusterInfo.brokers.length;
      

      if (brokerCount < 3) {
        return // run only if brokerCount >= 3
      }

      if (brokerCount === 0) {
        this.addCheck(results, 'default-topic-replication', checkName, 'fail', 'high', 
          'No brokers found in cluster metadata');
        return;
      }

      let brokersWithProperRF = 0;
      let brokersWithLowRF = 0;
      let brokersWithMissingConfig = 0;

      // Check each broker for default.replication.factor configuration
      clusterInfo.brokers.forEach((broker, index) => {
        if (broker.config) {
          const defaultReplicationFactor = this.getConfigValue(broker.config, 'default.replication.factor');
          
          if (defaultReplicationFactor) {
            const rf = parseInt(defaultReplicationFactor);
            if (rf >= 3) {
              brokersWithProperRF++;
            } else {
              brokersWithLowRF++;
              issues.push(`Broker ${broker.nodeId || index}: default.replication.factor=${rf} (should be >= 3)`);
            }
          } else {
            brokersWithMissingConfig++;
            issues.push(`Broker ${broker.nodeId || index}: default.replication.factor not configured (defaults to 1)`);
          }
        } else {
          brokersWithMissingConfig++;
          issues.push(`Broker ${broker.nodeId || index}: No configuration available`);
        }
      });

      if (brokersWithProperRF === brokerCount) {
        this.addCheck(results, 'default-topic-replication', checkName, 'pass', '',
          `All ${brokerCount} brokers have proper default replication factor (>= 3)`,
          'Default replication factor is properly configured to ensure new topics have adequate redundancy');
      } else if (brokersWithLowRF > 0 || brokersWithMissingConfig > 0) {
        this.addCheck(results, 'default-topic-replication', checkName, 'fail', 'high',
          `Found ${issues.length} default replication factor issue(s): ${issues.join('; ')}`,
          'Set default.replication.factor=3 (or >=3) in server.properties for all brokers to ensure new topics have proper redundancy by default');
      } else {
        this.addCheck(results, 'default-topic-replication', checkName, 'fail', 'high',
          'Unable to verify default replication factor configuration',
          'Check server.properties for default.replication.factor setting on all brokers and ensure it is set to 3 or higher');
      }
      
    } catch (error) {
      this.addCheck(results, 'default-topic-replication', checkName, 'fail', 'high',
        'Unable to verify default topic replication configuration',
        'Check server.properties for default.replication.factor setting on all brokers and ensure it is set to 3 or higher');
    }
  }

  async checkControlledShutdown(clusterInfo, topics, results) {
    const checkName = 'Controlled Shutdown';
    
    try {
      // Check controlled shutdown configuration across all brokers
      const issues = [];
      const brokerCount = clusterInfo.brokers.length;
      
      if (brokerCount === 0) {
        this.addCheck(results, 'controlled-shutdown', checkName, 'fail', 'medium', 
          'No brokers found in cluster metadata');
        return;
      }

      let brokersWithControlledShutdown = 0;
      let brokersWithDisabledShutdown = 0;
      let brokersWithMissingConfig = 0;
      let brokersWithSuboptimalConfig = 0;

      // Check each broker for controlled shutdown configuration
      clusterInfo.brokers.forEach((broker, index) => {
        if (broker.config) {
          const controlledShutdownEnable = this.getConfigValue(broker.config, 'controlled.shutdown.enable');
          const maxRetries = this.getConfigValue(broker.config, 'controlled.shutdown.max.retries');
          const retryBackoff = this.getConfigValue(broker.config, 'controlled.shutdown.retry.backoff.ms');
          
          if (controlledShutdownEnable) {
            const isEnabled = controlledShutdownEnable === 'true' || controlledShutdownEnable === true;
            
            if (isEnabled) {
              brokersWithControlledShutdown++;
              
              // Check for optimal retry configuration
              const retries = maxRetries ? parseInt(maxRetries) : null;
              const backoff = retryBackoff ? parseInt(retryBackoff) : null;
              
              if (retries !== null && retries < 3) {
                brokersWithSuboptimalConfig++;
                issues.push(`Broker ${broker.nodeId || index}: controlled.shutdown.max.retries=${retries} (recommended: >=3)`);
              }
              
              if (backoff !== null && backoff < 5000) {
                brokersWithSuboptimalConfig++;
                issues.push(`Broker ${broker.nodeId || index}: controlled.shutdown.retry.backoff.ms=${backoff} (recommended: >=5000)`);
              }
            } else {
              brokersWithDisabledShutdown++;
              issues.push(`Broker ${broker.nodeId || index}: controlled.shutdown.enable=false (should be true)`);
            }
          } else {
            brokersWithMissingConfig++;
            issues.push(`Broker ${broker.nodeId || index}: controlled.shutdown.enable not configured (defaults to true in modern Kafka)`);
          }
        } else {
          brokersWithMissingConfig++;
          issues.push(`Broker ${broker.nodeId || index}: No configuration available`);
        }
      });

      if (brokersWithControlledShutdown === brokerCount && brokersWithSuboptimalConfig === 0) {
        this.addCheck(results, 'controlled-shutdown', checkName, 'pass', '',
          `All ${brokerCount} brokers have optimal controlled shutdown configuration`,
          'Controlled shutdown is properly configured with recommended retry settings for graceful broker restarts');
      } else if (brokersWithDisabledShutdown > 0 || brokersWithMissingConfig > 0) {
        this.addCheck(results, 'controlled-shutdown', checkName, 'fail', 'medium',
          `Found ${issues.length} controlled shutdown configuration issue(s): ${issues.join('; ')}`,
          'Set controlled.shutdown.enable=true, controlled.shutdown.max.retries=3, and controlled.shutdown.retry.backoff.ms=5000 in server.properties for all brokers');
      } else if (brokersWithSuboptimalConfig > 0) {
        this.addCheck(results, 'controlled-shutdown', checkName, 'fail', 'medium',
          `Found ${issues.length} suboptimal controlled shutdown configuration(s): ${issues.join('; ')}`,
          'Optimize controlled shutdown settings: controlled.shutdown.max.retries=3 and controlled.shutdown.retry.backoff.ms=5000 for better restart behavior');
      } else {
        this.addCheck(results, 'controlled-shutdown', checkName, 'fail', 'medium',
          'Unable to verify controlled shutdown configuration',
          'Check server.properties for controlled.shutdown.enable setting on all brokers and ensure it is set to true');
      }
      
    } catch (error) {
      this.addCheck(results, 'controlled-shutdown', checkName, 'fail', 'medium',
        'Unable to verify controlled shutdown configuration',
        'Check server.properties for controlled.shutdown.enable setting on all brokers and ensure it is set to true');
    }
  }

  // Helper method to get configuration value
  getConfigValue(config, key) {
    if (config && config[key]) {
      return config[key].value || config[key];
    }
    return null;
  }

  addCheck(results, id, name, status, severity, message, recommendation = null) {
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
        'Checks if any topics have infinite retention policy enabled (retention.ms = infinite). Healthy: No topics have infinite retention. Warning: Some topics have infinite retention policy (bad practice). Info: Unable to verify retention policy.',
      'unclean-leader-election':
        'Checks if unclean leader election is enabled, which can cause data loss if out-of-sync replicas become leaders. Healthy: unclean.leader.election.enable=false. Failed: unclean.leader.election.enable=true (critical security risk).',
      'acl-enforcement':
        'Checks if ACL (Access Control List) enforcement is properly configured to prevent unauthorized access. For Apache/MSK: Verifies authorizer.class.name is set and allow.everyone.if.no.acl.found=false. Healthy: ACL enforcement is enabled. Failed: ACL enforcement is disabled (critical security risk).',
      'auto-topic-creation':
        'Checks if auto topic creation is enabled, which can lead to accidental topics with RF=1 and default configurations. For Apache/MSK/Aiven: Verifies auto.create.topics.enable=false. For Confluent Cloud: Already disabled by platform. Healthy: Auto topic creation is disabled. Failed: Auto topic creation is enabled (critical security risk).',
      'message-size-consistency':
        'Checks if message size limits are properly configured with correct hierarchy. Verifies producer max.request.size <= message.max.bytes < replica.fetch.max.bytes < fetch.max.bytes. Healthy: Proper hierarchy maintained. Failed: Incorrect hierarchy causing potential message rejections.',
      'default-topic-replication':
        'Checks if default replication factor is properly configured for new topics. Verifies default.replication.factor >= 3 to ensure proper redundancy. For Apache/MSK: Checks broker configuration. For Confluent/Aiven: RF managed by platform. Healthy: Default RF >= 3. Failed: Default RF = 1 or unset (high risk).',
      'controlled-shutdown':
        'Checks if controlled shutdown is properly configured to prevent unnecessary broker unavailability during restarts. Verifies controlled.shutdown.enable=true and related retry settings. For Apache/MSK/Aiven: Checks broker configuration. Healthy: Controlled shutdown enabled with proper retry settings. Failed: Controlled shutdown disabled or misconfigured.',
      'consumer-lag-threshold':
        'Checks if any consumer group lag exceeds the threshold (default 10,000 messages). Healthy: All groups below threshold. Failed: One or more groups above threshold; consider scaling consumers, optimizing processing, or increasing partitions.',
      'dead-consumer-groups':
        'Checks for consumer groups in DEAD state. Healthy: No long-dead groups. Failed: Dead groups found; delete unused groups to clean up metadata.',
      'min-insync-replicas':
        'Checks if topics with min.insync.replicas configured have it ≤ replication factor. Healthy: All configured topics have min.insync.replicas ≤ replication factor. Failed: Any topic has min.insync.replicas > replication factor (critical - prevents writes).',
      'single-partition-high-throughput':
        'Checks for single-partition topics with high throughput (>1MB/s). Healthy: No single-partition topics exceed threshold. Failed: Single-partition, high-throughput topics found; increase partitions to enable parallelism.',
      'under-replicated-partitions':
        'Checks if topics have fewer in-sync replicas than configured replication factor. Healthy: All partitions have expected number of in-sync replicas. Failed: Under-replicated partitions detected; check broker health and network connectivity.'
    };

    const check = {
      id,
      name,
      status, // 'pass', 'fail',
      severity, // 'critical', 'high', 'medium', 'low'
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
        results.failedChecks++;
        break;
    }
  }

  displayCheckResult(check) {
    const statusIcons = {
      'pass': '✅',
      'fail': '❌'
    };

    const statusColors = {
      'pass': chalk.green,
      'fail': chalk.red,
    };

    const severityIcons = {
      'critical': '🔴',
      'high': '🟠',
      'medium': '🟡',
      'low': '🔵'
    };
    const severityColors = {
      'critical': chalk.red,
      'high': chalk.orange,
      'medium': chalk.yellow,
      'low': chalk.blue
    };

    const severityIcon = severityIcons[check.severity] || '';
    const severityColor = severityColors[check.severity] || chalk.white;
  
    const statusIcon = statusIcons[check.status] || '';
    const statusColor = statusColors[check.status] || chalk.white;


    let status = `${statusIcon} ${statusColor(check.name)}`
    if (check.status === 'fail') {
      status = status + ` ${severityIcon} ${severityColor(this.capitalize(check.severity) + ' severity')}`
    }

    console.log(status);
    console.log(`   ${check.message}`);
    
    if (check.recommendation) {
      console.log(`   💡 Recommendation: ${chalk.cyan(check.recommendation)}`);
    }
    console.log('');
  }

  capitalize(word) {
    if (!word) return '';
    return word.charAt(0).toUpperCase() + word.slice(1);
  }

  displayResults(results) {
    console.log(chalk.blue('\n📊 Health Check Summary\n'));
    
    const summary = [
      `Total Checks: ${results.totalChecks}`,
      `❌ Failed: ${results.failedChecks}`,
      `✅ Passed: ${results.passedChecks}`
    ];

    console.log(summary.join(' | '));
    console.log('');

    const severityOrder = { 'critical': 1, 'high': 2, 'medium': 3, 'low': 4 };
    const sortedChecks = results.checks.sort((a, b) => {
      const severityA = severityOrder[a.severity] || 5;
      const severityB = severityOrder[b.severity] || 5;
      return severityA - severityB;
    });

    sortedChecks.forEach(check => {
      this.displayCheckResult(check);
    });
  }
}

module.exports = { HealthChecker }; 