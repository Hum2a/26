import { withClientApiKey } from "../api/client-key";

/** URL of a driver's face photo. Same authenticated route as other room media. */
export function driverFaceUrl(gameId: string, mediaId: string): string {
  return withClientApiKey(`/api/rooms/${gameId}/media/${mediaId}`);
}
