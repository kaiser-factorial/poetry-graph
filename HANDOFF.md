# HANDOFF — Poetry Graph

Notes for the next working session. Last updated July 2, 2026.

## What this is now

A three-page instrument (plus the legacy explorer) for building, reading, and performing the sound-structure of poems. The workspace is a WebGL force-graph in an etched star-atlas style; poems can be gathered by hand, templated against fixed forms, X-rayed from existing text, mapped onto the CCRU numogram by gematria, exported as engraved plates or state-bearing URLs, and performed as camera-flight-plus-tone rituals.

## How it evolved (session log, roughly)

1. **v1 toy** (archived in `docs/archive/`): Express API with hand-rolled 4D "embeddings", naive suffix rhymes, template poem generator, 2D D3 explorer. The explorer page still runs this.
2. **Poem workspace (2D → 3D)**: rhyme/alliteration group hubs with cross-links → full three.js rewrite (`3d-force-graph`), planetary design, then the **etched star-atlas** restyle (ink/bone/brass, Cormorant Garamond, engraved circle hubs, typography-as-nodes) applied across all pages.
3. **Sound-true grouping**: words join rhyme families via Datamuse rhyme sets, not spelling (tone/known/throne/moan/stone share one node).
4. **Layers & physics**: per-type force sliders; syllables-as-altitude with adaptive guide rings; spherical boundary force; node-count-scaled charge; camera axis locks (spin/tilt/face); draggable/collapsible/resizable panels.
5. **Forms**: field-guide page + workspace templates with refrain propagation, sestina spiral autofill, armed-slot click-to-fill from the graph.
6. **Read mode**: paste a poem → stopword filter → true rhyme families → loners cut (listed) → workspace handoff with brass line-enders and the poem in the draft.
7. **Numogram** (credit: lumpenspace/ccru — see README): AQ gematria zones, canonical plate geometry with region-depth fold, Barker spiral layout with continuous etched helix, syzygies/currents/gates layers, zone lore panels.
8. **Semantics + bonds**: Datamuse `ml=` meaning layer; shift-click hand-drawn bonds.
9. **Meter**: CMU dictionary on the backend; scansion gutter mode with meter naming.
10. **Export**: plate PNG with caption block; share links (whole state in URL fragment).
11. **Ritual playback**: Perform button — camera walk, word flares, pentatonic zone-tones over a drone, gutter line tracking.

## Architecture

```
backend/                 Express on :3001 (run: node server.js)
  server.js              all endpoints; in-memory caches (cleared on restart)
  phonetics.js           rhyme endings, onsets, syllable heuristic
  rhyme.js, embeddings.js, forceLayout.js, poemGenerator.js   ← v1, explorer-only
public/                  static, served with http-server -c-1 on :3000
  workspace.html/.js     THE app (~2200 lines JS; ES module via esm.sh import map)
  read.html              self-contained analyzer (inline script)
  forms.html             static field guide
  index.html + app.js    legacy explorer (v1 API)
```

**Key endpoints**: `/api/word-info?word=` (ending, onset, rhymes, similar, pos, syllables, stress), `/api/alliterations?onset=`, plus v1 endpoints the explorer uses.

**Workspace state** (`localStorage: poetry-workspace-v2`): `{ mode, words[{text, rhymeKey, onsetKey, pos, syllables, stress, similar, lineEnd?}], forceWeights, customEdges, literalAlliteration, syllableAltitude, numoLayout, draft, form, formSlots, formBodies }`. UI state (`poetry-workspace-ui-v1`): panel pos/size/collapse, camLock, scansion. Share links: `#s=<urlencoded JSON>` (trimmed: no `similar`), consumed and stripped on load.

### Gotchas worth remembering
- **Cache-bust `workspace.js?v=N`** in workspace.html on every JS change; browsers held stale copies before `-c-1` (that whole saga: `d3 is not defined`).
- **esm.sh import map** needs `three`, `three/webgpu`, `three/tsl`, and both `three/addons/` + `three/examples/jsm/` aliases, with `?external=three` on packages — otherwise duplicate THREE instances.
- **`node.__threeObj`** is 3d-force-graph's render cache — `delete` it when a node's visual should rebuild (memberCount, backfilled metadata).
- **Pinned nodes** (numogram zones) use `fx/fy/fz`; decorative links between pinned nodes get strength 0.
- **zoomToFit(ms, px, filter)** — always filter out the `plus` node; in numogram mode filter to hubs.
- **Verification pattern**: puppeteer-core + installed Chrome + `--use-angle=swiftshader --enable-unsafe-swiftshader` renders WebGL headless. Scripts from this session live in the session scratchpad (ephemeral) — the pattern: seed via URL, drive via `window.__ws` debug hook (`state`, `graph`, `addWord`, `refreshGraph`), screenshot, assert on `graph.graphData()`.
- `node --check` rejects workspace.js (ES module) — meaningless failure, ignore.
- Curly apostrophes: all tokenizers normalize U+2019/2018 → `'`; read-mode peels contraction suffixes (`she'd` → `she`, not `shed`).

## Loose threads

- **The explorer (index.html) is still v1** — fake 4D embeddings, template poem generator. Either retire it, or rebuild it as a pure "staging canvas" on the modern API. Its poem generator (`/api/poem`, 14 styles) is charmingly bad and unused by the new flow.
- **Offline rhyme grouping** falls back to spelling endings (Datamuse down = "love/move" merge, "tone/known" split). A bundled rhyme dictionary (CMU-derived: rhyme = matching phones from last stressed vowel) would make grouping fully offline and *better* — CMU is already installed server-side.
- **Group labels** are the first member's spelling ending (a "-one" node can hold *known*); harmless but occasionally odd (`y·2` collision suffixes from read-mode).
- **Meter naming is strict** — no promotion/demotion, so CMU-unstressed function words break "iambic" detection on genuinely iambic lines. The marks are right; the badge is conservative.
- **Literal mode exists only for alliteration** — the same potential-vs-event toggle would suit rhyme (line-end pairs only = the deployed scheme). Rhyme-scheme letter detection (ABAB…) in Read mode is adjacent and half-designed.
- **Form templates**: no gathering-progress meters yet ("4 of 7 A-words gathered"); flow/scansion only read the free draft, not template bodies; ballad can't add stanzas.
- **Single poem slot** — localStorage holds one workspace. No library/gallery of saved poems or plates.
- **Share links** are uncompressed JSON (fine to ~60 words; LZ-string would triple capacity).
- **Backend caches** are in-memory only; restart re-hits Datamuse.
- **Zone 0 (Sol)** is unreachable by single words (digital roots of positive AQ are 1–9) — thematically apt (the void stays empty), but *lines* can plex through 9… see brainstorm.
- **Performance tempo** is fixed at 950ms/word; no tempo control, no pause, template-mode drafts don't highlight.
- The `+` compass node's tether forces (`plusX/Y/Z`… removed?) — plus node now only exists when the canvas is empty; its old pinning code paths are gone, but check `boundaryForce` interaction if you ever re-add roaming nodes.

## Brainstorm (in rough order of pull, wildness welcome)

**Craft**
- **Metrically-interchangeable links**: same stress pattern → link/suggestion ("swap candidates for this slot that scan identically"). All data already present.
- **Rhyme-scheme detection & letters**: Read mode assigns A/B/C to line-end families, prints the scheme, annotates the gutter; forms could then *check* a draft against its template's scheme.
- **Gathering meters for forms**: villanelle template shows live counts per node; slots glow when their family lacks candidates.
- **Draft↔graph binding**: underline draft words that live in the graph; click to fly; dim "spent" words on the map (palette inventory).
- **Embeddings upgrade**: real vectors (small local model or API) → semantic force as continuous cosine weight instead of binary Datamuse pairs.

**Reading**
- **Numogram signatures**: zone histogram as a poem fingerprint; compare two poems side by side; name each poem's dominant syzygy demon (Frost ran warm toward the Warp).
- **Erasure mode**: load a read poem, delete words, watch the sound-structure decay in real time.
- **Import from URL** / OCR from a photo of a page.

**Performance & sound**
- **Tempo/scale controls**: BPM slider, scale picker (the pentatonic is hardcoded), zone→timbre mapping; currents could modulate key mid-poem.
- **Speech synthesis** in sync with the flight — the poem spoken word-by-word over its tones.
- **Record the ritual**: capture performance to video/GIF (canvas stream + MediaRecorder).
- **Gate music**: when the flight crosses between zones connected by a gate, sound the gate as an interval (the triangular-number jumps have natural ratios).

**Occult**
- **Cipher picker**: lumpenspace/ccru ships more ciphers (primes, synx, archaic) — let the numogram re-derive under any of them.
- **Uttunul watermark**: lines whose AQ plexes to 9 get a quiet marker (the 9::0 syzygy is the outer rim; a whole line reaching it feels earned).
- **Time-circuit playback**: an alternate Perform that walks zones 1→2→4→8→7→5 (the numogram's time-circuit) visiting whichever of your words live there.

**Structure**
- **Poem library**: multiple named workspaces, a gallery wall of exported plates.
- **Live rooms**: two poets, one shared graph (WebSocket; the backend is trivial to extend).
- **WebXR**: the atlas in a headset — stand inside the spiral while it performs.
- **LLM copilot** (opt-in): "suggest a line ending in this node, 10 syllables, iambic" — the graph becomes constraints for generation rather than the generator itself.

## Housekeeping candidates
- Retire or rebuild the explorer; then `backend/embeddings.js`, `forceLayout.js`, `poemGenerator.js` and half of `server.js` can go.
- Root `package.json` is mostly vestigial (d3 devDep unused since the workspace went 3D); a `concurrently` start script for both servers would be kind.
- `rhyme.js`'s hand lists are only used as offline fallback; superseded if the CMU-rhyme idea lands.
