// Single source of truth for allowed CORS origins — used by both the
// Express middleware in index.js and the Socket.IO handshake in socket.js,
// so the two can never drift apart.
//
// Allowed by default:
//   - localhost / 127.0.0.1 on any port (dev convenience)
//   - the server host's LAN IPs on the Expo dev ports
//   - every origin listed in the CORS_ORIGINS env var (comma-separated)
//
// In production set CORS_ORIGINS to your real domains, e.g.:
//   CORS_ORIGINS=https://711-admin.vercel.app,https://admin.mydomain.com
//
// Requests with no Origin header (native apps, curl, server-to-server)
// always pass — CORS is a browser-only mechanism.

import os from "os";

const LAN_DEV_PORTS = ["8081", "19000"]; // Expo web / Expo Go

const buildAllowedOrigins = () => {
  const allowed = new Set([
    "http://localhost:8081", // Expo web (loopback)
    "http://127.0.0.1:8081", // Expo web (ipv4)
    "http://localhost:5173", // Vite admin client
    "http://localhost:5174", // Vite admin client (alt port)
  ]);

  // The server host's own LAN IPs — covers http://<lan-ip>:8081 (Expo web)
  // and exp://<lan-ip>:8081 (Expo Go) for every interface of this machine.
  const nets = os.networkInterfaces();
  for (const addrs of Object.values(nets)) {
    for (const net of addrs ?? []) {
      if (net.family === "IPv4" && net.address) {
        for (const port of LAN_DEV_PORTS) {
          allowed.add(`http://${net.address}:${port}`);
          allowed.add(`exp://${net.address}:${port}`);
        }
      }
    }
  }

  // Production / extra origins from env
  for (const extra of (process.env.CORS_ORIGINS ?? "").split(",")) {
    const trimmed = extra.trim();
    if (trimmed) allowed.add(trimmed);
  }

  return allowed;
};

const normalize = (origin) => origin.replace(/\/$/, "");

export const isOriginAllowed = (origin) => {
  if (!origin) return true; // native apps / curl / same-origin

  const allowed = buildAllowedOrigins();

  if (allowed.has(normalize(origin))) return true;

  // Any localhost origin is allowed for dev convenience.
  if (/^https?:\/\/localhost(:\d+)?$/.test(origin) || /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) {
    return true;
  }

  return false;
};

// Middleware-style helper for Socket.IO's handshake origin check.
export const socketOriginAllowed = (origin, callback) => {
  callback(null, isOriginAllowed(origin));
};

export const corsOptionsDelegate = (req, callback) => {
  callback(null, { origin: isOriginAllowed(req.headers.origin), credentials: true });
};
