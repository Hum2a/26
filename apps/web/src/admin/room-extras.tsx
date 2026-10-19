import { Link } from "react-router";
export function RoomExtras() {
  return (
    <nav className="admin-section-links" aria-label="More room tools">
      <Link to="../media">Media moderation →</Link>
      <Link to="../results">Results & exports →</Link>
      <Link to="../health">Room health & recovery →</Link>
    </nav>
  );
}
