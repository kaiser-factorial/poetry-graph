// Poem Workspace — 3D force-directed word graph (WebGL).
// Words cluster under rhyme or alliteration hubs; extra connection layers
// (part of speech, syllable count, …) pull related words together with
// user-controlled force strengths.

import ForceGraph3D from 'https://esm.sh/3d-force-graph@1?external=three';
import SpriteText from 'https://esm.sh/three-spritetext@1?external=three';
import { forceY, forceCollide } from 'https://esm.sh/d3-force-3d@3';
import * as THREE from 'three';

const API_URL = 'http://localhost:3001';
const STORAGE_KEY = 'poetry-workspace-v2';

// ===== Client-side phonetics (mirrors backend/phonetics.js, used as fallback) =====
const VOWELS = 'aeiouy';
const SILENT_STARTS = { kn: 'n', gn: 'n', wr: 'r', ps: 's', pn: 'n', mn: 'n' };
const DIGRAPHS = ['ch', 'sh', 'th', 'ph', 'wh'];

function normalizeWord(word) {
  return String(word).toLowerCase().replace(/[^a-z]/g, '');
}

function localRhymeEnding(word) {
  const w = normalizeWord(word);
  if (w.length <= 2) return w;
  let end = w.length - 1;
  if (w[end] === 'e' && !VOWELS.includes(w[end - 1])) end -= 1;
  let i = end;
  while (i >= 0 && !VOWELS.includes(w[i])) i--;
  if (i < 0) return w;
  while (i > 0 && VOWELS.includes(w[i - 1])) i--;
  return w.slice(i);
}

function localOnset(word) {
  const w = normalizeWord(word);
  if (!w) return '';
  const two = w.slice(0, 2);
  if (SILENT_STARTS[two]) return SILENT_STARTS[two];
  if (DIGRAPHS.includes(two)) return two;
  return w[0];
}

function localSyllables(word) {
  const w = normalizeWord(word);
  if (!w) return 0;
  const clusters = w.match(/[aeiouy]+/g) || [];
  let count = clusters.length;
  if (count > 1 && w.endsWith('e') && !w.endsWith('le') && !VOWELS.includes(w[w.length - 2])) count -= 1;
  return Math.max(count, 1);
}

// ===== Connection types =====
// Each type can group (hubs) and/or cross-link, with a force weight slider.
const POS_NAMES = { n: 'noun', v: 'verb', adj: 'adjective', adv: 'adverb' };

// ===== Gematria / Numogram =====
// Alphanumeric Qabbala (AQ): base-36 — digits keep face value, a–z map to
// 10–35; a word's value is the sum. Its zone is the digital root (plex).
// Structure and geometry follow the CCRU numogram (via qliphoth.systems).

function aqValue(text) {
  let sum = 0;
  for (const ch of String(text).toLowerCase()) {
    const code = ch.charCodeAt(0);
    if (code >= 48 && code <= 57) sum += code - 48;
    else if (code >= 97 && code <= 122) sum += code - 97 + 10;
  }
  return sum;
}

function digitalRoot(n) {
  while (n >= 10) n = String(n).split('').reduce((a, d) => a + Number(d), 0);
  return n;
}

function plexSteps(n) {
  let expr = `${n}`;
  while (n >= 10) {
    const digits = String(n).split('');
    n = digits.reduce((a, d) => a + Number(d), 0);
    expr += ` = ${digits.join('+')} = ${n}`;
  }
  return expr;
}

function zoneOf(text) {
  return String(digitalRoot(aqValue(text)));
}

// Canonical numogram geometry ("original" layout), zone colors, and lore
const ZONE_POS = {
  6: [250, 85], 3: [420, 115], 2: [560, 275], 7: [580, 400], 5: [250, 370],
  4: [178, 480], 1: [400, 550], 8: [400, 660], 9: [400, 770], 0: [400, 875],
};
const NUMO_CENTER = [400, 460];
const ZONE_CLR = {
  0: '#aaaaaa', 1: '#ee44ee', 2: '#4488ff', 3: '#44cc77', 4: '#ee4444',
  5: '#ee8833', 6: '#ddcc33', 7: '#7755cc', 8: '#9944ee', 9: '#666666',
};
const PLANET_SYMBOL = {
  0: '☉', 1: '☿', 2: '♀', 3: '♁', 4: '♂',
  5: '♃', 6: '♄', 7: '♅', 8: '♆', 9: '♇',
};
const SYZYGY_PAIRS = [
  [4, 5, 'Katak'], [3, 6, 'Djynxx'], [2, 7, 'Oddubb'], [1, 8, 'Murrumur'], [0, 9, 'Uttunul'],
];
const NUMO_CURRENTS = [
  ['Surge', 8, 7], ['Hold', 2, 5], ['Sink', 4, 1], ['Warp', 6, 3],
];
// Gates: zone-n jumps to the digital root of its cumulation (triangular
// number). Self-loops (Gt-00, Gt-01, Gt-45) are omitted from the drawing.
const NUMO_GATES = [
  ['Gt-03', 2, 3], ['Gt-06', 3, 6], ['Gt-10', 4, 1], ['Gt-15', 5, 6],
  ['Gt-21', 6, 3], ['Gt-28', 7, 1], ['Gt-36', 8, 9],
];
// The third axis: regions fold out of the plate — warp lifts, plex sinks
const ZONE_REGION = {
  0: 'plex', 1: 'torque', 2: 'torque', 3: 'warp', 4: 'torque',
  5: 'torque', 6: 'warp', 7: 'torque', 8: 'torque', 9: 'plex',
};
const REGION_DEPTH = { torque: 0, warp: 160, plex: -160 };

// Barker spiral layout: one continuous helix from the innermost syzygy to
// the outermost — zones sit exactly on the curve at golden-angle intervals,
// 4::5 at the core, 0::9 on the widest, highest turn.
const SPIRAL_ORDER = [4, 5, 3, 6, 2, 7, 1, 8, 0, 9];
const SPIRAL_STEP = 2.39996; // golden angle

function spiralParam(k) {
  const theta = k * SPIRAL_STEP;
  const r = 40 + k * 30;
  const y = (k - 4.5) * 36;
  return [Math.cos(theta) * r, y, Math.sin(theta) * r];
}

function spiralZonePos(z) {
  return spiralParam(SPIRAL_ORDER.indexOf(z));
}

function numoScale() {
  return 0.55 + Math.min(state.words.length * 0.015, 0.35);
}
const ZONE_LORE = {
  0: { planet: 'Sol', region: 'plex', particle: 'eiaoung', line: 'Dense void of the cosmic hypermatrix — flatline and loss of signal.' },
  1: { planet: 'Mercury', region: 'torque', particle: 'gl', line: 'Meta-static pod-deliria and techno-immortalism; the Door of Doors.' },
  2: { planet: 'Venus', region: 'torque', particle: 'dt', line: 'Crypt-navigation, occulted cyberspace — greys, ghosts and zombies.' },
  3: { planet: 'Earth', region: 'warp', particle: 'zx', line: 'Swirling nebulae and alien pattern; vortical involvement with Zone-6.' },
  4: { planet: 'Mars', region: 'torque', particle: 'skr', line: 'Delta-phase terminal deliria — end-of-the-river disintegration.' },
  5: { planet: 'Jupiter', region: 'torque', particle: 'ktt', line: 'Hyperborean mythology, missing time; inner-eye of the Barker spiral.' },
  6: { planet: 'Saturn', region: 'warp', particle: 'tch', line: 'Occulted dimensions of Undu; the dead eye of the cyclone.' },
  7: { planet: 'Uranus', region: 'torque', particle: 'pb', line: 'Emergence from the depths — hyper-sea carriers, swamp-labyrinths.' },
  8: { planet: 'Neptune', region: 'torque', particle: 'mnm', line: 'Limbic drift, dreams, trance-states and foetal sentience.' },
  9: { planet: 'Pluto', region: 'plex', particle: 'tn', line: 'Cthelloid metallic ocean of the core — the outermost reaches the innermost.' },
};

// Muted atlas palette: brass, slate, sage, mauve
const CONNECTION_TYPES = {
  rhyme: {
    label: 'Rhyme',
    color: '#b39554',
    keyOf: w => w.rhymeKey || null,
  },
  alliteration: {
    label: 'Alliteration',
    color: '#6f82a8',
    keyOf: w => w.onsetKey || null,
  },
  pos: {
    label: 'Same POS',
    color: '#7d8f7a',
    keyOf: w => (w.pos && w.pos[0]) || null,
  },
  syllables: {
    label: 'Syllables',
    color: '#8f7a92',
    keyOf: w => (w.syllables > 0 ? String(w.syllables) : null),
  },
  gematria: {
    label: 'Gematria',
    color: '#b0705c',
    keyOf: w => zoneOf(w.text),
  },
};

const BONE = '#e8e2d3';
const INK = '#0c0b10';
const SERIF = '"Cormorant Garamond", serif';

// ===== State =====
let state = {
  mode: 'rhyme', // grouping: 'rhyme' | 'alliteration'
  words: [], // { text, rhymeKey, onsetKey, pos: [], syllables }
  forceWeights: { rhyme: 0.6, alliteration: 0.6, pos: 0, syllables: 0, gematria: 0, flow: 0 },
  syllableAltitude: false, // words stratify vertically by syllable count
  numoLayout: 'plate', // numogram geometry: 'plate' (canonical) | 'spiral' (Barker)
  draft: '', // the poem-in-progress, written in the Draft drawer
  form: null, // active poetic-form template (key into FORMS)
  formSlots: {}, // end-word slot values, e.g. { A1: 'night' }
  formBodies: {}, // line bodies keyed by line id
};

let selectedGroupKey = null;
let panelMode = 'closed';
const suggestionCache = new Map();
const nodeCache = new Map(); // id -> node object (keeps x/y/z across rebuilds)

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('poetry-workspace-v1');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.words)) {
        state.mode = ['alliteration', 'gematria'].includes(parsed.mode) ? parsed.mode : 'rhyme';
        state.words = parsed.words;
        if (parsed.forceWeights) state.forceWeights = { ...state.forceWeights, ...parsed.forceWeights };
        state.syllableAltitude = !!parsed.syllableAltitude;
        state.numoLayout = parsed.numoLayout === 'spiral' ? 'spiral' : 'plate';
        state.draft = parsed.draft || '';
        state.form = parsed.form || null;
        state.formSlots = parsed.formSlots || {};
        state.formBodies = parsed.formBodies || {};
      }
    }
  } catch (e) { /* fresh start */ }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function activeKeyOf(word) {
  return CONNECTION_TYPES[state.mode].keyOf(word);
}

function hubLabel(key) {
  if (state.mode === 'rhyme') return `-${key}`;
  if (state.mode === 'gematria') return `${key} ${PLANET_SYMBOL[key] || ''}`;
  return `${key.toUpperCase()}-`;
}

// ===== Graph data =====
function cachedNode(id, init) {
  let node = nodeCache.get(id);
  if (!node) {
    node = { id, ...init };
    nodeCache.set(id, node);
  } else {
    Object.assign(node, init);
  }
  return node;
}

function buildGraphData() {
  const nodes = [];
  const links = [];

  // Group words by the active key
  const groups = new Map();
  for (const word of state.words) {
    const key = activeKeyOf(word);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(word);
  }

  // Numogram mode: all ten zones render as pinned anchors in the canonical
  // geometry — the poem populates the diagram rather than shaping it.
  if (state.mode === 'gematria') {
    const scale = numoScale();
    for (let z = 0; z <= 9; z++) {
      const key = String(z);
      const id = `hub:gematria:${key}`;
      const memberCount = (groups.get(key) || []).length;
      let node = nodeCache.get(id);
      if (node && (node.memberCount !== memberCount)) delete node.__threeObj;
      node = cachedNode(id, { type: 'hub', key, label: hubLabel(key), zone: z, memberCount });
      if (state.numoLayout === 'spiral') {
        const [sx, sy, sz] = spiralZonePos(z);
        node.fx = sx * scale * 1.6;
        node.fy = sy * scale * 1.6;
        node.fz = sz * scale * 1.6;
      } else {
        node.fx = (ZONE_POS[z][0] - NUMO_CENTER[0]) * scale;
        node.fy = -(ZONE_POS[z][1] - NUMO_CENTER[1]) * scale;
        node.fz = REGION_DEPTH[ZONE_REGION[z]] * scale;
      }
      if (node.x === undefined) { node.x = node.fx; node.y = node.fy; node.z = node.fz; }
      nodes.push(node);
    }
    for (const word of state.words) {
      nodes.push(cachedNode(`w:${word.text}`, { type: 'word', word }));
      links.push({ source: `w:${word.text}`, target: `hub:gematria:${activeKeyOf(word)}`, kind: 'member' });
    }
    for (const [a, b] of SYZYGY_PAIRS) {
      links.push({ source: `hub:gematria:${a}`, target: `hub:gematria:${b}`, kind: 'syzygy' });
    }
    for (const [, from, to] of NUMO_CURRENTS) {
      links.push({ source: `hub:gematria:${from}`, target: `hub:gematria:${to}`, kind: 'current' });
    }
    for (const [, from, to] of NUMO_GATES) {
      links.push({ source: `hub:gematria:${from}`, target: `hub:gematria:${to}`, kind: 'gate' });
    }
    addCrossLinks(links);
    addFlowLinks(links);
    return { nodes, links };
  }

  // In small poems every group gets its circle (watching "-ost" appear as
  // you type is the point). In larger maps — like a read-in poem — lone
  // words float free instead of spawning singleton hubs.
  const showSingletonHubs = state.words.length <= 10;

  for (const [key, members] of groups) {
    if (members.length < 2 && !showSingletonHubs) continue;
    const id = `hub:${state.mode}:${key}`;
    let node = nodeCache.get(id);
    if (!node) {
      // New hub appears at the centroid of its members' current positions
      const positions = members
        .map(m => nodeCache.get(`w:${m.text}`))
        .filter(n => n && n.x !== undefined);
      const cx = positions.length ? positions.reduce((s, n) => s + n.x, 0) / positions.length : (Math.random() - 0.5) * 60;
      const cy = positions.length ? positions.reduce((s, n) => s + n.y, 0) / positions.length : (Math.random() - 0.5) * 60;
      const cz = positions.length ? positions.reduce((s, n) => s + n.z, 0) / positions.length : (Math.random() - 0.5) * 60;
      node = cachedNode(id, { type: 'hub', key, label: hubLabel(key), memberCount: members.length, x: cx, y: cy, z: cz });
    } else {
      if (node.memberCount !== members.length || node.label !== hubLabel(key)) {
        delete node.__threeObj; // re-render sphere at new size
      }
      Object.assign(node, { label: hubLabel(key), memberCount: members.length });
    }
    nodes.push(node);
  }

  for (const word of state.words) {
    nodes.push(cachedNode(`w:${word.text}`, { type: 'word', word }));
    const key = activeKeyOf(word);
    if (groups.get(key).length >= 2 || showSingletonHubs) {
      links.push({ source: `w:${word.text}`, target: `hub:${state.mode}:${key}`, kind: 'member' });
    }
  }

  addCrossLinks(links);
  addFlowLinks(links);

  // The "+" compass only greets an empty canvas; adding lives in the header
  if (state.words.length === 0) {
    nodes.push(cachedNode('plus', { type: 'plus', empty: true }));
  }

  return { nodes, links };
}

// Cross-links for every non-grouping connection type with weight > 0
function addCrossLinks(links) {
  for (const [typeName, type] of Object.entries(CONNECTION_TYPES)) {
    if (typeName === state.mode) continue;
    if (typeName === 'syllables' && state.syllableAltitude) continue; // shown as altitude instead
    if (!(state.forceWeights[typeName] > 0)) continue;
    const buckets = new Map();
    for (const word of state.words) {
      const key = type.keyOf(word);
      if (!key) continue;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(word);
    }
    for (const [, members] of buckets) {
      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
          links.push({ source: `w:${members[i].text}`, target: `w:${members[j].text}`, kind: typeName });
        }
      }
    }
  }
}

// Poem-order flow: consecutive words of the draft, traced as directed edges
function flowPairs() {
  if (!(state.forceWeights.flow > 0) || !state.draft) return [];
  const have = new Set(state.words.map(w => w.text));
  const seq = [];
  for (const tok of (state.draft.toLowerCase().match(/[a-z']+/g) || [])) {
    const clean = tok.replace(/'/g, '');
    if (have.has(clean)) seq.push(clean);
  }
  const seen = new Set();
  const pairs = [];
  for (let i = 0; i < seq.length - 1; i++) {
    if (seq[i] === seq[i + 1]) continue;
    const k = `${seq[i]}→${seq[i + 1]}`;
    if (seen.has(k)) continue;
    seen.add(k);
    pairs.push([seq[i], seq[i + 1]]);
  }
  return pairs;
}

function addFlowLinks(links) {
  for (const [a, b] of flowPairs()) {
    links.push({ source: `w:${a}`, target: `w:${b}`, kind: 'flow' });
  }
}

// ===== 3D rendering =====
const container = document.querySelector('#graph3d');

// Orbit controls (not trackball): the camera never rolls, so "up" is always
// up — the stable frame of reference syllable altitude needs.
const Graph = new ForceGraph3D(container, { controlType: 'orbit' })
  .backgroundColor(INK)
  .showNavInfo(false)
  .nodeThreeObject(node => makeNodeObject(node))
  .linkColor(link => {
    if (link.kind === 'member') return 'rgba(232,226,211,0.6)';
    if (link.kind === 'syzygy') return 'rgba(232,226,211,0.35)';
    if (link.kind === 'current') return '#b0705c';
    if (link.kind === 'gate') return '#8a94b8';
    if (link.kind === 'flow') return '#d9be7c';
    return CONNECTION_TYPES[link.kind].color;
  })
  .linkOpacity(0.55)
  .linkWidth(link => {
    if (link.kind === 'member') return 0.4;
    if (link.kind === 'syzygy') return 0.25;
    if (link.kind === 'current') return 0.55;
    if (link.kind === 'gate') return 0.3;
    if (link.kind === 'flow') return 0.5;
    return 0.3 + (state.forceWeights[link.kind] || 0) * 0.9;
  })
  .linkCurvature(link => link.kind === 'gate' ? 0.4 : link.kind === 'current' ? 0.12 : 0)
  .linkDirectionalParticles(link => link.kind === 'flow' ? 3 : link.kind === 'current' ? 2 : link.kind === 'gate' ? 1 : 0)
  .linkDirectionalParticleSpeed(link => link.kind === 'flow' ? 0.006 : link.kind === 'gate' ? 0.002 : 0.0035)
  .linkDirectionalParticleWidth(1.7)
  .onNodeClick(node => {
    if (node.type === 'plus') { openAddPanel(); return; }
    // With a form template open, clicking a word fills the armed end-word box
    if (node.type === 'word' && state.form &&
        document.querySelector('#draft').style.display !== 'none') {
      if (fillSlotFromGraph(node.word.text)) return;
    }
    if (node.type === 'hub') openGroupPanel(node.key);
    else if (node.type === 'word') openGroupPanel(activeKeyOf(node.word));
  })
  .onNodeDragEnd(node => { node.fx = null; node.fy = null; node.fz = null; })
  .onNodeHover(node => {
    container.style.cursor = node ? 'pointer' : '';
    if (hoveredNode === node) return;
    if (hoveredNode) applyNodeHover(hoveredNode, false);
    hoveredNode = node || null;
    if (hoveredNode) applyNodeHover(hoveredNode, true);
  })
  .onBackgroundClick(() => { if (panelMode !== 'closed') closePanel(); });

let hoveredNode = null;

function wordLabelColor(word) {
  return word.lineEnd ? '#d9be7c' : '#f2ede0';
}

function applyNodeHover(node, on) {
  const obj = node.__threeObj;
  if (!obj) return;
  obj.scale.setScalar(on ? (node.type === 'word' ? 1.18 : 1.07) : 1);
  if (node.type === 'word') {
    const label = obj.children.find(c => c instanceof SpriteText);
    if (label) label.color = on ? '#ffffff' : wordLabelColor(node.word);
  }
}

// Forces: members hold their hub tight; cross-links pull per slider weight.
// Charge (repulsion) is set per-refresh, scaled to the number of words —
// small poems stay compact, bigger ones get room to breathe.
Graph.d3Force('link')
  .distance(link => {
    if (link.kind === 'member') return 24;
    if (link.kind === 'flow') return 42;
    return 50;
  })
  .strength(link => {
    if (link.kind === 'member') return 0.9;
    if (['syzygy', 'current', 'gate'].includes(link.kind)) return 0; // decorative: both ends pinned
    if (link.kind === 'flow') return 0.2 * (state.forceWeights.flow || 0);
    return 0.35 * (state.forceWeights[link.kind] || 0);
  });
Graph.d3Force('center').strength(0.14);
Graph.d3Force('collide', forceCollide().radius(n => n.type === 'hub' ? 24 : 11));

// Invisible spherical boundary: repulsion can spread the poem, but nothing
// escapes the sphere. Radius grows gently with the word count.
function boundaryRadius() {
  return 110 + Math.min(state.words.length * 5, 180);
}

function boundaryForce() {
  let nodes = [];
  const force = alpha => {
    const R = boundaryRadius();
    for (const n of nodes) {
      const d = Math.hypot(n.x || 0, n.y || 0, n.z || 0) || 1;
      if (d > R) {
        const k = ((d - R) / d) * alpha * 0.5;
        n.vx -= n.x * k;
        n.vy -= n.y * k;
        n.vz -= n.z * k;
      }
    }
  };
  force.initialize = ns => { nodes = ns; };
  return force;
}
Graph.d3Force('boundary', boundaryForce());

function scaledCharge() {
  return -(15 + Math.min(state.words.length * 4, 65));
}

// Depth cues: light fog + a faint field of warm-gray stars, like foxing on old paper
const scene = Graph.scene();
scene.fog = new THREE.FogExp2(0x0c0b10, 0.0007);

const starGeo = new THREE.BufferGeometry();
const starPos = new Float32Array(1500);
for (let i = 0; i < starPos.length; i++) starPos[i] = (Math.random() - 0.5) * 2600;
starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({
  color: 0x6e685c, size: 1.1, sizeAttenuation: true, transparent: true, opacity: 0.7,
})));

// ===== Syllable altitude =====
// Words float at a height set by their syllable count; guide rings mark strata.
const strataGroup = new THREE.Group();
scene.add(strataGroup);

// Strata breathe with the poem: more words → taller floors and wider rings
function stratumSpacing() {
  return 40 + Math.min(state.words.length * 2.5, 60);
}

function stratumY(syllables) {
  return ((syllables || 1) - 2) * stratumSpacing();
}

function applyAltitudeForce() {
  if (state.syllableAltitude) {
    Graph.d3Force('syllY',
      forceY(n => n.type === 'word' ? stratumY(n.word.syllables) : 0)
        .strength(n => n.type === 'word' ? 0.85 : 0));
  } else {
    Graph.d3Force('syllY', null);
  }
}

function updateStrataGuides() {
  strataGroup.clear();
  if (!state.syllableAltitude || !state.words.length) return;

  // Ring radius adapts to the words' actual horizontal spread and grows
  // with the poem
  const placed = Graph.graphData().nodes.filter(n => n.type === 'word' && n.x !== undefined);
  const radius = Math.min(420, Math.max(70 + state.words.length * 4,
    ...placed.map(n => Math.hypot(n.x || 0, n.z || 0) + 30)));

  const counts = [...new Set(state.words.map(w => w.syllables || 1))].sort((a, b) => a - b);
  for (const count of counts) {
    const y = stratumY(count);
    const points = [];
    for (let i = 0; i <= 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(a) * radius, y, Math.sin(a) * radius));
    }
    const ring = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({ color: 0xe8e2d3, transparent: true, opacity: 0.16 })
    );
    const label = new SpriteText(`${count} syllable${count > 1 ? 's' : ''}`, 5.4, 'rgba(232,226,211,0.6)');
    label.fontFace = '"Inter", sans-serif';
    label.position.set(radius + 16, y, 0);
    strataGroup.add(ring, label);
  }
}

// Re-measure the rings once the layout settles
Graph.onEngineStop(() => { if (state.syllableAltitude) updateStrataGuides(); });

// The continuous Barker spiral, etched as a dashed hairline through the zones
const spiralGroup = new THREE.Group();
scene.add(spiralGroup);

function updateSpiralGuide() {
  spiralGroup.clear();
  if (state.mode !== 'gematria' || state.numoLayout !== 'spiral') return;

  const scale = numoScale() * 1.6;
  const points = [];
  for (let i = 0; i <= 300; i++) {
    const k = -0.45 + (i / 300) * 10.35; // overshoot both ends a little
    const [x, y, z] = spiralParam(k);
    points.push(new THREE.Vector3(x * scale, y * scale, z * scale));
  }
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineDashedMaterial({
      color: 0xe8e2d3, transparent: true, opacity: 0.22,
      dashSize: 4.5, gapSize: 3.5,
    })
  );
  line.computeLineDistances();
  spiralGroup.add(line);
}

// ===== Etched-atlas rendering =====
// Hubs are engraved circles (always facing the viewer, like a chart symbol);
// words are the typography itself, anchored by a small point.

function makeSprite(canvas, scale) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, transparent: true, depthWrite: false,
  }));
  sprite.scale.setScalar(scale);
  return sprite;
}

function hubSprite(label, r, zone = null, ghost = false) {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const cx = S / 2;
  const R = S / 2 - 28;
  const alpha = ghost ? 0.35 : 1;
  ctx.globalAlpha = alpha;

  // engraved double circle — zone hubs take their zone's tint
  const stroke = zone !== null ? ZONE_CLR[zone] : 'rgba(238,232,218,1)';
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.arc(cx, cx, R, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(232,226,211,0.3)';
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(cx, cx, R - 20, 0, Math.PI * 2); ctx.stroke();

  // tick marks at the eighth points
  ctx.strokeStyle = 'rgba(232,226,211,0.75)';
  ctx.lineWidth = 4;
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * (R + 6), cx + Math.sin(a) * (R + 6));
    ctx.lineTo(cx + Math.cos(a) * (R + 20), cx + Math.sin(a) * (R + 20));
    ctx.stroke();
  }

  ctx.font = `600 ${zone !== null ? 138 : 158}px ${SERIF}`;
  ctx.fillStyle = 'rgba(238,232,218,1)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, cx, zone !== null ? cx - 12 : cx + 10);

  if (zone !== null) {
    // the zone's phonic particle, etched beneath
    ctx.font = '400 52px "Inter", sans-serif';
    ctx.fillStyle = 'rgba(232,226,211,0.6)';
    ctx.fillText(ZONE_LORE[zone].particle, cx, cx + 96);
  }

  return makeSprite(c, r * 2.9);
}

function plusSpriteObj(empty) {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const cx = S / 2;
  ctx.strokeStyle = 'rgba(232,226,211,0.55)';
  ctx.lineWidth = 3;
  ctx.setLineDash([12, 11]);
  ctx.beginPath(); ctx.arc(cx, cx, cx - 10, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = `300 130px ${SERIF}`;
  ctx.fillStyle = 'rgba(232,226,211,0.8)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('+', cx, cx + 8);
  const sprite = makeSprite(c, empty ? 28 : 17);
  let t = Math.random() * Math.PI * 2;
  sprite.onBeforeRender = () => {
    t += 0.015;
    sprite.material.opacity = 0.8 + Math.sin(t) * 0.18;
  };
  return sprite;
}

// Subtle ink tints by part of speech
const POS_TINTS = { n: 0xe8e2d3, v: 0xd6bd8a, adj: 0xd8bfae, adv: 0xb4b8cb };

function makeNodeObject(node) {
  const group = new THREE.Group();

  if (node.type === 'hub') {
    const r = 12 + Math.min(node.memberCount * 1.4, 9);
    const zone = node.zone !== undefined ? node.zone : null;
    group.add(hubSprite(node.label, r, zone, zone !== null && node.memberCount === 0));
    return group;
  }

  if (node.type === 'word') {
    const r = 2.2 + Math.min(node.word.syllables || 1, 5) * 0.7;
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(r, 16, 16),
      new THREE.MeshBasicMaterial({ color: POS_TINTS[node.word.pos?.[0]] ?? 0x9b9588 })
    );
    // Line-ending words (from a read-in poem) carry the rhyme scheme — brass
    const label = new SpriteText(node.word.text, 10, wordLabelColor(node.word));
    label.fontFace = SERIF;
    label.fontWeight = '600';
    label.strokeColor = 'rgba(12,11,16,0.85)';
    label.strokeWidth = 0.7;
    label.position.y = r + 7.5;
    group.add(dot, label);
    return group;
  }

  // plus node
  group.add(plusSpriteObj(node.empty));
  if (node.empty) {
    const hint = new SpriteText('add your first word', 3.8, 'rgba(232,226,211,0.55)');
    hint.fontFace = '"Inter", sans-serif';
    hint.position.y = -19;
    group.add(hint);
  }
  return group;
}

function refreshGraph() {
  Graph.d3Force('charge').strength(scaledCharge());
  if (state.syllableAltitude) applyAltitudeForce(); // spacing scales with word count
  // graphData() reheats the simulation itself when the data changes
  Graph.graphData(buildGraphData());
  updateStrataGuides();
  updateSpiralGuide();
  renderForcesPanel();
}

// ===== Word management =====
async function fetchWordInfo(text) {
  try {
    const res = await fetch(`${API_URL}/api/word-info?word=${encodeURIComponent(text)}`);
    if (!res.ok) throw new Error('bad response');
    return await res.json();
  } catch (e) {
    return {
      word: normalizeWord(text),
      ending: localRhymeEnding(text),
      onset: localOnset(text),
      syllables: localSyllables(text),
      pos: [],
      rhymes: [],
    };
  }
}

// True-rhyme grouping: spelling endings differ ("tone" / "known"), so a word
// joins an existing group whenever it genuinely rhymes with a member —
// checked against the new word's rhyme list and each group's cached one.
function findRhymeGroup(clean, info) {
  const rhymeSet = new Set(info.rhymes || []);
  const groups = new Map();
  for (const w of state.words) {
    if (!groups.has(w.rhymeKey)) groups.set(w.rhymeKey, []);
    groups.get(w.rhymeKey).push(w.text);
  }
  for (const [key, members] of groups) {
    if (members.some(m => rhymeSet.has(m))) return key;
    const cached = suggestionCache.get(`rhyme:${key}`);
    if (cached && cached.includes(clean)) return key;
  }
  return null;
}

async function addWord(text, { rhymeKey = null, onsetKey = null } = {}) {
  const clean = normalizeWord(text);
  if (!clean) return null;
  const existing = state.words.find(w => w.text === clean);
  if (existing) return existing;

  const info = await fetchWordInfo(clean);
  const word = {
    text: clean,
    rhymeKey: rhymeKey || findRhymeGroup(clean, info) || info.ending,
    onsetKey: onsetKey || info.onset,
    pos: info.pos || [],
    syllables: info.syllables || localSyllables(clean),
  };
  state.words.push(word);

  if (info.rhymes?.length && !suggestionCache.has(`rhyme:${word.rhymeKey}`)) {
    suggestionCache.set(`rhyme:${word.rhymeKey}`, info.rhymes);
  }

  saveState();
  refreshGraph();
  return word;
}

function removeWord(text) {
  state.words = state.words.filter(w => w.text !== text);
  nodeCache.delete(`w:${text}`);
  saveState();
  refreshGraph();
  if (panelMode === 'group') {
    const stillExists = state.words.some(w => activeKeyOf(w) === selectedGroupKey);
    if (stillExists) openGroupPanel(selectedGroupKey);
    else closePanel();
  }
}

// Older saved words may lack pos/syllables — backfill quietly
async function backfillMeta() {
  const missing = state.words.filter(w => w.pos === undefined || w.syllables === undefined);
  if (!missing.length) return;
  await Promise.all(missing.map(async w => {
    const info = await fetchWordInfo(w.text);
    w.pos = info.pos || [];
    w.syllables = info.syllables || localSyllables(w.text);
    const node = nodeCache.get(`w:${w.text}`);
    if (node) delete node.__threeObj; // size/tint depend on the new metadata
  }));
  saveState();
  refreshGraph();
}

// ===== Suggestions =====
async function getSuggestions(groupKey, members) {
  const cacheKey = `${state.mode}:${groupKey}`;
  if (suggestionCache.has(cacheKey)) return suggestionCache.get(cacheKey);

  let words = [];
  try {
    if (state.mode === 'rhyme') {
      const anchor = members[0].text;
      const res = await fetch(`${API_URL}/api/word-info?word=${encodeURIComponent(anchor)}`);
      const data = await res.json();
      words = data.rhymes || [];
    } else {
      const res = await fetch(`${API_URL}/api/alliterations?onset=${encodeURIComponent(groupKey)}`);
      const data = await res.json();
      words = data.words || [];
    }
  } catch (e) {
    words = [];
  }

  suggestionCache.set(cacheKey, words);
  return words;
}

// ===== Panel =====
const panel = document.querySelector('#panel');
const panelTitle = document.querySelector('#panelTitle');
const panelBody = document.querySelector('#panelBody');

function closePanel() {
  panelMode = 'closed';
  selectedGroupKey = null;
  panel.style.display = 'none';
}

function openAddPanel() {
  panelMode = 'add';
  selectedGroupKey = null;
  panel.style.display = 'flex';
  panelTitle.textContent = 'Add words';
  panelBody.innerHTML = `
    <div class="add-input">
      <input type="text" id="wordInput" placeholder="a word, or several…" autocomplete="off">
      <button id="wordAddBtn">Add</button>
    </div>
    <p class="muted" style="margin-top: 10px;">
      Enter keeps the field open, so you can pour in a handful.
      Separate several with spaces or commas.
    </p>
    <div id="addLog" class="chip-list" style="margin-top: 12px;"></div>`;

  const input = document.querySelector('#wordInput');
  const log = document.querySelector('#addLog');
  const submit = async () => {
    const values = input.value.split(/[\s,]+/).filter(Boolean);
    if (!values.length) return;
    input.value = '';
    for (const value of values) {
      const word = await addWord(value);
      if (word && panelMode === 'add') {
        const chip = document.createElement('span');
        chip.className = 'chip member';
        chip.innerHTML = `${word.text} <span class="meta">→ ${
          state.mode === 'rhyme' ? '-' + word.rhymeKey
          : state.mode === 'gematria' ? 'zone ' + zoneOf(word.text)
          : word.onsetKey.toUpperCase() + '-'}</span>`;
        chip.title = 'view group';
        chip.addEventListener('click', () => openGroupPanel(activeKeyOf(word)));
        log.prepend(chip);
      }
    }
    if (panelMode === 'add') input.focus();
  };
  document.querySelector('#wordAddBtn').addEventListener('click', submit);
  input.addEventListener('keypress', e => { if (e.key === 'Enter') submit(); });
  input.focus();
}

function memberChip(m) {
  if (state.mode === 'gematria') {
    const aq = aqValue(m.text);
    return `<span class="chip member" data-word="${m.text}" title="AQ ${plexSteps(aq)}">${m.text}<span class="meta">${aq}</span><span class="x">✕</span></span>`;
  }
  const posName = POS_NAMES[m.pos?.[0]] || '';
  const meta = [posName, m.syllables ? `${m.syllables} syl` : ''].filter(Boolean).join(' · ');
  return `<span class="chip member" data-word="${m.text}" title="${meta || 'click to remove'}">${m.text}<span class="meta">${m.syllables || ''}</span><span class="x">✕</span></span>`;
}

async function openGroupPanel(groupKey) {
  panelMode = 'group';
  selectedGroupKey = groupKey;
  panel.style.display = 'flex';

  const members = state.words.filter(w => activeKeyOf(w) === groupKey);

  if (state.mode === 'gematria') {
    const z = parseInt(groupKey);
    const lore = ZONE_LORE[z];
    const [a, b, demon] = SYZYGY_PAIRS.find(([x, y]) => x === z || y === z);
    const twin = a === z ? b : a;
    const current = NUMO_CURRENTS.find(([, f, t]) => f === z || t === z);
    panelTitle.textContent = `Zone ${z} — ${lore.planet}`;
    panelBody.innerHTML = `
      <h3>In this poem — words plexing to ${z}</h3>
      <div class="chip-list">${members.map(memberChip).join('') || '<span class="muted">no words have settled here yet</span>'}</div>
      <h3>Zone lore</h3>
      <p class="muted" style="font-style: normal; line-height: 1.65;">${lore.line}</p>
      <p class="muted" style="font-style: normal; line-height: 1.65; margin-top: 8px;">
        Region: ${lore.region} · particle <em>${lore.particle}</em><br>
        Syzygy ${z}::${twin} — <em>${demon}</em>${current ? `<br>Current: ${current[0]} (${current[1]}→${current[2]})` : ''}
      </p>
      <button id="addAnotherBtn" style="margin-top: 16px; background: transparent; border: 1px solid var(--hairline-strong); color: var(--bone); padding: 7px 14px; cursor: pointer; font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.12em; width: 100%;">＋ add another word</button>`;
    panelBody.querySelectorAll('.chip.member').forEach(chip => {
      chip.addEventListener('click', () => removeWord(chip.dataset.word));
    });
    panelBody.querySelector('#addAnotherBtn').addEventListener('click', openAddPanel);
    return;
  }

  panelTitle.textContent = state.mode === 'rhyme'
    ? `Rhyme group “-${groupKey}”`
    : `Alliteration group “${groupKey.toUpperCase()}-”`;

  panelBody.innerHTML = `
    <h3>In this poem</h3>
    <div class="chip-list">${members.map(memberChip).join('') || '<span class="muted">none yet</span>'}</div>
    <h3>${state.mode === 'rhyme' ? 'Rhymes' : 'Same starting sound'} — click to add</h3>
    <div class="chip-list" id="suggestionList"><span class="muted">loading…</span></div>
    <button id="addAnotherBtn" style="margin-top: 16px; background: transparent; border: 1px solid var(--hairline-strong); color: var(--bone); padding: 7px 14px; cursor: pointer; font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.12em; width: 100%;">＋ add another word</button>`;

  panelBody.querySelectorAll('.chip.member').forEach(chip => {
    chip.addEventListener('click', () => removeWord(chip.dataset.word));
  });
  panelBody.querySelector('#addAnotherBtn').addEventListener('click', openAddPanel);

  const suggestions = await getSuggestions(groupKey, members);
  if (panelMode !== 'group' || selectedGroupKey !== groupKey) return;

  const list = document.querySelector('#suggestionList');
  const existing = new Set(state.words.map(w => w.text));
  const fresh = suggestions.filter(w => !existing.has(w)).slice(0, 24);

  if (!fresh.length) {
    list.innerHTML = '<span class="muted">no suggestions found</span>';
    return;
  }

  list.innerHTML = fresh.map(w => `<span class="chip" data-word="${w}">${w}</span>`).join('');
  list.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', async () => {
      const opts = state.mode === 'rhyme' ? { rhymeKey: groupKey } : { onsetKey: groupKey };
      await addWord(chip.dataset.word, opts);
      openGroupPanel(groupKey);
    });
  });
}

// ===== Camera axis locks =====
// "spin" pins the polar angle (rotate around the vertical axis only);
// "tilt" pins the azimuth (pitch over the top only); "face" squares up.
function applyCamLock() {
  const controls = Graph.controls();
  controls.minPolarAngle = 0;
  controls.maxPolarAngle = Math.PI;
  controls.minAzimuthAngle = -Infinity;
  controls.maxAzimuthAngle = Infinity;
  if (ui.camLock === 'turntable') {
    const p = controls.getPolarAngle();
    controls.minPolarAngle = p;
    controls.maxPolarAngle = p;
  } else if (ui.camLock === 'tilt') {
    const a = controls.getAzimuthalAngle();
    controls.minAzimuthAngle = a;
    controls.maxAzimuthAngle = a;
  }
}

function faceThePlate() {
  const prev = ui.camLock;
  ui.camLock = 'free';
  applyCamLock();
  Graph.cameraPosition({ x: 0, y: 0, z: 520 }, { x: 0, y: 0, z: 0 }, 800);
  setTimeout(() => {
    if (state.mode !== 'gematria') Graph.zoomToFit(600, 40, n => n.type !== 'plus');
    else Graph.zoomToFit(600, 40, n => n.type === 'hub');
  }, 900);
  setTimeout(() => { ui.camLock = prev; applyCamLock(); }, 1700);
}

// ===== Forces panel =====
function renderForcesPanel() {
  const wrap = document.querySelector('#forces');
  const rows = document.querySelector('#forceRows');
  if (!state.words.length) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'block';

  rows.innerHTML = Object.entries(CONNECTION_TYPES).map(([name, type]) => {
    const isGrouping = name === state.mode;
    const isAltitude = name === 'syllables' && state.syllableAltitude;
    const value = Math.round((state.forceWeights[name] || 0) * 100);
    const label = isAltitude ? `${type.label} <span class="mark">↕</span>`
      : `${type.label}${isGrouping ? ' <span class="mark">◉</span>' : ''}`;
    const title = isGrouping ? 'currently the grouping — always strong'
      : isAltitude ? 'shown as altitude instead of links' : '';
    return `
      <div class="force-row ${isGrouping || isAltitude ? 'disabled' : ''}" title="${title}">
        <span class="swatch" style="background:${type.color}"></span>
        <label>${label}</label>
        <input type="range" min="0" max="100" value="${isGrouping ? 100 : value}" data-type="${name}" ${isGrouping || isAltitude ? 'disabled' : ''}>
      </div>`;
  }).join('') + `
      <div class="force-row ${state.draft ? '' : 'disabled'}" title="${state.draft ? 'the poem’s word order, traced through the map' : 'write in the Draft to trace the poem’s flow'}">
        <span class="swatch" style="background:#d9be7c"></span>
        <label>Poem flow <span class="mark">→</span></label>
        <input type="range" min="0" max="100" value="${Math.round((state.forceWeights.flow || 0) * 100)}" data-type="flow" ${state.draft ? '' : 'disabled'}>
      </div>
      <div class="force-row alt-row">
        <span class="swatch" style="background:${CONNECTION_TYPES.syllables.color}; opacity:0.5"></span>
        <label style="width:auto; cursor:pointer; display:flex; align-items:center; gap:6px;">
          <input type="checkbox" id="altToggle" ${state.syllableAltitude ? 'checked' : ''}>
          syllables as altitude
        </label>
      </div>
      <div class="force-row cam-row">
        <label>Camera</label>
        <div class="cam-btns">
          <button data-cam="free" class="${ui.camLock === 'free' ? 'on' : ''}" title="orbit freely">free</button>
          <button data-cam="turntable" class="${ui.camLock === 'turntable' ? 'on' : ''}" title="rotate around the vertical axis only">spin</button>
          <button data-cam="tilt" class="${ui.camLock === 'tilt' ? 'on' : ''}" title="pitch over the top only">tilt</button>
          <button data-cam="face" title="square up to the graph">face</button>
        </div>
      </div>
      ${state.mode === 'gematria' ? `
      <div class="force-row cam-row">
        <label>Numogram</label>
        <div class="cam-btns">
          <button data-layout="plate" class="${state.numoLayout === 'plate' ? 'on' : ''}" title="the canonical decimal labyrinth, regions folded in depth">plate</button>
          <button data-layout="spiral" class="${state.numoLayout === 'spiral' ? 'on' : ''}" title="Barker spiral — syzygies as turns of a helix, 4::5 innermost">spiral</button>
        </div>
      </div>` : ''}`;

  rows.querySelectorAll('input[type="range"]').forEach(slider => {
    slider.addEventListener('input', () => {
      state.forceWeights[slider.dataset.type] = slider.valueAsNumber / 100;
      saveState();
      Graph.graphData(buildGraphData());
    });
  });

  rows.querySelector('#altToggle').addEventListener('change', e => {
    state.syllableAltitude = e.target.checked;
    saveState();
    applyAltitudeForce();
    refreshGraph();
  });

  rows.querySelectorAll('[data-cam]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.cam === 'face') { faceThePlate(); return; }
      ui.camLock = btn.dataset.cam;
      saveUi();
      applyCamLock();
      rows.querySelectorAll('[data-cam]').forEach(b =>
        b.classList.toggle('on', b.dataset.cam === ui.camLock));
    });
  });

  rows.querySelectorAll('[data-layout]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (state.numoLayout === btn.dataset.layout) return;
      state.numoLayout = btn.dataset.layout;
      saveState();
      refreshGraph();
      setTimeout(() => Graph.zoomToFit(800, 40, n => n.type === 'hub'), 1200);
    });
  });
}

// ===== Poetic form templates =====
// Each form is a list of stanzas of lines. A line carries an end-word slot;
// slots repeat (rhyme scheme), and refrain lines mirror a whole source line.
// First occurrence of a slot is editable; recurrences fill themselves.

const SESTINA_PERM = [
  [1, 2, 3, 4, 5, 6],
  [6, 1, 5, 2, 4, 3],
  [3, 6, 4, 1, 2, 5],
  [5, 3, 2, 6, 1, 4],
  [4, 5, 1, 3, 6, 2],
  [2, 4, 6, 5, 3, 1],
];

function sestinaStanzas() {
  const stanzas = SESTINA_PERM.map((perm, s) => ({
    label: `stanza ${s + 1}`,
    lines: perm.map((k, i) => ({ id: `s${s}l${i}`, slots: [`W${k}`], syl: 10 })),
  }));
  stanzas.push({
    label: 'envoi',
    lines: [
      { id: 'e1', slots: ['W2', 'W5'], syl: 10 },
      { id: 'e2', slots: ['W4', 'W3'], syl: 10 },
      { id: 'e3', slots: ['W6', 'W1'], syl: 10 },
    ],
  });
  return stanzas;
}

const FORMS = {
  villanelle: {
    name: 'Villanelle',
    glance: '19 lines · 2 rhymes · 2 refrains',
    about: 'Two whole lines return again and again — alternating as each tercet\'s close, colliding as the final couplet. Only two rhyme sounds carry all nineteen lines.',
    tip: 'Pick two rhyme nodes. Fill the A1 and A2 end-word boxes and write those two lines once — they repeat themselves. Then harvest 5 more A words and 6 B words.',
    hint: 'Write refrain lines <b>1</b> and <b>3</b> once — their echoes fill in. Click an end-word box, then click a word in the graph to fill it.',
    stanzas: [
      { label: 'tercet 1', lines: [
        { id: 'v1', slots: ['A1'], refrain: 'R1', syl: 10 },
        { id: 'v2', slots: ['B1'], syl: 10 },
        { id: 'v3', slots: ['A2'], refrain: 'R2', syl: 10 },
      ]},
      { label: 'tercet 2', lines: [
        { id: 'v4', slots: ['A3'], syl: 10 },
        { id: 'v5', slots: ['B2'], syl: 10 },
        { id: 'v6', lineMirrorOf: 'v1', refrain: 'R1' },
      ]},
      { label: 'tercet 3', lines: [
        { id: 'v7', slots: ['A4'], syl: 10 },
        { id: 'v8', slots: ['B3'], syl: 10 },
        { id: 'v9', lineMirrorOf: 'v3', refrain: 'R2' },
      ]},
      { label: 'tercet 4', lines: [
        { id: 'v10', slots: ['A5'], syl: 10 },
        { id: 'v11', slots: ['B4'], syl: 10 },
        { id: 'v12', lineMirrorOf: 'v1', refrain: 'R1' },
      ]},
      { label: 'tercet 5', lines: [
        { id: 'v13', slots: ['A6'], syl: 10 },
        { id: 'v14', slots: ['B5'], syl: 10 },
        { id: 'v15', lineMirrorOf: 'v3', refrain: 'R2' },
      ]},
      { label: 'quatrain', lines: [
        { id: 'v16', slots: ['A7'], syl: 10 },
        { id: 'v17', slots: ['B6'], syl: 10 },
        { id: 'v18', lineMirrorOf: 'v1', refrain: 'R1' },
        { id: 'v19', lineMirrorOf: 'v3', refrain: 'R2' },
      ]},
    ],
  },
  sestina: {
    name: 'Sestina',
    glance: '39 lines · 6 end-words · no rhyme',
    about: 'Six end-words spiral through six stanzas — each stanza folds the previous order outside-in — then all six land in a three-line envoi.',
    tip: 'Fill the six end-word boxes in stanza 1 (flexible, many-sensed words survive best). The spiral and the envoi fill themselves.',
    hint: 'Set the <b>six end-words in stanza 1</b> — every later box follows the spiral automatically.',
    stanzas: sestinaStanzas(),
  },
  sonnet: {
    name: 'Sonnet',
    glance: '14 lines · ABAB CDCD EFEF GG · pentameter',
    about: 'Three quatrains in alternating rhyme build the argument; the couplet turns it. Ten syllables to a line.',
    tip: 'Seven rhyme nodes, two words each — breadth over depth. Save your best pair for the closing couplet.',
    hint: 'Each rhyme sound is used exactly <b>twice</b>. Aim each line at <b>10 syllables</b> — the counter turns brass when you land it.',
    stanzas: [
      { label: 'quatrain 1', lines: [
        { id: 'n1', slots: ['A1'], syl: 10 }, { id: 'n2', slots: ['B1'], syl: 10 },
        { id: 'n3', slots: ['A2'], syl: 10 }, { id: 'n4', slots: ['B2'], syl: 10 },
      ]},
      { label: 'quatrain 2', lines: [
        { id: 'n5', slots: ['C1'], syl: 10 }, { id: 'n6', slots: ['D1'], syl: 10 },
        { id: 'n7', slots: ['C2'], syl: 10 }, { id: 'n8', slots: ['D2'], syl: 10 },
      ]},
      { label: 'quatrain 3', lines: [
        { id: 'n9', slots: ['E1'], syl: 10 }, { id: 'n10', slots: ['F1'], syl: 10 },
        { id: 'n11', slots: ['E2'], syl: 10 }, { id: 'n12', slots: ['F2'], syl: 10 },
      ]},
      { label: 'couplet', lines: [
        { id: 'n13', slots: ['G1'], syl: 10 }, { id: 'n14', slots: ['G2'], syl: 10 },
      ]},
    ],
  },
  ballad: {
    name: 'Ballad',
    glance: 'quatrains · ABCB · 8/6 beat',
    about: 'The storytelling form: quatrains alternating long and short lines, with only lines two and four rhyming. Extend it as far as the tale runs.',
    tip: 'One fresh rhyme pair per stanza. Keep the beat: roughly 8 syllables, then 6.',
    hint: 'Only lines <b>2 and 4</b> rhyme in each stanza — a fresh node every time. Watch the <b>8/6</b> pulse.',
    stanzas: [1, 2, 3].map(q => ({
      label: `stanza ${q}`,
      lines: [
        { id: `q${q}l1`, slots: [], syl: 8 },
        { id: `q${q}l2`, slots: [`B${q}a`], syl: 6, schemeOverride: 'B' },
        { id: `q${q}l3`, slots: [], syl: 8 },
        { id: `q${q}l4`, slots: [`B${q}b`], syl: 6, schemeOverride: 'B' },
      ],
    })),
  },
  limerick: {
    name: 'Limerick',
    glance: '5 lines · AABBA · anapestic',
    about: 'Long, long, short, short, long — and the last long line is the punchline. Keep it bouncing: da-da-DUM.',
    tip: 'Pick your line-5 punchline word first, then work backwards through its rhyme node for lines 1 and 2.',
    hint: 'Choose the <b>line 5</b> end-word first — it\'s the punchline. Lines 3–4 take a second node.',
    stanzas: [{ label: 'the five', lines: [
      { id: 'l1', slots: ['A1'], syl: 9 },
      { id: 'l2', slots: ['A2'], syl: 9 },
      { id: 'l3', slots: ['B1'], syl: 6 },
      { id: 'l4', slots: ['B2'], syl: 6 },
      { id: 'l5', slots: ['A3'], syl: 9 },
    ]}],
  },
  triolet: {
    name: 'Triolet',
    glance: '8 lines · 2 rhymes · line 1 returns twice',
    about: 'A miniature music box: line 1 returns as lines 4 and 7, line 2 returns as line 8. Only five lines are truly yours to write.',
    tip: 'Write lines 1 and 2 so their meaning can shift on return. Two small rhyme nodes cover it.',
    hint: 'Write lines <b>1</b> and <b>2</b> — their returns fill in. Three fresh A words, one fresh B.',
    stanzas: [{ label: 'the eight', lines: [
      { id: 't1', slots: ['A1'], refrain: 'Ra', syl: 8 },
      { id: 't2', slots: ['B1'], refrain: 'Rb', syl: 8 },
      { id: 't3', slots: ['A2'], syl: 8 },
      { id: 't4', lineMirrorOf: 't1', refrain: 'Ra' },
      { id: 't5', slots: ['A3'], syl: 8 },
      { id: 't6', slots: ['B2'], syl: 8 },
      { id: 't7', lineMirrorOf: 't1', refrain: 'Ra' },
      { id: 't8', lineMirrorOf: 't2', refrain: 'Rb' },
    ]}],
  },
  haiku: {
    name: 'Haiku',
    glance: '3 lines · 5 / 7 / 5 syllables',
    about: 'Seventeen syllables and a cut: set an image, extend it, pivot. No rhyme to gather — this one is all meter.',
    tip: 'Turn on syllables-as-altitude and read the strata like a till: budget each line, then spend.',
    hint: 'No end-word boxes here — just hit <b>5 / 7 / 5</b>. The counter turns brass on target.',
    stanzas: [{ label: 'the three', lines: [
      { id: 'h1', slots: [], syl: 5 },
      { id: 'h2', slots: [], syl: 7 },
      { id: 'h3', slots: [], syl: 5 },
    ]}],
  },
};

// Color class from a slot name: A1 → cA, W3 → third color, B2a → cB
function slotColorClass(slot, schemeOverride) {
  if (schemeOverride) return `c${schemeOverride}`;
  if (slot.startsWith('W')) return 'c' + 'ABCDEF'[parseInt(slot[1]) - 1];
  return `c${slot[0]}`;
}

// ===== Draft drawer =====
// A place to actually write — with a live syllable count per line.
// Words already in the graph use their true (Datamuse) counts; everything
// else falls back to the local heuristic.
const draftEl = document.querySelector('#draft');
const draftText = document.querySelector('#draftText');
const draftGutter = document.querySelector('#draftGutter');

function lineSyllables(line) {
  const tokens = line.toLowerCase().match(/[a-z']+/g) || [];
  if (!tokens.length) return '';
  const known = new Map(state.words.map(w => [w.text, w.syllables]));
  return tokens.reduce((sum, t) => {
    const clean = t.replace(/'/g, '');
    return sum + (known.get(clean) ?? localSyllables(clean));
  }, 0);
}

function lineAq(line) {
  const tokens = line.toLowerCase().match(/[a-z0-9']+/g) || [];
  if (!tokens.length) return null;
  return tokens.reduce((sum, t) => sum + aqValue(t.replace(/'/g, '')), 0);
}

function updateDraftGutter() {
  draftGutter.innerHTML = draftText.value.split('\n')
    .map(line => {
      const aq = lineAq(line);
      const aqSpan = aq === null ? ''
        : `<span class="aq" title="AQ ${plexSteps(aq)}">${aq}<span class="aq-zone">${digitalRoot(aq)}</span></span>`;
      return `<div>${lineSyllables(line)}${aqSpan}</div>`;
    })
    .join('');
  draftGutter.scrollTop = draftText.scrollTop;
}

let flowRefreshTimer = null;
draftText.addEventListener('input', () => {
  state.draft = draftText.value;
  saveState();
  updateDraftGutter();
  // retrace poem flow as the draft changes
  if (state.forceWeights.flow > 0) {
    clearTimeout(flowRefreshTimer);
    flowRefreshTimer = setTimeout(refreshGraph, 900);
  }
});
draftText.addEventListener('scroll', () => { draftGutter.scrollTop = draftText.scrollTop; });

// ===== Form template mode =====
const templateWrap = document.querySelector('#templateWrap');
const freeDraft = document.querySelector('#freeDraft');
const formClearBtn = document.querySelector('#formClearBtn');
const draftTitle = document.querySelector('#draftTitle');
let armedSlot = null;
let editableSlotOrder = [];

function esc(v) {
  return String(v || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function findLine(form, id) {
  for (const stanza of form.stanzas) {
    for (const line of stanza.lines) if (line.id === id) return line;
  }
  return null;
}

function renderTemplate() {
  const form = FORMS[state.form];
  if (!form) return;
  const seen = new Set();
  editableSlotOrder = [];
  let html = `<div class="t-hint">${form.hint}</div>`;

  for (const stanza of form.stanzas) {
    html += `<div class="t-stanza"><div class="t-stanza-label">${stanza.label}</div>`;
    for (const line of stanza.lines) {
      const isMirror = !!line.lineMirrorOf;
      const src = isMirror ? findLine(form, line.lineMirrorOf) : line;
      const bodyId = isMirror ? line.lineMirrorOf : line.id;
      const target = src.syl || 0;

      html += `<div class="t-line" data-syl="${target}">
        <span class="t-syl"></span>
        <input class="t-body" data-body="${bodyId}" value="${esc(state.formBodies[bodyId])}" ${isMirror ? 'disabled' : ''} placeholder="${isMirror ? '' : '…'}">`;

      for (const slot of (src.slots || [])) {
        const editable = !isMirror && !seen.has(slot);
        if (editable) {
          seen.add(slot);
          editableSlotOrder.push(slot);
        }
        html += `<input class="t-end ${slotColorClass(slot, src.schemeOverride)}" data-slot="${slot}" value="${esc(state.formSlots[slot])}" ${editable ? '' : 'disabled'} placeholder="${slot}">`;
      }

      html += `<span class="t-ref">${line.refrain || ''}</span></div>`;
    }
    html += `</div>`;
  }

  templateWrap.innerHTML = html;
  wireTemplate();
  updateTemplateSyls();
  updateArmedHighlight();
}

function updateTemplateSyls() {
  templateWrap.querySelectorAll('.t-line').forEach(row => {
    const body = row.querySelector('.t-body')?.value || '';
    const ends = [...row.querySelectorAll('.t-end')].map(i => i.value).join(' ');
    const target = parseInt(row.dataset.syl) || 0;
    const count = lineSyllables(`${body} ${ends}`.trim());
    const span = row.querySelector('.t-syl');
    span.textContent = count === '' ? (target ? `·/${target}` : '') : `${count}${target ? '/' + target : ''}`;
    span.classList.toggle('hit', !!target && count === target);
  });
}

function updateArmedHighlight() {
  templateWrap.querySelectorAll('.t-end').forEach(input => {
    input.classList.toggle('armed', !input.disabled && input.dataset.slot === armedSlot);
  });
}

function syncSlotInputs(slot, except) {
  templateWrap.querySelectorAll(`.t-end[data-slot="${slot}"]`).forEach(input => {
    if (input !== except) input.value = state.formSlots[slot] || '';
  });
}

function wireTemplate() {
  templateWrap.querySelectorAll('.t-body:not([disabled])').forEach(input => {
    input.addEventListener('input', () => {
      state.formBodies[input.dataset.body] = input.value;
      saveState();
      templateWrap.querySelectorAll(`.t-body[disabled][data-body="${input.dataset.body}"]`)
        .forEach(m => { m.value = input.value; });
      updateTemplateSyls();
    });
  });

  templateWrap.querySelectorAll('.t-end:not([disabled])').forEach(input => {
    input.addEventListener('input', () => {
      state.formSlots[input.dataset.slot] = input.value.trim();
      saveState();
      syncSlotInputs(input.dataset.slot, input);
      updateTemplateSyls();
    });
    input.addEventListener('focus', () => {
      armedSlot = input.dataset.slot;
      updateArmedHighlight();
    });
  });
}

// Clicking a word in the graph fills the armed (or next empty) end-word box
function fillSlotFromGraph(text) {
  let slot = armedSlot;
  if (!slot || state.formSlots[slot]) {
    slot = editableSlotOrder.find(s => !state.formSlots[s]) || armedSlot;
  }
  if (!slot) return false;
  state.formSlots[slot] = text;
  saveState();
  syncSlotInputs(slot, null);
  armedSlot = editableSlotOrder.find(s => !state.formSlots[s]) || null;
  updateArmedHighlight();
  updateTemplateSyls();
  return true;
}

function renderDraft() {
  const formActive = !!(state.form && FORMS[state.form]);
  draftEl.classList.toggle('form-mode', formActive);
  freeDraft.style.display = formActive ? 'none' : 'flex';
  templateWrap.style.display = formActive ? 'block' : 'none';
  formClearBtn.style.display = formActive ? 'inline-block' : 'none';

  if (formActive) {
    draftTitle.innerHTML = `Draft <span class="draft-note">${FORMS[state.form].name} — ${FORMS[state.form].glance}</span>`;
    renderTemplate();
  } else {
    draftTitle.innerHTML = 'Draft <span class="draft-note">syllables count themselves</span>';
    draftText.value = state.draft || '';
    updateDraftGutter();
  }
}

function openDraft() {
  draftEl.style.display = 'flex';
  renderDraft();
}

formClearBtn.addEventListener('click', () => {
  state.form = null;
  state.formSlots = {};
  state.formBodies = {};
  armedSlot = null;
  saveState();
  renderDraft();
});

// ===== Form modal =====
const formModal = document.querySelector('#formModal');
let pendingForm = null;

function showFormModal(key) {
  const form = FORMS[key];
  if (!form) return;
  pendingForm = key;
  document.querySelector('#modalTitle').textContent = form.name;
  document.querySelector('#modalGlance').textContent = form.glance;
  document.querySelector('#modalBody').textContent = form.about;
  document.querySelector('#modalTip').textContent = form.tip;
  document.querySelector('#modalGuide').href = `forms.html#${key}`;
  formModal.style.display = 'flex';
}

document.querySelector('#modalBegin').addEventListener('click', () => {
  formModal.style.display = 'none';
  if (state.form !== pendingForm) {
    state.form = pendingForm;
    state.formSlots = {};
    state.formBodies = {};
  }
  armedSlot = null;
  saveState();
  openDraft();
});

formModal.addEventListener('click', e => {
  if (e.target === formModal) formModal.style.display = 'none';
});

document.querySelector('#draftBtn').addEventListener('click', () => {
  const open = draftEl.style.display !== 'none';
  if (open) {
    draftEl.style.display = 'none';
  } else {
    openDraft();
    if (!state.form) draftText.focus();
  }
});
document.querySelector('#draftClose').addEventListener('click', () => {
  draftEl.style.display = 'none';
});

// ===== Movable & collapsible panels =====
// Every floating box can be dragged by its header and collapsed to a bar;
// positions and collapsed states persist.
const UI_KEY = 'poetry-workspace-ui-v1';
let ui = { collapsed: {}, pos: {}, size: {}, camLock: 'free' };
try {
  const savedUi = JSON.parse(localStorage.getItem(UI_KEY) || '{}');
  ui = {
    collapsed: savedUi.collapsed || {},
    pos: savedUi.pos || {},
    size: savedUi.size || {},
    camLock: ['turntable', 'tilt'].includes(savedUi.camLock) ? savedUi.camLock : 'free',
  };
} catch (e) { /* defaults */ }

function saveUi() {
  localStorage.setItem(UI_KEY, JSON.stringify(ui));
}

const mainEl = document.querySelector('main');

function clampToMain(x, y, el) {
  const m = mainEl.getBoundingClientRect();
  const w = el.offsetWidth || 200;
  return {
    x: Math.max(4, Math.min(x, m.width - Math.min(w, m.width) - 4)),
    y: Math.max(4, Math.min(y, m.height - 44)),
  };
}

function placePanel(el, x, y) {
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.right = 'auto';
  el.style.bottom = 'auto';
}

function setupFloatingPanel(name, el) {
  const handle = el.querySelector('.drag-handle');

  // restore saved position (clamped in case the window shrank)
  if (ui.pos[name]) {
    const p = clampToMain(ui.pos[name].x, ui.pos[name].y, el);
    placePanel(el, p.x, p.y);
  }

  // dragging
  handle.addEventListener('pointerdown', e => {
    if (e.target.closest('button, input, a, textarea, select')) return;
    const m = mainEl.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const offX = e.clientX - r.left;
    const offY = e.clientY - r.top;
    const move = ev => {
      const p = clampToMain(ev.clientX - m.left - offX, ev.clientY - m.top - offY, el);
      placePanel(el, p.x, p.y);
      ui.pos[name] = p;
    };
    const up = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      saveUi();
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    e.preventDefault();
  });

  // collapsing
  const btn = el.querySelector('.collapse-btn');
  const applyCollapse = () => {
    el.classList.toggle('collapsed', !!ui.collapsed[name]);
    btn.textContent = ui.collapsed[name] ? '＋' : '–';
    btn.title = ui.collapsed[name] ? 'expand' : 'collapse';
  };
  btn.addEventListener('click', e => {
    e.stopPropagation();
    ui.collapsed[name] = !ui.collapsed[name];
    saveUi();
    applyCollapse();
  });
  applyCollapse();

  // resizing (corner grip)
  const grip = document.createElement('div');
  grip.className = 'resize-handle';
  el.appendChild(grip);

  const applySize = () => {
    const s = ui.size[name];
    if (!s) return;
    el.style.width = `${s.w}px`;
    el.style.height = `${s.h}px`;
    el.style.maxHeight = 'none';
    el.style.overflowY = 'auto';
  };
  applySize();

  grip.addEventListener('pointerdown', e => {
    const m = mainEl.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const startW = r.width;
    const startH = r.height;
    const startX = e.clientX;
    const startY = e.clientY;
    const move = ev => {
      ui.size[name] = {
        w: Math.max(230, Math.min(startW + ev.clientX - startX, m.width - 20)),
        h: Math.max(110, Math.min(startH + ev.clientY - startY, m.height - 20)),
      };
      applySize();
    };
    const up = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      saveUi();
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    e.preventDefault();
    e.stopPropagation();
  });
}

setupFloatingPanel('panel', document.querySelector('#panel'));
setupFloatingPanel('forces', document.querySelector('#forces'));
setupFloatingPanel('draft', document.querySelector('#draft'));

window.addEventListener('resize', () => {
  for (const [name, pos] of Object.entries(ui.pos)) {
    const el = document.querySelector(`#${name === 'panel' ? 'panel' : name}`);
    if (el && pos) {
      const p = clampToMain(pos.x, pos.y, el);
      placePanel(el, p.x, p.y);
    }
  }
});

// ===== Toolbar =====
document.querySelector('#panelClose').addEventListener('click', closePanel);
document.querySelector('#addWordBtn').addEventListener('click', openAddPanel);

document.querySelectorAll('#modeToggle button').forEach(btn => {
  btn.addEventListener('click', () => {
    const mode = btn.dataset.mode;
    if (mode === state.mode) return;
    state.mode = mode;
    document.querySelectorAll('#modeToggle button').forEach(b =>
      b.classList.toggle('active', b.dataset.mode === mode));
    closePanel();
    saveState();
    refreshGraph();
    if (mode === 'gematria') {
      // face the plate — otherwise the pinned diagram can appear edge-on
      Graph.cameraPosition({ x: 0, y: 0, z: 520 }, { x: 0, y: 0, z: 0 }, 900);
      setTimeout(() => Graph.zoomToFit(800, 40, n => n.type === 'hub'), 1300);
    } else if (state.words.length) {
      setTimeout(() => Graph.zoomToFit(800, 40, n => n.type !== 'plus'), 1300);
    }
  });
});

document.querySelector('#newPoemBtn').addEventListener('click', () => {
  if (state.words.length && !confirm('Start a new poem? Words and form template will be cleared.')) return;
  state.words = [];
  state.form = null;
  state.formSlots = {};
  state.formBodies = {};
  armedSlot = null;
  nodeCache.clear();
  suggestionCache.clear();
  closePanel();
  draftEl.style.display = 'none';
  saveState();
  refreshGraph();
});

window.addEventListener('resize', () => {
  Graph.width(container.clientWidth).height(container.clientHeight);
});

// ===== Init =====
// Shareable seed links: workspace.html?seed=lost,name,cost&mode=alliteration
async function initFromSeed() {
  const params = new URLSearchParams(window.location.search);
  const seed = params.get('seed');
  if (!seed) return false;

  state.words = [];
  nodeCache.clear();
  state.mode = params.get('mode') === 'alliteration' ? 'alliteration' : 'rhyme';
  for (const raw of seed.split(',')) {
    await addWord(raw);
  }
  saveState();
  return true;
}

loadState();
// The serif renders into canvas sprites, so it must be loaded before first draw
const fontsReady = Promise.all([
  document.fonts.load(`500 116px ${SERIF}`),
  document.fonts.load(`600 40px ${SERIF}`),
  document.fonts.load('400 30px "Inter"'),
]).catch(() => {});

fontsReady.then(() => initFromSeed()).then(async seeded => {
  document.querySelectorAll('#modeToggle button').forEach(b =>
    b.classList.toggle('active', b.dataset.mode === state.mode));
  if (!seeded) await backfillMeta();
  applyAltitudeForce();
  applyCamLock();
  refreshGraph();
  if (state.mode === 'gematria') {
    Graph.cameraPosition({ x: 0, y: 0, z: 520 }, { x: 0, y: 0, z: 0 }, 0);
    setTimeout(() => Graph.zoomToFit(900, 40, n => n.type === 'hub'), 1400);
  } else if (state.words.length) {
    // frame the poem once the layout settles (the + node roams, so skip it)
    setTimeout(() => Graph.zoomToFit(900, 40, n => n.type !== 'plus'), 1400);
  }

  // ?form=villanelle → greet with the form reminder, then open its template.
  // If that form is already in progress, skip the modal and resume.
  const formParam = new URLSearchParams(window.location.search).get('form');
  if (formParam && FORMS[formParam] && formParam !== state.form) {
    showFormModal(formParam);
  } else if (state.form && FORMS[state.form]) {
    openDraft(); // resume an in-progress form draft
  }
});

// Debug/testing hook
window.__ws = { get state() { return state; }, graph: Graph, addWord, refreshGraph };
