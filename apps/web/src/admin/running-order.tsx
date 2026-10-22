import { useRef, useState } from "react";
import { Link } from "react-router";
import { MotionConfig, Reorder, useDragControls, useReducedMotion } from "motion/react";
import type { AdminContent, BirthdayOrder } from "@26/shared";
import { Button, Disclosure, TextField } from "../ui/primitives";
import { saveRunningOrder } from "./sections-api";

type Pack = AdminContent["packs"][number];
export function RunningOrder({ pack, onSaved }: { pack: Pack & { runningOrder: BirthdayOrder }; onSaved?: () => void }) {
  const [saved, setSaved] = useState(pack.runningOrder);
  const [ids, setIds] = useState(saved.ids);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const pending = useRef<{ requestId: string; expectedRevision: number; ids: string[] } | null>(null);
  const byId = new Map(pack.questions.map(q => [q.id, q]));
  const dirty = JSON.stringify(ids) !== JSON.stringify(saved.ids);
  const available = pack.questions.filter(q => !ids.includes(q.id) && q.status === "ready" && `${q.title} ${q.mechanic}`.toLocaleLowerCase("en-GB").includes(query.toLocaleLowerCase("en-GB")));
  async function save() {
    if (busy || !dirty || !ids.length) return;
    const signature = JSON.stringify(ids);
    if (!pending.current || JSON.stringify(pending.current.ids) !== signature || pending.current.expectedRevision !== saved.revision) pending.current = { requestId: crypto.randomUUID(), expectedRevision: saved.revision, ids: [...ids] };
    setBusy(true); setNotice("");
    const result = await saveRunningOrder(pending.current);
    setBusy(false);
    if ("error" in result) { setNotice(result.error); return; }
    setSaved(result); pending.current = null; setNotice("Running order saved. Existing games keep their original order."); onSaved?.();
  }
  function move(index: number, to: number) { const next = [...ids]; const [id] = next.splice(index, 1); next.splice(to, 0, id!); setIds(next); }
  return <section className="running-order" aria-label="Birthday running order">
    <header className="running-order-heading"><div><h2>Running order</h2><p>{ids.length} rounds · revision {saved.revision}{dirty ? " · Unsaved changes" : " · Saved"}</p></div>
      <div className="running-order-actions"><Button variant="secondary" disabled={busy || !dirty} onClick={() => { setIds(saved.ids); pending.current = null; setNotice(""); }}>Discard changes</Button>
      <Button disabled={busy || !dirty || !ids.length} onClick={() => void save()}>{busy ? "Saving…" : "Save running order"}</Button></div>
    </header>
    <p className="running-order-help">Drag a handle or use the move buttons. New birthday games use this order.</p>
    <p role="status" className="admin-meta">{notice}</p>
    <MotionConfig reducedMotion="user"><Reorder.Group axis="y" values={ids} onReorder={next => { if (!busy) setIds(next); }} className="running-order-list" aria-label="Ordered rounds">
      {ids.map((id, index) => <OrderRow key={id} id={id} index={index} total={ids.length} title={byId.get(id)?.title ?? id} mechanic={byId.get(id)?.mechanic ?? "Unavailable"} version={pack.version} disabled={busy} move={to => move(index, to)} remove={() => setIds(ids.filter(value => value !== id))} />)}
    </Reorder.Group></MotionConfig>
    <Disclosure title={`Add a round (${available.length} available)`}>
      <TextField label="Find a round to add" hint="Only completed rounds can join the running order." value={query} onChange={e => setQuery(e.target.value)} />
      <ul className="running-order-available">{available.map(q => <li key={q.id}><span>{q.title}<small>{q.mechanic}</small></span><Button variant="secondary" disabled={busy || ids.length >= 80} onClick={() => setIds([...ids, q.id])}>Add {q.title}</Button></li>)}</ul>
      {pack.questions.some(q => q.status === "draft") ? <p className="admin-meta">Unfinished drafts remain in the catalogue.</p> : null}
    </Disclosure>
    <Disclosure title="Save history"><ol className="admin-meta">{saved.history.length ? saved.history.slice().reverse().map(item => <li key={item.revision}>Revision {item.revision} · {item.count} rounds · {new Date(item.at).toLocaleString("en-GB")}</li>) : <li>Using the versioned default running order.</li>}</ol></Disclosure>
  </section>;
}

function OrderRow({ id, index, total, title, mechanic, version, disabled, move, remove }: { id: string; index: number; total: number; title: string; mechanic: string; version: string; disabled: boolean; move: (index: number) => void; remove: () => void }) {
  const drag = useDragControls();
  const reduced = useReducedMotion();
  return <Reorder.Item value={id} dragListener={false} dragControls={drag} drag={!disabled ? "y" : false} transition={{ duration: reduced ? 0.1 : 0.18, ease: "easeOut" }} className="running-order-row">
    <button type="button" className="order-handle" aria-label={`Drag ${title}`} disabled={disabled} onPointerDown={event => { if (!disabled) drag.start(event); }}>⠿</button>
    <span className="order-number">{String(index + 1).padStart(2, "0")}</span>
    <Link className="order-title" to={`/admin/content/${encodeURIComponent(version)}/${encodeURIComponent(id)}`}><strong>{title}</strong><small>{mechanic}{id === "kart-sprint" ? " · Up to 80 racers · Grid by quiz score" : ""}</small></Link>
    <div className="order-row-actions"><button type="button" disabled={disabled || index === 0} aria-label={`Move ${title} up`} onClick={() => move(index - 1)}>↑</button><button type="button" disabled={disabled || index === total - 1} aria-label={`Move ${title} down`} onClick={() => move(index + 1)}>↓</button><button type="button" disabled={disabled || index === total - 1} aria-label={`Move ${title} to end`} onClick={() => move(total - 1)}>To end</button><button type="button" disabled={disabled} aria-label={`Remove ${title} from running order`} onClick={remove}>Remove</button></div>
  </Reorder.Item>;
}
