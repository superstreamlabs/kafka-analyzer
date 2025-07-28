#!/usr/bin/env node

// Confluent Cloud credential validation helper
function validateConfluentCredentials(apiKey, apiSecret) {
  console.log('🔍 Validating Confluent Cloud Credentials...\n');
  
  // Check if credentials are provided
  if (!apiKey || !apiSecret) {
    console.error('❌ Error: Both API Key and API Secret are required');
    return false;
  }
  
  // Check API Key format (Confluent Cloud API keys typically start with specific patterns)
  console.log('📋 API Key Analysis:');
  console.log(`   Length: ${apiKey.length} characters`);
  console.log(`   Starts with: ${apiKey.substring(0, 8)}...`);
  console.log(`   Contains only alphanumeric: ${/^[a-zA-Z0-9]+$/.test(apiKey) ? '✅' : '❌'}`);
  
  // Check API Secret format
  console.log('\n📋 API Secret Analysis:');
  console.log(`   Length: ${apiSecret.length} characters`);
  console.log(`   Starts with: ${apiSecret.substring(0, 8)}...`);
  console.log(`   Contains only alphanumeric: ${/^[a-zA-Z0-9]+$/.test(apiSecret) ? '✅' : '❌'}`);
  
  // Common issues check
  console.log('\n🔍 Common Issues Check:');
  
  // Check for extra spaces
  if (apiKey !== apiKey.trim()) {
    console.error('   ❌ API Key has leading/trailing spaces');
  } else {
    console.log('   ✅ API Key has no extra spaces');
  }
  
  if (apiSecret !== apiSecret.trim()) {
    console.error('   ❌ API Secret has leading/trailing spaces');
  } else {
    console.log('   ✅ API Secret has no extra spaces');
  }
  
  // Check for common prefixes
  const commonPrefixes = ['2', '3', '4', '5', '6', '7', '8', '9'];
  if (commonPrefixes.includes(apiKey[0])) {
    console.log('   ✅ API Key starts with expected character');
  } else {
    console.warn('   ⚠️  API Key doesn\'t start with expected character');
  }
  
  // Check lengths
  if (apiKey.length < 10) {
    console.error('   ❌ API Key seems too short');
  } else {
    console.log('   ✅ API Key length looks reasonable');
  }
  
  if (apiSecret.length < 20) {
    console.error('   ❌ API Secret seems too short');
  } else {
    console.log('   ✅ API Secret length looks reasonable');
  }
  
  console.log('\n💡 Troubleshooting Tips:');
  console.log('   1. Copy credentials directly from Confluent Cloud console');
  console.log('   2. Ensure no extra spaces are included');
  console.log('   3. Verify the API Key is active and not expired');
  console.log('   4. Check that the API Key has necessary permissions');
  console.log('   5. Ensure you\'re using the correct cluster credentials');
  
  return true;
}

// Example usage - replace with your actual credentials
const apiKey = 'F5MJ7GHUVWBVSDU6';
const apiSecret = 'ivAOGbqTdmSOEt5Z2IfMF8ofYYbcpvwByH7lHllsurAxE0blk04T2v4duJflms/D';

if (apiKey === 'YOUR_API_KEY_HERE' || apiSecret === 'YOUR_API_SECRET_HERE') {
  console.log('⚠️  Please replace the placeholder credentials with your actual Confluent Cloud API Key and Secret');
  console.log('   Edit this file and replace YOUR_API_KEY_HERE and YOUR_API_SECRET_HERE');
} else {
  validateConfluentCredentials(apiKey, apiSecret);
} 