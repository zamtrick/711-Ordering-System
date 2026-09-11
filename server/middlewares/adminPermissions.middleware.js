import Setting from "../models/Setting.js";

export const ADMIN_PERMISSIONS_KEY = "adminPermissions";

export const DEFAULT_ADMIN_PERMISSIONS = {
  canManageProducts: true,
  canManageCategories: true,
  canManageRiders: true,
};

export const getAdminPermissionsMap = async () => {
  const doc = await Setting.findOne({ key: ADMIN_PERMISSIONS_KEY });
  if (!doc) return { ...DEFAULT_ADMIN_PERMISSIONS };
  try {
    const parsed = JSON.parse(doc.value);
    return {
      canManageProducts:
        parsed.canManageProducts ?? DEFAULT_ADMIN_PERMISSIONS.canManageProducts,
      canManageCategories:
        parsed.canManageCategories ??
        DEFAULT_ADMIN_PERMISSIONS.canManageCategories,
      canManageRiders:
        parsed.canManageRiders ?? DEFAULT_ADMIN_PERMISSIONS.canManageRiders,
    };
  } catch {
    return { ...DEFAULT_ADMIN_PERMISSIONS };
  }
};

// Blocks admin writes when the superadmin toggle is OFF.
// Superadmin always passes. Admin GET (read-only view) always passes.
export const requireAdminPermission = (permKey) => async (req, res, next) => {
  try {
    const role = req.user?.role;
    if (role === "superadmin") return next();
    if (role !== "admin") return next();
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();

    const perms = await getAdminPermissionsMap();
    if (perms[permKey]) return next();

    return res.status(403).json({
      success: false,
      message:
        "Managing this section is disabled by superadmin — read-only access.",
    });
  } catch (err) {
    console.error("requireAdminPermission error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
