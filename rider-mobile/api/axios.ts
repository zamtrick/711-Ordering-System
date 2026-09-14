import axios from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";
import Constants from "expo-constants";

// Base URL comes from app.json → extra.apiUrl so you only need to change it
// in one place. Fall back to the current LAN IP for physical devices
// (localhost never works on a real phone).
const baseURL: string =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  "http://192.168.254.181:5000/api";

const jar = new CookieJar();

const api = wrapper(
  axios.create({
    baseURL,
    headers: {
      "Content-Type": "application/json",
    },
    jar,
    withCredentials: true,
    timeout: 15000,
  }),
);

export default api;
