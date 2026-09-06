import axios from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";

// Persist cookies across requests (needed for httpOnly cookie-based auth on native)
const jar = new CookieJar();

const api = wrapper(
  axios.create({
    baseURL: "http://10.0.75.231:5000/api",
    headers: {
      "Content-Type": "application/json",
    },
    jar,
    withCredentials: true,
  }),
);

export default api;
