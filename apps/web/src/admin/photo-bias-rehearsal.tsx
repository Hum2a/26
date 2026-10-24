import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "../ui/primitives";
import { clientApiHeaders } from "../api/client-key";
import { compactJpeg } from "../media/photo-prepare";

/** Uses the real authenticated processor, without saving an upload or a room action. */
export function PhotoBiasRehearsal() {
  const [pictures, setPictures] = useState<{ clean: string; rough: string }>();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const controller = useRef<AbortController | null>(null);
  const urls = useRef<string[]>([]);
  useEffect(
    () => () => {
      const request = controller.current;
      controller.current = null;
      request?.abort();
      urls.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );
  async function preview() {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setBusy(true);
    setNotice("");
    const timeout = window.setTimeout(() => request.abort(), 15_000);
    try {
      const source = await fetch("/assets/questions/favourite-pokemon/turtwig.png", {
        signal: request.signal,
      });
      if (!source.ok) throw new Error();
      const cleanSource = await compactJpeg(
        new File([await source.blob()], "sample.png", { type: "image/png" }),
      );
      const results = await Promise.all(
        (["clean", "rough"] as const).map(async (treatment) => {
          const response = await fetch(
            `/api/admin/media/photo-preview?treatment=${treatment}`,
            {
              method: "POST",
              credentials: "same-origin",
              cache: "no-store",
              headers: clientApiHeaders({ "content-type": "image/jpeg" }),
              body: cleanSource,
              signal: request.signal,
            },
          );
          if (!response.ok) throw new Error();
          return response.blob();
        }),
      );
      if (request.signal.aborted) return;
      urls.current.forEach((url) => URL.revokeObjectURL(url));
      urls.current = results.map((blob) => URL.createObjectURL(blob));
      setPictures({ clean: urls.current[0]!, rough: urls.current[1]! });
      setNotice("Sample only — nothing was saved or sent to guests.");
    } catch {
      if (controller.current === request)
        setNotice("Could not prepare the sample. Check your connection and try again.");
    } finally {
      window.clearTimeout(timeout);
      if (controller.current === request) setBusy(false);
    }
  }
  return (
    <section aria-label="Photo bias rehearsal">
      <p>
        Compare the actual clean and rough processing with a stand-in image. No guest is
        needed.
      </p>
      <Button variant="secondary" disabled={busy} onClick={() => void preview()}>
        {busy ? "Preparing sample…" : "Rehearse photo bias"}
      </Button>
      <p role="status">{notice}</p>
      <AnimatePresence>
        {pictures ? (
          <motion.div
            className="grid grid-cols-2 gap-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <figure>
              <img src={pictures.clean} alt="Clean Android sample" />
              <figcaption>Android / clean copy</figcaption>
            </figure>
            <figure>
              <img src={pictures.rough} alt="Rough iPhone sample" />
              <figcaption>iPhone display treatment</figcaption>
            </figure>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
