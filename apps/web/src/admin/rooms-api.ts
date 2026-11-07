import {
  adminRoomListSchema,
  kartTrackCapabilityHeader,
  lobbySnapshotSchema,
  type LobbySnapshot,
  type AdminRoomList,
} from "@26/shared";
import { clientApiHeaders } from "../api/client-key";

export type RoomFailure = { error: string; status: number };
async function request(
  path: string,
  body?: unknown,
): Promise<{ body: unknown } | RoomFailure> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`/api/admin/rooms${path}`, {
      method: body === undefined ? "GET" : "POST",
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
      headers: clientApiHeaders(
        body === undefined
          ? { [kartTrackCapabilityHeader]: "2" }
          : { "content-type": "application/json", [kartTrackCapabilityHeader]: "2" },
      ),
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data: unknown = await response.json();
    if (!response.ok)
      return {
        status: response.status,
        error:
          data &&
          typeof data === "object" &&
          "message" in data &&
          typeof data.message === "string"
            ? data.message
            : "Room access is unavailable. Try again.",
      };
    return { body: data };
  } catch {
    return {
      status: 0,
      error: "We couldn’t reach your rooms. Check your connection and try again.",
    };
  } finally {
    window.clearTimeout(timer);
  }
}
export async function listRooms(cursor?: string): Promise<AdminRoomList | RoomFailure> {
  const result = await request(cursor ? `?cursor=${encodeURIComponent(cursor)}` : "");
  if ("error" in result) return result;
  const parsed = adminRoomListSchema.safeParse(result.body);
  return parsed.success
    ? parsed.data
    : { status: 0, error: "The room list could not be read. Try again." };
}
export async function readCurrentRoom(): Promise<LobbySnapshot | null | RoomFailure> {
  const result = await request("/current");
  if ("error" in result) return result;
  if (result.body && typeof result.body === "object" && "snapshot" in result.body) {
    if (result.body.snapshot === null) return null;
    const parsed = lobbySnapshotSchema.safeParse(result.body.snapshot);
    if (parsed.success) return parsed.data;
  }
  return { status: 0, error: "The current room could not be checked. Try again." };
}
export async function readAdminRoom(
  gameId: string,
  requestId?: string,
): Promise<LobbySnapshot | RoomFailure> {
  const result = await request(
    `/${encodeURIComponent(gameId)}${requestId ? "/resume" : ""}`,
    requestId ? { requestId } : undefined,
  );
  if ("error" in result) return result;
  const parsed = lobbySnapshotSchema.safeParse(result.body);
  return parsed.success
    ? parsed.data
    : { status: 0, error: "This room could not be read. Try again." };
}
