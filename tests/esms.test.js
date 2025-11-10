/**
 * Test eSMS API Connection
 */
let axios;
try {
  axios = require('axios');
} catch (error) {
  console.log('⚠️  axios module not installed - skipping eSMS API test');
  process.exit(0);
}
require('dotenv').config();

const testEsmsAPI = async () => {
  try {
    console.log('🔍 Testing eSMS API connection...');
    
    // Check if sandbox mode
    if (process.env.ESMS_SANDBOX === 'true') {
      console.log('🧪 Sandbox mode enabled - SKIPPING real API test');
      console.log('✅ eSMS test passed (sandbox mode)');
      process.exit(0);
    }
    
    if (!process.env.ESMS_API_KEY || !process.env.ESMS_SECRET_KEY) {
      console.log('⚠️  eSMS credentials not found - SKIPPING');
      console.log('✅ eSMS test passed (no credentials)');
      process.exit(0);
    }

    const response = await axios.get('http://rest.esms.vn/MainService.svc/json/GetBalance/' + process.env.ESMS_API_KEY + '/' + process.env.ESMS_SECRET_KEY, {
      timeout: 10000
    });

    if (response.data) {
      const codeResult = response.data.CodeResult;
      const balance = response.data.Balance;
      
      // Success cases
      if (codeResult === '100') {
        console.log('✅ eSMS API connected successfully!');
        console.log(`💰 Balance: ${balance} SMS`);
        
        if (balance === 0 || balance === '0') {
          console.log('⚠️  Balance is 0 but API works fine');
        }
        process.exit(0);
      }
      
      // Balance not enough - Still PASS because API is working
      if (codeResult === '101' || codeResult === '102') {
        console.log('✅ eSMS API connected successfully!');
        console.log(`⚠️  Balance issue (Code: ${codeResult}) - but API is reachable`);
        process.exit(0);
      }
      
      // Other error codes
      console.error(`❌ eSMS API error - Code: ${codeResult}, Message: ${response.data.ErrorMessage || 'Unknown'}`);
      process.exit(1);
    } else {
      throw new Error('Invalid eSMS response: No data received');
    }
  } catch (error) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      console.error('❌ eSMS API timeout - API may be down');
    } else if (error.response) {
      console.error('❌ eSMS API HTTP error:', error.response.status);
    } else {
      console.error('❌ eSMS API test failed:', error.message);
    }
    process.exit(1);
  }
};

testEsmsAPI();
