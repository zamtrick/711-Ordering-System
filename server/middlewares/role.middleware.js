export const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    // Superadmin has access to ALL routes
    if (req.user.role === "superadmin") {
      return next();
    }

    // Check if the user's role is included in the allowed roles
    const role = req.user.role;
    if (!allowedRoles.includes(role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // User has permission to continue
    next();
  };
};
