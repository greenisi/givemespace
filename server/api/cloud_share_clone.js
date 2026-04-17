import { cloneHostedCloudShareToGuest } from "../lib/share/service.js";
import { areGuestUsersAllowed } from "../lib/utils/runtime_params.js";
import { runTrackedMutation } from "../runtime/request_mutations.js";

export const allowAnonymous = true;

function createHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export async function post(context) {
  if (!areGuestUsersAllowed(context.runtimeParams)) {
    throw createHttpError("Cloud share not found.", 404);
  }

  const cloneResult = await runTrackedMutation(context, async () =>
    cloneHostedCloudShareToGuest({
      auth: context.auth,
      payloadBuffer: context.rawBody,
      projectRoot: context.projectRoot,
      req: context.req,
      runtimeParams: context.runtimeParams,
      shareToken: context.query?.token
    })
  );

  return {
    headers: {
      "Cache-Control": "no-store",
      "Set-Cookie": context.auth.createSessionCookieHeader(cloneResult.session.sessionToken)
    },
    status: 200,
    body: {
      redirectUrl: "/#/spaces?id=" + encodeURIComponent(cloneResult.importedSpace.spaceId),
      spaceId: cloneResult.importedSpace.spaceId,
      username: cloneResult.username
    }
  };
}
