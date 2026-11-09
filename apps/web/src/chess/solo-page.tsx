import { useCallback, useEffect, useState } from "react";
import { ChessGame } from "./chess-game";
import { ChessClocks } from "./chess-clocks";
import {
  applySoloMove,
  createSoloSnapshot,
  expireSoloClock,
  resignSolo,
} from "./solo-game";
import "./chess.css";
import "./solo-page.css";

export function SoloChessPage() {
  const [gameNo, setGameNo] = useState(0);
  const [snapshot, setSnapshot] = useState(() =>
    createSoloSnapshot(Date.now(), "solo-chess-1"),
  );

  useEffect(() => {
    document.title = "26 · Solo chess practice";
  }, []);

  useEffect(() => {
    if (snapshot.isGameOver) {
      return;
    }
    const wait =
      snapshot.sideToMove === snapshot.playerColor
        ? snapshot.playerTimeMs
        : snapshot.botTimeMs;
    const timer = window.setTimeout(
      () => {
        setSnapshot((current) => expireSoloClock(current, Date.now()));
      },
      Math.max(0, wait),
    );
    return () => window.clearTimeout(timer);
  }, [snapshot]);

  const onMove = useCallback(
    (from: string, to: string, promotion?: "q" | "r" | "b" | "n") => {
      setSnapshot((current) => {
        const result = applySoloMove(current, from, to, Date.now(), promotion);
        return "error" in result ? current : result;
      });
    },
    [],
  );

  return (
    <main className="solo-chess-page">
      <a className="solo-chess-back glass" href="/">
        ← 26
      </a>
      <div className="solo-chess-board">
        <p className="entry-eyebrow">Solo practice</p>
        <h1>Chess vs the Humza bot</h1>
        <p>You are White. 1+0, about 1425. No room, no party points.</p>
        <ChessClocks snapshot={snapshot} />
        <ChessGame
          key={snapshot.gameId}
          snapshot={snapshot}
          onMove={onMove}
          onResign={() => setSnapshot((current) => resignSolo(current, Date.now()))}
        />
        <button
          type="button"
          className="solo-chess-new"
          onClick={() => {
            const next = gameNo + 1;
            setGameNo(next);
            setSnapshot(createSoloSnapshot(Date.now(), `solo-chess-${next + 1}`));
          }}
        >
          New game
        </button>
      </div>
    </main>
  );
}
