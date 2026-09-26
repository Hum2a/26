import { CautionTape } from "../anim/CautionTape";

export function PausedOverlay() {
  return (
    <div className="tape-host" role="status" aria-label="Paused">
      <p>The game is paused.</p>
      <CautionTape />
    </div>
  );
}
