const axios = require('axios');
(async () => {
  try {
    const res = await axios.post('https://morningchallenge-5vf5qwski-shu-ices-projects.vercel.app/api/auth/login', {
      email: 'admin@example.com',
      password: 'admin123'
    });
    console.log(res.data);
  } catch (err) {
    console.error(err.response?.status, err.response?.data);
  }
})(); 