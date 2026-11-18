import { CautionTape } from "../anim/CautionTape";
import { useThemeVoice } from "../theme/voices";

export function WaitingNext() {
  const voice = useThemeVoice();
  return (
    <div className="tape-host">
      <p>{voice.waiting}</p>
      <CautionTape />
    </div>
  );
}
