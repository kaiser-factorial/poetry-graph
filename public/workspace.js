// Poem Workspace — 3D force-directed word graph (WebGL).
// Words cluster under rhyme or alliteration hubs; extra connection layers
// (part of speech, syllable count, …) pull related words together with
// user-controlled force strengths.

import ForceGraph3D from 'https://esm.sh/3d-force-graph@1?external=three';
import SpriteText from 'https://esm.sh/three-spritetext@1?external=three';
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

const CONNECTION_TYPES = {
  rhyme: {
    label: 'Rhyme',
    color: '#ffd76e',
    keyOf: w => w.rhymeKey || null,
  },
  alliteration: {
    label: 'Alliteration',
    color: '#9fd8ff',
    keyOf: w => w.onsetKey || null,
  },
  pos: {
    label: 'Same POS',
    color: '#7effb2',
    keyOf: w => (w.pos && w.pos[0]) || null,
  },
  syllables: {
    label: 'Syllables',
    color: '#ff9ff5',
    keyOf: w => (w.syllables > 0 ? String(w.syllables) : null),
  },
};

// ===== State =====
let state = {
  mode: 'rhyme', // grouping: 'rhyme' | 'alliteration'
  words: [], // { text, rhymeKey, onsetKey, pos: [], syllables }
  forceWeights: { rhyme: 0.6, alliteration: 0.6, pos: 0, syllables: 0 },
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

  // The lone "+" node
  const plusInit = { type: 'plus', empty: state.words.length === 0 };
  const plus = nodeCache.get('plus');
  if (plus && plus.empty !== plusInit.empty) delete plus.__threeObj;
  nodes.push(cachedNode('plus', plusInit));

  return { nodes, links };
}

// ===== 3D rendering =====
const container = document.querySelector('#graph3d');

const Graph = new ForceGraph3D(container)
  .backgroundColor('#14102b')
  .showNavInfo(false)
  .nodeThreeObject(node => makeNodeObject(node))
  .linkColor(link => link.kind === 'member' ? 'rgba(255,255,255,0.7)' : CONNECTION_TYPES[link.kind].color)
  .linkOpacity(0.45)
  .linkWidth(link => {
    if (link.kind === 'member') return 0.5;
    return 0.4 + (state.forceWeights[link.kind] || 0) * 1.4;
  })
  .onNodeClick(node => {
    if (node.type === 'plus') openAddPanel();
    else if (node.type === 'hub') openGroupPanel(node.key);
    else if (node.type === 'word') openGroupPanel(activeKeyOf(node.word));
  })
  .onNodeDragEnd(node => { node.fx = null; node.fy = null; node.fz = null; })
  .onBackgroundClick(() => { if (panelMode !== 'closed') closePanel(); });

// Forces: members hold their hub tight; cross-links pull per slider weight
Graph.d3Force('link')
  .distance(link => link.kind === 'member' ? 42 : 95)
  .strength(link => {
    if (link.kind === 'member') return 0.9;
    return 0.35 * (state.forceWeights[link.kind] || 0);
  });
Graph.d3Force('charge').strength(-140);

// Depth cues: fog + a sparse starfield + an extra light for specular pop
const scene = Graph.scene();
scene.fog = new THREE.FogExp2(0x14102b, 0.0015);

const starGeo = new THREE.BufferGeometry();
const starPos = new Float32Array(900);
for (let i = 0; i < starPos.length; i++) starPos[i] = (Math.random() - 0.5) * 2400;
starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x5c50b8, size: 1.6, sizeAttenuation: true })));

const keyLight = new THREE.PointLight(0xbfb0ff, 600, 0, 1.8);
keyLight.position.set(120, 160, 220);
scene.add(keyLight);

function makeNodeObject(node) {
  const group = new THREE.Group();

  if (node.type === 'hub') {
    const r = 11 + Math.min(node.memberCount * 1.6, 10);
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(r, 32, 32),
      new THREE.MeshPhongMaterial({
        color: 0x9d92f5, transparent: true, opacity: 0.4,
        emissive: 0x6a5fd0, emissiveIntensity: 0.75,
        shininess: 90, specular: 0xffffff, depthWrite: false,
      })
    );
    const label = new SpriteText(node.label, 7, '#ffffff');
    label.fontWeight = '700';
    label.strokeColor = 'rgba(20,16,43,0.9)';
    label.strokeWidth = 1.2;
    group.add(sphere, label);
    return group;
  }

  if (node.type === 'word') {
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(4.6, 24, 24),
      new THREE.MeshPhongMaterial({
        color: 0xffc95e, emissive: 0x8a5c00, emissiveIntensity: 0.55,
        shininess: 100, specular: 0xffffff,
      })
    );
    const label = new SpriteText(node.word.text, 5, '#ffffff');
    label.fontWeight = '600';
    label.strokeColor = 'rgba(20,16,43,0.9)';
    label.strokeWidth = 1.4;
    label.position.y = 10;
    group.add(sphere, label);
    return group;
  }

  // plus node
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(node.empty ? 10 : 6.5, 18, 18),
    new THREE.MeshPhongMaterial({
      color: 0x9f95e8, wireframe: true, transparent: true, opacity: 0.7,
    })
  );
  const label = new SpriteText('+', node.empty ? 9 : 6, '#ffffff');
  group.add(sphere, label);
  if (node.empty) {
    const hint = new SpriteText('click to add your first word', 4, 'rgba(235,230,255,0.85)');
    hint.position.y = -18;
    group.add(hint);
  }
  return group;
}

function refreshGraph() {
  // graphData() reheats the simulation itself when the data changes
  Graph.graphData(buildGraphData());
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

async function addWord(text, { rhymeKey = null, onsetKey = null } = {}) {
  const clean = normalizeWord(text);
  if (!clean) return null;
  const existing = state.words.find(w => w.text === clean);
  if (existing) return existing;

  const info = await fetchWordInfo(clean);
  const word = {
    text: clean,
    rhymeKey: rhymeKey || info.ending,
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
  panelTitle.textContent = 'Add a word';
  panelBody.innerHTML = `
    <div class="add-input">
      <input type="text" id="wordInput" placeholder="type a word, e.g. lost" autocomplete="off">
      <button id="wordAddBtn">Add</button>
    </div>
    <p class="muted" style="margin-top: 10px;">
      The word joins its ${state.mode === 'rhyme' ? 'rhyme family (like "-ost")' : 'starting-sound group (like "L-")'} —
      or starts a new one.
    </p>`;

  const input = document.querySelector('#wordInput');
  const submit = async () => {
    const value = input.value.trim();
    if (!value) return;
    input.value = '';
    const word = await addWord(value);
    if (word) openGroupPanel(activeKeyOf(word));
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
    <div class="chip-list" id="suggestionList"><span class="muted">loading…</span></div>`;

  panelBody.querySelectorAll('.chip.member').forEach(chip => {
    chip.addEventListener('click', () => removeWord(chip.dataset.word));
  });

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
    const value = Math.round((state.forceWeights[name] || 0) * 100);
    return `
      <div class="force-row ${isGrouping ? 'disabled' : ''}" title="${isGrouping ? 'currently the grouping — always strong' : ''}">
        <span class="swatch" style="background:${type.color}"></span>
        <label>${type.label}${isGrouping ? ' ★' : ''}</label>
        <input type="range" min="0" max="100" value="${isGrouping ? 100 : value}" data-type="${name}" ${isGrouping ? 'disabled' : ''}>
      </div>`;
  }).join('');

  rows.querySelectorAll('input[type="range"]').forEach(slider => {
    slider.addEventListener('input', () => {
      state.forceWeights[slider.dataset.type] = slider.valueAsNumber / 100;
      saveState();
      Graph.graphData(buildGraphData());
    });
  });
}

// ===== Toolbar =====
document.querySelector('#panelClose').addEventListener('click', closePanel);

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
initFromSeed().then(async seeded => {
  document.querySelectorAll('#modeToggle button').forEach(b =>
    b.classList.toggle('active', b.dataset.mode === state.mode));
  if (!seeded) await backfillMeta();
  refreshGraph();
  if (state.words.length) {
    setTimeout(() => Graph.zoomToFit(900, 70), 1200); // frame the poem once the layout settles
  }
});

// Debug/testing hook
window.__ws = { get state() { return state; }, graph: Graph, addWord, refreshGraph };
