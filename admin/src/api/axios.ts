import axios from "axios";

// In development the API runs on localhost. For other environments set
// VITE_API_URL in a .env file (e.g. VITE_API_URL=http://192.168.x.x:5000/api).
const baseURL = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api";

const api = axios.create({
  baseURL,
  withCredentials: true,
});

export default api;
