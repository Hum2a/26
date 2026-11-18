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

function GuessMap({
  editable = false,
  onPin,
  pin,
  target,
  guesses = noPins,
}: {
  editable?: boolean;
  onPin?: (pin: MapPin) => void;
  pin?: MapPin;
  target?: MapPin;
  guesses?: MapPin[];
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
      zoomSnap: 0.5,
      maxBounds: [
        [-85, -180],
        [85, 180],
      ],
      maxBoundsViscosity: 1,
      zoomAnimation: false,
      fadeAnimation: false,
      markerZoomAnimation: false,
    }).setView([18, 0], 0.5);
    instance.current = board;
    board.attributionControl.setPrefix(false).addAttribution("Natural Earth");
    markers.current = layerGroup().addTo(board);
    const resize = new ResizeObserver(() => board.invalidateSize({ pan: false }));
    resize.observe(element.current);
    let active = true;
    void loadWorld()
      .then((data) => {
        if (!active) return;
        const places = geoJSON(data, {
          style: { color: "#507485", fillColor: "#c5d9c2", fillOpacity: 1, weight: 1 },
          interactive: false,
          pointToLayer: (feature, position) =>
            circleMarker(position, {
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
        setReady(true);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
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
      onPin?.({
        lat: Math.max(-85, Math.min(85, event.latlng.lat)),
        lng: Math.max(-180, Math.min(180, event.latlng.lng)),
      });
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
        fillOpacity: 0.7,
        interactive: false,
      }).addTo(group);
    }
    if (pin)
      circleMarker(pin, {
        radius: 8,
        color: "#12459b",
        fillOpacity: 1,
        interactive: false,
      }).addTo(group);
    if (target)
      circleMarker(target, {
        radius: 11,
        color: "#9c2343",
        fillOpacity: 1,
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
    <div>
      <div
        ref={element}
        className="guess-map"
        role="region"
        aria-label={target ? "Location reveal map" : "Guessing map"}
      />
      {failed ? (
        <p role="alert">
          The map did not load.{" "}
          <button
            type="button"
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
          onClick={() => {
            const centre = instance.current?.getCenter();
            if (centre) onPin?.({ lat: centre.lat, lng: centre.lng });
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
