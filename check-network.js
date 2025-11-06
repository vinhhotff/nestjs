const dns = require('dns');
const https = require('https');
const { promisify } = require('util');

const resolve4 = promisify(dns.resolve4);

console.log('🔍 Checking network connectivity to PayOS API...\n');

// Function to test DNS with specific DNS server
async function testDNSWithServer(hostname, dnsServer = null) {
  if (dnsServer) {
    dns.setServers([dnsServer]);
    console.log(`   Trying with DNS server: ${dnsServer}`);
  }
  
  try {
    const addresses = await resolve4(hostname);
    return addresses;
  } catch (err) {
    if (dnsServer) {
      console.log(`   ❌ Failed with ${dnsServer}: ${err.message}`);
    }
    throw err;
  }
}

// Test DNS resolution with multiple DNS servers
async function testDNSResolution() {
  const hostname = 'api-merchant.payos.vn';
  const dnsServers = [
    null, // Default DNS
    '8.8.8.8', // Google DNS
    '1.1.1.1', // Cloudflare DNS
    '114.114.114.114', // 114 DNS (China)
  ];

  console.log('📡 Testing DNS Resolution...');
  
  for (const server of dnsServers) {
    try {
      const addresses = await testDNSWithServer(hostname, server);
      console.log(`✅ DNS Resolution Success with ${server || 'default DNS'}:`);
      console.log('   Resolved to:', addresses.join(', '));
      return addresses;
    } catch (err) {
      // Continue to next DNS server
    }
  }
  
  // All DNS servers failed
  console.error('\n❌ DNS Resolution Failed with all DNS servers');
  console.error('   Error: Cannot resolve api-merchant.payos.vn');
  console.error('\n💡 Solutions:');
  console.error('   1. Check internet connection');
  console.error('   2. Try accessing https://api-merchant.payos.vn in your browser');
  console.error('   3. Check if you are behind a corporate firewall/proxy');
  console.error('   4. Verify domain name is correct (should be api-merchant.payos.vn, not api.payos.vn)');
  console.error('   5. Try changing DNS settings in Windows:');
  console.error('      - Open Network Settings');
  console.error('      - Change DNS to 8.8.8.8 (Google) or 1.1.1.1 (Cloudflare)');
  throw new Error('DNS resolution failed');
}

// Main test
testDNSResolution().then((addresses) => {
    // Try HTTPS connection
    console.log('\n🌐 Testing HTTPS connection...');
    const req = https.request({
      hostname: 'api-merchant.payos.vn',
      port: 443,
      path: '/',
      method: 'GET',
      timeout: 5000,
    }, (res) => {
      console.log('✅ HTTPS Connection Success:');
      console.log('   Status:', res.statusCode);
      console.log('   Headers:', res.headers['server'] || 'N/A');
      console.log('\n✅ Network connectivity is OK!');
      process.exit(0);
    });

    req.on('error', (err) => {
      console.error('❌ HTTPS Connection Failed:', err.message);
      console.error('   The server can resolve DNS but cannot connect');
      console.error('   Possible causes:');
      console.error('   1. Firewall blocking HTTPS (port 443)');
      console.error('   2. Proxy configuration needed');
      console.error('   3. Network timeout');
      process.exit(1);
    });

    req.on('timeout', () => {
      console.error('❌ Connection Timeout');
      console.error('   The server took too long to respond');
      req.destroy();
      process.exit(1);
    });

    req.end();
}).catch((err) => {
  console.error('\n❌ Network test failed');
  process.exit(1);
});

