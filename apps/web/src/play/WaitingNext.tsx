import { CautionTape } from "../anim/CautionTape";
import { defaultVoice, useThemeVoice } from "../theme/voices";

/** The state itself, in every theme. A theme's own line only sits beside it. */
const waitingState = defaultVoice.waiting;

export function WaitingNext() {
  const voice = useThemeVoice();
  return (
    <div className="tape-host">
      <p>{waitingState}</p>
      {voice.waiting !== waitingState ? <p>{voice.waiting}</p> : null}
      <CautionTape />
    </div>
  );
}
