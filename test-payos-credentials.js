/**
 * Script để test PayOS credentials trực tiếp với API
 * Chạy: node test-payos-credentials.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });

const CLIENT_ID = process.env.PAYOS_CLIENT_ID;
const API_KEY = process.env.PAYOS_API_KEY;
const BASE_URL = process.env.PAYOS_BASE_URL || 'https://api-merchant.payos.vn';

console.log('🔍 Testing PayOS Credentials...\n');

if (!CLIENT_ID || !API_KEY) {
  console.error('❌ PAYOS_CLIENT_ID or PAYOS_API_KEY is missing in .env file');
  process.exit(1);
}

console.log('📋 Credentials:');
console.log(`  Client ID: ${CLIENT_ID.substring(0, 8)}...${CLIENT_ID.substring(CLIENT_ID.length - 4)} (${CLIENT_ID.length} chars)`);
console.log(`  API Key: ${API_KEY.substring(0, 8)}...${API_KEY.substring(API_KEY.length - 4)} (${API_KEY.length} chars)`);
console.log(`  Base URL: ${BASE_URL}\n`);

// Test request với minimal valid data
const testPayload = {
  orderCode: Math.floor(100000 + Math.random() * 90000000), // Random 8-digit number
  amount: 1000, // Minimum amount
  description: "Test payment",
  items: [
    {
      name: "Test Item",
      quantity: 1,
      price: 1000
    }
  ],
  returnUrl: "http://localhost:3000/test",
  cancelUrl: "http://localhost:3000/test"
};

console.log('📤 Sending test request to PayOS API...');
console.log('📋 Payload:', JSON.stringify(testPayload, null, 2));
console.log('');

fetch(`${BASE_URL}/v2/payment-requests`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-client-id': CLIENT_ID,
    'x-api-key': API_KEY,
  },
  body: JSON.stringify(testPayload),
})
  .then(async (response) => {
    const data = await response.json();
    
    console.log('📥 Response Status:', response.status);
    console.log('📦 Response Body:', JSON.stringify(data, null, 2));
    console.log('');
    
    if (data.code === '00') {
      console.log('✅ SUCCESS! Credentials are VALID!');
      console.log(`   Payment Link: ${data.data?.checkoutUrl || 'N/A'}`);
      process.exit(0);
    } else {
      console.error('❌ ERROR from PayOS API:');
      console.error(`   Code: ${data.code}`);
      console.error(`   Description: ${data.desc}`);
      console.error(`   Data: ${JSON.stringify(data.data)}`);
      console.error('');
      
      if (data.code === '20') {
        console.error('💡 Error Code 20: "Thông tin truyền lên không đúng"');
        console.error('   Possible causes:');
        console.error('   1. Credentials không đúng (Client ID hoặc API Key sai)');
        console.error('   2. PayOS account chưa được kích hoạt');
        console.error('   3. PayOS account chưa được verify');
        console.error('   4. PayOS account không có quyền tạo payment link');
        console.error('');
        console.error('   Solutions:');
        console.error('   1. Kiểm tra lại credentials trên PayOS Dashboard: https://my.payos.vn');
        console.error('   2. Đảm bảo account đã được verify');
        console.error('   3. Kiểm tra xem account có đủ quyền không');
        console.error('   4. Liên hệ PayOS support nếu vẫn lỗi');
      } else if (data.code === '01' || data.code === '02') {
        console.error('💡 Authentication error - Credentials không đúng');
        console.error('   Hãy kiểm tra lại Client ID và API Key trên PayOS Dashboard');
      } else {
        console.error('💡 Xem tài liệu PayOS để biết ý nghĩa của error code:', data.code);
        console.error('   Documentation: https://payos.vn/docs');
      }
      
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('❌ Network Error:', error.message);
    console.error('');
    console.error('   Possible causes:');
    console.error('   1. Không có kết nối internet');
    console.error('   2. Firewall chặn');
    console.error('   3. DNS không resolve được api-merchant.payos.vn');
    console.error('');
    console.error('   Run: npm run check-network');
    process.exit(1);
  });

