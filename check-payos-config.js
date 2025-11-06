/**
 * Script để kiểm tra PayOS configuration
 * Chạy: node check-payos-config.js
 */

const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');

console.log('🔍 Checking PayOS Configuration...\n');
console.log('Looking for .env file at:', envPath);

if (!fs.existsSync(envPath)) {
  console.error('❌ File .env does NOT exist!');
  console.log('\n📝 To create .env file:');
  console.log('1. Create a file named .env in the agoda/ directory');
  console.log('2. Add the following lines:');
  console.log('');
  console.log('PAYOS_CLIENT_ID=your_client_id_here');
  console.log('PAYOS_API_KEY=your_api_key_here');
  console.log('PAYOS_CHECKSUM_KEY=your_checksum_key_here');
  console.log('FRONTEND_URL=http://localhost:3000');
  console.log('');
  console.log('See QUICK_START_PAYOS.md for detailed instructions.');
  process.exit(1);
}

console.log('✅ File .env exists\n');

const envContent = fs.readFileSync(envPath, 'utf8');
const lines = envContent.split('\n');

let hasClientId = false;
let hasApiKey = false;
let hasChecksumKey = false;
let hasFrontendUrl = false;

lines.forEach((line, index) => {
  const trimmed = line.trim();
  if (trimmed.startsWith('PAYOS_CLIENT_ID=') && !trimmed.endsWith('=') && trimmed !== 'PAYOS_CLIENT_ID=') {
    hasClientId = true;
    const value = trimmed.split('=')[1];
    console.log(`✅ PAYOS_CLIENT_ID: Set (${value.length} chars)`);
  }
  if (trimmed.startsWith('PAYOS_API_KEY=') && !trimmed.endsWith('=') && trimmed !== 'PAYOS_API_KEY=') {
    hasApiKey = true;
    const value = trimmed.split('=')[1];
    console.log(`✅ PAYOS_API_KEY: Set (${value.length} chars)`);
  }
  if (trimmed.startsWith('PAYOS_CHECKSUM_KEY=') && !trimmed.endsWith('=') && trimmed !== 'PAYOS_CHECKSUM_KEY=') {
    hasChecksumKey = true;
    const value = trimmed.split('=')[1];
    console.log(`✅ PAYOS_CHECKSUM_KEY: Set (${value.length} chars)`);
  }
  if (trimmed.startsWith('FRONTEND_URL=')) {
    hasFrontendUrl = true;
  }
});

console.log('');

if (!hasClientId) {
  console.error('❌ PAYOS_CLIENT_ID is missing or empty');
}
if (!hasApiKey) {
  console.error('❌ PAYOS_API_KEY is missing or empty');
}
if (!hasChecksumKey) {
  console.error('❌ PAYOS_CHECKSUM_KEY is missing or empty');
}
if (!hasFrontendUrl) {
  console.warn('⚠️  FRONTEND_URL is missing (optional, but recommended)');
}

if (hasClientId && hasApiKey && hasChecksumKey) {
  console.log('\n✅ All PayOS credentials are configured!');
  console.log('💡 Remember to RESTART your backend server after adding credentials.');
} else {
  console.log('\n❌ PayOS configuration is incomplete!');
  console.log('\n📝 To fix:');
  console.log('1. Open .env file in agoda/ directory');
  console.log('2. Add the missing credentials from https://my.payos.vn');
  console.log('3. Restart backend server');
  console.log('\nSee QUICK_START_PAYOS.md for detailed instructions.');
  process.exit(1);
}

