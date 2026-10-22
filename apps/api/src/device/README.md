# Device statistics

[Home](../../../../README.md) · [Documentation](../../../../docs/README.md) · [Event runbook](../../../../docs/event-runbook.md)

Browser details are collected so the end of the game can show playful comparisons. They are not an identity, a login, or a score.

The collector version is 1. The phone feature-detects each field and sends only the allowlist. The room normalises the report again and drops anything else. A missing, rejected, or extreme value is stored as unknown. The answer is still accepted.

`deviceContextId` is a random id. It is not the player id and it is not the guest credential. A context row belongs to the authenticated player in that room. A report cannot name another player. The first context for a player is the one used later for whole-room device counts. An accepted answer, vote, duel, prediction, name reaction, or troll stores the context id that was current at that moment. If the phone has not reported yet, that id is null. The room does not invent a device.

Transferring to another phone keeps the same player and does not add a participant. The current context pointer is cleared. The next report creates a new context. Earlier answers keep the context they were accepted with.

The stage heartbeat is the text `ping`, answered with `pong` by the Durable Object auto-response so a quiet room can stay hibernated. The phone keeps a few round-trip samples and sends a summary about once a minute or when the phase changes. The room stores at most 16 samples, plus a count, a median, and an upper estimate. Reconnects are counted from guest sockets after the first, and they stop at 40. Upload and submission retries are capped totals, not a log of every attempt. Draft keystrokes are not telemetry.

A device stays off the projector unless a comparison is deliberately shown. The end-of-night facts beat is that comparison. It reads the latest report for each current guest and may say a room total, such as dark mode or a browser, without naming who. A unique time zone or first language is not named. The matching phone, and later that guest's personal results, can add "That's you." Script errors, the last error text, IP, raw user agent, device model, memory, processor count, pixel ratio, downlink, round-trip time, upload failures and network quality are not facts.

Screen width and height are CSS pixels. The wider screen group is a short edge of at least 700 CSS pixels (`screenGroupVersion` 1). That cutoff was chosen before any party results. It is not a measurement in inches and it is not a phone model. `physical.size` and `physical.model` stay `unknown`. An iPad that looks like a desktop Mac is stored as `ipad` with classification `ambiguous`. A platform that only says iOS, without iPhone or iPad, is `iphone` with classification `ambiguous`.

`network.quality` may be `4g`. `network.bearer` stays `unknown`. That quality value is not proof of a mobile 4G service. IP addresses are not read or stored. The room does not ask for location, contacts, or permissions that the game does not already use for a photo or a voice clip.

Detailed rows and round-trip samples are removed 30 days after `room.created_at`. The room column `telemetry_retention_days` can change that interval. The background job id is `telemetry-retention`. Removal writes `telemetry_aggregate` family counts first, then deletes `device_context` and clears the sample list. Answers, scores, players, and media stay. Prompt 15 can copy `detailedTelemetryPolicy` from `@26/shared` onto the archive. After removal, an answer may still mention a context id that no longer resolves.

## Easter egg queries

`profile.ts` reads the reports above for easter eggs. It collects nothing new. Inside the room, read with the room's `SqlStorage`, then use the pure helpers:

```ts
import {
  deviceExtreme,
  deviceOddOneOut,
  deviceTally,
  devicesWhere,
  playerDevice,
  read,
  roomDevices,
} from "../device/profile.ts";

const devices = roomDevices(sql); // latest report per active player who has reported
deviceOddOneOut(devices, read.family); // the one Android among iPhones, or null
deviceExtreme(devices, read.rttMs, "highest"); // laggiest connection, null on a tie
deviceTally(devices, read.colorScheme); // [{ value: "dark", count: 5, nicknames }]
devicesWhere(devices, (d) => read.language(d)?.startsWith("it") ?? false);
playerDevice(sql, playerId); // one player, or null before their phone reports
```

`read` has ready-made accessors for every report field plus connection lag and reconnects. Unknown values are always skipped, and helpers return null rather than guess. Once the 30-day retention removes detailed rows, these return nothing.

Replace nothing in this folder for the party. The phone copy is on the guest join screen.
