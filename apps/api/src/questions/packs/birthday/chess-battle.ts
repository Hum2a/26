import { chessQuestion } from "../../authoring.ts";

/**
 * Chess Battle: Individual 1+0 blitz games against the Humza bot.
 * Everyone plays White. Bot plays Black at ~1425 Elo.
 */
export const chessBattle = chessQuestion({
  id: "chess-battle",
  title: "Chess Battle",
  status: "draft",
  prompt: "Play 1-minute blitz against the Humza bot!",
  instructions:
    "You play White. Make your moves quickly—you have 1 minute total. Win = 100 points, Draw = 50 points.",
  points: 100,
  collectMs: 15_000, // 15 seconds collection time after all games finish
  initialTimeMs: 60_000, // 1+0 time control
  incrementMs: 0,
  attribution: "never",
  notes: "1+0 blitz. All guests play simultaneously. Engine runs client-side with casual trust.",
});
