import axios from 'axios';

const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL || 'https://edgetimer-backend.onrender.com',
  timeout: 10000,
});

export default api;
