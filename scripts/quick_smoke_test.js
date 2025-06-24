#!/usr/bin/env node
// 🚀 Quick smoke test: login & beginner problems
const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'https://morningchallenge-8u5129p3n-shu-ices-projects.vercel.app';
const ADMIN = { email:'admin@example.com', password:'admin123' };

(async ()=>{
  try{
    const login = await axios.post(`${BASE_URL}/api/auth/login`, ADMIN);
    console.log('Login ✅', login.status);
    const token = login.data.token;
    const res = await axios.get(`${BASE_URL}/api/problems?difficulty=beginner`, {headers:{Authorization:`Bearer ${token}`}});
    console.log('Problems ✅', res.status, res.data.problems?.length);
    console.log('Smoke test SUCCESS');
    process.exit(0);
  }catch(e){
    console.error('Smoke test FAILED', e.response?.status, e.response?.data?.error||e.message);
    process.exit(1);
  }
})(); 