import axios from 'axios';

const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL || 'https://edgetimer-production.up.railway.app',
  timeout: 10000,
});

export default api;
