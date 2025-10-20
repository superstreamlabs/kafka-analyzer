const fs = require('fs').promises;
const path = require('path');

class FileService {
  constructor(config) {
    this.config = config;
    this.outputDir = config.outputDir;
    this.formats = config.formats || ['json', 'csv', 'html'];
    this.includeTimestamp = config.includeTimestamp !== false; // Default to true unless explicitly set to false
  }

  async saveAnalysisResults(topicInfo) {
    try {
      // Ensure output directory exists
      await this.ensureOutputDirectory();

      const savedFiles = [];
      const timestamp = this.includeTimestamp ? `-${Date.now()}` : '';

      // Save in each requested format
      for (const format of this.formats) {
        try {
          const result = await this.saveInFormat(topicInfo, format, timestamp);
          savedFiles.push(result);
        } catch (error) {
          console.warn(`Warning: Failed to save ${format} format: ${error.message}`);
        }
      }

      return savedFiles;

    } catch (error) {
      throw new Error(`Failed to save analysis results: ${error.message}`);
    }
  }

  async ensureOutputDirectory() {
    try {
      await fs.access(this.outputDir);
    } catch {
      await fs.mkdir(this.outputDir, { recursive: true });
    }
  }

  async saveInFormat(topicInfo, format, timestamp) {
    switch (format) {
      case 'json':
        return await this.saveJson(topicInfo, timestamp);
      case 'csv':
        return await this.saveCsv(topicInfo, timestamp);
      case 'html':
        return await this.saveHtml(topicInfo, timestamp);
      case 'txt':
        return await this.saveText(topicInfo, timestamp);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  async saveJson(topicInfo, timestamp) {
    const filename = `kafka-analysis${timestamp}.json`;
    const filepath = path.join(this.outputDir, filename);
    
    const jsonData = JSON.stringify(topicInfo, null, 2);
    await fs.writeFile(filepath, jsonData, 'utf8');
    
    return filename;
  }

  async saveCsv(topicInfo, timestamp) {
    const filename = `kafka-health-checks${timestamp}.csv`;
    const filepath = path.join(this.outputDir, filename);
    
    const csvData = this.generateCsvData(topicInfo);
    await fs.writeFile(filepath, csvData, 'utf8');
    
    return filename;
  }

  generateCsvData(topicInfo) {
    // Start with health check results if available
    const rows = [];
    
    if (topicInfo.healthChecks && topicInfo.healthChecks.checks.length > 0) {
      rows.push(['Health Check Results']);
      rows.push(['Check Name', 'Status', 'Severity', 'Message', 'Description', 'Recommendation']);
      
      topicInfo.healthChecks.checks.forEach(check => {
        rows.push([
          check.name,
          check.status,
          check.severity,
          check.message,
          check.description || '',
          check.recommendation || ''
        ]);
      });
    }

    return rows
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');
  }

  async saveHtml(topicInfo, timestamp) {
    const filename = `kafka-report${timestamp}.html`;
    const filepath = path.join(this.outputDir, filename);
    
    // Generate HTML report
    const htmlContent = await this.generateHtmlReport(topicInfo);
    await fs.writeFile(filepath, htmlContent, 'utf8');
    
    return filename;
  }

  async generateHtmlReport(topicInfo) {
    const templatePath = path.resolve(__dirname, '..', 'templates', 'email-template-modern.html');
    const template = await fs.readFile(templatePath, 'utf8');
    return this.populateTemplate(template, topicInfo);
  }

  populateTemplate(template, topicInfo) {
    const summary = topicInfo.summary || {};
    const clusterInfo = topicInfo.clusterInfo || {};
    const vendor = topicInfo.topics[0]?.vendor || 'unknown';

    // Replace basic placeholders
    let html = template
      .replace('{{controller}}', clusterInfo.controller || 'Unknown')
      .replace('{{brokerCount}}', clusterInfo.brokers?.length || 0)
      .replace('{{timestamp}}', new Date(clusterInfo.timestamp || Date.now()).toLocaleString())
      .replace('{{totalTopics}}', summary.totalTopics || 0)
      .replace('{{userTopics}}', summary.userTopics || 0)
      .replace('{{internalTopics}}', summary.internalTopics || 0)
      .replace('{{totalPartitions}}', summary.totalPartitions || 0)
      .replace('{{errorTopics}}', summary.topicsWithErrors || 0)
      .replace('{{vendor}}', this.formatVendorName(vendor));

    // Generate health check section
    const healthCheckSection = this.generateHealthCheckSection(topicInfo.healthChecks);
    html = html.replace('{{healthCheckSection}}', healthCheckSection);

    return html;
  }

  formatVendorName(vendor) {
    const vendorNames = {
      'aws-msk': 'AWS MSK',
      'confluent-cloud': 'Confluent Cloud',
      'aiven': 'Aiven Kafka',
      'confluent-platform': 'Confluent Platform',
      'redpanda': 'Redpanda',
      'apache': 'Apache Kafka'
    };
    return vendorNames[vendor] || vendor;
  }

  getVendorSpecificInfo(topic) {
    switch (topic.vendor) {
      case 'aws-msk':
        return topic.awsMetadata ? `AWS Region: ${topic.awsMetadata.region}, Type: ${topic.awsMetadata.clusterType}` : '';
      case 'confluent-cloud':
        return topic.confluentMetadata ? `Provider: ${topic.confluentMetadata.cloudProvider}, Type: ${topic.confluentMetadata.clusterType}` : '';
      case 'aiven':
        return topic.aivenMetadata ? `Provider: ${topic.aivenMetadata.cloudProvider}, Type: ${topic.aivenMetadata.clusterType}` : '';
      default:
        return '';
    }
  }

  generateConfigSection(commonConfigs) {
    if (!commonConfigs || Object.keys(commonConfigs).length === 0) {
      return '';
    }

    let configHtml = '<div class="config-section"><h3>Common Topic Configurations</h3>';
    
    Object.entries(commonConfigs).forEach(([configName, values]) => {
      configHtml += `<h4>${configName}</h4>`;
      Object.entries(values).forEach(([value, count]) => {
        configHtml += `<div class="config-item">${value}: ${count} topics</div>`;
      });
    });
    
    configHtml += '</div>';
    return configHtml;
  }



  async saveText(topicInfo, timestamp) {
    const filename = `kafka-summary${timestamp}.txt`;
    const filepath = path.join(this.outputDir, filename);
    
    const textContent = this.generateTextSummary(topicInfo);
    await fs.writeFile(filepath, textContent, 'utf8');
    
    return filename;
  }

  generateTextSummary(topicInfo) {
    const lines = [];
    lines.push('Kafka Analysis Summary');
    lines.push('----------------------');
    lines.push(`ZooKeepers: ${topicInfo.clusterInfo.controller}`);
    lines.push(`Brokers: ${topicInfo.clusterInfo.brokers.length}`);
    lines.push(`Total Topics: ${topicInfo.summary.totalTopics}`);
    lines.push(`User Topics: ${topicInfo.summary.userTopics}`);
    lines.push(`Internal Topics: ${topicInfo.summary.internalTopics}`);
    lines.push(`Total Partitions: ${topicInfo.summary.totalPartitions}`);
    lines.push(`Topics with Issues: ${topicInfo.summary.topicsWithErrors}`);
    lines.push('');
    
    // Add health check results if available
    if (topicInfo.healthChecks && topicInfo.healthChecks.checks.length > 0) {
      lines.push('Health Check Results');
      lines.push('-------------------');
      lines.push(`Total Checks: ${topicInfo.healthChecks.totalChecks}`);
      lines.push(`❌ Failed: ${topicInfo.healthChecks.failedChecks}`);
      lines.push(`✅ Passed: ${topicInfo.healthChecks.passedChecks}`);
      lines.push('');
      
      const severityIcons = {
        'critical': '🔴',
        'high': '🟠',
        'medium': '🟡',
        'low': '🔵'
      };
      
      topicInfo.healthChecks.checks.forEach(check => {
        const statusIcon = {
          'pass': '✅',
          'fail': '❌',
        }[check.status] || '❓';
        
        let severityText = '';
        if (check.status === 'fail' && check.severity) {
          const severityIcon = severityIcons[check.severity] || '';
          severityText = check.severity.charAt(0).toUpperCase() + check.severity.slice(1) + ' severity';
          severityText = `${severityIcon} ${severityText}`;
        }

        lines.push(`${statusIcon} ${check.name} ${severityText}`);
      
        if (check.description) {
          lines.push(`   📋 ${check.description}`);
        }
        lines.push(`   ${check.message}`);
        if (check.recommendation) {
          lines.push(`   💡 Recommendation: ${check.recommendation}`);
        }
        lines.push('');
      });
    }
    
    return lines.join('\n');
  }


  generateHealthCheckSection(healthChecks) {
    if (!healthChecks || !healthChecks.checks || healthChecks.checks.length === 0) {
      return '<div class="health-summary"><h2>Health Check Summary</h2><p>No health checks available.</p></div>';
    }

    let healthHtml = `
      <!-- Health Summary -->
      <div class="health-summary">
        <h2>Health Check Summary</h2>
        <div class="summary-grid">
          <div class="summary-item">
            <div class="summary-number total">${healthChecks.totalChecks}</div>
            <div class="summary-label">Total Checks</div>
          </div>
          <div class="summary-item">
            <div class="summary-number failed">${healthChecks.failedChecks}</div>
            <div class="summary-label">Failed</div>
          </div>
          <div class="summary-item">
            <div class="summary-number passed">${healthChecks.passedChecks}</div>
            <div class="summary-label">Passed</div>
          </div>
        </div>
      </div>

      <!-- Health Checks -->
      <div class="health-checks-section">
        <h2>Health Check Results</h2>
        
        <div class="health-checks">
    `;

    healthChecks.checks.forEach(check => {
      const statusClass = check.status === 'pass' ? 'pass' : 'fail';
      const statusText = check.status === 'pass' ? 'Passed' : 'Failed';
      const iconFile = check.status === 'pass' ? 'check-circle.svg' : 'x-circle.svg';
      
      // Add severity badge for failed checks
      const severityBadge = check.status === 'fail' && check.severity ? 
        `<span class="severity-badge ${check.severity}">${check.severity.toUpperCase()}</span>` : '';
      
      healthHtml += `
        <div class="health-check ${statusClass}">
          <div class="check-header">
            <div class="status-icon ${statusClass}">
              <img src="${__dirname}/static/icons/${iconFile}" alt="${statusText}" />
            </div>
            <h3 class="check-title">${check.name}</h3>
            ${severityBadge}
            ${check.status === 'pass' ? `<span class="status-badge ${statusClass}">${statusText}</span>` : ''}
          </div>
          ${check.description ? `
          <div class="check-description">
            ${check.description}
          </div>` : ''}
          <div class="check-message">
            ${check.message}
          </div>
          ${check.recommendation ? `
          <div class="check-recommendation">
            <p><span class="recommendation-label">💡 Recommendation:</span> ${check.recommendation}</p>
          </div>` : ''}
        </div>
      `;
    });

    healthHtml += `
        </div>
      </div>
    `;

    return healthHtml;
  }


  getConfig() {
    return {
      outputDir: this.outputDir,
      formats: this.formats,
      includeTimestamp: this.includeTimestamp
    };
  }
}

module.exports = { FileService }; 