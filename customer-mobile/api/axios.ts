import { create as createAxios } from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";
import Constants from "expo-constants";

// Resolution order (first match wins):
//   1. EXPO_PUBLIC_API_URL — set per build profile in eas.json (production/
//      preview point at the public HTTPS API) or in a local .env file.
//   2. app.json → extra.apiUrl — the dev default baked into the source.
//   3. Dev LAN fallback (no localhost-on-device trap).
export const baseURL: string =
  process.env.EXPO_PUBLIC_API_URL ??
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  "http://192.168.254.191:5000/api";

// Persist cookies across requests (needed for httpOnly cookie-based auth on native)
const jar = new CookieJar();

const api = wrapper(
  createAxios({
    baseURL,
    headers: {
      "Content-Type": "application/json",
    },
    jar,
    withCredentials: true,
    // Generous: Render's free plan cold-starts take 30–60s before the
    // first response arrives — a 15s timeout made every cold start look
    // like a network failure.
    timeout: 60000,
  }),
);

export default api;
