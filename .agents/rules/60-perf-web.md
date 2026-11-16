---
description: Render budgets, memoisation, layout, perceived performance, phone UX
trigger: glob
globs:
  - apps/web/**/*.ts
  - apps/web/**/*.tsx
  - apps/web/**/*.css
---

# Web rendering and phone UX

Target: mid-range Android/iPhone on venue Wi-Fi. A question, lobby, or score beat must stay at **60 fps** when the phone is idle-to-tapping, and must not drop the tap-to-paint of the send control below one frame. The projector follows the same rule with larger type.

## State placement and re-renders

Put **high-frequency values in refs**, not in React state. Kart pose, clock remainder, pointer position, and Stockfish search flags update too often to re-render the tree.

```tsx
// ❌ BAD — every race tick rebuilds React
function Hud({ race }: { race: KartRaceView }) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 50);
    return () => clearInterval(id);
  }, []);
  return <p>{now}</p>;
}

// ✅ GOOD — KartCanvas already keeps `live.current = race` and draws in rAF
useEffect(() => {
  live.current = race;
}, [race]);
```

Good pattern: `apps/web/src/kart/KartCanvas.tsx` (refs + rAF). Good pattern: `applySnapshotPatch` in `apps/web/src/live/room-socket.ts` keeps unchanged snapshot field identities so a clock patch does not redraw every player and option.

```tsx
// ❌ BAD — new object/function every snapshot, even when play is unchanged
<GuestPlay snapshot={snapshot} onSubmit={() => submit()} />;

// ✅ GOOD — stable handlers; split context so a kart frame does not refresh the dock
const onSubmit = useCallback(
  () => socket.submitAnswer(selectedId),
  [socket, selectedId],
);
```

Do not lift the whole `LobbySnapshot` through a provider that wraps chrome + question + trolls + media. Split by change rate: connection, play, self answer, trolls.

`memo` is for **lists of 80** (name cloud, standings, wall) and for round controls whose parent updates on patches. It is not a default wrapper for every file.

## Layout thrash

Do not read layout and write style in the same frame (`offsetWidth` then `style.left`, `getBoundingClientRect` in render, `scrollHeight` loops). Animate with Motion / CSS transforms, not top/left. Reserve space for images, avatars, and the phone dock so options do not jump (CLS).

```css
/* ❌ BAD */
.option img {
  height: auto;
}

/* ✅ GOOD — question option images have a known box before decode */
.option img {
  aspect-ratio: 1;
  width: 100%;
  height: auto;
}
```

Good pattern: `preloadImages` / `usePreloadQuestion` in `apps/web/src/play/preload.ts` fetch the **current** question’s pictures during intro, not the rest of the pack.

## Perceived performance

- Press, select, and send must change paint in the same gesture. Pending vs accepted stays distinct; never label a local tap “locked in”.
- Route and round `Suspense` fallbacks are real chrome (status text in the question frame), not a blank screen.
- Reconnect copy lives in `ReconnectBanner`: keep retrying, tell the guest after 1.5s, offer a manual retry later. Do not block the last known question behind a full-screen spinner.
- Honour `prefers-reduced-motion`. Loops, parallax, and layout travel belong off the answering controls.

## Touch and readability

- Primary hit targets stay large (existing dock and option tiles). `touch-action: manipulation` on tap controls so iOS does not wait for a double-tap zoom.
- Check 320 / 390 / 430px widths, safe areas, and a short landscape viewport. Do not shrink essential text to avoid scrolling; scroll vertically rather than clip.
- Do not `preventDefault` on `touchmove` unless you are the kart stick, and then only on that element.
- Projector type stays readable across a room. Secrets, host diagnostics, and answer keys never render on `/screen`.

## Lists of eighty

Keys are stable player ids, never array index. Do not run `layout` / `popLayout` animations on every tick for the full lobby. Name-cloud springs on **join/leave** are fine; animating size of all 80 bubbles every like-patch is not.

```tsx
// ❌ BAD — new array + index keys on every snapshot
names.map((name, i) => <li key={i}>{name.nickname}</li>)

// ✅ GOOD — NameCloud keys `name.playerId` and uses AnimatePresence for enter/exit
<CloudItem key={name.playerId} layout={!reduced ? "position" : false} />
```

## Effects, listeners, leaks

Every `addEventListener`, socket, `setTimeout`, rAF, `Worker`, `AudioContext`, wake lock, and `getUserMedia` stream is cleared in the same effect’s teardown. Do not subscribe in render. `openRoomSocket` already drops heartbeats and window listeners on close — call `close()` on unmount.

```tsx
// ❌ BAD
useEffect(() => {
  const engine = new StockfishEngine();
  void engine.initialize();
}, []);

// ✅ GOOD — chess-game must terminate the engine when the round or page goes away
useEffect(() => {
  const engine = new StockfishEngine({ onBestMove });
  void engine.initialize();
  return () => engine.terminate();
}, []);
```
