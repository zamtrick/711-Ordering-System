import axios from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";

const jar = new CookieJar();

const api = wrapper(
  axios.create({
    baseURL: "http://192.168.254.181:5000/api",
    headers: {
      "Content-Type": "application/json",
    },
    jar,
    withCredentials: true,
  }),
);

export default api;
