#!/usr/bin/env node

/**
 * Manual Testing Script for CRM Implementations
 * Run with: node test-implementations.js
 */

const BASE_URL = 'http://localhost:3000'

// Test data
const testAccount = {
  accountName: "Test Account",
  accountTypeId: "test-type-id", // You'll need a real ID
  websiteUrl: "invalid-url-format", // Should fail validation
  shippingAddress: {
    line1: "123 Test St",
    city: "Test City",
    state: "INVALID", // Should fail validation
    postalCode: "12345678901234567890" // Should fail validation (too long)
  }
}

const testContact = {
  firstName: "John",
  lastName: "Doe",
  accountId: "test-account-id", // You'll need a real ID
  emailAddress: "invalid-email", // Should fail validation
  workPhone: "123-456-789", // Should fail validation (wrong format)
  mobilePhone: "9876543210" // Should be formatted to xxx-xxx-xxxx
}

async function testValidation() {
  console.log('🧪 Testing Server-Side Data Validation...\n')
  
  try {
    // Test Account Validation
    console.log('1. Testing Account Validation (should fail):')
    const accountResponse = await fetch(`${BASE_URL}/api/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testAccount)
    })
    
    const accountResult = await accountResponse.json()
    console.log('Status:', accountResponse.status)
    console.log('Response:', JSON.stringify(accountResult, null, 2))
    
    if (accountResponse.status === 400 && accountResult.details) {
      console.log('✅ Validation working! Found errors:', accountResult.details.length)
      accountResult.details.forEach(error => {
        console.log(`   - ${error.field}: ${error.message}`)
      })
    } else {
      console.log('❌ Validation not working as expected')
    }
    
    console.log('\n2. Testing Contact Validation (should fail):')
    const contactResponse = await fetch(`${BASE_URL}/api/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testContact)
    })
    
    const contactResult = await contactResponse.json()
    console.log('Status:', contactResponse.status)
    console.log('Response:', JSON.stringify(contactResult, null, 2))
    
    if (contactResponse.status === 400 && contactResult.details) {
      console.log('✅ Validation working! Found errors:', contactResult.details.length)
      contactResult.details.forEach(error => {
        console.log(`   - ${error.field}: ${error.message}`)
      })
    } else {
      console.log('❌ Validation not working as expected')
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
  }
}

async function testSystemSettings() {
  console.log('\n🔧 Testing System Settings API...\n')
  
  try {
    // Test getting system settings
    console.log('1. Testing GET /api/system-settings:')
    const getResponse = await fetch(`${BASE_URL}/api/system-settings`)
    const getResult = await getResponse.json()
    
    console.log('Status:', getResponse.status)
    console.log('Response:', JSON.stringify(getResult, null, 2))
    
    if (getResponse.status === 200) {
      console.log('✅ System settings API working!')
    } else {
      console.log('❌ System settings API not working')
    }
    
  } catch (error) {
    console.error('❌ System settings test failed:', error.message)
  }
}

function printManualTestInstructions() {
  console.log('\n📋 MANUAL TESTING INSTRUCTIONS\n')
  
  console.log('🔒 COPY PROTECTION TESTING:')
  console.log('1. Create a user with role.code = "Accounting"')
  console.log('2. Login with that user')
  console.log('3. Go to http://localhost:3000/accounts or http://localhost:3000/contacts')
  console.log('4. Try these actions (should be blocked):')
  console.log('   - Press Ctrl+C')
  console.log('   - Right-click on the page')
  console.log('   - Try to select text')
  console.log('   - Press F12 (developer tools)')
  console.log('5. Look for "🔒 Copy Protected" indicator in top-right corner')
  console.log('6. Look for subtle watermark overlay on the page')
  
  console.log('\n📊 AUDIT LOGGING TESTING:')
  console.log('1. Create/update/delete an account or contact')
  console.log('2. Check your database:')
  console.log('   SELECT * FROM "AuditLog" ORDER BY "createdAt" DESC LIMIT 5;')
  console.log('3. Verify you see entries with:')
  console.log('   - action: "Create", "Update", or "Delete"')
  console.log('   - entityName: "Account" or "Contact"')
  console.log('   - userId, tenantId, ipAddress, userAgent')
  console.log('   - previousValues and newValues (for updates)')
  
  console.log('\n⚙️ ADMIN SETTINGS TESTING:')
  console.log('1. Login as Admin user')
  console.log('2. Go to http://localhost:3000/admin/settings')
  console.log('3. Test copy protection toggle')
  console.log('4. Test audit log retention settings')
  console.log('5. Verify settings are saved and applied')
  
  console.log('\n🔍 VALIDATION TESTING:')
  console.log('1. Try creating accounts/contacts with invalid data:')
  console.log('   - Invalid email: "not-an-email"')
  console.log('   - Invalid phone: "123-456-789" (should be xxx-xxx-xxxx)')
  console.log('   - Invalid URL: "not-a-url"')
  console.log('   - Invalid state: "INVALID" (should be 2-letter code)')
  console.log('   - Invalid zip: "12345678901234567890" (too long)')
  console.log('2. Check for validation error messages')
  console.log('3. Verify data is not saved when validation fails')
}

async function main() {
  console.log('🚀 CRM Implementation Testing Script\n')
  console.log('Make sure your Next.js server is running on http://localhost:3000\n')
  
  // Test validation
  await testValidation()
  
  // Test system settings
  await testSystemSettings()
  
  // Print manual testing instructions
  printManualTestInstructions()
  
  console.log('\n✨ Testing complete! Follow the manual instructions above for full verification.')
}

// Run the tests
main().catch(console.error)
