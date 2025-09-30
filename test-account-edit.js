// Quick test script to verify account edit API
const testAccountEdit = async () => {
  const accountId = 'test-id-here'; // Replace with actual account ID
  
  const testData = {
    accountName: 'Updated Test Account',
    accountLegalName: 'Updated Test Account Legal',
    active: true,
    description: 'This is an updated description',
    shippingAddress: {
      line1: '123 Updated Street',
      city: 'Updated City',
      state: 'CA',
      postalCode: '90210',
      country: 'United States'
    },
    billingSameAsShipping: false,
    billingAddress: {
      line1: '456 Billing Street',
      city: 'Billing City', 
      state: 'NY',
      postalCode: '10001',
      country: 'United States'
    }
  };

  try {
    const response = await fetch(`http://localhost:3001/api/accounts/${accountId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        // Add auth headers as needed
      },
      body: JSON.stringify(testData)
    });

    const result = await response.json();
    console.log('Response status:', response.status);
    console.log('Response data:', result);
    
    if (response.ok) {
      console.log('✅ Account edit API is working!');
    } else {
      console.log('❌ Account edit API error:', result.error);
    }
  } catch (error) {
    console.log('❌ Network error:', error.message);
  }
};

console.log('Account Edit API Test Ready');
console.log('To test, replace accountId and run: testAccountEdit()');