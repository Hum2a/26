import { expect, it } from "vitest";
import { noteMediaDisplayRevision, withClientApiKey } from "./client-key";

it("refreshes room photo URLs on policy changes without changing unrelated requests", () => {
  noteMediaDisplayRevision("ABCDEFGH", 2);
  const photo = withClientApiKey("/api/rooms/ABCDEFGH/media/photo-id");
  expect(new URL(photo, "http://localhost").searchParams.get("display")).toBe("2");
  expect(withClientApiKey(photo)).toBe(photo);
  noteMediaDisplayRevision("ABCDEFGH", 3);
  expect(withClientApiKey("/api/rooms/ABCDEFGH/media/photo-id")).toContain("display=3");
  expect(withClientApiKey("/api/rooms/OTHERROOM/media/photo-id")).not.toContain(
    "display=",
  );
  expect(withClientApiKey("/api/rooms/ABCDEFGH/results")).not.toContain("display=");
});
