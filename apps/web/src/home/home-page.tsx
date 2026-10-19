import { useEffect, useState } from "react";
import { Link } from "react-router";
import { motion } from "motion/react";
import { useAdminSession } from "../admin/use-admin-session";
import { resumeGuest } from "../live/room-api";
import { EntryFrame } from "../ui/entry-frame";
import { LinkButton } from "../ui/primitives";

export function HomePage() {
  const admin = useAdminSession();
  const [hasGame, setHasGame] = useState(false);
  const signedIn = admin.state === "ready" && admin.session.signedIn;
  const adminPath = signedIn ? "/admin" : "/admin/login";
  const adminLabel = signedIn ? "Open admin" : "Admin sign in";
  useEffect(() => {
    document.title = "26 · The birthday quiz";
    let active = true;
    void resumeGuest()
      .then((session) => {
        if (active) setHasGame(Boolean(session));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  return (
    <EntryFrame
      wide
      navigation={
        <Link className="entry-text-link" to={adminPath}>
          {adminLabel}
        </Link>
      }
    >
      <div className="home-layout">
        <section className="home-intro">
          <p className="entry-eyebrow">The birthday quiz</p>
          <h1>
            A little older.
            <br />
            <em>A lot to answer for.</em>
          </h1>
          <p>
            One room. Everyone playing. Bring your opinions, your best guesses, and your
            phone.
          </p>
          {hasGame ? (
            <motion.div
              className="home-return"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              <LinkButton to="/play" variant="secondary">
                Return to your game →
              </LinkButton>
            </motion.div>
          ) : null}
        </section>
        <section className="home-ticket skin-panel" aria-label="Your way in">
          <div className="home-ticket-top" aria-hidden="true">
            <p className="home-ticket-number">26</p>
            <span>Good company · Questionable answers</span>
          </div>
          <div className="home-destination">
            <p className="entry-eyebrow">For everyone in the room</p>
            <h2>Your phone. Your answers.</h2>
            <p>Got the code? Pick a nickname and you’re in.</p>
            <LinkButton to="/join">Join the party →</LinkButton>
          </div>
          <div className="home-admin">
            <p>Running the night?</p>
            <Link className="entry-text-link" to={adminPath}>
              {adminLabel}
            </Link>
          </div>
        </section>
      </div>
    </EntryFrame>
  );
}
