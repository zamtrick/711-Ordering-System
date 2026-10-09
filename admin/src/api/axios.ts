import axios from "axios";
import { toastError } from "@/context/toast-context";

// In development the API runs on localhost. For other environments set
// VITE_API_URL in a .env file (e.g. VITE_API_URL=http://192.168.x.x:5000/api).
const baseURL = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api";

const api = axios.create({
  baseURL,
  withCredentials: true,
});

// Global session handling: a 401 from any non-auth endpoint means the JWT
// cookie expired or was cleared. AuthContext listens for the event and drops
// the user, which makes ProtectedRoute redirect to /login; the notice flag
// tells Login why the user landed there. /auth/* is excluded because a 401
// there is the normal "not signed in yet" answer (e.g. /auth/me on load).
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const url: string = err?.config?.url ?? "";
    if (err?.response?.status === 401 && !url.startsWith("/auth/")) {
      sessionStorage.setItem("auth_notice", "Your session expired. Please sign in again.");
      toastError("Your session expired. Please sign in again.");
      window.dispatchEvent(new Event("auth:expired"));
    }
    return Promise.reject(err);
  },
);

export default api;
