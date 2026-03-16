const http = require('http');

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/orders/1',
  method: 'GET',
  headers: {
    // Generate an admin token for testing or just test if it returns 401
    // Actually, I don't have a token. Can I get a token?
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log(res.statusCode, data));
});
req.on('error', e => console.error(e));
req.end();
