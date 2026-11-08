import {
  authFailureSchema,
  kartTrackCapabilityHeader,
  guestSessionSchema,
  lobbyCreatedSchema,
  roomDiagnosticsSchema,
  type RoomDiagnostics,
  lobbySnapshotSchema,
  playCommandSchema,
  roomClientErrorSchema,
  transferIssuedSchema,
  type GuestSession,
  type LobbyCreated,
  type LobbySnapshot,
  type PlayCommand,
  type TransferIssued,
  type RehearsalConfig,
  type KartLookName,
  type KartHandling,
  type KartItemRules,
} from "@26/shared";
import { clientApiHeaders } from "../api/client-key.ts";

export async function createLobby(
  requestId: string,
  rehearsal?: RehearsalConfig,
  kind?: "kart",
): Promise<LobbyCreated | { error: string }> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch("/api/rooms", {
      method: "POST",
      credentials: "same-origin",
      headers: clientApiHeaders({ "content-type": "application/json" }),
      body: JSON.stringify({
        requestId,
        ...(rehearsal ? { rehearsal } : {}),
        ...(kind ? { kind } : {}),
      }),
      signal: controller.signal,
    });
    return await read(response, lobbyCreatedSchema);
  } catch {
    return { error: "We couldn’t confirm room creation. Retry the same request." };
  } finally {
    window.clearTimeout(timer);
  }
}

/** Fills an empty room with sample guests, photos, trolls and scores. */
export async function seedSampleRoom(
  gameId: string,
): Promise<{ count: number } | { error: string }> {
  try {
    const response = await fetch("/api/rooms/sample", {
      method: "POST",
      credentials: "same-origin",
      headers: clientApiHeaders({ "content-type": "application/json" }),
      body: JSON.stringify({ gameId }),
    });
    const body: unknown = await response.json().catch(() => undefined);
    if (response.ok && body && typeof body === "object" && "count" in body) {
      return { count: Number(body.count) };
    }
    const message =
      body &&
      typeof body === "object" &&
      "message" in body &&
      typeof body.message === "string"
        ? body.message
        : "The sample data could not be added. Try again.";
    return { error: message };
  } catch {
    return {
      error: "The sample data could not be added. Check the connection and try again.",
    };
  }
}

export async function joinLobby(input: {
  code: string;
  nickname: string;
  requestId: string;
}): Promise<GuestSession | { error: string; uncertain?: boolean }> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch("/api/rooms/join", {
      method: "POST",
      credentials: "same-origin",
      headers: clientApiHeaders({ "content-type": "application/json" }),
      body: JSON.stringify(input),
      signal: controller.signal,
    });
    const result = await read(response, guestSessionSchema);
    return "error" in result
      ? {
          ...result,
          uncertain: response.ok || response.status >= 500 || response.status === 408,
        }
      : result;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function resumeGuest(): Promise<GuestSession | undefined> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch("/api/rooms/session", {
      credentials: "same-origin",
      headers: clientApiHeaders(),
      signal: controller.signal,
      cache: "no-store",
    });
    if (response.status === 401 || response.status === 404) return undefined;
    if (!response.ok) throw new Error("Guest session is unavailable.");
    const parsed = guestSessionSchema.safeParse(await response.json());
    if (!parsed.success) throw new Error("Guest session could not be checked.");
    return parsed.data;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function lookupStage(
  code: string,
): Promise<LobbySnapshot | { error: string }> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch("/api/rooms/lookup", {
      method: "POST",
      credentials: "same-origin",
      headers: clientApiHeaders({
        "content-type": "application/json",
        [kartTrackCapabilityHeader]: "2",
      }),
      body: JSON.stringify({ code }),
      signal: controller.signal,
    });
    return await read(response, lobbySnapshotSchema);
  } catch {
    return {
      error: "The projector could not connect. Check the room code and try again.",
    };
  } finally {
    window.clearTimeout(timer);
  }
}

export type PlayAction =
  | "developer-configure"
  | "developer-run"
  | "developer-stop"
  | "developer-jump"
  | "developer-repeat"
  | "developer-scenario"
  | "developer-bots"
  | "start-birthday"
  | "start-kart"
  | "start-kart-rehearsal"
  | "kart-course-on"
  | "kart-course-off"
  | "kart-opponents-on"
  | "kart-effects-on"
  | "kart-effects-off"
  | "kart-look"
  | "kart-setting"
  | "kart-handling"
  | "kart-item-rules"
  | "kart-track"
  | "kart-items-on"
  | "kart-items-off"
  | "kart-items-clear"
  | "kart-opponents-off"
  | "kart-stage-map"
  | "kart-stage-overview"
  | "kart-stage-follow"
  | "kart-stage-director"
  | "photo-bias-on"
  | "photo-bias-off"
  | "start"
  | "pause"
  | "resume"
  | "advance"
  | "skip"
  | "finish"
  | "reveal-names"
  | "hide"
  | "show"
  | "rereveal"
  | "rename"
  | "swap"
  | "kick"
  | "open-joining"
  | "close-joining"
  | "recover"
  | "adjust"
  | "include"
  | "exclude"
  | "feature"
  | "cancel-effect"
  | "dismiss-cue"
  | "troll-on"
  | "troll-off"
  | "wall-approve"
  | "wall-decline"
  | "wall-pull"
  | "wall-skip"
  | "wall-next"
  | "wall-settings"
  | "wall-mute"
  | "wall-unmute"
  | "hide-media"
  | "retry-archive"
  | "release-stuck-media"
  | "retry-delivery"
  | "end-now"
  | "destroy";

export type PlayIntent = {
  expectedPhaseGeneration?: number;
  rehearsalConfig?: RehearsalConfig;
  questionIndex?: number;
  scenario?: "disconnect" | "late-join" | "deadline-burst" | "host-loss";
  botCount?: number;
  /** Kart driving-feel change; the room validates the key and value again. */
  kartSetting?: { key: string; value: string };
  lookPreset?: KartLookName;
  handlingPreset?: KartHandling;
  itemRules?: KartItemRules;
  kartTrack?: import("@26/shared").KartTrackId;
  kartLaps?: import("@26/shared").KartLaps;
  gameId: string;
  action: PlayAction;
  requestId: string;
  playerId?: string;
  otherPlayerId?: string;
  nickname?: string;
  points?: number;
  reason?: string;
  candidateId?: string;
  effectId?: string;
  mediaId?: string;
  trollKind?: string;
  postId?: string;
  /** Destroy only: the join code the host typed to confirm. */
  confirmCode?: string;
  wallSettings?: {
    enabled?: boolean;
    moderation?: "approve" | "direct";
    placement?: "breaks" | "corner";
    showMs?: number;
    captions?: boolean;
  };
};
export async function playRoom(
  input: PlayIntent,
): Promise<PlayCommand | { error: string; uncertain?: boolean }> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch("/api/rooms/play", {
      method: "POST",
      credentials: "same-origin",
      headers: clientApiHeaders({ "content-type": "application/json" }),
      body: JSON.stringify(input),
      signal: controller.signal,
    });
    const result = await read(response, playCommandSchema);
    return "error" in result
      ? { ...result, uncertain: response.ok || response.status >= 500 }
      : result;
  } catch {
    return {
      error:
        "We couldn’t confirm that action. Retry the same request to check its result.",
      uncertain: true,
    };
  } finally {
    window.clearTimeout(timer);
  }
}

export async function readDiagnostics(
  gameId: string,
): Promise<RoomDiagnostics | { error: string }> {
  const response = await fetch(`/api/rooms/${gameId}/diagnostics`, {
    credentials: "same-origin",
    headers: clientApiHeaders(),
  });
  return read(response, roomDiagnosticsSchema);
}

export async function downloadScoreSummary(
  gameId: string,
): Promise<{ error: string } | undefined> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`/api/rooms/${gameId}/summary`, {
      credentials: "same-origin",
      signal: controller.signal,
      headers: clientApiHeaders(),
    });
    if (!response.ok) {
      const body: unknown = await response.json().catch(() => undefined);
      return { error: errorMessage(body) };
    }
    const text = await response.text();
    const file = new File([text], `score-summary-${gameId}.md`, {
      type: "text/markdown",
    });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    link.click();
    URL.revokeObjectURL(url);
    return undefined;
  } catch {
    return { error: "The score summary could not be downloaded. Try again." };
  } finally {
    window.clearTimeout(timer);
  }
}

export async function issueTransfer(input: {
  gameId: string;
  playerId: string;
  requestId: string;
}): Promise<TransferIssued | { error: string; uncertain?: boolean }> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch("/api/rooms/transfer", {
      method: "POST",
      credentials: "same-origin",
      headers: clientApiHeaders({ "content-type": "application/json" }),
      body: JSON.stringify(input),
      signal: controller.signal,
    });
    const result = await read(response, transferIssuedSchema);
    return "error" in result
      ? { ...result, uncertain: response.ok || response.status >= 500 }
      : result;
  } catch {
    return {
      error: "We couldn’t confirm the transfer code. Retry the same request.",
      uncertain: true,
    };
  } finally {
    window.clearTimeout(timer);
  }
}

export async function redeemTransfer(input: {
  joinCode: string;
  code: string;
  requestId: string;
}): Promise<GuestSession | { error: string; uncertain?: boolean }> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch("/api/rooms/transfer/redeem", {
      method: "POST",
      credentials: "same-origin",
      headers: clientApiHeaders({ "content-type": "application/json" }),
      body: JSON.stringify(input),
      signal: controller.signal,
    });
    const result = await read(response, guestSessionSchema);
    return "error" in result
      ? {
          ...result,
          uncertain: response.ok || response.status >= 500 || response.status === 408,
        }
      : result;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function read<T>(
  response: Response,
  schema: {
    safeParse: (value: unknown) => { success: true; data: T } | { success: false };
  },
): Promise<T | { error: string }> {
  const body: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    return { error: errorMessage(body) };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return { error: "That response was not a lobby." };
  }
  return parsed.data;
}

function errorMessage(body: unknown): string {
  const room = roomClientErrorSchema.safeParse(body);
  if (room.success) {
    return room.data.message;
  }
  const auth = authFailureSchema.safeParse(body);
  if (auth.success) {
    return auth.data.message;
  }
  return "That request was not accepted.";
}
