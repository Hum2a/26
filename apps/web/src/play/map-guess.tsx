import { useEffect, useRef, useState } from "react";
import {
  circleMarker,
  geoJSON,
  latLngBounds,
  layerGroup,
  map,
  type Map as LeafletMap,
} from "leaflet";
import { pinDistanceKm, type MapPin, type PlaySnapshot } from "@26/shared";
import { SubmitButton } from "./controls/SubmitButton";
import { roundSubmitState } from "./controls/submit-state";
import "leaflet/dist/leaflet.css";
import "./map-guess.css";
import { loadWorld } from "./map-guess-world";

const noPins: MapPin[] = [];
const tapJitterPx = 6;

/** Keep map coordinates inside valid Mercator bounds after panning or zooming. */
function clampMapPin(lat: number, lng: number): MapPin {
  const clampedLat = Math.max(-85, Math.min(85, lat));
  let wrappedLng = lng;
  if (wrappedLng > 180 || wrappedLng < -180) {
    wrappedLng = ((((wrappedLng + 180) % 360) + 360) % 360) - 180;
  }
  const clampedLng = Math.max(-180, Math.min(180, wrappedLng));
  return { lat: clampedLat, lng: clampedLng };
}

export function GuessMap({
  editable = false,
  onPin,
  pin,
  target,
  guesses = noPins,
  className,
}: {
  editable?: boolean;
  onPin?: (pin: MapPin) => void;
  pin?: MapPin;
  target?: MapPin;
  guesses?: MapPin[];
  className?: string;
}) {
  const element = useRef<HTMLDivElement>(null);
  const instance = useRef<LeafletMap>(null);
  const markers = useRef<ReturnType<typeof layerGroup>>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!element.current) return;
    const board = map(element.current, {
      minZoom: 0,
      maxZoom: 8,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      wheelPxPerZoomLevel: 80,
      bounceAtZoomLimits: false,
      worldCopyJump: false,
      inertia: true,
      inertiaDeceleration: 2800,
      inertiaMaxSpeed: 3500,
      // Instant zoom avoids Leaflet's CSS zoom hitch; pan still uses transforms.
      zoomAnimation: false,
      fadeAnimation: false,
      markerZoomAnimation: false,
      maxBounds: [
        [-85, -180],
        [85, 180],
      ],
      maxBoundsViscosity: 1,
    }).setView([18, 0], 0.5);
    instance.current = board;
    const container = board.getContainer();
    container.style.touchAction = "none";
    container.style.overscrollBehavior = "none";

    let touchOrigin: { x: number; y: number } | null = null;
    function onTouchStart(event: TouchEvent) {
      if (event.touches.length === 1) {
        const touch = event.touches[0];
        touchOrigin = touch ? { x: touch.clientX, y: touch.clientY } : null;
      } else {
        touchOrigin = null;
      }
    }
    function onTouchMove(event: TouchEvent) {
      if (!event.cancelable) return;
      // Always lock multi-touch pinch so iOS Safari never zooms or rubber-bands the page.
      if (event.touches.length > 1) {
        event.preventDefault();
        return;
      }
      // Keep tiny single-finger jitter from suppressing iOS Safari's synthetic tap click.
      const touch = event.touches[0];
      if (!touchOrigin || !touch) {
        event.preventDefault();
        return;
      }
      if (
        Math.hypot(touch.clientX - touchOrigin.x, touch.clientY - touchOrigin.y) >
        tapJitterPx
      ) {
        event.preventDefault();
      }
    }
    function clearTouchOrigin() {
      touchOrigin = null;
    }
    function blockGesture(event: Event) {
      if (event.cancelable) event.preventDefault();
    }
    function blockCtrlWheel(event: WheelEvent) {
      if (event.ctrlKey && event.cancelable) event.preventDefault();
    }

    container.addEventListener("touchstart", onTouchStart, { passive: true });
    container.addEventListener("touchmove", onTouchMove, { passive: false });
    container.addEventListener("touchend", clearTouchOrigin, { passive: true });
    container.addEventListener("touchcancel", clearTouchOrigin, { passive: true });
    container.addEventListener("gesturestart", blockGesture, { passive: false });
    container.addEventListener("gesturechange", blockGesture, { passive: false });
    container.addEventListener("wheel", blockCtrlWheel, { passive: false });

    board.attributionControl.setPrefix(false).addAttribution("Natural Earth");
    markers.current = layerGroup().addTo(board);
    const resize = new ResizeObserver(() => board.invalidateSize({ pan: false }));
    resize.observe(element.current);
    let active = true;
    // Pinning uses the Leaflet view, not the landmass layer. Wait only for the map
    // instance so the centre control is available while world.geojson is still loading.
    setReady(true);
    void loadWorld()
      .then((data) => {
        if (!active) return;
        const places = geoJSON(data, {
          style: {
            className: "guess-map-land",
            color: "#507485",
            fillColor: "#c5d9c2",
            fillOpacity: 1,
            weight: 1,
          },
          interactive: false,
          pointToLayer: (feature, position) =>
            circleMarker(position, {
              className: "guess-map-city-dot",
              radius: feature.properties?.country ? 0 : 2,
              stroke: false,
              fillColor: "#213e48",
              fillOpacity: 1,
              interactive: false,
            }),
          onEachFeature: (feature, layer) => {
            const name: unknown = feature.properties?.name;
            if (feature.geometry.type !== "Point" || typeof name !== "string") return;
            const label = document.createElement("span");
            label.textContent = name;
            const country = feature.properties?.country === true;
            layer.bindTooltip(label, {
              permanent: true,
              interactive: false,
              direction: country ? "center" : "right",
              className: country
                ? "guess-map-label guess-map-country"
                : "guess-map-label guess-map-city",
            });
          },
        }).addTo(board);
        function labels() {
          const { classList } = board.getContainer();
          classList.toggle("guess-map-show-countries", board.getZoom() >= 2);
          classList.toggle("guess-map-show-cities", board.getZoom() >= 3.5);
        }
        board.on("zoomend", labels);
        places.bringToBack();
        labels();
      })
      .catch(() => {
        if (active) {
          setReady(false);
          setFailed(true);
        }
      });
    return () => {
      active = false;
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchmove", onTouchMove);
      container.removeEventListener("touchend", clearTouchOrigin);
      container.removeEventListener("touchcancel", clearTouchOrigin);
      container.removeEventListener("gesturestart", blockGesture);
      container.removeEventListener("gesturechange", blockGesture);
      container.removeEventListener("wheel", blockCtrlWheel);
      resize.disconnect();
      board.remove();
      instance.current = null;
      markers.current = null;
    };
  }, [attempt]);
  useEffect(() => {
    const board = instance.current;
    if (!board || !editable || !onPin || !ready) return;
    function select(event: { latlng: { lat: number; lng: number } }) {
      onPin?.(clampMapPin(event.latlng.lat, event.latlng.lng));
    }
    board.on("click", select);
    return () => {
      board.off("click", select);
    };
  }, [attempt, editable, onPin, ready]);
  useEffect(() => {
    const group = markers.current;
    if (!group) return;
    group.clearLayers();
    for (const guess of guesses) {
      circleMarker(guess, {
        radius: 4,
        color: "#294c7e",
        fillColor: "#6db3ff",
        fillOpacity: 0.78,
        weight: 1.5,
        interactive: false,
      }).addTo(group);
    }
    if (pin)
      circleMarker(pin, {
        radius: 8,
        color: "#12459b",
        fillColor: "#4f9cff",
        fillOpacity: 0.95,
        weight: 3,
        interactive: false,
      }).addTo(group);
    if (target)
      circleMarker(target, {
        radius: 11,
        color: "#9c2343",
        fillColor: "#ff4f7b",
        fillOpacity: 0.95,
        weight: 3,
        interactive: false,
      }).addTo(group);
  }, [attempt, guesses, pin, target]);
  useEffect(() => {
    const board = instance.current;
    if (!board || !ready || !target) return;
    const points = [target, ...guesses, ...(pin ? [pin] : [])];
    const bounds = latLngBounds(points.map(({ lat, lng }) => [lat, lng]));
    board.fitBounds(bounds, { padding: [26, 26], maxZoom: 5, animate: false });
  }, [guesses, pin, ready, target]);
  return (
    <div className={className ? `guess-map-shell ${className}` : "guess-map-shell"}>
      <div className="guess-map-frame">
        <div
          ref={element}
          className="guess-map"
          role="region"
          aria-label={target ? "Location reveal map" : "Guessing map"}
        />
        {editable && ready ? (
          <span className="guess-map-reticle" aria-hidden="true" />
        ) : null}
      </div>
      {failed ? (
        <p role="alert" className="guess-map-error">
          The map did not load.{" "}
          <button
            type="button"
            className="guess-map-retry"
            onClick={() => {
              setFailed(false);
              setReady(false);
              setAttempt(attempt + 1);
            }}
          >
            Try again
          </button>
        </p>
      ) : null}
      {editable && ready ? (
        <button
          type="button"
          className="guess-map-centre motion-press"
          onClick={() => {
            const centre = instance.current?.getCenter();
            if (centre) onPin?.(clampMapPin(centre.lat, centre.lng));
          }}
        >
          Place pin at map centre
        </button>
      ) : null}
    </div>
  );
}

export function GuestMapGuess({
  play,
  open,
  pending,
  onSubmit,
}: {
  play: PlaySnapshot;
  open: boolean;
  pending: boolean;
  onSubmit?: (pin: MapPin) => void;
}) {
  const [draft, setDraft] = useState<MapPin>();
  const accepted =
    play.selfAnswer?.kind === "map-guess" ? play.selfAnswer.pin : undefined;
  const reveal = play.reveal?.kind === "map-guess" ? play.reveal : undefined;
  const pin = reveal ? accepted : (accepted ?? draft);
  return (
    <>
      {reveal ? (
        <p>
          {reveal.label}
          {accepted
            ? ` · Your pin was ${pinDistanceKm(accepted, reveal.target).toLocaleString("en-GB", { maximumFractionDigits: 1 })} km away.`
            : ""}
        </p>
      ) : null}
      <GuessMap
        pin={pin}
        target={reveal?.target}
        editable={open && !pending && !accepted}
        onPin={setDraft}
      />
      {pin && !reveal ? (
        <p aria-live="polite">
          Pin at {pin.lat.toFixed(2)}°, {pin.lng.toFixed(2)}°
        </p>
      ) : null}
      {(open || pending || accepted) && !reveal ? (
        <SubmitButton
          label="Send pin"
          state={roundSubmitState(Boolean(accepted), pending)}
          disabled={!pin}
          onClick={() => {
            if (open && pin && !accepted) onSubmit?.(pin);
          }}
        />
      ) : null}
    </>
  );
}

export function StageMapGuess({ play }: { play: PlaySnapshot }) {
  const reveal = play.reveal?.kind === "map-guess" ? play.reveal : undefined;
  return (
    <section className="stage-map-guess">
      <h2>{reveal?.label ?? play.question.prompt}</h2>
      {reveal ? (
        <>
          <GuessMap target={reveal.target} guesses={reveal.pins} />
          <p>Pink shows the location · blue shows guest pins</p>
          {reveal.closest.length ? (
            <ol aria-label="Closest pins">
              {reveal.closest.map(({ nickname, distanceKm }, index) => (
                <li key={index}>
                  {nickname} ·{" "}
                  {distanceKm.toLocaleString("en-GB", { maximumFractionDigits: 1 })} km
                  away
                </li>
              ))}
            </ol>
          ) : null}
        </>
      ) : (
        <p>
          {play.submissionCount} {play.submissionCount === 1 ? "pin" : "pins"} sent
        </p>
      )}
    </section>
  );
}
