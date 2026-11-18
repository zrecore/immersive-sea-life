---
name: add-marine-mammal
description: Add or tune a marine mammal species in the sea-life scene (registry entry, size/colour/behaviour, call sound). Use when asked for a new whale, dolphin, seal, otter or similar.
---

# Add a marine mammal

Everything is data-driven from `src/sim/mammals.ts`; no component changes are needed for a new species.

1. Add an entry to `MAMMALS` (id = key). Pick `kind: 'cetacean'` (needs `shape: c(w, h, dorsal, beak, fin, fluke, cut)`) or `'pinniped'` (uses `fore`; `otter: true` swaps flippers for a tail). `top`/`belly` are the countershading colours; `cut` raises the pale belly line (orca/Dall's-style flanks).
2. Respect the one-at-a-time lane: `dur` must stay under about 70 s so `t0 + dur` ends inside the 90 s `MSLOT` in `src/sim/events.ts`. Do not add a second schedule for mammals.
3. Choose `span` (distance crossed; slow animals smaller), `y`/`z` ranges (small animals nearer the camera, z about 9 to -8; big whales high and back), `group` size, `weight` (relative frequency) and `bob`.
4. `sound` selects a synthesized call in `src/audio/AudioEngine.ts` (`humpback`, `moan`, `deep`, `orca`, `dolphin`, `click`, `bark`, `roar`, `none`). Add a new case there only for a genuinely new call type.
5. The Controls panel picker lists `MAMMAL_IDS` automatically.
6. Verify with the `verify-scene` skill: `--mammal <id>`.
