const { SignatureV4 } = require('@aws-sdk/signature-v4');
const { Sha256 } = require('@aws-crypto/sha256-js');
const crypto = require('crypto');

class AwsMskSasl {
  constructor(authorizationIdentity, accessKeyId, secretAccessKey) {
    this.authorizationIdentity = authorizationIdentity;
    this.accessKeyId = accessKeyId;
    this.secretAccessKey = secretAccessKey;
    this.region = this.extractRegion();
  }

  extractRegion() {
    // Extract region from authorization identity or default to eu-central-1
    if (this.authorizationIdentity.includes('eu-central-1')) {
      return 'eu-central-1';
    }
    return 'eu-central-1'; // Default for your cluster
  }

  async createAuthString() {
    const timestamp = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
    const date = timestamp.substring(0, 8);
    
    // Create the request to sign
    const request = {
      method: 'GET',
      hostname: 'kafka-cluster.amazonaws.com',
      path: '/',
      headers: {
        'host': 'kafka-cluster.amazonaws.com',
        'x-amz-date': timestamp,
        'x-amz-security-token': '', // Empty for IAM user
        'user-agent': 'superstream-analyzer'
      }
    };

    // Create the signer
    const signer = new SignatureV4({
      credentials: {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey
      },
      region: this.region,
      service: 'kafka-cluster',
      sha256: Sha256
    });

    // Sign the request
    const signedRequest = await signer.sign(request);
    
    // Extract the authorization header
    const authHeader = signedRequest.headers.authorization;
    
    // Create the SASL auth string
    const authString = `Action=kafka-cluster:Connect,Host=${this.authorizationIdentity},User-Agent=superstream-analyzer,Version=2020_10_22,${authHeader}`;
    
    return authString;
  }

  // This method is called by KafkaJS
  async authenticate(connection) {
    try {
      const authString = await this.createAuthString();
      
      // Send the authentication string
      await connection.send({
        apiKey: 36, // SASL_AUTHENTICATE
        apiVersion: 1,
        correlationId: connection.correlationId++,
        clientId: connection.clientId,
        payload: {
          authBytes: Buffer.from(authString, 'utf8')
        }
      });

      // Read the response
      const response = await connection.receive();
      
      if (response.payload.errorCode !== 0) {
        throw new Error(`SASL authentication failed: ${response.payload.errorMessage}`);
      }

      return true;
    } catch (error) {
      throw new Error(`AWS MSK IAM authentication failed: ${error.message}`);
    }
  }
}

module.exports = { AwsMskSasl }; 