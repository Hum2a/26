import { useState } from "react";
import { Button } from "../ui/primitives";
import { Scoreboard } from "../ui/scoreboard";
import { previewActivityToast } from "../ui/activity-notices";

export function PresentationRehearsal() {
  const [round, setRound] = useState(0);
  const entries = Array.from({ length: 100 }, (_, index) => {
    const player = (index + round) % 100;
    return {
      id: `sample-${player}`,
      name: `Sample player ${player + 1}`,
      place: index + 1,
      points: (100 - index) * 25 + round * 10,
    };
  });
  return (
    <section className="grid gap-4" aria-label="Presentation rehearsal">
      <div>
        <h2>Try the new finish</h2>
        <p>Sample players and scores. These controls change this preview only.</p>
      </div>
      <div className="admin-actions">
        <Button onClick={() => setRound((value) => value + 1)}>
          Preview score changes
        </Button>
        <Button variant="secondary" onClick={previewActivityToast}>
          Preview notification
        </Button>
      </div>
      <Scoreboard
        entries={entries}
        label="Sample standings"
        title="A place for everyone"
      />
    </section>
  );
}
