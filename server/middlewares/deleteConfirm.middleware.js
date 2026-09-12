// --------------------------------------------------
// DELETE CONFIRMATION
// --------------------------------------------------
// Destructive DELETE routes require the caller to explicitly confirm by
// sending { confirmText: "DELETE" } in the request body. The UI pairs this
// with a "type DELETE to confirm" dialog, but the check lives server-side
// so the endpoint is never callable without the explicit confirmation.
// Case-insensitive and whitespace-tolerant for UX; the intent is unambiguous.
// --------------------------------------------------

export const requireDeleteConfirmation = (req, res, next) => {
  const confirmText =
    typeof req.body?.confirmText === "string"
      ? req.body.confirmText.trim().toUpperCase()
      : "";

  if (confirmText !== "DELETE") {
    return res.status(400).json({
      success: false,
      message: 'Confirmation required: send confirmText "DELETE" in the request body.',
    });
  }

  return next();
};
