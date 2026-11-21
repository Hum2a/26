# Lines of code report

Generated: 2026-11-21T11:11:25.196Z

Excludes `node_modules`, build outputs (`dist`, `.wrangler`, `.vite`, `kart-engine`), vendored engines (`draco`, `chess-engine`), lockfiles, secret env files, and this report. Generated types/data (`worker-configuration.d.ts`, `validity-words.ts`, `kart-circuit.json`, etc.) are separated into **Generated & Data** so handwritten totals remain exact.

- **Handwritten Code:** 203,104 LOC across 1,204 files
- **Test-to-App Ratio:** 0.53x (67,897 test LOC vs 127,054 app LOC)
- **App File Size:** avg 205 LOC · median 105 LOC · p90 443 LOC · max 5,702 LOC

## Overview by role

| Role | Files | Code | Comment | Blank | Total | Share | Avg LOC | Size |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| App (Production) | 620 | 127,054 | 3,987 | 5,104 | 136,145 | 62.6% | 205 | 3.97 MB |
| Content (Question Packs) | 93 | 2,343 | 80 | 100 | 2,523 | 1.2% | 25 | 97.3 KB |
| Tests & E2E | 449 | 67,897 | 996 | 3,395 | 72,288 | 33.4% | 151 | 2.47 MB |
| Tooling & Scripts | 42 | 5,810 | 85 | 534 | 6,429 | 2.9% | 138 | 193.6 KB |
| **Handwritten Code Subtotal** | 1,204 | 203,104 | 5,148 | 9,133 | 217,385 | 100.0% | 169 | 6.72 MB |
| Config & CI | 35 | 1,882 | 62 | 49 | 1,993 | 0.4% | 54 | 65.0 KB |
| Generated & Data | 14 | 208,601 | 7,829 | 8 | 216,438 | 48.5% | 14,900 | 6.24 MB |
| Documentation | 106 | 16,845 | 3 | 6,946 | 23,794 | 3.9% | 159 | 2.28 MB |
| **Repository Total** | 1,359 | 430,432 | 13,042 | 16,136 | 459,610 | 100.0% | 317 | 15.30 MB |

## Workspaces

| Workspace | Files | App | Content | Test | Tool/Cfg | Code | Share | Avg |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `apps/web` | 701 | 74,354 | 0 | 32,193 | 536 | 107,083 | 52.2% | 153 |
| `apps/api` | 388 | 37,848 | 2,343 | 33,595 | 520 | 74,306 | 36.2% | 192 |
| `packages/shared` | 54 | 10,698 | 0 | 0 | 35 | 10,733 | 5.2% | 199 |
| `scripts` | 55 | 0 | 0 | 2,109 | 5,659 | 7,768 | 3.8% | 141 |
| `apps/kart-solo` | 23 | 3,767 | 0 | 0 | 54 | 3,821 | 1.9% | 166 |
| `root` | 13 | 0 | 0 | 0 | 631 | 631 | 0.3% | 49 |
| `packages/emails` | 3 | 387 | 0 | 0 | 39 | 426 | 0.2% | 142 |
| `.agents` | 1 | 0 | 0 | 0 | 183 | 183 | 0.1% | 183 |
| `.github` | 1 | 0 | 0 | 0 | 35 | 35 | 0.0% | 35 |
| **TOTAL** | 1,239 | 127,054 | 2,343 | 67,897 | 7,692 | 204,986 | 100.0% | 165 |

## Cross-stack features (handwritten code)

| Feature | Files | App | Content | Test | Tool/Cfg | Code | Share | Avg |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `kart` | 278 | 25,424 | 0 | 18,927 | 599 | 44,950 | 22.1% | 162 |
| `room & realtime` | 182 | 21,443 | 0 | 13,140 | 0 | 34,583 | 17.0% | 190 |
| `play & questions` | 171 | 24,276 | 0 | 9,311 | 0 | 33,587 | 16.5% | 196 |
| `developer, perf & tooling` | 96 | 2,618 | 0 | 7,420 | 5,211 | 15,249 | 7.5% | 159 |
| `admin console` | 90 | 10,544 | 0 | 4,500 | 0 | 15,044 | 7.4% | 167 |
| `themes & ui` | 58 | 13,677 | 0 | 878 | 0 | 14,555 | 7.2% | 251 |
| `stats, results & archive` | 40 | 8,856 | 0 | 2,809 | 0 | 11,665 | 5.7% | 292 |
| `media, wall & devices` | 72 | 6,940 | 0 | 3,887 | 0 | 10,827 | 5.3% | 150 |
| `chess` | 45 | 5,265 | 0 | 3,588 | 0 | 8,853 | 4.4% | 197 |
| `trolls & sabotage` | 44 | 5,706 | 0 | 2,283 | 0 | 7,989 | 3.9% | 182 |
| `auth & security` | 35 | 2,305 | 0 | 1,154 | 0 | 3,459 | 1.7% | 99 |
| `question packs` | 93 | 0 | 2,343 | 0 | 0 | 2,343 | 1.2% | 25 |
| **TOTAL** | 1,204 | 127,054 | 2,343 | 67,897 | 5,810 | 203,104 | 100.0% | 169 |

## Granular areas (handwritten code)

| Area | Files | App | Content | Test | Tool/Cfg | Code | Share | Avg |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `apps/api/test` | 160 | 0 | 0 | 33,595 | 0 | 33,595 | 16.5% | 210 |
| `apps/web/src/admin` | 118 | 12,785 | 0 | 5,300 | 0 | 18,085 | 8.9% | 153 |
| `apps/web/src/kart` | 123 | 11,731 | 0 | 6,041 | 0 | 17,772 | 8.8% | 144 |
| `apps/api/src/room` | 28 | 11,892 | 0 | 0 | 0 | 11,892 | 5.9% | 425 |
| `apps/web/src/play/designs` | 48 | 9,225 | 0 | 1,408 | 0 | 10,633 | 5.2% | 222 |
| `apps/web/src/theme` | 19 | 8,481 | 0 | 408 | 0 | 8,889 | 4.4% | 468 |
| `apps/api/src/questions` | 27 | 8,320 | 0 | 0 | 0 | 8,320 | 4.1% | 308 |
| `scripts` | 54 | 0 | 0 | 2,109 | 5,652 | 7,761 | 3.8% | 144 |
| `apps/web/e2e` | 50 | 0 | 0 | 7,598 | 0 | 7,598 | 3.7% | 152 |
| `apps/web/src/play` | 50 | 5,604 | 0 | 1,961 | 0 | 7,565 | 3.7% | 151 |
| `packages/shared/src/kart` | 30 | 5,366 | 0 | 0 | 0 | 5,366 | 2.6% | 179 |
| `apps/web/src/chess` | 32 | 3,840 | 0 | 1,451 | 0 | 5,291 | 2.6% | 165 |
| `apps/web/src/ui` | 30 | 4,692 | 0 | 247 | 0 | 4,939 | 2.4% | 165 |
| `apps/web/src/troll` | 32 | 3,529 | 0 | 963 | 0 | 4,492 | 2.2% | 140 |
| `apps/web/src/stage` | 39 | 2,865 | 0 | 1,202 | 0 | 4,067 | 2.0% | 104 |
| `apps/api/src/stats` | 8 | 3,676 | 0 | 0 | 0 | 3,676 | 1.8% | 460 |
| `apps/web/src/guest` | 16 | 2,659 | 0 | 873 | 0 | 3,532 | 1.7% | 221 |
| `packages/shared/src (core)` | 15 | 3,215 | 0 | 0 | 0 | 3,215 | 1.6% | 214 |
| `apps/web/src/live` | 18 | 1,912 | 0 | 922 | 0 | 2,834 | 1.4% | 157 |
| `apps/kart-solo/src` | 13 | 2,657 | 0 | 0 | 0 | 2,657 | 1.3% | 204 |
| `apps/web/src/developer` | 16 | 1,759 | 0 | 810 | 0 | 2,569 | 1.3% | 161 |
| `apps/api/src/troll` | 2 | 2,156 | 0 | 0 | 0 | 2,156 | 1.1% | 1,078 |
| `apps/api/src/questions/packs/birthday` | 82 | 0 | 2,101 | 0 | 0 | 2,101 | 1.0% | 26 |
| `apps/api/src/media` | 11 | 1,853 | 0 | 0 | 0 | 1,853 | 0.9% | 168 |
| `packages/shared/src/trends` | 2 | 1,767 | 0 | 0 | 0 | 1,767 | 0.9% | 884 |
| `apps/api/src/archive` | 6 | 1,496 | 0 | 0 | 0 | 1,496 | 0.7% | 249 |
| `apps/api/src/auth` | 12 | 1,482 | 0 | 0 | 0 | 1,482 | 0.7% | 124 |
| `apps/web/src/wall` | 6 | 1,027 | 0 | 182 | 0 | 1,209 | 0.6% | 202 |
| `apps/api/src/questions/kart` | 2 | 1,171 | 0 | 0 | 0 | 1,171 | 0.6% | 586 |
| `apps/api/src/questions/chess` | 2 | 1,165 | 0 | 0 | 0 | 1,165 | 0.6% | 583 |
| `apps/kart-solo/src/upstream` | 5 | 1,086 | 0 | 0 | 0 | 1,086 | 0.5% | 217 |
| `apps/api/src/wall` | 5 | 1,015 | 0 | 0 | 0 | 1,015 | 0.5% | 203 |
| `apps/web/src/device` | 15 | 562 | 0 | 406 | 0 | 968 | 0.5% | 65 |
| `apps/web/src/media` | 10 | 672 | 0 | 270 | 0 | 942 | 0.5% | 94 |
| `apps/api/src/results` | 5 | 883 | 0 | 0 | 0 | 883 | 0.4% | 177 |
| `apps/api/src/device` | 2 | 811 | 0 | 0 | 0 | 811 | 0.4% | 406 |
| `apps/web/perf` | 2 | 0 | 0 | 774 | 0 | 774 | 0.4% | 387 |
| `apps/api/src/developer` | 2 | 734 | 0 | 0 | 0 | 734 | 0.4% | 367 |
| `apps/web/src (root)` | 9 | 457 | 0 | 245 | 0 | 702 | 0.3% | 78 |
| `apps/web/src/results` | 4 | 542 | 0 | 137 | 0 | 679 | 0.3% | 170 |
| `apps/api/src/credentials` | 7 | 661 | 0 | 0 | 0 | 661 | 0.3% | 94 |
| `apps/web/src/play/controls` | 15 | 512 | 0 | 130 | 0 | 642 | 0.3% | 43 |
| `apps/web/src/anim` | 8 | 325 | 0 | 223 | 0 | 548 | 0.3% | 69 |
| `packages/emails` | 1 | 387 | 0 | 0 | 0 | 387 | 0.2% | 387 |
| `apps/web/src/controller` | 9 | 180 | 0 | 183 | 0 | 363 | 0.2% | 40 |
| `apps/web/src/api` | 7 | 196 | 0 | 148 | 0 | 344 | 0.2% | 49 |
| `apps/web/src/lobby` | 4 | 283 | 0 | 41 | 0 | 324 | 0.2% | 81 |
| `apps/web/src/photo` | 3 | 257 | 0 | 48 | 0 | 305 | 0.2% | 102 |
| `packages/shared/src/chess` | 3 | 260 | 0 | 0 | 0 | 260 | 0.1% | 87 |
| `apps/api/src/questions/packs/demo` | 11 | 0 | 242 | 0 | 0 | 242 | 0.1% | 22 |
| `apps/api/src/room/kart` | 4 | 242 | 0 | 0 | 0 | 242 | 0.1% | 61 |
| `apps/web/src/home` | 3 | 111 | 0 | 74 | 0 | 185 | 0.1% | 62 |
| `apps/web/src/join` | 6 | 123 | 0 | 58 | 0 | 181 | 0.1% | 30 |
| `root` | 2 | 0 | 0 | 0 | 158 | 158 | 0.1% | 79 |
| `apps/api/src/questions/wordle` | 1 | 128 | 0 | 0 | 0 | 128 | 0.1% | 128 |
| `apps/api/src (root)` | 3 | 126 | 0 | 0 | 0 | 126 | 0.1% | 42 |
| `apps/web/test` | 1 | 0 | 0 | 90 | 0 | 90 | 0.0% | 90 |
| `packages/shared/src/wordle` | 1 | 70 | 0 | 0 | 0 | 70 | 0.0% | 70 |
| `apps/api/src/security` | 1 | 37 | 0 | 0 | 0 | 37 | 0.0% | 37 |
| `apps/web (root)` | 1 | 25 | 0 | 0 | 0 | 25 | 0.0% | 25 |
| `packages/shared/src/map-guess` | 1 | 20 | 0 | 0 | 0 | 20 | 0.0% | 20 |
| `apps/kart-solo (root)` | 1 | 15 | 0 | 0 | 0 | 15 | 0.0% | 15 |
| `apps/kart-solo/src/track` | 1 | 9 | 0 | 0 | 0 | 9 | 0.0% | 9 |
| **TOTAL** | 1,204 | 127,054 | 2,343 | 67,897 | 5,810 | 203,104 | 100.0% | 169 |

## Languages & extensions (handwritten + config)

| Extension | Files | App | Content | Test | Tool/Cfg | Code | Share | Avg |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `.ts` | 756 | 66,205 | 2,343 | 50,769 | 4,952 | 124,269 | 60.6% | 164 |
| `.tsx` | 362 | 39,662 | 0 | 16,757 | 0 | 56,419 | 27.5% | 156 |
| `.css` | 68 | 20,046 | 0 | 0 | 0 | 20,046 | 9.8% | 295 |
| `.mjs` | 19 | 0 | 0 | 208 | 1,573 | 1,781 | 0.9% | 94 |
| `.jsx` | 3 | 967 | 0 | 0 | 0 | 967 | 0.5% | 322 |
| `.json` | 18 | 0 | 0 | 0 | 627 | 627 | 0.3% | 35 |
| `.js` | 4 | 119 | 0 | 117 | 212 | 448 | 0.2% | 112 |
| `.jsonc` | 2 | 0 | 0 | 36 | 137 | 173 | 0.1% | 87 |
| `.sh` | 1 | 0 | 0 | 0 | 156 | 156 | 0.1% | 156 |
| `.html` | 3 | 40 | 0 | 10 | 0 | 50 | 0.0% | 17 |
| `.yml` | 1 | 0 | 0 | 0 | 35 | 35 | 0.0% | 35 |
| `.sql` | 2 | 15 | 0 | 0 | 0 | 15 | 0.0% | 8 |
| **TOTAL** | 1,239 | 127,054 | 2,343 | 67,897 | 7,692 | 204,986 | 100.0% | 165 |

## App file size distribution

| Bucket | Files | Code | Share |
| --- | ---: | ---: | ---: |
| < 50 LOC | 167 | 4,016 | 3.2% |
| 50 - 99 LOC | 135 | 9,557 | 7.5% |
| 100 - 299 LOC | 200 | 35,997 | 28.3% |
| 300 - 499 LOC | 66 | 25,067 | 19.7% |
| 500 - 999 LOC | 36 | 24,474 | 19.3% |
| 1,000+ LOC | 16 | 27,943 | 22.0% |

## Largest app files

| File | Area | Code | Comment | Blank | Total |
| --- | --- | ---: | ---: | ---: | ---: |
| `apps/api/src/room/party-room.ts` | `apps/api/src/room` | 5,702 | 127 | 155 | 5,984 |
| `apps/web/src/theme/themes.ts` | `apps/web/src/theme` | 1,819 | 37 | 35 | 1,891 |
| `apps/web/src/ui/admin.css` | `apps/web/src/ui` | 1,775 | 20 | 19 | 1,814 |
| `apps/api/src/questions/vote.ts` | `apps/api/src/questions` | 1,732 | 39 | 72 | 1,843 |
| `apps/api/src/troll/engine.ts` | `apps/api/src/troll` | 1,666 | 57 | 71 | 1,794 |
| `packages/shared/src/index.ts` | `packages/shared/src (core)` | 1,661 | 94 | 100 | 1,855 |
| `apps/web/src/kart/kart.css` | `apps/web/src/kart` | 1,639 | 18 | 20 | 1,677 |
| `packages/shared/src/trends/trend-engine.ts` | `packages/shared/src/trends` | 1,604 | 40 | 45 | 1,689 |
| `apps/web/src/theme/theme-deep.css` | `apps/web/src/theme` | 1,579 | 54 | 95 | 1,728 |
| `apps/api/src/questions/multiple-choice.ts` | `apps/api/src/questions` | 1,440 | 32 | 35 | 1,507 |
| `packages/shared/src/kart/kart.ts` | `packages/shared/src/kart` | 1,390 | 48 | 17 | 1,455 |
| `apps/api/src/stats/aggregate.ts` | `apps/api/src/stats` | 1,284 | 13 | 66 | 1,363 |
| `apps/api/src/room/routes.ts` | `apps/api/src/room` | 1,240 | 10 | 30 | 1,280 |
| `apps/web/src/guest/guest-page.tsx` | `apps/web/src/guest` | 1,223 | 19 | 35 | 1,277 |
| `apps/web/src/theme/theme-scenes.css` | `apps/web/src/theme` | 1,165 | 21 | 61 | 1,247 |
| `apps/api/src/questions/kart/kart.ts` | `apps/api/src/questions/kart` | 1,024 | 67 | 42 | 1,133 |
| `apps/web/src/kart/circuit.ts` | `apps/web/src/kart` | 997 | 22 | 3 | 1,022 |
| `apps/api/src/questions/duel.ts` | `apps/api/src/questions` | 958 | 5 | 49 | 1,012 |
| `apps/web/src/theme/identity.ts` | `apps/web/src/theme` | 957 | 45 | 33 | 1,035 |
| `apps/web/src/live/room-socket.ts` | `apps/web/src/live` | 917 | 40 | 56 | 1,013 |
| `apps/api/src/questions/validate.ts` | `apps/api/src/questions` | 912 | 13 | 19 | 944 |
| `apps/web/src/admin/live-console.tsx` | `apps/web/src/admin` | 877 | 15 | 4 | 896 |
| `apps/api/src/stats/fun-facts.ts` | `apps/api/src/stats` | 837 | 6 | 45 | 888 |
| `apps/kart-solo/src/solo.css` | `apps/kart-solo/src` | 799 | 0 | 5 | 804 |
| `apps/api/src/room/lifecycle.ts` | `apps/api/src/room` | 791 | 26 | 48 | 865 |

## Largest test files

| File | Area | Code | Comment | Blank | Total |
| --- | --- | ---: | ---: | ---: | ---: |
| `apps/api/test/kart-room.spec.ts` | `apps/api/test` | 1,267 | 12 | 24 | 1,303 |
| `apps/web/src/kart/kart.test.tsx` | `apps/web/src/kart` | 999 | 20 | 28 | 1,047 |
| `scripts/release-integration.test.ts` | `scripts` | 765 | 35 | 47 | 847 |
| `apps/api/test/chess-scheduler.spec.ts` | `apps/api/test` | 753 | 68 | 121 | 942 |
| `apps/api/test/auth.spec.ts` | `apps/api/test` | 712 | 3 | 46 | 761 |
| `apps/api/test/question-authoring.spec.ts` | `apps/api/test` | 598 | 0 | 23 | 621 |
| `apps/api/test/vote.spec.ts` | `apps/api/test` | 592 | 2 | 32 | 626 |
| `apps/web/perf/kart-render-baseline.spec.ts` | `apps/web/perf` | 592 | 8 | 5 | 605 |
| `apps/web/src/kart/circuit.test.ts` | `apps/web/src/kart` | 577 | 6 | 14 | 597 |
| `apps/api/test/stage-effects.spec.ts` | `apps/api/test` | 559 | 1 | 24 | 584 |
| `apps/api/test/admin-rooms-auth.spec.ts` | `apps/api/test` | 553 | 0 | 5 | 558 |
| `apps/web/src/admin/live-console.test.tsx` | `apps/web/src/admin` | 541 | 5 | 16 | 562 |
| `apps/api/test/hardening.spec.ts` | `apps/api/test` | 532 | 2 | 32 | 566 |
| `apps/api/test/media.spec.ts` | `apps/api/test` | 524 | 0 | 25 | 549 |
| `apps/api/test/room.spec.ts` | `apps/api/test` | 524 | 1 | 30 | 555 |

## Largest content pack files

| File | Area | Code | Comment | Blank | Total |
| --- | --- | ---: | ---: | ---: | ---: |
| `apps/api/src/questions/packs/birthday/manifest.ts` | `apps/api/src/questions/packs/birthday` | 187 | 14 | 5 | 206 |
| `apps/api/src/questions/packs/birthday/ed-or-humza.ts` | `apps/api/src/questions/packs/birthday` | 179 | 2 | 4 | 185 |
| `apps/api/src/questions/packs/birthday/retired.ts` | `apps/api/src/questions/packs/birthday` | 50 | 1 | 1 | 52 |
| `apps/api/src/questions/packs/birthday/whos-that-pokemon.ts` | `apps/api/src/questions/packs/birthday` | 44 | 0 | 1 | 45 |
| `apps/api/src/questions/packs/birthday/nextdoor-paranoia.ts` | `apps/api/src/questions/packs/birthday` | 43 | 0 | 1 | 44 |
| `apps/api/src/questions/packs/demo/manifest.ts` | `apps/api/src/questions/packs/demo` | 42 | 4 | 1 | 47 |
| `apps/api/src/questions/packs/birthday/tribunal-reddit.ts` | `apps/api/src/questions/packs/birthday` | 36 | 0 | 1 | 37 |
| `apps/api/src/questions/packs/birthday/accommodation-01.ts` | `apps/api/src/questions/packs/birthday` | 35 | 0 | 1 | 36 |
| `apps/api/src/questions/packs/birthday/accommodation-02.ts` | `apps/api/src/questions/packs/birthday` | 35 | 0 | 1 | 36 |
| `apps/api/src/questions/packs/birthday/accommodation-03.ts` | `apps/api/src/questions/packs/birthday` | 35 | 0 | 1 | 36 |
