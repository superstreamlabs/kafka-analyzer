#!/usr/bin/env node

const { Kafka: ConfluentKafka } = require('@confluentinc/kafka-javascript').KafkaJS;

// Test Confluent Cloud connection using official methodology
async function testConfluentConnection() {
  console.log('🧪 Testing Confluent Cloud Connection (Official Methodology)...\n');
  
  // Replace these with your actual Confluent Cloud credentials
  const config = {
    'bootstrap.servers': 'pkc-7xoy1.eu-central-1.aws.confluent.cloud:9092', // Replace with your broker
    'security.protocol': 'SASL_SSL',
    'sasl.mechanisms': 'PLAIN',
    'sasl.username': 'YOUR_API_KEY', // Replace with your API Key
    'sasl.password': 'YOUR_API_SECRET', // Replace with your API Secret
    'session.timeout.ms': 45000,
    'client.id': 'superstream-analyzer-test'
  };
  
  console.log('📋 Official Confluent Cloud Configuration:');
  console.log(`  Bootstrap Servers: ${config['bootstrap.servers']}`);
  console.log(`  Security Protocol: ${config['security.protocol']}`);
  console.log(`  SASL Mechanisms: ${config['sasl.mechanisms']}`);
  console.log(`  Username: ${config['sasl.username'] ? '***' + config['sasl.username'].slice(-4) : 'NOT SET'}`);
  console.log(`  Password: ${config['sasl.password'] ? '***' + config['sasl.password'].slice(-4) : 'NOT SET'}`);
  console.log(`  Session Timeout: ${config['session.timeout.ms']}ms`);
  console.log(`  Client ID: ${config['client.id']}`);
  console.log('');
  
  try {
    const kafka = new ConfluentKafka();
    const admin = kafka.admin(config);
    
    console.log('🔌 Connecting to Confluent Cloud using official methodology...');
    await admin.connect();
    console.log('✅ Connected successfully!');
    
    console.log('📊 Fetching cluster metadata...');
    const metadata = await admin.fetchTopicMetadata();
    console.log(`✅ Found ${metadata.topics.length} topics`);
    
    await admin.disconnect();
    console.log('✅ Disconnected successfully');
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('💡 Troubleshooting tips:');
    console.error('  1. Verify your API Key and Secret are correct');
    console.error('  2. Check that your broker URL is correct');
    console.error('  3. Ensure your API Key has the necessary permissions');
    console.error('  4. Check if your network allows outbound connections');
    console.error('  5. Verify your Confluent Cloud cluster is active');
    console.error('  6. Make sure you\'re using the official Confluent Cloud methodology');
  }
}

testConfluentConnection(); 