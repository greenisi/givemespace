import { isLoginAllowed } from "../lib/utils/runtime_params.js";

export const allowAnonymous = true;

function createHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export function get(context) {
  if (!isLoginAllowed(context.runtimeParams)) {
    throw createHttpError("Login is disabled in this system.", 403);
  }

  const headers = {
    "Cache-Control": "no-store"
  };

  if (
    context.user?.shouldClearSessionCookie &&
    context.auth &&
    typeof context.auth.createClearedSessionCookieHeader === "function"
  ) {
    headers["Set-Cookie"] = context.auth.createClearedSessionCookieHeader();
  }

  return {
    headers,
    status: 200,
    body: {
      authenticated: Boolean(context.user?.isAuthenticated),
      username: context.user?.isAuthenticated ? context.user.username : ""
    }
  };
}
