const joi = require('joi');
const dns = require('dns');
const net = require('net');
const fs = require('fs').promises;
const { Kafka } = require('kafkajs');
const chalk = require('chalk');
const path = require('path');

class Validators {
  // Phase 1: Input Format Validation
  static brokerUrl(url) {
    const brokerRegex = /^[a-zA-Z0-9.-]+:\d{1,5}$/;
    if (!brokerRegex.test(url)) {
      return false;
    }
    
    const [, port] = url.split(':');
    const portNum = parseInt(port);
    return portNum >= 1 && portNum <= 65535;
  }

  static port(port) {
    return port >= 1 && port <= 65535;
  }

  // Phase 2: Network Connectivity Testing
  static async testTcpConnection(host, port, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      const startTime = Date.now();
      
      socket.setTimeout(timeout);
      
      socket.on('connect', () => {
        const connectTime = Date.now() - startTime;
        socket.destroy();
        resolve({ connectTime });
      });
      
      socket.on('timeout', () => {
        socket.destroy();
        reject(new Error('Connection timeout'));
      });
      
      socket.on('error', (error) => {
        socket.destroy();
        reject(error);
      });
      
      socket.connect(port, host);
    });
  }

  static async testBrokerConnectivity(brokers) {
    const results = [];
    
    for (const broker of brokers) {
      const [host, port] = broker.split(':');
      
      try {
        // Test DNS resolution first
        const dnsResult = await this.testDnsResolution(host);
        if (dnsResult.status === 'failed') {
          results.push({
            broker,
            status: 'failed',
            error: dnsResult.error,
            logs: dnsResult.logs
          });
          continue;
        }
        
        // Test TCP connection
        const socket = await this.testTcpConnection(host, parseInt(port), 10000);
        results.push({
          broker,
          status: 'connected',
          latency: socket.connectTime,
          logs: [
            `TCP connection to ${broker} successful`,
            `Latency: ${socket.connectTime}ms`,
            `DNS resolved to: ${dnsResult.addresses.join(', ')}`
          ]
        });
      } catch (error) {
        results.push({
          broker,
          status: 'failed',
          error: error.message,
          logs: [
            `Failed to connect to ${broker}`,
            `Error: ${error.code || 'UNKNOWN'}`,
            `Details: ${error.message}`
          ]
        });
      }
    }
    
    return results;
  }

  static async testDnsResolution(hostname) {
    try {
      const addresses = await dns.promises.lookup(hostname, { all: true });
      return {
        status: 'resolved',
        addresses: addresses.map(addr => addr.address),
        logs: [`DNS resolution for ${hostname} successful: ${addresses.map(a => a.address).join(', ')}`]
      };
    } catch (error) {
      return {
        status: 'failed',
        error: error.message,
        logs: [
          `DNS resolution failed for ${hostname}`,
          `Error code: ${error.code}`,
          `System error: ${error.syscall}`
        ]
      };
    }
  }

  // Phase 3: Security Protocol Testing
  static async validateSslCertificates(brokers, sslConfig) {
    const results = [];
    
    for (const broker of brokers) {
      const [host, port] = broker.split(':');
      
      try {
        const cert = await this.getCertificateInfo(host, parseInt(port));
        const validation = this.validateCertificate(cert, host);
        
        results.push({
          broker,
          status: validation.valid ? 'valid' : 'invalid',
          certificate: {
            subject: cert.subject,
            issuer: cert.issuer,
            validFrom: cert.valid_from,
            validTo: cert.valid_to,
            fingerprint: cert.fingerprint
          },
          logs: [
            `Certificate retrieved for ${host}:${port}`,
            `Subject: ${cert.subject.CN}`,
            `Issuer: ${cert.issuer.CN}`,
            `Valid from: ${cert.valid_from}`,
            `Valid to: ${cert.valid_to}`,
            ...validation.issues
          ]
        });
      } catch (error) {
        results.push({
          broker,
          status: 'error',
          error: error.message,
          logs: [
            `SSL certificate validation failed for ${host}:${port}`,
            `Error: ${error.code}`,
            `Details: ${error.message}`
          ]
        });
      }
    }
    
    return results;
  }

  static async getCertificateInfo(host, port) {
    return new Promise((resolve, reject) => {
      const tls = require('tls');
      const socket = tls.connect({
        host,
        port,
        rejectUnauthorized: false
      }, () => {
        const cert = socket.getPeerCertificate();
        socket.destroy();
        resolve(cert);
      });
      
      socket.on('error', (error) => {
        socket.destroy();
        reject(error);
      });
    });
  }

  static validateCertificate(cert, hostname) {
    const issues = [];
    let valid = true;
    
    // Check if certificate exists
    if (!cert || Object.keys(cert).length === 0) {
      issues.push('No certificate received');
      valid = false;
      return { valid, issues };
    }
    
    // Check expiration
    const now = new Date();
    const validFrom = new Date(cert.valid_from);
    const validTo = new Date(cert.valid_to);
    
    if (now < validFrom) {
      issues.push(`Certificate not yet valid (valid from: ${cert.valid_from})`);
      valid = false;
    }
    
    if (now > validTo) {
      issues.push(`Certificate expired (expired: ${cert.valid_to})`);
      valid = false;
    }
    
    // Check hostname
    if (cert.subject.CN !== hostname) {
      issues.push(`Hostname mismatch: expected ${hostname}, got ${cert.subject.CN}`);
      valid = false;
    }
    
    return { valid, issues };
  }

  static async testSaslAuthentication(brokers, saslConfig) {
    try {
      const kafka = new Kafka({
        clientId: 'superstream-auth-test',
        brokers: brokers,
        sasl: saslConfig,
        connectionTimeout: 10000,
        authenticationTimeout: 5000
      });

      const admin = kafka.admin();
      await admin.connect();
      
      // Test basic cluster access
      const metadata = await admin.fetchTopicMetadata();
      await admin.disconnect();

      return {
        status: 'authenticated',
        mechanism: saslConfig.mechanism,
        logs: [
          `SASL authentication successful using ${saslConfig.mechanism}`,
          `Username: ${saslConfig.username}`,
          `Cluster access verified`,
          `Metadata fetch successful`
        ]
      };
    } catch (error) {
      return {
        status: 'failed',
        error: error.message,
        logs: [
          `SASL authentication failed`,
          `Mechanism: ${saslConfig.mechanism}`,
          `Username: ${saslConfig.username}`,
          `Error code: ${error.code || 'AUTH_ERROR'}`,
          `Message: ${error.message}`,
          `Possible causes: Invalid credentials, network issues, or insufficient permissions`
        ]
      };
    }
  }

  // Phase 4: Technical Setup Validation
  static async validateCompleteSetup(kafkaConfig, fileConfig) {
    const validationResults = {
      kafka: null,
      file: null,
      overall: 'pending',
      logs: [],
      errors: []
    };

    try {
      validationResults.logs.push('Starting comprehensive validation...');
      
      // Test complete Kafka setup
      // validationResults.logs.push('Testing Kafka configuration...');
      // validationResults.kafka = await this.validateKafkaSetup(kafkaConfig);
      // validationResults.logs.push(...validationResults.kafka.logs);

      // if (validationResults.kafka.status !== 'success') {
      //   validationResults.errors.push('Kafka setup validation failed');
      //   validationResults.logs.push('❌ Kafka validation failed - stopping validation');
      // }

      // Test file system setup
      validationResults.logs.push('Testing file system configuration...');
      validationResults.file = await this.validateFileSetup(fileConfig);
      validationResults.logs.push(...validationResults.file.logs);

      if (validationResults.file.status !== 'success') {
        validationResults.errors.push('File system setup validation failed');
        validationResults.logs.push('❌ File system validation failed - stopping validation');
      }

      // Determine overall status
      if (validationResults.kafka.status === 'success' && 
          validationResults.file.status === 'success') {
        validationResults.overall = 'ready';
        validationResults.logs.push('✅ All systems validated - Ready for analysis');
      } else {
        validationResults.overall = 'failed';
        validationResults.logs.push('❌ Validation failed - Cannot proceed with analysis');
      }

    } catch (error) {
      validationResults.overall = 'error';
      validationResults.errors.push(`Validation error: ${error.message}`);
      validationResults.logs.push(`Critical error during validation: ${error.message}`);
      validationResults.logs.push(`Error stack: ${error.stack}`);
    }

    return validationResults;
  }

  static async validateKafkaSetup(config) {
    const logs = ['Starting Kafka setup validation...'];
    try {
      // Use the first broker for connectivity check
      const broker = Array.isArray(config.brokers) ? config.brokers[0] : config.brokers;
      logs.push(`Checking TCP connectivity to broker: ${broker}`);
      
      const [host, portStr] = broker.split(':');
      const port = parseInt(portStr, 10);
      
      logs.push(`Debug: Parsed host: "${host}", port: "${portStr}" -> ${port}`);
      
      if (!host || isNaN(port)) {
        logs.push('❌ Invalid broker format. Expected host:port');
        return {
          status: 'failed',
          logs,
          error: 'Invalid broker format. Expected host:port'
        };
      }
      
      logs.push(`Attempting TCP connection to ${host}:${port}`);
      
      // Attempt TCP connection
      await new Promise((resolve, reject) => {
        const socket = new net.Socket();
        socket.setTimeout(5000);
        socket.once('error', (err) => {
          logs.push(`❌ TCP connection failed: ${err.message}`);
          socket.destroy();
          reject(err);
        });
        socket.once('timeout', () => {
          logs.push('❌ TCP connection timed out');
          socket.destroy();
          reject(new Error('TCP connection timed out'));
        });
        socket.connect(port, host, () => {
          logs.push('✅ TCP connection successful');
          socket.end();
          resolve();
        });
      });
      logs.push('✅ Broker address is reachable');
      return {
        status: 'success',
        logs
      };
    } catch (error) {
      logs.push(`❌ Kafka validation failed: ${error.message}`);
      return {
        status: 'failed',
        error: error.message,
        logs
      };
    }
  }

  static async validateFileSetup(config) {
    const logs = ['Starting file system setup validation...'];
    
    try {
      logs.push(`Checking output directory: ${config.outputDir}`);
      
      // Check if directory exists or can be created
      try {
        await fs.access(config.outputDir);
        logs.push('✅ Output directory exists');
      } catch {
        logs.push('Creating output directory...');
        await fs.mkdir(config.outputDir, { recursive: true });
        logs.push('✅ Output directory created successfully');
      }

      // Test write permissions
      logs.push('Testing write permissions...');
      const testFile = path.join(config.outputDir, '.test-write');
      await fs.writeFile(testFile, 'test');
      await fs.unlink(testFile);
      logs.push('✅ Write permissions verified');

      // Validate formats
      logs.push('Validating output formats...');
      const validFormats = ['json', 'csv', 'html', 'txt'];
      const invalidFormats = config.formats.filter(f => !validFormats.includes(f));
      
      if (invalidFormats.length > 0) {
        throw new Error(`Invalid formats: ${invalidFormats.join(', ')}`);
      }
      
      logs.push(`✅ Output formats validated: ${config.formats.join(', ')}`);

      return {
        status: 'success',
        logs
      };

    } catch (error) {
      logs.push(`❌ File system validation failed: ${error.message}`);
      
      // Detailed error analysis
      if (error.code === 'EACCES') {
        logs.push('Issue: Permission denied - check directory permissions');
      } else if (error.code === 'ENOSPC') {
        logs.push('Issue: No space left on device');
      } else if (error.code === 'ENOTDIR') {
        logs.push('Issue: Output path is not a directory');
      }

      return {
        status: 'failed',
        error: error.message,
        code: error.code,
        logs
      };
    }
  }

  // Helper methods for file validation
  static async validateFileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  static async validateFileReadable(filePath) {
    try {
      await fs.readFile(filePath);
      return true;
    } catch {
      return false;
    }
  }

  static async validateDirectoryWritable(dirPath) {
    try {
      const testFile = path.join(dirPath, '.test-write');
      await fs.writeFile(testFile, 'test');
      await fs.unlink(testFile);
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = { Validators }; 