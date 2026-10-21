import { NavLink, useLocation } from "react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, type ReactNode } from "react";
import { EntryFrame } from "./entry-frame";
import "./admin.css";

export function AdminShell({
  children,
  account,
}: {
  children: ReactNode;
  account: ReactNode;
}) {
  const location = useLocation();
  const reduced = useReducedMotion();
  const roomPath = location.pathname.match(/^\/admin\/rooms\/([A-Z0-9]+)(?:\/|$)/)?.[1];
  useEffect(() => {
    // The question inspector owns its title, including loading and error states.
    if (location.pathname.startsWith("/admin/content/")) return;
    const title = roomPath
      ? location.pathname.endsWith("/live")
        ? "Live controls"
        : location.pathname.endsWith("/players")
          ? "Players"
          : location.pathname.endsWith("/media")
            ? "Media"
            : location.pathname.endsWith("/results")
              ? "Results & exports"
              : location.pathname.endsWith("/health")
                ? "Room health"
                : "Room overview"
      : location.pathname.endsWith("/settings")
        ? "Account & appearance"
        : location.pathname.endsWith("/rooms")
          ? "Rooms"
          : location.pathname.endsWith("/content")
            ? "Question packs"
            : location.pathname.endsWith("/kart")
              ? "Kart"
              : "Admin overview";
    document.title = `${title} · 26`;
  }, [location.pathname, roomPath]);
  return (
    <EntryFrame
      wide
      navigation={
        <NavLink to="/join" className="entry-text-link">
          Join the party
        </NavLink>
      }
    >
      <div className="admin-workspace">
        <aside className="admin-sidebar">
          <p className="entry-eyebrow">Running the night</p>
          <p className="admin-label">The control room.</p>
          <nav aria-label="Admin workspace">
            <NavLink end to="/admin">
              Home
            </NavLink>
            <NavLink end to="/admin/rooms">
              Rooms
            </NavLink>
            <NavLink to="/admin/content">Question packs</NavLink>
            <NavLink to="/admin/kart">Kart</NavLink>
            <NavLink to="/admin/trolls">Trolls</NavLink>
            {roomPath ? (
              <div className="admin-room-nav">
                <p>Selected room</p>
                <NavLink end to={`/admin/rooms/${roomPath}`}>
                  Overview
                </NavLink>
                <NavLink to={`/admin/rooms/${roomPath}/live`}>Live controls</NavLink>
                <NavLink to={`/admin/rooms/${roomPath}/players`}>Players</NavLink>
                <NavLink to={`/admin/rooms/${roomPath}/media`}>Media</NavLink>
                <NavLink to={`/admin/rooms/${roomPath}/results`}>Results</NavLink>
                <NavLink to={`/admin/rooms/${roomPath}/health`}>Health</NavLink>
                <NavLink to={`/admin/rooms/${roomPath}/trolls`}>Trolls</NavLink>
              </div>
            ) : null}
            <NavLink to="/admin/settings">Account & appearance</NavLink>
          </nav>
          <div className="admin-account">{account}</div>
        </aside>
        <div className="admin-content">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={roomPath ?? "workspace"}
              initial={{ opacity: 0, y: reduced ? 0 : 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </EntryFrame>
  );
}
