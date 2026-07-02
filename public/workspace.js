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
};

const BONE = '#e8e2d3';
const INK = '#0c0b10';
const SERIF = '"Cormorant Garamond", serif';

// ===== State =====
let state = {
  mode: 'rhyme', // grouping: 'rhyme' | 'alliteration'
  words: [], // { text, rhymeKey, onsetKey, pos: [], syllables }
  forceWeights: { rhyme: 0.6, alliteration: 0.6, pos: 0, syllables: 0 },
  syllableAltitude: false, // words stratify vertically by syllable count
  draft: '', // the poem-in-progress, written in the Draft drawer
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
        state.mode = parsed.mode === 'alliteration' ? 'alliteration' : 'rhyme';
        state.words = parsed.words;
        if (parsed.forceWeights) state.forceWeights = { ...state.forceWeights, ...parsed.forceWeights };
        state.syllableAltitude = !!parsed.syllableAltitude;
        state.draft = parsed.draft || '';
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
  return state.mode === 'rhyme' ? `-${key}` : `${key.toUpperCase()}-`;
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

  for (const [key, members] of groups) {
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
    links.push({ source: `w:${word.text}`, target: `hub:${state.mode}:${activeKeyOf(word)}`, kind: 'member' });
  }

  // Cross-links for every non-grouping connection type with weight > 0
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

  // The "+" compass only greets an empty canvas; adding lives in the header
  if (state.words.length === 0) {
    nodes.push(cachedNode('plus', { type: 'plus', empty: true }));
  }

  return { nodes, links };
}

// ===== 3D rendering =====
const container = document.querySelector('#graph3d');

// Orbit controls (not trackball): the camera never rolls, so "up" is always
// up — the stable frame of reference syllable altitude needs.
const Graph = new ForceGraph3D(container, { controlType: 'orbit' })
  .backgroundColor(INK)
  .showNavInfo(false)
  .nodeThreeObject(node => makeNodeObject(node))
  .linkColor(link => link.kind === 'member' ? 'rgba(232,226,211,0.6)' : CONNECTION_TYPES[link.kind].color)
  .linkOpacity(0.55)
  .linkWidth(link => {
    if (link.kind === 'member') return 0.4;
    return 0.3 + (state.forceWeights[link.kind] || 0) * 0.9;
  })
  .onNodeClick(node => {
    if (node.type === 'plus') openAddPanel();
    else if (node.type === 'hub') openGroupPanel(node.key);
    else if (node.type === 'word') openGroupPanel(activeKeyOf(node.word));
  })
  .onNodeDragEnd(node => { node.fx = null; node.fy = null; node.fz = null; })
  .onBackgroundClick(() => { if (panelMode !== 'closed') closePanel(); });

// Forces: members hold their hub tight; cross-links pull per slider weight.
// Charge (repulsion) is set per-refresh, scaled to the number of words —
// small poems stay compact, bigger ones get room to breathe.
Graph.d3Force('link')
  .distance(link => link.kind === 'member' ? 24 : 50)
  .strength(link => {
    if (link.kind === 'member') return 0.9;
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

function hubSprite(label, r) {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const cx = S / 2;
  const R = S / 2 - 28;

  // engraved double circle
  ctx.strokeStyle = 'rgba(238,232,218,1)';
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

  ctx.font = `600 158px ${SERIF}`;
  ctx.fillStyle = 'rgba(238,232,218,1)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, cx, cx + 10);

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
    group.add(hubSprite(node.label, r));
    return group;
  }

  if (node.type === 'word') {
    const r = 2.2 + Math.min(node.word.syllables || 1, 5) * 0.7;
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(r, 16, 16),
      new THREE.MeshBasicMaterial({ color: POS_TINTS[node.word.pos?.[0]] ?? 0x9b9588 })
    );
    const label = new SpriteText(node.word.text, 10, '#f2ede0');
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
        chip.innerHTML = `${word.text} <span class="meta">→ ${state.mode === 'rhyme' ? '-' + word.rhymeKey : word.onsetKey.toUpperCase() + '-'}</span>`;
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
  const posName = POS_NAMES[m.pos?.[0]] || '';
  const meta = [posName, m.syllables ? `${m.syllables} syl` : ''].filter(Boolean).join(' · ');
  return `<span class="chip member" data-word="${m.text}" title="${meta || 'click to remove'}">${m.text}<span class="meta">${m.syllables || ''}</span><span class="x">✕</span></span>`;
}

async function openGroupPanel(groupKey) {
  panelMode = 'group';
  selectedGroupKey = groupKey;
  panel.style.display = 'flex';

  const members = state.words.filter(w => activeKeyOf(w) === groupKey);
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
      <div class="force-row alt-row">
        <span class="swatch" style="background:${CONNECTION_TYPES.syllables.color}; opacity:0.5"></span>
        <label style="width:auto; cursor:pointer; display:flex; align-items:center; gap:6px;">
          <input type="checkbox" id="altToggle" ${state.syllableAltitude ? 'checked' : ''}>
          syllables as altitude
        </label>
      </div>`;

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

function updateDraftGutter() {
  draftGutter.innerHTML = draftText.value.split('\n')
    .map(line => `<div>${lineSyllables(line)}</div>`)
    .join('');
  draftGutter.scrollTop = draftText.scrollTop;
}

draftText.addEventListener('input', () => {
  state.draft = draftText.value;
  saveState();
  updateDraftGutter();
});
draftText.addEventListener('scroll', () => { draftGutter.scrollTop = draftText.scrollTop; });

document.querySelector('#draftBtn').addEventListener('click', () => {
  const open = draftEl.style.display !== 'none';
  draftEl.style.display = open ? 'none' : 'flex';
  if (!open) {
    draftText.value = state.draft || '';
    updateDraftGutter();
    draftText.focus();
  }
});
document.querySelector('#draftClose').addEventListener('click', () => {
  draftEl.style.display = 'none';
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
  });
});

document.querySelector('#newPoemBtn').addEventListener('click', () => {
  if (state.words.length && !confirm('Start a new poem? Current words will be cleared.')) return;
  state.words = [];
  nodeCache.clear();
  suggestionCache.clear();
  closePanel();
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
  refreshGraph();
  if (state.words.length) {
    // frame the poem once the layout settles (the + node roams, so skip it)
    setTimeout(() => Graph.zoomToFit(900, 40, n => n.type !== 'plus'), 1400);
  }
});

// Debug/testing hook
window.__ws = { get state() { return state; }, graph: Graph, addWord, refreshGraph };
