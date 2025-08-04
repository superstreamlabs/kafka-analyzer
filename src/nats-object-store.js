const { connect, jwtAuthenticator } = require('nats');
const chalk = require('chalk');
const ora = require('ora');

class NATSObjectStore {
  constructor(config = {}) {
    this.config = {
      servers: config.servers || ['nats://localhost:4222'],
      jwt: config.jwt || null,
      nkey: config.nkey || null,
      account: config.account || null,
      bucket: config.bucket || 'kafka-analysis',
      objectName: config.objectName || 'analysis-result',
      ...config
    };
    this.nc = null;
    this.objectStore = null;
  }

  async connect() {
    try {
      console.log(chalk.blue('\n🛫 Connecting to NATS Object Store...'));
      const spinner = ora('Establishing NATS connection...').start();

      const connectOptions = {
        servers: this.config.servers,
        maxReconnectAttempts: 5,
        reconnectTimeWait: 1000,
        connectionTimeout: 5000,
        requestTimeout: 10000,
        name: 'superstream-kafka-analyzer-object-store'
      };

      // Add authentication if provided
      if (this.config.jwt && this.config.nkey) {
        const enc = new TextEncoder();
        connectOptions.authenticator = jwtAuthenticator(() => this.config.jwt, () => enc.encode(this.config.nkey));
      } else if (this.config.jwt) {
        connectOptions.authenticator = jwtAuthenticator(this.config.jwt);
      }

      this.nc = await connect(connectOptions);

      spinner.stop();
      console.log(chalk.green('✅ Connected to NATS successfully!'));
      console.log(chalk.gray(`• Server: ${this.config.servers.join(', ')}`));
      console.log(chalk.gray(`• Bucket: ${this.config.bucket}`));
      console.log(chalk.gray(`• Object: ${this.config.objectName}`));

      // Set up connection event handlers
      this.setupEventHandlers();

      return true;
    } catch (error) {
      console.error(chalk.red('❌ Failed to connect to NATS:'), error.message);
      return false;
    }
  }

  setupEventHandlers() {
    if (!this.nc) return;

    this.nc.closed().then(() => {
      console.log(chalk.yellow('⚠️ NATS connection closed'));
    });
  }

  async getOrCreateBucket() {
    try {
      console.log(chalk.blue('\n📦 Setting up Object Store bucket...'));
      const spinner = ora('Creating/accessing bucket...').start();

      // Get JetStream API
      const js = this.nc.jetstream();
      
      // Configure bucket with 30-day TTL
      const bucketConfig = {
        ttl: 30 * 24 * 60 * 60 * 1000000000, // 30 days in nanoseconds
        duplicate_window: 0 // Disable duplicate window to prevent object deletion
      };
      
      // Get (or create) object store bucket with TTL
      this.objectStore = await js.views.os(this.config.bucket, bucketConfig);

      spinner.stop();
      console.log(chalk.green('✅ Object Store bucket ready!'));
      console.log(chalk.gray(`• Bucket: ${this.config.bucket}`));
      console.log(chalk.gray(`• TTL: 30 days`));

      return true;
    } catch (error) {
      console.error(chalk.red('❌ Failed to setup Object Store bucket:'), error.message);
      return false;
    }
  }

  async storeObject(data, metadata = {}) {
    if (!this.objectStore) {
      throw new Error('Object Store not initialized. Call getOrCreateBucket() first.');
    }

    try {
      console.log(chalk.blue('\n💾 Storing object to NATS Object Store...'));
      const spinner = ora('Uploading analysis data...').start();

      // Convert data to JSON string
      const jsonData = JSON.stringify(data, null, 2);
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(jsonData);

      // Store the object using putBlob for binary data
      const info = await this.objectStore.putBlob({ 
        name: this.config.objectName, 
        description: 'Kafka analysis results' 
      }, dataBuffer);

      spinner.stop();
      console.log(chalk.green('✅ Object stored successfully!'));
      console.log(chalk.gray(`• Object: ${this.config.objectName}`));
      console.log(chalk.gray(`• Size: ${dataBuffer.length} bytes`));
      console.log(chalk.gray(`• Bucket: ${this.config.bucket}`));

      return info;
    } catch (error) {
      console.error(chalk.red('❌ Failed to store object:'), error.message);
      throw error;
    }
  }

  async disconnect() {
    try {
      if (this.nc) {
        await this.nc.close();
        console.log(chalk.green('✅ NATS connection closed'));
      }
    } catch (error) {
      console.error(chalk.red('❌ Error disconnecting:'), error.message);
    }
  }
}

module.exports = { NATSObjectStore }; 