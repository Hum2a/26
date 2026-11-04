import { useEffect, useRef, useState } from "react";
import { Button, Disclosure } from "../ui/primitives";
import { EntryNotice } from "../ui/entry-frame";
import { useSection } from "./use-section";
import { readKartAssets } from "./sections-api";
import { checkKartAssets, type AssetCheck } from "../kart/asset-readiness";
import { graphicsProfiles } from "../kart/graphics";

/** Checks stay in this browser; they do not start a room or report guest readiness. */
export function KartAssetsPanel() {
  const manifest = useSection(readKartAssets);
  const [checks, setChecks] = useState<AssetCheck[]>([]);
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const active = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      const controller = active.current;
      active.current = null;
      controller?.abort();
    },
    [],
  );
  async function check() {
    const data = manifest.data;
    if (!data || running || active.current || manifest.error) return;
    const controller = new AbortController();
    active.current = controller;
    setRunning(true);
    setChecks([]);
    const timer = window.setTimeout(() => controller.abort(), 30_000);
    let verified = 0;
    try {
      await checkKartAssets(data, controller.signal, (value) => {
        if (value.status === "verified") verified++;
        setChecks((old) => [...old, value]);
      });
    } finally {
      window.clearTimeout(timer);
      if (active.current === controller) {
        setHistory((old) =>
          [
            `${new Date().toLocaleTimeString("en-GB")} · ${controller.signal.aborted ? "Stopped or timed out" : "Finished"} · ${verified}/${data.assets.length} files verified on this browser`,
            ...old,
          ].slice(0, 5),
        );
        setRunning(false);
        active.current = null;
      }
    }
  }
  return (
    <section className="admin-kart-pane" aria-label="Kart asset readiness">
      <h2>Files and render limits</h2>
      <p>
        Check this browser’s access to the installed files. A verified download confirms
        size and SHA-256, not GPU decoding or a phone’s performance. Start driving in
        the real circuit below to test loading and rendering.
      </p>
      <EntryNotice message={manifest.error} />
      <div className="admin-kart-views">
        <Button
          disabled={running || !manifest.data || Boolean(manifest.error)}
          onClick={() => void check()}
        >
          Check kart files
        </Button>
        <Button
          variant="secondary"
          disabled={!running}
          onClick={() => active.current?.abort()}
        >
          Stop file check
        </Button>
        <Button
          variant="secondary"
          disabled={running || manifest.loading}
          onClick={() => {
            setChecks([]);
            void manifest.refresh();
          }}
        >
          Refresh asset inventory
        </Button>
      </div>
      <p role="status">
        {running
          ? `Checking ${checks.length}/${manifest.data?.assets.length ?? 0} files…`
          : manifest.loading
            ? "Loading asset inventory…"
            : manifest.data
              ? `${manifest.data.version} · ${manifest.data.assets.length} files · ${manifest.data.assets.reduce((n, a) => n + a.textures.length, 0)} embedded textures · no kart audio installed`
              : "Asset inventory unavailable"}
      </p>
      {manifest.error && manifest.data ? (
        <p>
          The last loaded inventory may be out of date. Refresh it before checking
          files.
        </p>
      ) : null}
      {manifest.data?.assets.map((asset) => (
        <div key={asset.id} className="admin-task-section admin-kart-asset">
          <h3>{asset.usage}</h3>
          <p>
            {asset.path} · {asset.bytes.toLocaleString("en-GB")} bytes
          </p>
          <p>
            {checks.find((c) => c.id === asset.id)?.detail ??
              "Not checked on this browser"}
          </p>
          <Disclosure title="Fingerprint and embedded textures">
            <code>{asset.sha256}</code>
            <ul>
              {asset.textures.map((texture) => (
                <li key={texture.id}>
                  {texture.id} · {texture.mimeType} · {texture.bytes} bytes ·{" "}
                  {texture.sha256}
                </li>
              ))}
            </ul>
          </Disclosure>
          <p>
            <a
              className="entry-text-link"
              href={asset.source}
              target="_blank"
              rel="noreferrer"
            >
              Source
            </a>{" "}
            ·{" "}
            <a
              className="entry-text-link"
              href={asset.notice}
              target="_blank"
              rel="noreferrer"
            >
              Notices
            </a>{" "}
            · {asset.replacement}
          </p>
        </div>
      ))}
      <h3>Recent checks on this browser</h3>
      {history.length ? (
        <ol>
          {history.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ol>
      ) : (
        <p>No file checks run on this page yet.</p>
      )}
      <h3>Current graphics policy</h3>
      <ul>
        {Object.entries(graphicsProfiles).map(([tier, p]) => (
          <li key={tier}>
            {tier} · pixel ratio cap {p.pixelRatio} · spark stride {p.sparkStride} ·
            scene spark cap {p.sparkLimit} · solo trail cap {p.trailLimit}
          </li>
        ))}
      </ul>
      <p>
        Use Course set-up in the real driving view to compare Auto, High and Low, reset
        practice and switch optional course features off. Connected clients can return
        to Map view if the circuit fails; solo shows an honest retry.
      </p>
    </section>
  );
}
