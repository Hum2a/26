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
    "You play White, 1+0. Score Black pieces you capture: Q10 R5 B3 N3 P1. Checkmate is at least 40. Other results keep captures.",
  points: 40,
  collectMs: 15_000, // 15 seconds collection time after all games finish
  initialTimeMs: 60_000, // 1+0 time control
  incrementMs: 0,
  attribution: "never",
  notes:
    "1+0 blitz. All guests play simultaneously. Engine runs client-side with casual trust.",
});
