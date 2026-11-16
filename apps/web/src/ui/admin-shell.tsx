import { ActivityToaster } from "./activity-toaster";
import { NavLink, useLocation } from "react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useState, type ReactNode } from "react";
import { Icon } from "@iconify/react/dist/offline";
import { appVersion } from "@26/shared";
import house from "@iconify-icons/lucide/house";
import doorOpen from "@iconify-icons/lucide/door-open";
import bookOpen from "@iconify-icons/lucide/book-open";
import car from "@iconify-icons/lucide/car";
import sparkles from "@iconify-icons/lucide/sparkles";
import radio from "@iconify-icons/lucide/radio";
import users from "@iconify-icons/lucide/users";
import image from "@iconify-icons/lucide/image";
import vote from "@iconify-icons/lucide/vote";
import images from "@iconify-icons/lucide/images";
import ghost from "@iconify-icons/lucide/ghost";
import chartColumn from "@iconify-icons/lucide/chart-column";
import trophy from "@iconify-icons/lucide/trophy";
import activity from "@iconify-icons/lucide/activity";
import bot from "@iconify-icons/lucide/bot";
import settings from "@iconify-icons/lucide/settings";
import menu from "@iconify-icons/lucide/menu";
import x from "@iconify-icons/lucide/x";
import { readCurrentRoom } from "../admin/rooms-api";
import { EntryFrame } from "./entry-frame";
import {
  adminFeatures,
  adminNavGroups,
  featurePath,
  featuresInGroup,
  type AdminFeature,
} from "../admin/features";
import "./admin.css";

const featureIcons: Record<string, typeof house> = {
  home: house,
  rooms: doorOpen,
  content: bookOpen,
  kart: car,
  "troll-catalogue": sparkles,
  overview: radio,
  live: radio,
  players: users,
  media: image,
  voters: vote,
  wall: images,
  trolls: ghost,
  analytics: chartColumn,
  results: trophy,
  health: activity,
  developer: bot,
  settings: settings,
};

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
  const feature = currentFeature(location.pathname, roomPath);
  const [menuPath, setMenuPath] = useState<string | null>(null);
  const menuOpen = menuPath === location.pathname;
  const menuId = useId();

  useEffect(() => {
    if (!menuOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuPath(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  useEffect(() => {
    // The question inspector owns its title, including loading and error states.
    if (location.pathname.startsWith("/admin/content/")) return;
    document.title = `${feature?.label ?? "Admin"} · 26`;
  }, [location.pathname, feature?.label]);

  return (
    <EntryFrame
      wide
      full
      navigation={
        <NavLink to="/join" className="entry-text-link">
          Join the party
        </NavLink>
      }
    >
      <ActivityToaster />
      <div className="admin-workspace">
        <header className="admin-mobile-bar">
          <button
            type="button"
            className="admin-menu-button"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            onClick={() => setMenuPath(menuOpen ? null : location.pathname)}
          >
            <Icon icon={menuOpen ? x : menu} aria-hidden="true" />
            {menuOpen ? "Close menu" : "Menu"}
          </button>
          <p className="admin-mobile-title">{feature?.label ?? "Admin"}</p>
          {selectedRoom ? (
            <span className="admin-chip" title="Selected room">
              {selectedRoom.label}
            </span>
          ) : (
            <span className="admin-chip" data-tone="muted">
              No room
            </span>
          )}
        </header>
        {menuOpen ? (
          <button
            type="button"
            className="admin-nav-backdrop"
            aria-label="Close menu"
            onClick={() => setMenuPath(null)}
          />
        ) : null}
        <aside
          id={menuId}
          className="admin-sidebar"
          data-open={menuOpen ? "" : undefined}
        >
          <p className="admin-brand-kicker">Control room</p>
          <p className="admin-label">26 admin</p>
          {selectedRoom ? (
            <p className="admin-room-chip">Room {selectedRoom.label}</p>
          ) : (
            <p className="admin-room-chip" data-tone="muted">
              Open a room to run the night
            </p>
          )}
          <nav aria-label="Admin workspace">
            {adminNavGroups.map((group) => {
              const items = featuresInGroup(group.id);
              if (items.length === 0) return null;
              const roomItems = items.filter((item) => item.scope === "room");
              const globalItems = items.filter((item) => item.scope === "global");
              if (roomItems.length > 0 && globalItems.length === 0 && !selectedRoom) {
                return (
                  <div key={group.id} className="admin-nav-group">
                    <p>{group.label}</p>
                    {roomItems.map((item) => (
                      <span
                        key={item.id}
                        className="admin-nav-disabled"
                        aria-disabled="true"
                      >
                        <NavIcon id={item.id} />
                        {item.label}
                      </span>
                    ))}
                    {group.id === "tonight" ? (
                      <NavLink to="/admin/rooms" className="admin-nav-hint-link">
                        Open a room first →
                      </NavLink>
                    ) : null}
                  </div>
                );
              }
              return (
                <div key={group.id} className="admin-nav-group">
                  <p>{group.label}</p>
                  {items.map((item) =>
                    item.scope === "room" && !selectedRoom ? (
                      <span
                        key={item.id}
                        className="admin-nav-disabled"
                        aria-disabled="true"
                      >
                        <NavIcon id={item.id} />
                        {item.label}
                      </span>
                    ) : (
                      <AdminNavLink
                        key={item.id}
                        end={item.path === "" || item.path === "rooms"}
                        to={featurePath(item, selectedRoom?.gameId)}
                      >
                        <NavIcon id={item.id} />
                        {item.label}
                      </AdminNavLink>
                    ),
                  )}
                </div>
              );
            })}
          </nav>
          <div className="admin-account">{account}</div>
          <p className="admin-version" title="Release version">
            v{appVersion}
          </p>
        </aside>
        <div className="admin-content">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              // A room keeps one provider and socket; its pages animate inside it.
              key={roomPath ?? location.pathname}
              initial={{ opacity: 0, y: reduced ? 0 : 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduced ? 0 : -4 }}
              transition={{ duration: reduced ? 0.12 : 0.2, ease: [0.2, 0, 0, 1] }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </EntryFrame>
  );
}

function NavIcon({ id }: { id: string }) {
  const icon = featureIcons[id];
  if (!icon) return null;
  return <Icon icon={icon} className="admin-nav-icon" aria-hidden="true" />;
}

/** A sidebar link whose active highlight glides between items. */
function AdminNavLink({
  to,
  end,
  children,
}: {
  to: string;
  end?: boolean;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  return (
    <NavLink to={to} end={end}>
      {({ isActive }) => (
        <>
          {isActive ? (
            <motion.span
              layoutId="admin-nav-pill"
              className="admin-nav-pill"
              aria-hidden="true"
              transition={
                reduced
                  ? { duration: 0.12 }
                  : { type: "spring", stiffness: 500, damping: 40 }
              }
            />
          ) : null}
          <span className="admin-nav-label">{children}</span>
        </>
      )}
    </NavLink>
  );
}

/**
 * The room the sidebar's room pages point at: the one in the address, or the
 * room this browser last selected. Checked once when outside a room.
 */
export function useSelectedRoom(
  roomPath: string | undefined,
): { gameId: string; label: string } | null {
  const [selected, setSelected] = useState<{ gameId: string; label: string } | null>(
    null,
  );
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
    return {
      gameId: roomPath,
      label: selected?.gameId === roomPath ? selected.label : roomPath,
    };
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
    (feature) =>
      feature.scope === (roomPath ? "room" : "global") && feature.path === segment,
  );
}
