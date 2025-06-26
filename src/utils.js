const chalk = require('chalk');

function displayValidationResults(results) {
  console.log(chalk.blue('\n=== VALIDATION RESULTS ===\n'));
  
  // Show all logs
  results.logs.forEach(log => {
    if (log.includes('✅')) {
      console.log(chalk.green(log));
    } else if (log.includes('❌')) {
      console.log(chalk.red(log));
    } else if (log.includes('⚠️')) {
      console.log(chalk.yellow(log));
    } else {
      console.log(chalk.gray(log));
    }
  });

  // Show errors if any
  if (results.errors.length > 0) {
    console.log(chalk.red('\n=== ERRORS FOUND ==='));
    results.errors.forEach(error => {
      console.log(chalk.red(`• ${error}`));
    });
  }

  // Final status
  console.log('\n' + '='.repeat(50));
  if (results.overall === 'ready') {
    console.log(chalk.green.bold('🚀 VALIDATION PASSED - Ready to proceed with analysis'));
  } else {
    console.log(chalk.red.bold('❌ VALIDATION FAILED - Cannot proceed with analysis'));
    console.log(chalk.yellow('\nPlease resolve the issues above and try again.'));
  }
  console.log('='.repeat(50) + '\n');
}

function displayTopicSummary(topicInfo, savedFiles = []) {
  const summary = topicInfo.summary;
  const clusterInfo = topicInfo.clusterInfo;

  console.log(chalk.blue('\n=== ANALYSIS SUMMARY ===\n'));

  // Cluster Information
  console.log(chalk.yellow('📊 Cluster Information:'));
  console.log(`  ZooKeepers: ${clusterInfo.controller || 'Unknown'}`);
  console.log(`  Brokers: ${clusterInfo.brokers.length}`);
  console.log(`  Analysis Time: ${new Date(clusterInfo.timestamp).toLocaleString()}`);

  // Summary Statistics
  console.log(chalk.yellow('\n📈 Summary Statistics:'));
  console.log(`  Total Topics: ${chalk.cyan(summary.totalTopics)}`);
  console.log(`  User Topics: ${chalk.green(summary.userTopics)}`);
  console.log(`  Internal Topics: ${chalk.yellow(summary.internalTopics)}`);
  console.log(`  Total Partitions: ${chalk.cyan(summary.totalPartitions)}`);
  console.log(`  Average Partitions per Topic: ${chalk.cyan(summary.averagePartitionsPerTopic)}`);
  
  if (summary.topicsWithErrors > 0) {
    console.log(`  Topics with Errors: ${chalk.red(summary.topicsWithErrors)}`);
  }

  // Replication Factor Distribution
  if (Object.keys(summary.replicationFactors).length > 0) {
    console.log(chalk.yellow('\n🔄 Replication Factor Distribution:'));
    Object.entries(summary.replicationFactors)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .forEach(([factor, count]) => {
        console.log(`  RF ${factor}: ${chalk.cyan(count)} topics`);
      });
  }

  // Common Configurations
  if (Object.keys(summary.commonConfigs).length > 0) {
    console.log(chalk.yellow('\n⚙️  Common Topic Configurations:'));
    Object.entries(summary.commonConfigs).forEach(([configName, values]) => {
      console.log(`  ${configName}:`);
      Object.entries(values).forEach(([value, count]) => {
        console.log(`    ${value}: ${chalk.cyan(count)} topics`);
      });
    });
  }

  // Topic List (if not too many)
  if (topicInfo.topics.length <= 20) {
    console.log(chalk.yellow('\n📋 Topics:'));
    topicInfo.topics.forEach(topic => {
      const topicType = topic.isInternal ? chalk.yellow(' (Internal)') : '';
      const errorInfo = topic.errorCode !== 0 ? chalk.red(` - ERROR: ${topic.error || 'Unknown error'}`) : '';
      
      console.log(`  ${topic.name}${topicType} - ${topic.partitions.length} partitions${errorInfo}`);
    });
  } else {
    console.log(chalk.yellow(`\n📋 Topics: ${topicInfo.topics.length} topics found (showing first 10)`));
    topicInfo.topics.slice(0, 10).forEach(topic => {
      const topicType = topic.isInternal ? chalk.yellow(' (Internal)') : '';
      console.log(`  ${topic.name}${topicType} - ${topic.partitions.length} partitions`);
    });
    console.log(chalk.gray(`  ... and ${topicInfo.topics.length - 10} more topics`));
  }

  // Saved Files
  if (savedFiles.length > 0) {
    console.log(chalk.green('\n💾 Saved Files:'));
    savedFiles.forEach(file => {
      console.log(`  ${chalk.cyan(file)}`);
    });
  }

  console.log(chalk.green('\n✅ Analysis completed successfully!'));
  console.log(chalk.gray('Check the output directory for detailed reports.\n'));
}

function displayBrokerInfo(brokers) {
  console.log(chalk.yellow('\n🖥️  Broker Information:'));
  brokers.forEach(broker => {
    console.log(`  Broker ${broker.id}: ${broker.host}:${broker.port}${broker.rack ? ` (Rack: ${broker.rack})` : ''}`);
  });
}

function displayErrorDetails(error, context = '') {
  console.log(chalk.red(`\n❌ Error${context ? ` in ${context}` : ''}:`));
  console.log(chalk.red(`  ${error.message}`));
  
  if (error.code) {
    console.log(chalk.gray(`  Error Code: ${error.code}`));
  }
  
  if (error.stack && process.env.DEBUG) {
    console.log(chalk.gray('\n  Stack Trace:'));
    console.log(chalk.gray(error.stack));
  }
}

function displayProgress(message, current, total) {
  const percentage = Math.round((current / total) * 100);
  const barLength = 30;
  const filledLength = Math.round((barLength * current) / total);
  const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
  
  process.stdout.write(`\r${message}: [${bar}] ${percentage}% (${current}/${total})`);
  
  if (current === total) {
    process.stdout.write('\n');
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDuration(milliseconds) {
  if (milliseconds < 1000) return `${milliseconds}ms`;
  if (milliseconds < 60000) return `${(milliseconds / 1000).toFixed(1)}s`;
  const minutes = Math.floor(milliseconds / 60000);
  const seconds = ((milliseconds % 60000) / 1000).toFixed(1);
  return `${minutes}m ${seconds}s`;
}

function sanitizeForLogging(data) {
  if (typeof data === 'string') {
    // Remove potential sensitive information
    return data
      .replace(/password["\s]*[:=]["\s]*[^"\s,}]+/gi, 'password: ***')
      .replace(/secret["\s]*[:=]["\s]*[^"\s,}]+/gi, 'secret: ***')
      .replace(/key["\s]*[:=]["\s]*[^"\s,}]+/gi, 'key: ***')
      .replace(/token["\s]*[:=]["\s]*[^"\s,}]+/gi, 'token: ***');
  }
  
  if (typeof data === 'object' && data !== null) {
    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
      if (['password', 'secret', 'key', 'token', 'auth'].includes(key.toLowerCase())) {
        sanitized[key] = '***';
      } else {
        sanitized[key] = sanitizeForLogging(value);
      }
    }
    return sanitized;
  }
  
  return data;
}

function createTable(headers, rows) {
  // Calculate column widths
  const columnWidths = headers.map((header, index) => {
    const maxWidth = Math.max(
      header.length,
      ...rows.map(row => String(row[index] || '').length)
    );
    return Math.min(maxWidth, 50); // Cap at 50 characters
  });

  // Create header row
  const headerRow = headers.map((header, index) => 
    header.padEnd(columnWidths[index])
  ).join(' | ');

  // Create separator
  const separator = columnWidths.map(width => '-'.repeat(width)).join('-+-');

  // Create data rows
  const dataRows = rows.map(row => 
    row.map((cell, index) => 
      String(cell || '').padEnd(columnWidths[index])
    ).join(' | ')
  );

  return [headerRow, separator, ...dataRows].join('\n');
}

function displayTable(headers, rows, title = '') {
  if (title) {
    console.log(chalk.blue(`\n${title}`));
  }
  
  const table = createTable(headers, rows);
  console.log(table);
}

function displayConfigSummary(config) {
  console.log(chalk.blue('\n=== CONFIGURATION SUMMARY ===\n'));
  
  console.log(chalk.yellow('🔗 Kafka Configuration:'));
  console.log(`  Brokers: ${config.kafka.brokers.join(', ')}`);
  console.log(`  Security: ${config.kafka.security}`);
  console.log(`  Timeout: ${config.kafka.timeout / 1000}s`);
  
  if (config.kafka.sasl) {
    console.log(`  SASL: ${config.kafka.sasl.mechanism} (${config.kafka.sasl.username})`);
  }
  
  if (config.kafka.ssl) {
    console.log(`  SSL: ${config.kafka.ssl.rejectUnauthorized ? 'Strict' : 'Lenient'}`);
  }
  
  console.log(chalk.yellow('\n💾 File Output Configuration:'));
  console.log(`  Output Directory: ${config.file.outputDir}`);
  console.log(`  Formats: ${config.file.formats.join(', ')}`);
  console.log(`  Include Timestamp: ${config.file.includeTimestamp ? 'Yes' : 'No'}`);
}

function displayHelp() {
  console.log(chalk.blue.bold('\nSuperStream Kafka Analyzer - Help\n'));
  
  console.log(chalk.yellow('Usage:'));
  console.log('  npx superstream-kafka-analyzer [options]\n');
  
  console.log(chalk.yellow('Options:'));
  console.log('  -c, --config <path>        Path to configuration file');
  console.log('  -b, --brokers <brokers>    Comma-separated list of Kafka brokers');
  console.log('  -v, --verbose              Enable verbose logging');
  console.log('  -t, --timeout <seconds>    Connection timeout in seconds (default: 30)');
  console.log('  --no-validation            Skip validation steps');
  console.log('  -h, --help                 Display this help message');
  console.log('  -V, --version              Display version information\n');
  
  console.log(chalk.yellow('Examples:'));
  console.log('  npx superstream-kafka-analyzer');
  console.log('  npx superstream-kafka-analyzer --brokers localhost:9092');
  console.log('  npx superstream-kafka-analyzer --config config.json --verbose\n');
  
  console.log(chalk.yellow('Configuration File Format:'));
  console.log('  {');
  console.log('    "kafka": {');
  console.log('      "brokers": ["localhost:9092", "localhost:9093"],');
  console.log('      "security": "PLAINTEXT"');
  console.log('    },');
  console.log('    "file": {');
  console.log('      "outputDir": "./kafka-analysis",');
  console.log('      "formats": ["json", "csv", "html"],');
  console.log('      "includeTimestamp": true');
  console.log('    }');
  console.log('  }\n');
}

module.exports = {
  displayValidationResults,
  displayTopicSummary,
  displayBrokerInfo,
  displayErrorDetails,
  displayProgress,
  formatBytes,
  formatDuration,
  sanitizeForLogging,
  createTable,
  displayTable,
  displayConfigSummary,
  displayHelp
}; 