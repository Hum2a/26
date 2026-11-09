# Additional kart course audit

7 November 2026. Part of Phase8; current verification lives in the checkpoint and build progress.

The pinned original and fork both inventory `public/models/track-transformed.glb`
as git blob `a8fa36852395c711b5a869edaee229a2051cdc22`,1797320 bytes.
Downloaded the [pinned original asset](https://github.com/mustache-dev/Mario-Kart-3.js/blob/83c3a8bb5aeab18b3d5f13084c5fba4a99cb78f7/public/models/track-transformed.glb)
into ignored local check output and verified its actual git-blob hash before inspecting
its GLB JSON geometry metadata:10 mesh nodes,10 meshes and10 materials, with Draco
compression and position accessor counts/bounds. The installed retained circuit is
1808888 bytes, also10 nodes/meshes. Those counts do not establish identical geometry,
a new playable route or media permission. This was a metadata inspection, not a claim
of having decoded and visually certified every triangle.

There is no corresponding alternate route, grid, collision, recovery, item or course
manifest in this app. Do not install that asset as a finished course or infer media
rights from its code repository. It remains an inspected, uninstalled alternate asset;
the new course uses original procedural geometry. Exact audit output, hashes,
accessor bounds and source URL are in `artifacts/phase8-park/alternate-audit.json`.

## Original 26 Park

`packages/shared/src/kart/kart-park.ts` defines a24m-wide closed road with40m sweeping
bends, two broad straights and a gentle S section. A single mitered ribbon supplies
the rendered road, SVG map, road classification and swept-collision boundaries.
The existing pure driving, ordered lap cursor, recovery, item and projection code
handles this course; no second physics, score or socket system was introduced.

There are80 five-column grid slots,18 item boxes, eight ordered sectors and optional
boost/ramp/sweeper lanes. The start grid stays on the straight before the finish line.
The same public route drives map guidance and bounded homing. Geometry has no network
model dependency. Existing approved karts and the shared theme palette still render it.

Admin → Kart → Tracks & modes selects any slot, actual recovery or the finite
three-second driving sample with the real map and optional3D renderer. All actors
are labelled stand-ins, all sample scores are zero and no room is created or changed.
Kart-only lobbies now offer all three courses in Live controls before Start, with
receipted selection, bounded host history and a room-owned script version. Start
freezes that choice; released question files and underway races stay unchanged.
The public contract accepts Park, with HTTP/WS course capability2: older readers
receive a refresh response before incompatible data. The isolated connected Park
journey passed; the current full verification status is in the checkpoint.
Public Park free drive/time trials remain pending and are labelled accordingly.
