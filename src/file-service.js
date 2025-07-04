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
          const filename = await this.saveInFormat(topicInfo, format, timestamp);
          savedFiles.push(filename);
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
      rows.push(['Check Name', 'Status', 'Message', 'Description', 'Recommendation']);
      
      topicInfo.healthChecks.checks.forEach(check => {
        rows.push([
          check.name,
          check.status,
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
    
    const htmlContent = await this.generateHtmlReport(topicInfo);
    await fs.writeFile(filepath, htmlContent, 'utf8');
    
    return filename;
  }

  async generateHtmlReport(topicInfo) {
    try {
      // Try to load the template
      const templatePath = path.join(__dirname, '../templates/email-template.html');
      const template = await fs.readFile(templatePath, 'utf8');
      return this.populateTemplate(template, topicInfo);
    } catch (error) {
      // Fallback to default template
      return this.getDefaultHtmlTemplate(topicInfo);
    }
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
      .replace('{{avgPartitions}}', summary.averagePartitionsPerTopic || 0)
      .replace('{{errorTopics}}', summary.topicsWithErrors || 0)
      .replace('{{vendor}}', this.formatVendorName(vendor));

    // Remove topic items section
    html = html.replace('{{topicItems}}', '');

    // Generate configuration section if there are common configs
    const configSection = this.generateConfigSection(summary.commonConfigs);
    html = html.replace('{{configSection}}', configSection);

    // Generate health check section if available
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

  generateHealthCheckSection(healthChecks) {
    if (!healthChecks || !healthChecks.checks || healthChecks.checks.length === 0) {
      return '';
    }

    const statusIcons = {
      'pass': '✅',
      'fail': '❌',
      'warning': '⚠️',
      'error': '🚨',
      'info': 'ℹ️'
    };

    const statusColors = {
      'pass': '#28a745',
      'fail': '#dc3545',
      'warning': '#ffc107',
      'error': '#dc3545',
      'info': '#17a2b8'
    };

    let healthHtml = `
      <div class="health-check-section">
        <h3>🔍 Health Check Results</h3>
        <div class="health-summary">
          <strong>Summary:</strong> 
          Total: ${healthChecks.totalChecks} | 
          ✅ Passed: ${healthChecks.passedChecks} | 
          ❌ Failed: ${healthChecks.failedChecks} | 
          ⚠️ Warnings: ${healthChecks.warnings}
        </div>
        <div class="health-checks">
    `;

    healthChecks.checks.forEach(check => {
      const icon = statusIcons[check.status] || '❓';
      const color = statusColors[check.status] || '#6c757d';
      
      healthHtml += `
        <div class="health-check-item" style="border-left: 4px solid ${color}; padding: 10px; margin: 10px 0; background-color: #f8f9fa;">
          <div class="health-check-header" style="font-weight: bold; margin-bottom: 5px;">
            ${icon} ${check.name}
          </div>
          ${check.description ? `
            <div class="health-check-description" style="color: #6c757d; font-size: 0.9em; margin-bottom: 5px; font-style: italic;">
              📋 ${check.description}
            </div>
          ` : ''}
          <div class="health-check-message" style="margin-bottom: 5px;">
            ${check.message}
          </div>
          ${check.recommendation ? `
            <div class="health-check-recommendation" style="color: #17a2b8; font-style: italic;">
              💡 Recommendation: ${check.recommendation}
            </div>
          ` : ''}
        </div>
      `;
    });

    healthHtml += `
        </div>
      </div>
    `;

    return healthHtml;
  }

  getDefaultHtmlTemplate(topicInfo) {
    const summary = topicInfo.summary || {};
    const clusterInfo = topicInfo.clusterInfo || {};
    const vendor = topicInfo.topics[0]?.vendor || 'unknown';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Superstream Kafka Health Report</title>
  <link href="https://fonts.googleapis.com/css?family=Inter:400,600,700&display=swap" rel="stylesheet">
  <style>
    html, body {
      font-family: 'Inter', Arial, sans-serif !important;
    }
    body {
      background: linear-gradient(135deg, #181A20 0%, #23272F 100%);
      min-height: 100vh;
      margin: 0;
      font-family: 'Inter', Arial, sans-serif !important;
      color: #F3F6F9;
      display: flex;
      justify-content: center;
      align-items: flex-start;
    }
    .report-card {
      background: #23272F;
      border-radius: 18px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.25);
      margin: 40px 0;
      display: flex;
      max-width: 1100px;
      width: 100%;
      overflow: hidden;
      min-height: 600px;
    }
    .sidebar {
      background: #181A20;
      padding: 36px 28px 36px 28px;
      width: 270px;
      display: flex;
      flex-direction: column;
      align-items: center;
      border-right: 1px solid #23272F;
    }
    .sidebar img {
      width: 120px;
      margin-bottom: 32px;
    }
    .sidebar h2 {
      color: #3ED6B7;
      font-size: 1.1rem;
      font-weight: 700;
      margin: 0 0 18px 0;
      letter-spacing: 1px;
      font-family: 'Inter', Arial, sans-serif !important;
    }
    .summary-list {
      width: 100%;
      margin-top: 18px;
    }
    .summary-list p {
      margin: 0 0 12px 0;
      font-size: 1.05rem;
      color: #B0B8C1;
      display: flex;
      align-items: center;
      gap: 8px;
      font-family: 'Inter', Arial, sans-serif !important;
    }
    .summary-list strong {
      color: #F3F6F9;
      font-weight: 600;
      min-width: 120px;
      display: inline-block;
      font-family: 'Inter', Arial, sans-serif !important;
    }
    .main-content {
      flex: 1;
      padding: 40px 48px 40px 48px;
      display: flex;
      flex-direction: column;
      min-width: 0;
      font-family: 'Inter', Arial, sans-serif !important;
    }
    .main-content h1 {
      font-size: 2.1rem;
      font-weight: 700;
      margin: 0 0 10px 0;
      color: #3ED6B7;
      letter-spacing: 1px;
      font-family: 'Inter', Arial, sans-serif !important;
    }
    .main-content h2 {
      font-size: 1.3rem;
      font-weight: 600;
      margin: 24px 0 10px 0;
      color: #6B6BFF;
      font-family: 'Inter', Arial, sans-serif !important;
    }
    .health-check-section {
      margin-top: 18px;
    }
    .health-summary {
      background: #181A20;
      border-radius: 10px;
      padding: 14px 18px;
      margin-bottom: 18px;
      color: #B0B8C1;
      font-size: 1.01rem;
      font-weight: 500;
      display: flex;
      gap: 18px;
      align-items: center;
      font-family: 'Inter', Arial, sans-serif !important;
    }
    .health-checks {
      display: flex;
      flex-direction: column;
      gap: 18px;
    }
    .health-check-item {
      background: #181A20 !important;
      border-radius: 10px;
      border-left: 6px solid #3ED6B7;
      padding: 18px 22px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.18);
      color: #F3F6F9 !important;
      transition: border-color 0.2s;
      font-family: 'Inter', Arial, sans-serif !important;
    }
    .health-check-item * {
      color: #F3F6F9 !important;
      font-family: 'Inter', Arial, sans-serif !important;
    }
    .health-check-header {
      font-weight: 600;
      font-size: 1.1rem;
      margin-bottom: 4px;
      display: flex;
      align-items: center;
      gap: 8px;
      color: #F3F6F9 !important;
      font-family: 'Inter', Arial, sans-serif !important;
    }
    .health-check-description {
      color: #B0B8C1 !important;
      font-size: 0.98em;
      margin-bottom: 4px;
      font-style: italic;
      font-family: 'Inter', Arial, sans-serif !important;
    }
    .health-check-message {
      margin-bottom: 4px;
      color: #F3F6F9 !important;
      font-family: 'Inter', Arial, sans-serif !important;
    }
    .health-check-recommendation {
      color: #3ED6B7 !important;
      font-style: italic;
      font-family: 'Inter', Arial, sans-serif !important;
    }
    @media (max-width: 1100px) {
      .report-card { max-width: 99vw; }
    }
    @media (max-width: 900px) {
      .report-card { flex-direction: column; max-width: 98vw; }
      .sidebar { width: 100%; border-right: none; border-bottom: 1px solid #23272F; flex-direction: row; justify-content: flex-start; padding: 24px 16px; }
      .sidebar img { width: 70px; margin-bottom: 0; margin-right: 18px; }
      .main-content { padding: 24px 12px; }
    }
    @media (max-width: 600px) {
      .main-content { padding: 12px 2vw; }
      .sidebar { padding: 12px 2vw; }
    }
    .main-content a, .main-content a:visited, .main-content a:active, .main-content a:focus, .main-content a:link {
      color: #3ED6B7 !important;
      text-decoration: underline;
      transition: color 0.2s;
    }
    .main-content a:hover {
      color: #6B6BFF !important;
      text-decoration: underline;
    }
    .sidebar a, .sidebar a:visited, .sidebar a:active, .sidebar a:focus, .sidebar a:link {
      color: #3ED6B7 !important;
      text-decoration: underline;
      transition: color 0.2s;
    }
    .sidebar a:hover {
      color: #6B6BFF !important;
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="report-card">
    <div class="sidebar">
      <img src="../static/superstream-logo.png" alt="Superstream Logo" />
      <div>
        <div class="summary-list">
          <p><strong>Vendor:</strong> ${this.formatVendorName(vendor)}</p>
          <p><strong>ZooKeepers:</strong> ${clusterInfo.controller || 'Unknown'}</p>
          <p><strong>Brokers:</strong> ${clusterInfo.brokers?.length || 0}</p>
          <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
          <p><strong>Total Topics:</strong> ${summary.totalTopics || 0}</p>
          <p><strong>User Topics:</strong> ${summary.userTopics || 0}</p>
          <p><strong>Internal Topics:</strong> ${summary.internalTopics || 0}</p>
          <p><strong>Total Partitions:</strong> ${summary.totalPartitions || 0}</p>
          <p><strong>Topics with Issues:</strong> ${summary.topicsWithErrors || 0}</p>
        </div>
      </div>
    </div>
    <div class="main-content">
      <h1>Kafka Health Report</h1>
      <div class="health-check-section">
        ${this.generateHealthCheckSection(topicInfo.healthChecks)}
      </div>
      <div style="margin-top: 30px; padding: 15px; background: #181A20; border-radius: 5px; color: #B0B8C1; font-family: 'Inter', Arial, sans-serif !important;">
        <p><em>Generated by <a href="https://superstream.ai">Superstream</a> Kafka Analyzer</em><br>
        Wants to fix your Kafka issues automatically and continuously? <a href="https://superstream.ai">Learn more</a><br>
        <br><small>All rights reserved to Superstream Labs Inc 2025. You own your data and it is never shared with anyone, including us.</small>
        </p>
      </div>
      <div style="margin-top: 30px; text-align: center;">
        <a href="https://superstream.ai" target="_blank">
          <img src="../static/superstream-cta.png" alt="Superstream - Fix your Kafka issues automatically" style="max-width: 100%; height: auto; border-radius: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);" />
        </a>
      </div>
    </div>
  </div>
</body>
</html>`;
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
      lines.push(`✅ Passed: ${topicInfo.healthChecks.passedChecks}`);
      lines.push(`❌ Failed: ${topicInfo.healthChecks.failedChecks}`);
      lines.push(`⚠️  Warnings: ${topicInfo.healthChecks.warnings}`);
      lines.push('');
      
      topicInfo.healthChecks.checks.forEach(check => {
        const statusIcon = {
          'pass': '✅',
          'fail': '❌',
          'warning': '⚠️',
          'error': '🚨',
          'info': 'ℹ️'
        }[check.status] || '❓';
        
        lines.push(`${statusIcon} ${check.name}`);
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

  getConfig() {
    return {
      outputDir: this.outputDir,
      formats: this.formats,
      includeTimestamp: this.includeTimestamp
    };
  }
}

module.exports = { FileService }; 