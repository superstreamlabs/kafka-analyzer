const https = require('https');

class ConfluentService {
  constructor(apiKey, apiSecret, clusterId, restEndpoint) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.clusterId = clusterId;
    this.restEndpoint = restEndpoint;
  }

  /**
   * Check if API credentials are available
   */
  hasCredentials() {
    return !!(this.apiKey && this.apiSecret && this.clusterId && this.restEndpoint);
  }

  /**
   * Make authenticated request to Confluent Cloud API
   */
  async makeRequest(endpoint, method = 'GET') {
    if (!this.hasCredentials()) {
      throw new Error('Confluent Cloud API credentials not provided');
    }

    const auth = Buffer.from(`${this.apiKey}:${this.apiSecret}`).toString('base64');

    const options = {
      hostname: this.restEndpoint,
      port: 443,
      path: endpoint,
      method: method,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const jsonData = JSON.parse(data);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(jsonData);
            } else {
              reject(new Error(`API request failed: ${res.statusCode} - ${jsonData.message || data}`));
            }
          } catch (error) {
            reject(new Error(`Failed to parse API response: ${error.message}`));
          }
        });
      });
      
      req.on('error', (error) => {
        reject(new Error(`API request failed: ${error.message}`));
      });
      
      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('API request timeout'));
      });
      
      req.end();
    });
  }

  /**
   * List ACLs for the environment
   */
  async listAcls() {
    try {
      const endpoint = `/kafka/v3/clusters/${this.clusterId}/acls`;
      const response = await this.makeRequest(endpoint);
      return response.data || [];
    } catch (error) {
      throw new Error(`Failed to list ACLs: ${error.message}`);
    }
  }

  /**
   * Analyze ACLs for overly permissive rules
   */
  analyzeAcls(acls) {
    const issues = [];

    if (!Array.isArray(acls)) {
      return issues;
    }

    acls.forEach((acl, index) => {
      const resourceType = acl && acl.resource_type ? String(acl.resource_type) : '';
      const resourceName = acl && acl.resource_name ? String(acl.resource_name) : '';
      const patternType = acl && acl.pattern_type ? String(acl.pattern_type) : '';
      const principal = acl && acl.principal ? String(acl.principal) : '';
      const host = acl && typeof acl.host !== 'undefined' ? String(acl.host) : '';
      const operation = acl && acl.operation ? String(acl.operation) : '';
      const permission = acl && acl.permission ? String(acl.permission) : '';

      // 1) Wildcard resource name or wildcard principal
      if (resourceName === '*') {
        issues.push({
          aclIndex: index,
          type: 'wildcard_resource',
          description: 'Wildcard resource access',
          resourceType,
          resourceName,
          principal,
          operation,
          permission
        });
      }

      if (principal.startsWith('User:') && principal.split(':', 2)[1] === '*') {
        issues.push({
          aclIndex: index,
          type: 'wildcard_principal',
          description: 'Wildcard user principal',
          resourceType,
          resourceName,
          principal,
          operation,
          permission
        });
      }

      // 2) Overly broad operation
      if (operation === 'ALL' || operation === '*') {
        issues.push({
          aclIndex: index,
          type: 'overly_broad_operation',
          description: 'ALL operations permission',
          resourceType,
          resourceName,
          principal,
          operation,
          permission
        });
      }

      // 3) Permissive host (any host). Some APIs may return '' for any host
      if (host === '*' || host === '') {
        issues.push({
          aclIndex: index,
          type: 'permissive_host',
          description: 'ACL applies to any host',
          resourceType,
          resourceName,
          principal,
          operation,
          permission
        });
      }

      // 4) Broad resource pattern type
      if (patternType === 'PREFIXED' && (resourceName === '*' || resourceName === '' || resourceName.length <= 1)) {
        issues.push({
          aclIndex: index,
          type: 'broad_pattern',
          description: 'Broad resource pattern (PREFIXED with very short or wildcard name)',
          resourceType,
          resourceName,
          principal,
          operation,
          permission
        });
      }
    });

    return issues;
  }

  /**
   * Check ACL enforcement and least-privilege patterns
   */
  async checkAclEnforcement() {
    try {
      if (!this.hasCredentials()) {
        return {
          enabled: false,
          reason: 'API credentials not provided',
          acls: [],
          issues: []
        };
      }

      const acls = await this.listAcls();
      const issues = this.analyzeAcls(acls);
      
      return {
        enabled: true,
        aclCount: acls.length,
        acls: acls,
        issues: issues,
        hasOverlyPermissiveRules: issues.length > 0
      };
    } catch (error) {
      return {
        enabled: false,
        reason: error.message,
        acls: [],
        issues: []
      };
    }
  }
}

module.exports = { ConfluentService };
