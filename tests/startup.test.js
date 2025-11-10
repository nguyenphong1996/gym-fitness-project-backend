/**
 * Test App Startup
 */
const http = require('http');

const testAppStartup = async () => {
  return new Promise((resolve, reject) => {
    console.log('🔍 Testing application startup...');
    
    const timeout = setTimeout(() => {
      reject(new Error('❌ App startup timeout (10s)'));
    }, 10000);

    const checkServer = setInterval(() => {
      const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/health',
        method: 'GET',
        timeout: 2000
      };

      const req = http.request(options, (res) => {
        if (res.statusCode === 200 || res.statusCode === 404) {
          clearTimeout(timeout);
          clearInterval(checkServer);
          console.log('✅ App started successfully on port 3000!');
          console.log(`📊 Status code: ${res.statusCode}`);
          resolve();
        }
      });

      req.on('error', () => {
        // Keep checking
      });

      req.end();
    }, 1000);
  });
};

testAppStartup()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
