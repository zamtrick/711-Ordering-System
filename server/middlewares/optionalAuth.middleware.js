import jwt from "jsonwebtoken";

/**
 * optionalAuth — like auth, but never blocks the request.
 *
 * If a valid accessToken cookie is present, it decodes it and sets req.user
 * exactly as the regular auth middleware does. If the token is missing,
 * invalid, or expired, req.user is left undefined and the next handler runs
 * normally.
 *
 * Use this on routes that work for both authenticated and unauthenticated
 * callers — e.g. POST /auth/logout, where the cookie should always be
 * cleared but an audit log is only written when we can identify the user.
 */
const optionalAuth = (req, _res, next) => {
  try {
    const token = req.cookies?.accessToken;
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
    }
  } catch {
    // Invalid / expired token — silently ignore, req.user stays undefined.
  }
  next();
};

export default optionalAuth;
