import {
  adminContentSchema,
  adminMediaSchema,
  adminQuestionDetailSchema,
  adminQuestionPreviewSchema,
  type AdminQuestionPreview,
  type AdminQuestionDetail,
  type AdminContent,
  type AdminMedia,
} from "@26/shared";

export { readSection } from "../api/read-data";
import { readSection } from "../api/read-data";
export const readContent = (): Promise<AdminContent | { error: string }> =>
  readSection("/api/admin/content", adminContentSchema);
export const readQuestion = (
  version: string,
  id: string,
): Promise<AdminQuestionDetail | { error: string }> =>
  readSection(
    `/api/admin/content/${encodeURIComponent(version)}/questions/${encodeURIComponent(id)}`,
    adminQuestionDetailSchema,
  );
export const readQuestionPreview = (
  version: string,
  id: string,
): Promise<AdminQuestionPreview | { error: string }> =>
  readSection(
    `/api/admin/content/${encodeURIComponent(version)}/questions/${encodeURIComponent(id)}/preview`,
    adminQuestionPreviewSchema,
  );
export const readMediaPage = (
  gameId: string,
  cursor?: string,
): Promise<AdminMedia | { error: string }> =>
  readSection(
    `/api/admin/rooms/${gameId}/media${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
    adminMediaSchema,
  );
