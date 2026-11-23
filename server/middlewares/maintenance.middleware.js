import { getMaintenanceStatus } from "../controllers/settings.controller.js";

// --------------------------------------------------
// MAINTENANCE MIDDLEWARE
// --------------------------------------------------
// Blocks all non-exempt API routes with 503 when maintenance mode is on.
//
// Exempt paths (always pass through):
//   - GET  /api/settings/maintenance   — apps need to read the flag
//   - GET  /api/settings/delivery-fee  — Render health-check path
//   - POST /api/auth/*                 — login/logout so superadmin can still reach the admin panel
//   - GET  /api/auth/me                — session check in layout guards
//   - GET  /api/auth/token             — socket handshake token
//   - GET  /health, GET /              — health check endpoints
//
// Rider routes are intentionally NOT blocked so riders can complete
// in-flight deliveries while the system is down for maintenance.

const EXEMPT = [
  { method: "GET",  prefix: "/api/settings/maintenance" },
  { method: "GET",  prefix: "/api/settings/delivery-fee" },
  { method: "POST", prefix: "/api/auth/" },
  { method: "GET",  prefix: "/api/auth/me" },
  { method: "GET",  prefix: "/api/auth/token" },
  { method: "GET",  prefix: "/api/rider/" },
  { method: "PATCH",prefix: "/api/rider/" },
  { method: "POST", prefix: "/api/rider/" },
  { method: "GET",  prefix: "/health" },
  { method: "GET",  prefix: "/" },
];

const isExempt = (req) =>
  EXEMPT.some(
    ({ method, prefix }) =>
      req.method === method && req.path.startsWith(prefix),
  );

export const maintenanceGuard = async (req, res, next) => {
  try {
    // Skip the DB lookup for paths that are always allowed
    if (isExempt(req)) return next();

    const { enabled, message } = await getMaintenanceStatus();
    if (!enabled) return next();

    return res.status(503).json({
      success: false,
      maintenance: true,
      message: message || "We're down for maintenance. We'll be back shortly.",
    });
  } catch {
    // If we can't read the setting, let the request through — a broken
    // maintenance check should never take the whole API down.
    return next();
  }
};
