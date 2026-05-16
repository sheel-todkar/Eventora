const axios = require('axios');

async function testRegister() {
    try {
        const response = await axios.post('http://localhost:5000/api/auth/register', {
            name: 'Test User',
            email: 'test' + Date.now() + '@example.com',
            password: 'password123'
        });
        console.log('Response:', response.data);
    } catch (err) {
        console.error('Error:', err.response ? err.response.data : err.message);
    }
}

testRegister();
