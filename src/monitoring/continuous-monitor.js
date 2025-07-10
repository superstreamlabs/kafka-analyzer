const EventEmitter = require('events');
const { KafkaClient } = require('../kafka-client');
const { HealthChecker } = require('../health-checker');
const chalk = require('chalk');
const fs = require('fs').promises;
const path = require('path');

class ContinuousMonitor extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.kafkaClient = new KafkaClient(config.kafka);
    this.healthChecker = new HealthChecker(config.kafka.vendor, config.kafka);
    this.isRunning = false;
    this.intervalId = null;
    this.metricsIntervalId = null;
    this.consecutiveFailures = 0;
    this.lastHealthScore = null;
    this.baseline = null;
    
    this.thresholds = {
      healthScoreChange: 10,
      consecutiveFailureLimit: 3,
      significantLagIncrease: 50,
      newIssueDetection: true
    };

    this.monitoringConfig = {
      interval: config.monitoring?.interval || 300,
      metricsInterval: config.monitoring?.metricsCollection?.interval || 60,
      enabled: config.monitoring?.enabled !== false,
      metricsEnabled: config.monitoring?.metricsCollection?.enabled !== false
    };
  }

  async start() {
    if (this.isRunning) {
      console.log(chalk.yellow('⚠️ Monitoring is already running'));
      return;
    }

    console.log(chalk.blue('🚀 Starting Continuous Kafka Monitoring...'));
    console.log(chalk.gray(`📊 Analysis interval: ${this.monitoringConfig.interval} seconds`));
    console.log(chalk.gray(`📈 Metrics collection interval: ${this.monitoringConfig.metricsInterval} seconds`));
    
    try {
      await this.kafkaClient.connect();
      console.log(chalk.green('✅ Initial connection successful'));
      
      await this.establishBaseline();
      
      this.startAnalysisInterval();
      
      if (this.monitoringConfig.metricsEnabled) {
        this.startMetricsInterval();
      }
      
      this.isRunning = true;
      this.emit('started');
      
      console.log(chalk.green('✅ Continuous monitoring started successfully'));
      console.log(chalk.gray('💡 Press Ctrl+C to stop monitoring'));
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to start monitoring:'), error.message);
      this.emit('error', error);
      throw error;
    }
  }

  async establishBaseline() {
    console.log(chalk.blue('📏 Establishing baseline metrics...'));
    
    try {
      const metrics = await this.collectMetrics();
      const healthResults = await this.runHealthChecks();
      
      this.baseline = {
        timestamp: new Date().toISOString(),
        healthScore: this.calculateHealthScore(healthResults),
        topicCount: metrics.topics.length,
        totalPartitions: metrics.topics.reduce((sum, topic) => sum + topic.partitions, 0),
        consumerGroups: metrics.consumers.length,
        totalLag: metrics.consumers.reduce((sum, consumer) => sum + consumer.totalLag, 0)
      };
      
      console.log(chalk.green('✅ Baseline established:'), {
        healthScore: `${this.baseline.healthScore}%`,
        topics: this.baseline.topicCount,
        partitions: this.baseline.totalPartitions,
        consumerGroups: this.baseline.consumerGroups,
        totalLag: this.baseline.totalLag
      });
      
    } catch (error) {
      console.error(chalk.yellow('⚠️ Failed to establish baseline:'), error.message);
    }
  }

  startAnalysisInterval() {
    this.intervalId = setInterval(async () => {
      await this.runAnalysis();
    }, this.monitoringConfig.interval * 1000);
  }

  startMetricsInterval() {
    this.metricsIntervalId = setInterval(async () => {
      await this.collectAndAnalyzeMetrics();
    }, this.monitoringConfig.metricsInterval * 1000);
  }

  async runAnalysis() {
    const timestamp = new Date().toISOString();
    console.log(chalk.blue(`\n🔍 Running analysis at ${timestamp}`));
    
    try {
      const metrics = await this.collectMetrics();
      const healthResults = await this.runHealthChecks();
      const currentHealthScore = this.calculateHealthScore(healthResults);
      
      const analysis = this.performAnalysis(metrics, healthResults, currentHealthScore);
      
      const report = {
        timestamp,
        type: 'continuous_analysis',
        healthScore: currentHealthScore,
        metrics,
        healthResults,
        analysis,
        baseline: this.baseline
      };
      
      await this.saveReport(report);
      
      this.displaySummary(analysis);
      
      this.consecutiveFailures = 0;
      this.lastHealthScore = currentHealthScore;
      this.emit('analysis:complete', report);
      
    } catch (error) {
      this.consecutiveFailures++;
      console.error(chalk.red(`❌ Analysis failed (${this.consecutiveFailures}/${this.thresholds.consecutiveFailureLimit}):`), error.message);
      
      if (this.consecutiveFailures >= this.thresholds.consecutiveFailureLimit) {
        console.log(chalk.red('🚨 Multiple consecutive failures detected - this may indicate a serious issue'));
        this.emit('consecutive:failures', this.consecutiveFailures);
      }
      
      this.emit('analysis:error', error);
    }
  }

  async collectAndAnalyzeMetrics() {
    try {
      const metrics = await this.collectQuickMetrics();
      const issues = this.detectQuickIssues(metrics);
      
      if (issues.length > 0) {
        console.log(chalk.yellow(`⚠️ Quick check detected ${issues.length} potential issue(s):`));
        issues.forEach(issue => console.log(chalk.yellow(`  • ${issue}`)));
      }
      
      this.emit('metrics:collected', { timestamp: new Date().toISOString(), metrics, issues });
      
    } catch (error) {
      console.error(chalk.yellow('⚠️ Quick metrics collection failed:'), error.message);
    }
  }

  async collectMetrics() {
    console.log(chalk.gray('📊 Collecting cluster metrics...'));
    
    const topics = await this.kafkaClient.getTopics();
    const consumerGroups = await this.kafkaClient.getConsumerGroups();
    const clusterInfo = await this.kafkaClient.admin.describeCluster();
    
    const consumerMetrics = [];
    for (const group of consumerGroups) {
      try {
        const groupDescription = await this.kafkaClient.admin.describeGroups([group.groupId]);
        const offsets = await this.kafkaClient.admin.fetchOffsets({ groupId: group.groupId });
        
        let totalLag = 0;
        for (const offset of offsets) {
          totalLag += Math.max(0, parseInt(offset.offset) || 0);
        }
        
        consumerMetrics.push({
          groupId: group.groupId,
          state: groupDescription.groups[0]?.state || 'Unknown',
          memberCount: groupDescription.groups[0]?.members.length || 0,
          totalLag
        });
        
      } catch (error) {
        console.warn(chalk.yellow(`⚠️ Failed to get metrics for consumer group ${group.groupId}`));
      }
    }
    
    return {
      topics: topics.map(topic => ({
        name: topic.name,
        partitions: topic.partitions.length,
        replicationFactor: topic.partitions[0]?.replicas.length || 0,
        isInternal: topic.name.startsWith('__')
      })),
      consumers: consumerMetrics,
      cluster: {
        brokers: clusterInfo.brokers.length,
        controller: clusterInfo.controller,
        clusterId: clusterInfo.clusterId
      }
    };
  }

  async collectQuickMetrics() {
    const consumerGroups = await this.kafkaClient.getConsumerGroups();
    
    return {
      consumerGroupCount: consumerGroups.length,
      timestamp: new Date().toISOString()
    };
  }

  async runHealthChecks() {
    console.log(chalk.gray('🏥 Running health checks...'));
    
    const topics = await this.kafkaClient.getTopics();
    const consumerGroups = await this.kafkaClient.getConsumerGroups();
    const clusterInfo = await this.kafkaClient.admin.describeCluster();
    
    return await this.healthChecker.runHealthChecks(clusterInfo, topics, consumerGroups);
  }

  calculateHealthScore(healthResults) {
    // Handle both array format and object format from health checker
    let checks = healthResults;
    
    if (healthResults && typeof healthResults === 'object' && !Array.isArray(healthResults)) {
      // If it's an object (from health checker), extract the checks array
      checks = healthResults.checks || [];
    }
    
    if (!checks || !Array.isArray(checks) || checks.length === 0) return 0;
    
    const passed = checks.filter(check => check.status === 'PASSED').length;
    const total = checks.length;
    
    return Math.round((passed / total) * 100);
  }

  performAnalysis(metrics, healthResults, currentHealthScore) {
    const analysis = {
      status: 'healthy',
      issues: [],
      improvements: [],
      insights: [],
      changesSinceBaseline: {}
    };

    if (this.baseline) {
      analysis.changesSinceBaseline = this.compareWithBaseline(metrics, currentHealthScore);
    }

    if (this.lastHealthScore !== null) {
      const healthChange = currentHealthScore - this.lastHealthScore;
      if (Math.abs(healthChange) >= this.thresholds.healthScoreChange) {
        const trend = healthChange > 0 ? 'improved' : 'degraded';
        analysis.insights.push(`Health score ${trend} by ${Math.abs(healthChange)}% since last check`);
        
        if (healthChange < 0) {
          analysis.status = 'degraded';
          analysis.issues.push(`Health score dropped from ${this.lastHealthScore}% to ${currentHealthScore}%`);
        }
      }
    }

    // Handle both array format and object format from health checker
    let checks = healthResults;
    if (healthResults && typeof healthResults === 'object' && !Array.isArray(healthResults)) {
      checks = healthResults.checks || [];
    }

    const failedChecks = Array.isArray(checks) ? checks.filter(check => check.status === 'FAILED') : [];
    if (failedChecks.length > 0) {
      analysis.status = failedChecks.length > 2 ? 'critical' : 'warning';
      analysis.issues.push(`${failedChecks.length} health check(s) failing`);
    }

    const totalLag = metrics.consumers.reduce((sum, consumer) => sum + consumer.totalLag, 0);
    if (totalLag > 1000) {
      analysis.issues.push(`High consumer lag detected: ${totalLag} messages`);
      analysis.status = totalLag > 10000 ? 'critical' : 'warning';
    }

    const inactiveGroups = metrics.consumers.filter(c => c.memberCount === 0);
    if (inactiveGroups.length > 0) {
      analysis.improvements.push(`${inactiveGroups.length} inactive consumer group(s) could be cleaned up`);
    }

    if (analysis.issues.length === 0 && analysis.status === 'healthy') {
      analysis.insights.push('All systems operating normally');
    }

    return analysis;
  }

  compareWithBaseline(metrics, currentHealthScore) {
    if (!this.baseline) return {};

    const changes = {};
    
    const healthChange = currentHealthScore - this.baseline.healthScore;
    if (healthChange !== 0) {
      changes.healthScore = {
        previous: this.baseline.healthScore,
        current: currentHealthScore,
        change: healthChange,
        trend: healthChange > 0 ? 'improved' : 'degraded'
      };
    }

    const topicChange = metrics.topics.length - this.baseline.topicCount;
    if (topicChange !== 0) {
      changes.topics = {
        previous: this.baseline.topicCount,
        current: metrics.topics.length,
        change: topicChange
      };
    }

    const currentTotalLag = metrics.consumers.reduce((sum, consumer) => sum + consumer.totalLag, 0);
    const lagChange = currentTotalLag - this.baseline.totalLag;
    if (Math.abs(lagChange) > 100) {
      changes.consumerLag = {
        previous: this.baseline.totalLag,
        current: currentTotalLag,
        change: lagChange,
        trend: lagChange > 0 ? 'increased' : 'decreased'
      };
    }

    return changes;
  }

  detectQuickIssues(metrics) {
    const issues = [];
    
    if (metrics.consumerGroupCount === 0) {
      issues.push('No consumer groups detected');
    }
    
    return issues;
  }

  displaySummary(analysis) {
    const statusEmoji = {
      'healthy': '✅',
      'warning': '⚠️',
      'degraded': '📉',
      'critical': '🚨'
    };

    console.log(chalk.blue(`\n📋 Analysis Summary: ${statusEmoji[analysis.status]} ${analysis.status.toUpperCase()}`));
    
    if (analysis.issues.length > 0) {
      console.log(chalk.red('\n🚨 Issues Detected:'));
      analysis.issues.forEach(issue => console.log(chalk.red(`  • ${issue}`)));
    }
    
    if (analysis.insights.length > 0) {
      console.log(chalk.blue('\n💡 Insights:'));
      analysis.insights.forEach(insight => console.log(chalk.blue(`  • ${insight}`)));
    }
    
    if (analysis.improvements.length > 0) {
      console.log(chalk.yellow('\n🔧 Potential Improvements:'));
      analysis.improvements.forEach(improvement => console.log(chalk.yellow(`  • ${improvement}`)));
    }

    if (Object.keys(analysis.changesSinceBaseline).length > 0) {
      console.log(chalk.cyan('\n📊 Changes Since Baseline:'));
      Object.entries(analysis.changesSinceBaseline).forEach(([key, change]) => {
        const trend = change.trend || (change.change > 0 ? '↗️' : '↘️');
        console.log(chalk.cyan(`  • ${key}: ${change.previous} → ${change.current} ${trend}`));
      });
    }
  }

  async saveReport(report) {
    try {
      const outputDir = this.config.file.outputDir;
      await fs.mkdir(outputDir, { recursive: true });
      
      const filename = `monitoring-${report.timestamp.replace(/[:.]/g, '-')}.json`;
      const filepath = path.join(outputDir, filename);
      
      await fs.writeFile(filepath, JSON.stringify(report, null, 2));
      console.log(chalk.green(`💾 Monitoring report saved: ${filename}`));
      
    } catch (error) {
      console.error(chalk.yellow('⚠️ Failed to save monitoring report:'), error.message);
    }
  }

  async stop() {
    if (!this.isRunning) {
      console.log(chalk.yellow('⚠️ Monitoring is not running'));
      return;
    }

    console.log(chalk.blue('🛑 Stopping Continuous Kafka Monitoring...'));
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    if (this.metricsIntervalId) {
      clearInterval(this.metricsIntervalId);
      this.metricsIntervalId = null;
    }
    
    try {
      await this.kafkaClient.disconnect();
    } catch (error) {
      console.warn(chalk.yellow('⚠️ Error disconnecting Kafka client:'), error.message);
    }
    
    this.isRunning = false;
    this.emit('stopped');
    
    console.log(chalk.green('✅ Continuous monitoring stopped'));
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      consecutiveFailures: this.consecutiveFailures,
      lastHealthScore: this.lastHealthScore,
      baseline: this.baseline ? {
        establishedAt: this.baseline.timestamp,
        healthScore: this.baseline.healthScore
      } : null
    };
  }
}

module.exports = { ContinuousMonitor };
