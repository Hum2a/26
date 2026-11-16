import {
  kartTrackCapabilityHeader,
  kartTrackRefreshMessage,
  needsKartTrackUpdate,
  type LobbySnapshot,
} from "@26/shared";
export function rejectOldKartTrackClient(
  request: Request,
  snapshot: LobbySnapshot,
  extra?: Headers,
) {
  if (
    request.headers.get(kartTrackCapabilityHeader) === "2" ||
    !needsKartTrackUpdate(snapshot)
  )
    return undefined;
  const headers = new Headers(extra);
  headers.set("cache-control", "no-store");
  return Response.json(
    { error: "invalid", message: kartTrackRefreshMessage },
    { status: 409, headers },
  );
}
