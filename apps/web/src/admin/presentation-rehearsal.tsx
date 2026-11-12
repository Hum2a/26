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
    <section className="admin-card" aria-label="Presentation rehearsal">
      <div className="admin-card-header">
        <span className="admin-status-dot" data-tone="ok" aria-hidden="true" />
        <span className="admin-mono-tag">PREVIEW MODE</span>
        <h2 className="admin-card-title">Try the new finish</h2>
      </div>
      <div className="admin-card-body space-y-4">
        <p>Sample players and scores. These controls change this preview only.</p>
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
      </div>
    </section>
  );
}
