/**
 * Script để validate PayOS request format
 * Chạy: node validate-payos-request.js
 */

// Ví dụ request payload từ logs
const sampleRequest = {
  orderCode: 18226687,
  amount: 115000,
  description: "Order #690a0f4690d5567dd5047dde",
  items: [
    {
      name: "Phở Bò",
      quantity: 2,
      price: 45000
    },
    {
      name: "Bánh Mì Thịt Nguội",
      quantity: 1,
      price: 25000
    }
  ],
  returnUrl: "http://localhost:3000/payment/callback?orderId=690a0f4690d5567dd5047dde",
  cancelUrl: "http://localhost:3000/payment/callback?status=CANCELLED&orderId=690a0f4690d5567dd5047dde"
};

console.log('🔍 Validating PayOS Request Format...\n');
console.log('📋 Sample Request:', JSON.stringify(sampleRequest, null, 2));
console.log('');

const errors = [];
const warnings = [];

// 1. Validate orderCode
if (!Number.isInteger(sampleRequest.orderCode)) {
  errors.push('❌ orderCode must be an integer');
} else {
  const codeStr = sampleRequest.orderCode.toString();
  if (codeStr.length < 6 || codeStr.length > 8) {
    errors.push(`❌ orderCode must be 6-8 digits. Got: ${codeStr.length} digits (${sampleRequest.orderCode})`);
  } else {
    console.log(`✅ orderCode: ${sampleRequest.orderCode} (${codeStr.length} digits)`);
  }
}

// 2. Validate amount
if (!Number.isInteger(sampleRequest.amount)) {
  errors.push('❌ amount must be an integer');
} else if (sampleRequest.amount <= 0) {
  errors.push(`❌ amount must be > 0. Got: ${sampleRequest.amount}`);
} else {
  console.log(`✅ amount: ${sampleRequest.amount} VND`);
}

// 3. Validate description
if (!sampleRequest.description || typeof sampleRequest.description !== 'string') {
  errors.push('❌ description must be a non-empty string');
} else {
  console.log(`✅ description: "${sampleRequest.description}"`);
}

// 4. Validate items
if (!Array.isArray(sampleRequest.items)) {
  errors.push('❌ items must be an array');
} else if (sampleRequest.items.length === 0) {
  errors.push('❌ items array cannot be empty');
} else {
  console.log(`✅ items: ${sampleRequest.items.length} item(s)`);
  
  sampleRequest.items.forEach((item, index) => {
    const itemErrors = [];
    
    if (!item.name || typeof item.name !== 'string' || item.name.trim() === '') {
      itemErrors.push('name is missing or empty');
    }
    
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      itemErrors.push(`quantity is invalid (got: ${item.quantity})`);
    }
    
    if (!Number.isInteger(item.price) || item.price <= 0) {
      itemErrors.push(`price is invalid (got: ${item.price})`);
    }
    
    if (itemErrors.length > 0) {
      errors.push(`❌ Item ${index + 1}: ${itemErrors.join(', ')}`);
    } else {
      console.log(`  ✅ Item ${index + 1}: ${item.name} x${item.quantity} = ${item.price} VND`);
    }
  });
}

// 5. Validate returnUrl
if (!sampleRequest.returnUrl || typeof sampleRequest.returnUrl !== 'string') {
  errors.push('❌ returnUrl must be a valid URL string');
} else {
  try {
    new URL(sampleRequest.returnUrl);
    console.log(`✅ returnUrl: ${sampleRequest.returnUrl}`);
  } catch (e) {
    errors.push(`❌ returnUrl is not a valid URL: ${sampleRequest.returnUrl}`);
  }
}

// 6. Validate cancelUrl
if (!sampleRequest.cancelUrl || typeof sampleRequest.cancelUrl !== 'string') {
  errors.push('❌ cancelUrl must be a valid URL string');
} else {
  try {
    new URL(sampleRequest.cancelUrl);
    console.log(`✅ cancelUrl: ${sampleRequest.cancelUrl}`);
  } catch (e) {
    errors.push(`❌ cancelUrl is not a valid URL: ${sampleRequest.cancelUrl}`);
  }
}

// 7. Check total amount matches items
const itemsTotal = sampleRequest.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
if (itemsTotal !== sampleRequest.amount) {
  warnings.push(`⚠️  Total from items (${itemsTotal} VND) does not match amount (${sampleRequest.amount} VND)`);
} else {
  console.log(`✅ Total amount matches items: ${itemsTotal} VND`);
}

console.log('\n' + '='.repeat(60));

if (errors.length > 0) {
  console.error('\n❌ VALIDATION ERRORS:');
  errors.forEach(err => console.error('  ' + err));
  process.exit(1);
}

if (warnings.length > 0) {
  console.warn('\n⚠️  WARNINGS:');
  warnings.forEach(warn => console.warn('  ' + warn));
}

if (errors.length === 0) {
  console.log('\n✅ Request format is VALID!');
  console.log('\n💡 If PayOS still returns error code 20, check:');
  console.log('   1. PayOS credentials (Client ID, API Key)');
  console.log('   2. PayOS account status');
  console.log('   3. PayOS API documentation for latest requirements');
}

