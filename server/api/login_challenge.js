import { isLoginAllowed, isSingleUserApp } from "../lib/utils/runtime_params.js";

export const allowAnonymous = true;

function createHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export async function post(context) {
  if (isSingleUserApp(context.runtimeParams)) {
    throw createHttpError("Password login is disabled in single-user mode.", 403);
  }

  if (!isLoginAllowed(context.runtimeParams)) {
    throw createHttpError("Login is disabled in this system.", 403);
  }

  const payload =
    context.body && typeof context.body === "object" && !Buffer.isBuffer(context.body)
      ? context.body
      : {};

  try {
    return await context.auth.createLoginChallenge({
      clientNonce: payload.clientNonce,
      req: context.req,
      username: payload.username
    });
  } catch (error) {
    throw createHttpError(error.message || "Login challenge failed.", Number(error.statusCode) || 401);
  }
}
