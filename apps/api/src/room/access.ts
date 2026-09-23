import { adminSessionSchema } from "@26/shared";
import { authFailure } from "../auth/http.ts";
import { administratorForRequest } from "../auth/routes.ts";
import { sameOriginRejection } from "../credentials/cookies.ts";

/**
 * Local development asks the existing session route, which Node answers
 * because PGlite cannot open inside the Worker. Staging and production use
 * the in-Worker session check and do not loop back to themselves.
 * A guest cannot grant this by setting a header.
 */
export async function rejectUnlessRoomCreator(
  request: Request,
  env: Env,
): Promise<Response | undefined> {
  if (sameOriginRejection(request)) {
    return authFailure("forbidden", 403);
  }
  if (env.APP_ENV === "local") {
    return localAdministrator(request);
  }
  const admin = await administratorForRequest(env, request);
  if (admin instanceof Response) {
    return admin;
  }
  return undefined;
}

async function localAdministrator(request: Request): Promise<Response | undefined> {
  let response: Response;
  try {
    response = await fetch(new URL("/api/admin/session", request.url), {
      headers: { cookie: request.headers.get("cookie") ?? "" },
    });
  } catch {
    return authFailure("unauthenticated", 401);
  }
  if (response.status === 503) {
    return authFailure("misconfigured", 503);
  }
  if (!response.ok) {
    return authFailure("unauthenticated", 401);
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return authFailure("unauthenticated", 401);
  }
  const session = adminSessionSchema.safeParse(body);
  if (!session.success || !session.data.signedIn) {
    return authFailure("unauthenticated", 401);
  }
  return undefined;
}
