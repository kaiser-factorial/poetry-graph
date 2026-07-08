# Poetry Graph

An instrument for seeing, building, and performing the sound-structure of poems — a 3D force-directed word-graph in the style of an etched star atlas.

Words enter as points; their relationships become forces. Rhyme families gather into engraved orbit-circles, alliterations thread between them, meanings pull, syllables stratify, and — if you're feeling occult — every word's Alphanumeric Qabbala value assigns it a zone on the CCRU numogram. You can gather a palette for a poem you haven't written, drape a villanelle template over it, scan your meter as you draft, X-ray a poem that already exists, engrave the result as a plate, mail it as a URL, or press **Perform** and let the poem fly the camera and ring its zones as pentatonic tones.

## Running it

```bash
npm install   # once — also installs backend deps
npm start     # API on :3001 + frontend on :3000, together
```

Then open [http://localhost:3000/workspace.html](http://localhost:3000/workspace.html). An internet connection makes everything richer (Datamuse supplies rhymes, meanings, and parts of speech); offline, spelling-based fallbacks take over.

## Deploying it

This repo is prepared for Vercel. Import it as a plain Node/static project and keep the default install command (`npm install`). No build command is required. Vercel serves `public/` as the static site, rewrites `/` to `workspace.html`, and sends `/api/*` requests to the Express app through `api/index.js`.

The frontend uses same-origin API calls in production, while local development still points the `:3000` static server at the API on `:3001`.

No environment variables are required for the current deployment. Datamuse is called server-side without a key, and CMU scansion data comes from the backend dependency install. If Datamuse keys become required later, add the key as a Vercel environment variable and keep the browser on same-origin `/api/*` calls.

## The pages

### ✍️ Workspace (`workspace.html`) — the centerpiece
A WebGL scene (three.js via `3d-force-graph`) where your poem's words live.

- **Three groupings**: **Rhyme** (true sound-families — *tone, known, throne, moan* share one node despite four spellings), **Alliteration** (onset families, digraph-aware), and **Numogram** (words fall to zones 0–9 by the digital root of their AQ value, pinned to the canonical diagram or to a Barker-spiral helix).
- **Connection force sliders**: rhyme, alliteration, part of speech, syllables, gematria, semantic **meaning** (Datamuse means-like), **your bonds** (shift-click two words to bind them by hand), and **poem flow** (the draft's word order as directed particle-edges). Each slider sets how strongly that relationship pulls the layout.
- **Literal alliteration** toggle: onset links only where words actually follow one another in the draft — the device, not the coincidence.
- **Syllables as altitude**: words stratify onto labeled floors by syllable count.
- **Draft drawer**: write beside the map with live per-line syllable counts, line AQ values with plex reductions, and a **scansion mode** (˘´) showing true CMU stress marks — clean lines get their meter named.
- **Form templates**: begin a villanelle, sestina, sonnet, ballad, limerick, triolet, or haiku from the Forms page and the drawer becomes a stanza-sectioned template with color-coded end-word boxes. Refrains propagate themselves; the sestina spiral fills automatically; click a graph word to fill the armed slot.
- **Perform**: ritual playback — camera flight along the poem's order, words flaring in sequence, each sounding its zone as a pentatonic pitch over a drone.
- **Export**: engrave the current view as a framed, captioned PNG plate, or fold the entire poem-state into a shareable URL.
- Panels drag, collapse, and resize; camera can be axis-locked (turntable / tilt / face).

### 📖 Read (`read.html`)
Paste an existing poem and see what it sounds like: function words are skipped, true rhyme families detected, loners (no rhyme or alliteration partner) cut and listed, then the survivors open in the workspace — line-ending words in brass, the original text pre-loaded in the drawer, flow and literal alliteration on. Try the Frost sample: it recovers his entire rhyme scheme from raw text.

### 📜 Forms (`forms.html`)
A field guide to the fixed forms — rhyme schemes drawn with colored node letters, refrains and syllable targets annotated, the sestina's full spiral table — each with a recipe for gathering its materials from the graph and a one-click "begin" that opens its template.

### 🔭 Explorer (`index.html`)
The original 2D prototype: a light staging canvas for collecting words before opening them in the workspace.

## How the sound-analysis works

- **Rhyme**: [Datamuse](https://www.datamuse.com/api/) `rel_rhy`, frequency-filtered; a new word joins an existing family whenever it truly rhymes with a member, so spelling never splits a sound.
- **Onsets**: first letter/sound with digraph (`wh-`, `th-`…) and silent-start (`kn-` → n) handling.
- **Meaning**: Datamuse `ml=` semantic neighbors, stored per word; pairwise links.
- **Stress & syllables**: the [CMU Pronouncing Dictionary](https://github.com/words/cmu-pronouncing-dictionary) (135k words) for true stress patterns.
- **Gematria**: Alphanumeric Qabbala — base-36, digits keep face value, A–Z map to 10–35, summed; zone = digital root.
- **Input safety**: words restored from localStorage/share links and words submitted to the legacy explorer are normalized before entering graph state or API graph output.

## Credits

- **[lumpenspace/ccru](https://github.com/lumpenspace/ccru)** and **[qliphoth.systems](https://qliphoth.systems)** — the numogram implementation this project's gematria mode is built on: the AQ cipher behavior, the canonical zone geometry (`original` layout coordinates), zone colors, regions, phonic particles, syzygies, currents, gates, and zone lore all follow that repository's data. The CypherHover component inspired the plex-reduction displays. Deep gratitude — go explore the interactive numogram at [num.qliphoth.systems](https://num.qliphoth.systems).
- The **CCRU** (Cybernetic Culture Research Unit), whose writings the numogram, zones, syzygies, currents, gates, and demons originate from.
- **[Datamuse API](https://www.datamuse.com/api/)** — rhymes, semantic neighbors, parts of speech, frequencies.
- **[CMU Pronouncing Dictionary](https://github.com/words/cmu-pronouncing-dictionary)** — stress patterns and syllable counts.
- **[3d-force-graph](https://github.com/vasturiano/3d-force-graph)**, **[three-spritetext](https://github.com/vasturiano/three-spritetext)**, and **[d3-force-3d](https://github.com/vasturiano/d3-force-3d)** by Vasco Asturiano; **[three.js](https://threejs.org)**; **[D3](https://d3js.org)**.
- Typefaces: **Cormorant Garamond** and **Inter** (Google Fonts).
- The Read page's sample is Robert Frost's *Nothing Gold Can Stay* (1923, public domain).

## For future development

See [HANDOFF.md](HANDOFF.md) — architecture notes, loose threads, and the long brainstorm.

Earlier iterations are documented in [docs/archive](docs/archive).
