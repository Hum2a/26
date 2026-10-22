import { NavLink, useLocation } from "react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import { appVersion } from "@26/shared";
import { readCurrentRoom } from "../admin/rooms-api";
import { EntryFrame } from "./entry-frame";
import {
  adminFeatures,
  featurePath,
  globalFeatures,
  roomFeatures,
  type AdminFeature,
} from "../admin/features";
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
  const selectedRoom = useSelectedRoom(roomPath);
  useEffect(() => {
    // The question inspector owns its title, including loading and error states.
    if (location.pathname.startsWith("/admin/content/")) return;
    const feature = currentFeature(location.pathname, roomPath);
    document.title = `${feature?.label ?? "Admin overview"} · 26`;
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
          {/* Built from `adminFeatures`: a new feature only needs its entry there. */}
          <nav aria-label="Admin workspace">
            {globalFeatures
              .filter((feature) => feature.id !== "settings")
              .map((feature) => (
                <NavLink
                  key={feature.id}
                  end={feature.path === "" || feature.path === "rooms"}
                  to={featurePath(feature)}
                >
                  {feature.label}
                </NavLink>
              ))}
            {/*
              Room pages are always listed, so they can be found from anywhere.
              They link to the room in the address, or this browser's selected room.
            */}
            <div className="admin-room-nav">
              <p>{selectedRoom ? `Room ${selectedRoom.label}` : "Room pages"}</p>
              {selectedRoom ? (
                roomFeatures.map((feature) => (
                  <NavLink
                    key={feature.id}
                    end={feature.path === ""}
                    to={featurePath(feature, selectedRoom.gameId)}
                  >
                    {feature.label}
                  </NavLink>
                ))
              ) : (
                <>
                  {roomFeatures.map((feature) => (
                    <span key={feature.id} className="admin-nav-disabled" aria-disabled="true">
                      {feature.label}
                    </span>
                  ))}
                  <NavLink to="/admin/rooms">Open a room first →</NavLink>
                </>
              )}
            </div>
            <NavLink to="/admin/settings">Account & appearance</NavLink>
          </nav>
          <div className="admin-account">{account}</div>
          {/* Set by release.sh, so the host can tell which release is live. */}
          <p className="admin-version" title="Release version">
            v{appVersion}
          </p>
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

/**
 * The room the sidebar's room pages point at: the one in the address, or the
 * room this browser last selected. Checked once when outside a room.
 */
export function useSelectedRoom(
  roomPath: string | undefined,
): { gameId: string; label: string } | null {
  const [selected, setSelected] = useState<{ gameId: string; label: string } | null>(null);
  useEffect(() => {
    if (roomPath) {
      return;
    }
    let live = true;
    readCurrentRoom()
      .then((room) => {
        if (live && room && !("error" in room)) {
          setSelected({ gameId: room.gameId, label: room.joinCode });
        }
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [roomPath]);
  if (roomPath) {
    return { gameId: roomPath, label: selected?.gameId === roomPath ? selected.label : roomPath };
  }
  return selected;
}

/** The feature whose page is open, for the document title. */
function currentFeature(
  pathname: string,
  roomPath: string | undefined,
): AdminFeature | undefined {
  const rest = roomPath
    ? (pathname.split(`/admin/rooms/${roomPath}`)[1] ?? "")
    : pathname.replace(/^\/admin/, "");
  const segment = rest.replace(/^\//, "").split("/")[0] ?? "";
  return adminFeatures.find(
    (feature) => feature.scope === (roomPath ? "room" : "global") && feature.path === segment,
  );
}
