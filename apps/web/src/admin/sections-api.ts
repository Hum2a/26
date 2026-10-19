import {
  adminContentSchema,
  adminMediaSchema,
  type AdminContent,
  type AdminMedia,
} from "@26/shared";

export { readSection } from "../api/read-data";
import { readSection } from "../api/read-data";
export const readContent = (): Promise<AdminContent | { error: string }> =>
  readSection("/api/admin/content", adminContentSchema);
export const readMediaPage = (
  gameId: string,
  cursor?: string,
): Promise<AdminMedia | { error: string }> =>
  readSection(
    `/api/admin/rooms/${gameId}/media${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
    adminMediaSchema,
  );
