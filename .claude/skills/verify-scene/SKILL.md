---
name: verify-scene
description: Render the sea-life scene in headless Chrome and screenshot it (optionally with a given marine mammal, school, surface preset or settings) to check visuals and shader errors. Use after changing anything under src/scene, src/render or src/sim.
---

# Verify the scene visually

There is no test suite; verify by rendering. Headless Chrome runs on software WebGL (SwiftShader), so this checks correctness and look, not frame rate or audio. Say so when reporting.

1. Start the dev server on localhost only (never `--host`): `npx vite --port 5180 --strictPort` in the background.
2. Make sure `playwright-core` is installed outside the repo (e.g. `npm i playwright-core` in the scratchpad directory). It drives the installed Chrome (`channel: 'chrome'`), so no browser download is needed.
3. Run the script, pointing `PW_DIR` at the directory containing `node_modules/playwright-core`:

```
PW_DIR=<dir> node .claude/skills/verify-scene/verify.mjs out.png [--mammal orca] [--school sardine] [--state '{"surface":"wallFloor"}'] [--size 1280x720] [--clip 200,440,640,280] [--wait 5000]
```

4. Read the PNG, and check the printed console errors (the favicon 404 is expected; shader/program errors are not).
5. Stop the dev server when done.

`--mammal` accepts any id from `src/sim/mammals.ts`. The script triggers it through the app's own module instance (a plain `import('/src/...')` would create a second instance and show nothing).
