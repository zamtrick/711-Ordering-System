import axios from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";
import Constants from "expo-constants";

// Base URL comes from app.json → extra.apiUrl so you only need to change it
// in one place. Fall back to localhost for web/simulator convenience.
const baseURL: string =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  "http://localhost:5000/api";

// Persist cookies across requests (needed for httpOnly cookie-based auth on native)
const jar = new CookieJar();

const api = wrapper(
  axios.create({
    baseURL,
    headers: {
      "Content-Type": "application/json",
    },
    jar,
    withCredentials: true,
  }),
);

export default api;
