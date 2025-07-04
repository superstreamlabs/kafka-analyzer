#!/usr/bin/env node

const inquirer = require('inquirer');
const chalk = require('chalk');
const ora = require('ora');
const path = require('path');
const fs = require('fs');
const { KafkaClient } = require('./kafka-client');
const { FileService } = require('./file-service');
const { Validators } = require('./validators');
const { HealthChecker } = require('./health-checker');
const { displayValidationResults, displayTopicSummary } = require('./utils');
const { SupabaseAnalytics } = require('./analytics');

class CLI {
  constructor(options = {}) {
    this.options = options;
    this.config = {
      kafka: {},
      file: {}
    };
    this.kafkaClient = null;
    this.fileService = null;
    this.analytics = new SupabaseAnalytics();
    
    // Handle bootstrap-servers option mapping to brokers
    if (options.bootstrapServers && !options.brokers) {
      this.options.brokers = options.bootstrapServers;
    }
  }

  async loadConfigFromFile(configPath) {
    try {
      const fullPath = path.resolve(configPath);
      if (!fs.existsSync(fullPath)) {
        throw new Error(`Config file not found: ${fullPath}`);
      }

      const configContent = fs.readFileSync(fullPath, 'utf8');
      const config = JSON.parse(configContent);

      // Validate config structure
      if (!config.kafka || !config.file) {
        throw new Error('Invalid config file structure. Must contain "kafka" and "file" sections.');
      }

      this.config = config;
      
      // Add email if not present in config file
      if (!this.config.email) {
        this.config.email = '';
      }
      
      console.log(chalk.green(`✅ Configuration loaded from: ${fullPath}`));
      return true;
    } catch (error) {
      console.error(chalk.red(`❌ Failed to load config file: ${error.message}`));
      return false;
    }
  }

  async promptForConfig() {
    console.log(chalk.blue('\n🚀 Superstream Kafka Analyzer\n'));
    console.log(chalk.gray('Configure your analysis settings:\n'));

    // Vendor Selection
    console.log(chalk.yellow('🏢 Vendor Selection'));
    const vendorAnswer = await inquirer.prompt([
      {
        type: 'list',
        name: 'vendor',
        message: 'Which Kafka vendor are you using?',
        choices: [
          { name: 'Apache Kafka (Self-hosted)', value: 'apache' },
          { name: 'AWS MSK (Amazon Managed Streaming for Apache Kafka)', value: 'aws-msk' },
          { name: 'Confluent Cloud', value: 'confluent-cloud' },
          { name: 'Confluent Platform', value: 'confluent-platform' },
          { name: 'Redpanda', value: 'redpanda' },
          { name: 'Aiven Kafka', value: 'aiven' }
        ],
        default: 'apache'
      }
    ]);

    // Kafka Configuration
    console.log(chalk.yellow('\n📡 Kafka Configuration'));
    const kafkaAnswers = await inquirer.prompt([
      {
        type: 'input',
        name: 'brokers',
        message: 'Bootstrap servers (comma-separated):',
        default: 'localhost:9092',
        validate: (input) => {
          if (!input.trim()) return 'Bootstrap servers are required';
          return true;
        }
      },
      {
        type: 'input',
        name: 'clientId',
        message: 'Client ID (press Enter for default):',
        default: 'superstream-analyzer'
      }
    ]);

    // Authentication configuration based on vendor
    let saslConfig = null;
    if (vendorAnswer.vendor === 'aws-msk') {
      console.log(chalk.yellow('\n🔐 AWS MSK Authentication'));
      const authType = await inquirer.prompt([
        {
          type: 'list',
          name: 'authType',
          message: 'Choose authentication method:',
          choices: [
            { name: 'IAM Authentication (Port 9198)', value: 'iam' },
            { name: 'SCRAM Authentication (Port 9096)', value: 'scram' },
            { name: 'No Authentication', value: 'none' }
          ],
          default: 'iam'
        }
      ]);

      if (authType.authType === 'iam') {
        console.log(chalk.gray('IAM authentication will use your AWS credentials automatically'));
        saslConfig = {
          mechanism: 'oauthbearer'
        };
      } else if (authType.authType === 'scram') {
        const scramAnswers = await inquirer.prompt([
          {
            type: 'input',
            name: 'username',
            message: 'SCRAM Username:',
            validate: (input) => {
              if (!input.trim()) return 'Username is required for SCRAM';
              return true;
            }
          },
          {
            type: 'password',
            name: 'password',
            message: 'SCRAM Password:',
            validate: (input) => {
              if (!input.trim()) return 'Password is required for SCRAM';
              return true;
            }
          }
        ]);
        saslConfig = {
          mechanism: 'scram-sha-512',
          username: scramAnswers.username,
          password: scramAnswers.password
        };
      }
    } else if (vendorAnswer.vendor === 'confluent-cloud') {
      console.log(chalk.yellow('\n🔐 Confluent Cloud Authentication'));
      const confluentAnswers = await inquirer.prompt([
        {
          type: 'input',
          name: 'username',
          message: 'API Key:',
          validate: (input) => {
            if (!input.trim()) return 'API Key is required for Confluent Cloud';
            return true;
          }
        },
        {
          type: 'password',
          name: 'password',
          message: 'API Secret:',
          validate: (input) => {
            if (!input.trim()) return 'API Secret is required for Confluent Cloud';
            return true;
          }
        }
      ]);
      saslConfig = {
        mechanism: 'plain',
        username: confluentAnswers.username,
        password: confluentAnswers.password
      };
    } else if (vendorAnswer.vendor === 'aiven') {
      console.log(chalk.yellow('\n🔐 Aiven Kafka Authentication'));
      const aivenAnswers = await inquirer.prompt([
        {
          type: 'input',
          name: 'username',
          message: 'Username:',
          validate: (input) => {
            if (!input.trim()) return 'Username is required for Aiven';
            return true;
          }
        },
        {
          type: 'password',
          name: 'password',
          message: 'Password:',
          validate: (input) => {
            if (!input.trim()) return 'Password is required for Aiven';
            return true;
          }
        }
      ]);
      saslConfig = {
        mechanism: 'scram-sha-256',
        username: aivenAnswers.username,
        password: aivenAnswers.password
      };
    } else {
      // For other vendors, ask if SASL is needed
      const useSasl = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'useSasl',
          message: 'Use SASL authentication?',
          default: false
        }
      ]);

      if (useSasl.useSasl) {
        const saslAnswers = await inquirer.prompt([
          {
            type: 'list',
            name: 'mechanism',
            message: 'SASL mechanism:',
            choices: [
              { name: 'PLAIN', value: 'plain' },
              { name: 'SCRAM-SHA-256', value: 'scram-sha-256' },
              { name: 'SCRAM-SHA-512', value: 'scram-sha-512' }
            ],
            default: 'plain'
          },
          {
            type: 'input',
            name: 'username',
            message: 'Username:',
            validate: (input) => {
              if (!input.trim()) return 'Username is required for SASL';
              return true;
            }
          },
          {
            type: 'password',
            name: 'password',
            message: 'Password:',
            validate: (input) => {
              if (!input.trim()) return 'Password is required for SASL';
              return true;
            }
          }
        ]);
        saslConfig = {
          mechanism: saslAnswers.mechanism,
          username: saslAnswers.username,
          password: saslAnswers.password
        };
      }
    }

    // Build kafka config
    this.config.kafka = {
      ...kafkaAnswers,
      vendor: vendorAnswer.vendor,
      useSasl: !!saslConfig,
      sasl: saslConfig
    };

    // File Output Configuration
    console.log(chalk.yellow('\n💾 File Output Configuration'));
    const fileAnswers = await inquirer.prompt([
      {
        type: 'input',
        name: 'outputDir',
        message: 'Output directory:',
        default: './kafka-analysis',
        validate: (input) => {
          if (!input.trim()) return 'Output directory is required';
          return true;
        }
      },
      {
        type: 'confirm',
        name: 'includeMetadata',
        message: 'Include metadata in output file?',
        default: true
      },
      {
        type: 'confirm',
        name: 'includeTimestamp',
        message: 'Include timestamp in output filename?',
        default: true
      }
    ]);

    this.config.file = {
      ...fileAnswers,
      formats: ['html']
    };

    // Email Collection - moved to the end
    console.log(chalk.yellow('\n📧 Do you want to export the results as a file?'));
    console.log(chalk.gray('We collect your email to generate a comprehensive report file. You can skip this, but no file-based output will be generated.\n'));
    
    const emailAnswer = await inquirer.prompt([
      {
        type: 'input',
        name: 'email',
        message: 'Your email address (optional - skip for no file output):',
        default: '',
        validate: (input) => {
          if (input.trim() === '') return true; // Allow empty
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(input)) return 'Please enter a valid email address';
          return true;
        }
      }
    ]);

    // Add email to config
    this.config.email = emailAnswer.email;
  }

  async run() {
    try {
      // Track app start with location
      await this.analytics.trackAppStart(
        this.config.kafka.vendor,
        !!this.options.config
      );

      // Track location update for this session
      await this.analytics.trackLocationUpdate();
      
      // Use Commander.js options
      const configPath = this.options.config;
      
      if (configPath) {
        console.log(chalk.gray(`Debug: Loading config from: ${configPath}`));
        const configLoaded = await this.loadConfigFromFile(configPath);
        if (!configLoaded) {
          process.exit(1);
        }
        console.log(chalk.gray('Debug: Config loaded successfully, skipping prompts'));
      } else {
        console.log(chalk.gray('Debug: No config file specified, using interactive mode'));
        await this.promptForConfig();
      }

      // Initialize services without validation
      console.log(chalk.yellow('\n⚠️  Validation skipped - proceeding directly to analysis'));
      this.kafkaClient = new KafkaClient(this.config.kafka);
      this.fileService = new FileService(this.config.file);

      await this.analyzeKafka();
    } catch (error) {
      // Track errors with location
      await this.analytics.trackLocationBasedEvent('error', {
        error_type: error.name,
        vendor: this.config.kafka.vendor
      });
      console.error(chalk.red('\n❌ Application Error:'), error.message);
      process.exit(1);
    }
  }

  async validateConfiguration() {
    console.log(chalk.blue('\n🔍 Validating Configuration\n'));

    const spinner = ora('Validating configuration...').start();
    let validationResults = null;

    try {
      // Initialize services
      this.kafkaClient = new KafkaClient(this.config.kafka);
      this.fileService = new FileService(this.config.file);

      // Run comprehensive validation
      validationResults = await Validators.validateCompleteSetup(
        this.config.kafka,
        this.config.file
      );

      spinner.stop();
      displayValidationResults(validationResults);

      if (validationResults.overall !== 'ready') {
        // Print all logs and errors for clarity
        console.log(chalk.red('\n=== FULL VALIDATION LOGS ==='));
        validationResults.logs.forEach(log => {
          if (log.includes('❌')) {
            console.log(chalk.red(log));
          } else if (log.includes('✅')) {
            console.log(chalk.green(log));
          } else if (log.includes('⚠️')) {
            console.log(chalk.yellow(log));
          } else {
            console.log(chalk.gray(log));
          }
        });
        if (validationResults.errors.length > 0) {
          console.log(chalk.red('\n=== ERRORS FOUND ==='));
          validationResults.errors.forEach(error => {
            console.log(chalk.red(`• ${error}`));
          });
        }
        // Print the last error log as the root cause
        const lastErrorLog = validationResults.logs.reverse().find(log => log.includes('❌'));
        if (lastErrorLog) {
          console.log(chalk.red('\nRoot cause:'), lastErrorLog);
        }
        throw new Error('Configuration validation failed. Please fix the issues above and try again.');
      }

    } catch (error) {
      spinner.stop();
      
      // If we have validation results, display them even if there was an exception
      if (validationResults) {
        console.log(chalk.red('\n=== VALIDATION FAILED ==='));
        console.log(chalk.red('Error during validation:'), error.message);
        
        console.log(chalk.red('\n=== FULL VALIDATION LOGS ==='));
        validationResults.logs.forEach(log => {
          if (log.includes('❌')) {
            console.log(chalk.red(log));
          } else if (log.includes('✅')) {
            console.log(chalk.green(log));
          } else if (log.includes('⚠️')) {
            console.log(chalk.yellow(log));
          } else {
            console.log(chalk.gray(log));
          }
        });
        
        if (validationResults.errors.length > 0) {
          console.log(chalk.red('\n=== ERRORS FOUND ==='));
          validationResults.errors.forEach(error => {
            console.log(chalk.red(`• ${error}`));
          });
        }
      } else {
        // If no validation results, show the raw error
        console.log(chalk.red('\n=== VALIDATION ERROR ==='));
        console.log(chalk.red('Failed to run validation:'), error.message);
        if (error.stack) {
          console.log(chalk.gray('\nStack trace:'));
          console.log(chalk.gray(error.stack));
        }
      }
      
      throw error;
    }
  }

  async analyzeKafka() {
    console.log(chalk.blue('\n📊 Executing Kafka Analysis\n'));

    const spinner = ora('Connecting to Kafka cluster...').start();

    try {
      // Track app start
      await this.analytics.trackAppStart(
        this.config.kafka.vendor,
        !!this.options.config
      );
      // Connect to Kafka
      await this.kafkaClient.connect();
      spinner.text = 'Retrieving topic information...';
      spinner.render();

      // Get topic information
      const topics = await this.kafkaClient.getTopics();
      const consumerGroups = await this.kafkaClient.getConsumerGroups();
      const clusterInfo = await this.kafkaClient.getClusterInfo();
      
      // Build comprehensive analysis results
      const analysisResults = {
        clusterInfo,
        topics,
        consumerGroups,
        summary: {
          totalTopics: topics.length,
          totalPartitions: topics.reduce((sum, topic) => sum + (topic.partitions || 0), 0),
          internalTopics: topics.filter(topic => topic.isInternal).length,
          userTopics: topics.filter(topic => !topic.isInternal).length,
          topicsWithErrors: topics.filter(topic => !topic.partitions || topic.partitions === 0).length,
          consumerGroups: consumerGroups.length
        },
        timestamp: new Date().toISOString()
      };

      // Run health checks before saving files
      spinner.text = 'Running health checks...';
      spinner.render();
      const healthResults = await this.runHealthChecks(clusterInfo, topics, consumerGroups);
      
      // Add health check results to analysis results
      if (healthResults) {
        analysisResults.healthChecks = healthResults;
      }
      
      // Check if email is provided for file generation
      if (this.config.email && this.config.email.trim()) {
        // Store email in Supabase
        await this.analytics.storeEmail(
          this.config.email,
          this.config.kafka.vendor,
          !!this.options.config
        );
        
        spinner.text = 'Saving results to files...';
        spinner.render();

        // Save results to files
        const savedFiles = await this.fileService.saveAnalysisResults(analysisResults);

        spinner.stop();
        
        // Display summary
        console.log(chalk.green('\n✅ Analysis completed successfully!'));
        console.log(chalk.blue('\n📊 Analysis Summary:'));
        console.log(chalk.gray(`• Total Topics: ${analysisResults.summary.totalTopics}`));
        console.log(chalk.gray(`• Total Partitions: ${analysisResults.summary.totalPartitions}`));
        console.log(chalk.gray(`• User Topics: ${analysisResults.summary.userTopics}`));
        console.log(chalk.gray(`• Internal Topics: ${analysisResults.summary.internalTopics}`));
        console.log(chalk.gray(`• Topics with Issues: ${analysisResults.summary.topicsWithErrors}`));
        console.log(chalk.gray(`• Consumer Groups: ${analysisResults.summary.consumerGroups}`));
        
        // Show topics with issues if any (only partitions missing or zero)
        const topicsWithIssues = topics.filter(topic => !topic.partitions || topic.partitions === 0);
        if (topicsWithIssues.length > 0) {
          console.log(chalk.yellow('\n⚠️  Topics with Issues (missing or zero partitions):'));
          topicsWithIssues.forEach(topic => {
            console.log(chalk.yellow(`  • ${topic.name}: ${topic.partitions || 0} partitions`));
          });
        }
        
        if (savedFiles && savedFiles.length > 0) {
          console.log(chalk.green('\n💾 Results saved to:'));
          savedFiles.forEach(file => {
            console.log(chalk.gray(`  • ${file}`));
          });
        }
      } else {
        spinner.stop();
        
        // Display summary without file generation
        console.log(chalk.green('\n✅ Analysis completed successfully!'));
        console.log(chalk.blue('\n📊 Analysis Summary:'));
        console.log(chalk.gray(`• Total Topics: ${analysisResults.summary.totalTopics}`));
        console.log(chalk.gray(`• Total Partitions: ${analysisResults.summary.totalPartitions}`));
        console.log(chalk.gray(`• User Topics: ${analysisResults.summary.userTopics}`));
        console.log(chalk.gray(`• Internal Topics: ${analysisResults.summary.internalTopics}`));
        console.log(chalk.gray(`• Topics with Issues: ${analysisResults.summary.topicsWithErrors}`));
        console.log(chalk.gray(`• Consumer Groups: ${analysisResults.summary.consumerGroups}`));
        
        // Show topics with issues if any (only partitions missing or zero)
        const topicsWithIssues = topics.filter(topic => !topic.partitions || topic.partitions === 0);
        if (topicsWithIssues.length > 0) {
          console.log(chalk.yellow('\n⚠️  Topics with Issues (missing or zero partitions):'));
          topicsWithIssues.forEach(topic => {
            console.log(chalk.yellow(`  • ${topic.name}: ${topic.partitions || 0} partitions`));
          });
        }
        
        console.log(chalk.yellow('\n📧 No file-based summary generated because no email was provided.'));
        console.log(chalk.gray('To generate a comprehensive report file, either:'));
        console.log(chalk.gray('  • Run in interactive mode (npx .) and provide your email when prompted'));
        console.log(chalk.gray('  • Add "email": "your@email.com" to your config file (see examples in README)'));
      }

      // Track successful analysis with location
      await this.analytics.trackLocationBasedEvent('analysis_complete', {
        vendor: this.config.kafka.vendor,
        topics_count: analysisResults.summary.totalTopics,
        health_checks_count: healthResults ? healthResults.totalChecks : 0,
        has_issues: healthResults ? (healthResults.failedChecks > 0 || healthResults.warnings > 0) : false
      }, true); // Include detailed location

      // Track health checks with location if available
      if (healthResults) {
        await this.analytics.trackLocationBasedEvent('health_checks', {
          vendor: this.config.kafka.vendor,
          total_checks: healthResults.totalChecks,
          passed_checks: healthResults.passedChecks,
          failed_checks: healthResults.failedChecks,
          warnings: healthResults.warnings
        }, true); // Include detailed location
      }

    } catch (error) {
      await this.analytics.trackLocationBasedEvent('analysis_failed', {
        error_type: 'analysis_failed',
        vendor: this.config.kafka.vendor
      });
      spinner.stop();
      console.error(chalk.red('\n❌ Analysis failed:'), error.message);
      throw error;
    } finally {
      if (this.kafkaClient) {
        await this.kafkaClient.disconnect();
      }
    }
  }

  async runHealthChecks(clusterInfo, topics, consumerGroups) {
    try {
      const vendor = this.config.kafka.vendor;
      
      if (!vendor) {
        console.log(chalk.yellow('\n⚠️  No vendor specified, skipping health checks'));
        return;
      }

      const healthChecker = new HealthChecker(vendor, this.config.kafka);
      const healthResults = await healthChecker.runHealthChecks(clusterInfo, topics, consumerGroups);
      
      // Add health check results to the analysis results for file output
      return healthResults;
    } catch (error) {
      console.error(chalk.red('\n❌ Health checks failed:'), error.message);
      // Don't throw error, just log it
    }
  }

  async trackLocationManually() {
    try {
      console.log(chalk.blue('\n📍 Updating location information...'));
      const spinner = ora('Fetching location data...').start();
      
      await this.analytics.trackLocationUpdate();
      
      spinner.stop();
      console.log(chalk.green('✅ Location updated successfully!'));
      
      // Display current location
      const currentLocation = this.analytics.getCurrentLocation();
      if (currentLocation) {
        console.log(chalk.blue('\n📍 Current Location:'));
        console.log(chalk.gray(`• Country: ${currentLocation.country}`));
        console.log(chalk.gray(`• Region: ${currentLocation.region}`));
        console.log(chalk.gray(`• City: ${currentLocation.city}`));
        console.log(chalk.gray(`• Timezone: ${currentLocation.timezone}`));
        if (currentLocation.latitude && currentLocation.longitude) {
          console.log(chalk.gray(`• Coordinates: ${currentLocation.latitude}, ${currentLocation.longitude}`));
        }
      }
    } catch (error) {
      console.error(chalk.red('\n❌ Failed to update location:'), error.message);
    }
  }

  getCurrentLocationInfo() {
    const location = this.analytics.getCurrentLocation();
    const isCached = this.analytics.isLocationCached();
    
    if (!location) {
      return {
        available: false,
        message: 'No location data available'
      };
    }
    
    return {
      available: true,
      cached: isCached,
      data: location,
      message: `Location: ${location.city}, ${location.region}, ${location.country}`
    };
  }
}

// At the top of the file, after class CLI definition
process.on('uncaughtException', async (err) => {
  try {
    const analytics = new SupabaseAnalytics();
    const context = {
      vendor: (global.superstreamContext && global.superstreamContext.vendor) || 'unknown',
      config: (global.superstreamContext && global.superstreamContext.config) || null,
      error_name: err.name,
      error_message: err.message,
      error_stack: err.stack,
      explanation: `This is an uncaught exception. It usually means a bug or an unhandled edge case in the code. Check the stack trace and error message for clues. If this is a user input or config issue, validate your config file and CLI options. If it is a Kafka connection or authentication error, check your broker addresses, credentials, and network connectivity.`
    };
    await analytics.trackEvent('uncaught_exception', context);
  } catch (e) {}
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', async (reason) => {
  try {
    const analytics = new SupabaseAnalytics();
    const context = {
      vendor: (global.superstreamContext && global.superstreamContext.vendor) || 'unknown',
      config: (global.superstreamContext && global.superstreamContext.config) || null,
      error_message: reason && reason.message ? reason.message : String(reason),
      error_stack: reason && reason.stack ? reason.stack : null,
      explanation: `This is an unhandled promise rejection. It often means an async operation failed without a catch block. Check the error message and stack trace. If this is a network, Kafka, or config error, check your connection, credentials, and config file. If it is a bug, report the stack trace to the developers.`
    };
    await analytics.trackEvent('unhandled_rejection', context);
  } catch (e) {}
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

// Set global context for error reporting
function setSuperstreamContext(vendor, config) {
  global.superstreamContext = { vendor, config };
}

async function runCLI(options) {
  const cli = new CLI(options);
  await cli.run();
}

module.exports = { CLI, runCLI }; 