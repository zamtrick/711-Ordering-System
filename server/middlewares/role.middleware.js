export const authorize = (...allowedRoles) => {
  return (req, res, next) => {
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
