const https = require('https');
const crypto = require('crypto');
const os = require('os');
const path = require('path');
const fs = require('fs');

class SupabaseAnalytics {
  constructor() {
    // Supabase configuration - replace with your actual values
    this.supabaseUrl = "https://cqlefzpkgqvcepghfmfy.supabase.co"; // Replace with your Supabase URL
    this.anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxbGVmenBrZ3F2Y2VwZ2hmbWZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA5NDE2NDMsImV4cCI6MjA2NjUxNzY0M30.tdOZJt4QpDLHdADb4GKUgZO-gQLssArOvyoECqddLCE"; // Replace with your Supabase anon key
    this.enabled = process.env.SUPERSTREAM_ANALYTICS !== 'false';
    this.clientId = this.getOrCreateClientId();
    this.locationCache = null;
    this.locationCacheTime = null;
    this.locationCacheExpiry = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  }

  getOrCreateClientId() {
    const configDir = path.join(os.homedir(), '.superstream');
    const clientIdFile = path.join(configDir, 'client-id');
    try {
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      if (fs.existsSync(clientIdFile)) {
        return fs.readFileSync(clientIdFile, 'utf8').trim();
      }
      const newClientId = 'superstream-' + crypto.randomBytes(16).toString('hex');
      fs.writeFileSync(clientIdFile, newClientId);
      return newClientId;
    } catch (error) {
      return 'superstream-temp-' + crypto.randomBytes(8).toString('hex');
    }
  }

  async getLocation() {
    // Return cached location if still valid
    if (this.locationCache && this.locationCacheTime && 
        (Date.now() - this.locationCacheTime) < this.locationCacheExpiry) {
      return this.locationCache;
    }

    try {
      const location = await this.fetchLocationFromIP();
      this.locationCache = location;
      this.locationCacheTime = Date.now();
      return location;
    } catch (error) {
      // Return default location data if geolocation fails
      return {
        country: 'unknown',
        country_code: 'unknown',
        region: 'unknown',
        city: 'unknown',
        latitude: null,
        longitude: null,
        timezone: 'unknown'
      };
    }
  }

  async fetchLocationFromIP() {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'ipapi.co',
        port: 443,
        path: '/json/',
        method: 'GET',
        headers: {
          'User-Agent': 'SuperStream-Kafka-Analyzer/1.0'
        },
        timeout: 5000
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            if (res.statusCode === 200) {
              const locationData = JSON.parse(data);
              resolve({
                country: locationData.country_name || 'unknown',
                country_code: locationData.country_code || 'unknown',
                region: locationData.region || 'unknown',
                city: locationData.city || 'unknown',
                latitude: locationData.latitude || null,
                longitude: locationData.longitude || null,
                timezone: locationData.timezone || 'unknown'
              });
            } else {
              reject(new Error(`HTTP ${res.statusCode}`));
            }
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Location request timeout'));
      });
      req.end();
    });
  }

  async trackEvent(event, data = {}) {
    if (!this.enabled) return;
    try {
      const location = await this.getLocation();
      const payload = {
        client_id: this.clientId,
        event_type: event,
        timestamp: new Date().toISOString(),
        app_version: require('../package.json').version,
        platform: os.platform(),
        arch: os.arch(),
        node_version: process.version,
        location_country: location.country,
        location_country_code: location.country_code,
        location_region: location.region,
        location_city: location.city,
        location_latitude: location.latitude,
        location_longitude: location.longitude,
        location_timezone: location.timezone,
        ...data
      };
      await this.sendToSupabase(payload);
    } catch (error) {
      // Silently fail
    }
  }

  async sendToSupabase(payload) {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify(payload);
      const url = new URL(this.supabaseUrl);
      const options = {
        hostname: url.hostname,
        port: 443,
        path: '/rest/v1/analytics',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'apikey': this.anonKey,
          'Authorization': `Bearer ${this.anonKey}`,
          'Prefer': 'return=minimal'
        }
      };
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      });
      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }

  async trackAppStart(vendor, hasConfigFile = false) {
    await this.trackEvent('app_start', {
      vendor: vendor || 'unknown',
      has_config_file: hasConfigFile,
      mode: hasConfigFile ? 'config_file' : 'interactive'
    });
  }

  async trackAnalysisComplete(vendor, topicsCount, healthChecksCount, hasIssues = false) {
    await this.trackEvent('analysis_complete', {
      vendor: vendor || 'unknown',
      topics_count: topicsCount,
      health_checks_count: healthChecksCount,
      has_issues: hasIssues
    });
  }

  async trackHealthChecks(vendor, results) {
    await this.trackEvent('health_checks', {
      vendor: vendor || 'unknown',
      total_checks: results.totalChecks,
      passed_checks: results.passedChecks,
      failed_checks: results.failedChecks
    });
  }

  async trackError(errorType, vendor = null) {
    await this.trackEvent('error', {
      error_type: errorType,
      vendor: vendor || 'unknown'
    });
  }

  async trackFeatureUsage(feature, vendor = null) {
    await this.trackEvent('feature_usage', {
      feature,
      vendor: vendor || 'unknown'
    });
  }

  async trackLocationUpdate() {
    // Force refresh location cache and track location update
    this.locationCache = null;
    this.locationCacheTime = null;
    const location = await this.getLocation();
    await this.trackEvent('location_update', {
      location_country: location.country,
      location_country_code: location.country_code,
      location_region: location.region,
      location_city: location.city,
      location_latitude: location.latitude,
      location_longitude: location.longitude,
      location_timezone: location.timezone
    });
  }

  async trackLocationBasedEvent(event, data = {}, includeDetailedLocation = false) {
    if (!this.enabled) return;
    try {
      const location = await this.getLocation();
      const payload = {
        client_id: this.clientId,
        event_type: event,
        timestamp: new Date().toISOString(),
        app_version: require('../package.json').version,
        platform: os.platform(),
        arch: os.arch(),
        node_version: process.version,
        location_country: location.country,
        location_country_code: location.country_code,
        location_region: location.region,
        location_city: location.city,
        location_latitude: location.latitude,
        location_longitude: location.longitude,
        location_timezone: location.timezone,
        ...data
      };
      await this.sendToSupabase(payload);
    } catch (error) {
      // Silently fail
    }
  }

  async storeEmail(email, vendor, hasConfigFile = false) {
    if (!this.enabled || !email || !email.trim()) return;
    try {
      const location = await this.getLocation();
      const payload = {
        client_id: this.clientId,
        email: email.trim().toLowerCase(),
        vendor: vendor || 'unknown',
        has_config_file: hasConfigFile,
        mode: hasConfigFile ? 'config_file' : 'interactive',
        timestamp: new Date().toISOString(),
        app_version: require('../package.json').version,
        platform: os.platform(),
        arch: os.arch(),
        node_version: process.version,
        location_country: location.country,
        location_country_code: location.country_code,
        location_region: location.region,
        location_city: location.city,
        location_latitude: location.latitude,
        location_longitude: location.longitude,
        location_timezone: location.timezone
      };
      await this.sendEmailToSupabase(payload);
    } catch (error) {
      // Silently fail
    }
  }

  async sendEmailToSupabase(payload) {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify(payload);
      const url = new URL(this.supabaseUrl);
      const options = {
        hostname: url.hostname,
        port: 443,
        path: '/rest/v1/user_emails',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'apikey': this.anonKey,
          'Authorization': `Bearer ${this.anonKey}`,
          'Prefer': 'return=minimal'
        }
      };
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      });
      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }

  getCurrentLocation() {
    return this.locationCache;
  }

  isLocationCached() {
    return this.locationCache && this.locationCacheTime && 
           (Date.now() - this.locationCacheTime) < this.locationCacheExpiry;
  }
}

module.exports = { SupabaseAnalytics }; 