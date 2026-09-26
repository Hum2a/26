import "./caution-tape.css";

const unit = "COMING SOON · 近日公開 · COMING SOON · ";
const marquee = unit.repeat(4);

export function CautionTape() {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return (
    <div data-force-reduced-motion={reduce ? "true" : undefined}>
      <div className="coming-soon-tape" aria-hidden="true">
        <div className="coming-soon-tape__edge coming-soon-tape__edge--top" />
        <div className="coming-soon-tape__band">
          <div
            className="coming-soon-tape__track"
            style={reduce ? { animation: "none" } : undefined}
          >
            <span className="coming-soon-tape__text">{marquee}</span>
            <span className="coming-soon-tape__text" aria-hidden="true">
              {marquee}
            </span>
          </div>
        </div>
        <div className="coming-soon-tape__edge coming-soon-tape__edge--bottom" />
      </div>
    </div>
  );
}
