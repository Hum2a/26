import { CautionTape } from "../anim/CautionTape";

export function WaitingNext() {
  return (
    <div className="tape-host">
      <p>Waiting for the next question.</p>
      <CautionTape />
    </div>
  );
}
