// --------------------------------------------------
// ERROR UTILITIES
// --------------------------------------------------
// Centralises the repeated pattern of extracting a human-readable message
// from an axios/unknown error so catch blocks stay one line each.

interface ApiErrorResponse {
  message?: string;
}

/**
 * Extract a server-provided error message from an unknown thrown value.
 * Falls back to the provided default when the shape doesn't match or the
 * server didn't include a message.
 *
 * @example
 *   } catch (err) {
 *     Alert.alert("Error", getErrorMessage(err, "Failed to save profile."));
 *   }
 */
export function getErrorMessage(err: unknown, fallback: string): string {
  if (
    err &&
    typeof err === "object" &&
    "response" in err &&
    err.response &&
    typeof err.response === "object" &&
    "data" in err.response &&
    err.response.data &&
    typeof err.response.data === "object" &&
    "message" in err.response.data
  ) {
    const message = (err.response.data as ApiErrorResponse).message;
    if (typeof message === "string" && message.length > 0) return message;
  }
  return fallback;
}

/**
 * Check whether an unknown error is a 401 (unauthorised) response.
 */
export function isUnauthorized(err: unknown): boolean {
  return (
    !!err &&
    typeof err === "object" &&
    "response" in err &&
    err.response !== null &&
    typeof err.response === "object" &&
    "status" in err.response &&
    err.response.status === 401
  );
}
