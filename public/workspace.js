// Poem Workspace — group words by rhyme family or alliteration,
// with cross-links showing the inactive relationship.

const API_URL = 'http://localhost:3001';
const STORAGE_KEY = 'poetry-workspace-v1';

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

// ===== State =====
let state = {
  mode: 'rhyme', // 'rhyme' | 'alliteration'
  words: [], // { text, rhymeKey, onsetKey }
};

// Future direction: user-drawn semantic edges, each connection type with a
// configurable force weight. The link builder below already tags links with
// a `kind`, so semantic edges slot in as another kind.
let selectedGroupKey = null; // key of the currently open group, or null
let panelMode = 'closed'; // 'closed' | 'add' | 'group'
const suggestionCache = new Map();
const savedPositions = new Map(); // node id -> {x, y}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.words)) {
        state = { mode: parsed.mode === 'alliteration' ? 'alliteration' : 'rhyme', words: parsed.words };
      }
    }
  } catch (e) { /* fresh start */ }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function activeKeyOf(word) {
  return state.mode === 'rhyme' ? word.rhymeKey : word.onsetKey;
}

function inactiveKeyOf(word) {
  return state.mode === 'rhyme' ? word.onsetKey : word.rhymeKey;
}

function hubLabel(key) {
  return state.mode === 'rhyme' ? `-${key}` : `${key.toUpperCase()}-`;
}

// ===== D3 setup =====
const svg = d3.select('#canvas');
const zoomLayer = svg.append('g');
let simulation = null;

svg.call(
  d3.zoom()
    .scaleExtent([0.3, 3])
    .filter(event => event.target.tagName === 'svg' || event.type === 'wheel')
    .on('zoom', event => zoomLayer.attr('transform', event.transform))
);

function canvasSize() {
  const rect = document.querySelector('main').getBoundingClientRect();
  return { width: rect.width, height: rect.height };
}

function buildGraph() {
  const { width, height } = canvasSize();
  const nodes = [];
  const links = [];

  // Group words by the active key
  const groups = new Map();
  for (const word of state.words) {
    const key = activeKeyOf(word);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(word);
  }

  // Hub nodes
  for (const [key, members] of groups) {
    const id = `hub:${key}`;
    const saved = savedPositions.get(id);
    // New hubs appear at the centroid of their members' last positions
    let x = saved?.x, y = saved?.y;
    if (x === undefined) {
      const memberPos = members
        .map(m => savedPositions.get(`w:${m.text}`))
        .filter(Boolean);
      if (memberPos.length) {
        x = d3.mean(memberPos, p => p.x);
        y = d3.mean(memberPos, p => p.y);
      } else {
        x = width / 2 + (Math.random() - 0.5) * 200;
        y = height / 2 + (Math.random() - 0.5) * 200;
      }
    }
    nodes.push({ id, type: 'hub', key, label: hubLabel(key), memberCount: members.length, x, y });
  }

  // Word nodes + membership links
  for (const word of state.words) {
    const id = `w:${word.text}`;
    const saved = savedPositions.get(id);
    nodes.push({
      id, type: 'word', word,
      x: saved?.x ?? width / 2 + (Math.random() - 0.5) * 300,
      y: saved?.y ?? height / 2 + (Math.random() - 0.5) * 300,
    });
    links.push({ source: id, target: `hub:${activeKeyOf(word)}`, kind: 'member' });
  }

  // Cross-links: pairs sharing the INACTIVE key
  const inactiveGroups = new Map();
  for (const word of state.words) {
    const key = inactiveKeyOf(word);
    if (!inactiveGroups.has(key)) inactiveGroups.set(key, []);
    inactiveGroups.get(key).push(word);
  }
  for (const [, members] of inactiveGroups) {
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        links.push({ source: `w:${members[i].text}`, target: `w:${members[j].text}`, kind: 'cross' });
      }
    }
  }

  // The lone "+" node
  const plusSaved = savedPositions.get('plus');
  nodes.push({
    id: 'plus', type: 'plus',
    x: plusSaved?.x ?? (state.words.length ? width * 0.85 : width / 2),
    y: plusSaved?.y ?? (state.words.length ? height * 0.2 : height / 2),
  });

  return { nodes, links };
}

function render() {
  const { width, height } = canvasSize();
  const { nodes, links } = buildGraph();

  zoomLayer.selectAll('*').remove();

  const linkSel = zoomLayer.selectAll('.link')
    .data(links)
    .enter()
    .append('line')
    .attr('class', d => {
      if (d.kind === 'member') return 'member-link';
      // rhyme mode: cross = alliteration pairs (thin); alliteration mode: cross = rhyme pairs (thicker)
      return `cross-link ${state.mode === 'rhyme' ? 'thin' : 'thick'}`;
    });

  const nodeSel = zoomLayer.selectAll('.node-g')
    .data(nodes, d => d.id)
    .enter()
    .append('g')
    .attr('class', 'node-g');

  // Hubs
  nodeSel.filter(d => d.type === 'hub')
    .append('circle')
    .attr('class', d => `hub-node${d.key === selectedGroupKey ? ' selected' : ''}`)
    .attr('r', d => 24 + Math.min(d.memberCount * 2, 12))
    .on('click', (event, d) => { event.stopPropagation(); openGroupPanel(d.key); });

  nodeSel.filter(d => d.type === 'hub')
    .append('text')
    .attr('class', 'hub-label')
    .text(d => d.label);

  // Words
  nodeSel.filter(d => d.type === 'word')
    .append('circle')
    .attr('class', 'word-node')
    .attr('r', 9)
    .on('click', (event, d) => { event.stopPropagation(); openGroupPanel(activeKeyOf(d.word)); });

  nodeSel.filter(d => d.type === 'word')
    .append('text')
    .attr('class', 'word-label')
    .attr('dy', -14)
    .text(d => d.word.text);

  // Plus node
  const plusG = nodeSel.filter(d => d.type === 'plus');
  plusG.append('circle')
    .attr('class', 'plus-node')
    .attr('r', state.words.length ? 18 : 34)
    .on('click', (event) => { event.stopPropagation(); openAddPanel(); });
  plusG.append('text')
    .attr('class', 'plus-label')
    .text('+');
  if (!state.words.length) {
    plusG.append('text')
      .attr('class', 'plus-hint')
      .attr('dy', 58)
      .text('click to add your first word');
  }

  // Drag
  nodeSel.call(
    d3.drag()
      .on('start', (event, d) => {
        if (!event.active && simulation) simulation.alphaTarget(0.25).restart();
        d.fx = d.x; d.fy = d.y;
      })
      .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
      .on('end', (event, d) => {
        if (!event.active && simulation) simulation.alphaTarget(0);
        d.fx = null; d.fy = null;
      })
  );

  // Simulation
  if (simulation) simulation.stop();
  simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links)
      .id(d => d.id)
      .distance(d => d.kind === 'member' ? 75 : 150)
      .strength(d => d.kind === 'member' ? 0.8 : 0.03))
    .force('charge', d3.forceManyBody().strength(d => d.type === 'hub' ? -500 : -150))
    .force('center', d3.forceCenter(width / 2, height / 2).strength(0.05))
    .force('collide', d3.forceCollide().radius(d => d.type === 'hub' ? 44 : 22))
    .on('tick', () => {
      linkSel
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);
      nodeSel.attr('transform', d => {
        savedPositions.set(d.id, { x: d.x, y: d.y });
        return `translate(${d.x},${d.y})`;
      });
    });

  updateLegend();
}

function updateLegend() {
  const legend = document.querySelector('#legend');
  if (!state.words.length) { legend.style.display = 'none'; return; }
  legend.style.display = 'block';
  if (state.mode === 'rhyme') {
    legend.innerHTML = `
      <div><span class="swatch member-s"></span>rhyme group</div>
      <div><span class="swatch thin-s"></span>shared starting sound</div>`;
  } else {
    legend.innerHTML = `
      <div><span class="swatch member-s"></span>alliteration group</div>
      <div><span class="swatch thick-s"></span>rhyming pair</div>`;
  }
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
      rhymes: [],
    };
  }
}

async function addWord(text, { rhymeKey = null, onsetKey = null } = {}) {
  const clean = normalizeWord(text);
  if (!clean) return null;
  if (state.words.some(w => w.text === clean)) return state.words.find(w => w.text === clean);

  const info = await fetchWordInfo(clean);
  const word = {
    text: clean,
    rhymeKey: rhymeKey || info.ending,
    onsetKey: onsetKey || info.onset,
  };
  state.words.push(word);

  // Warm the suggestion cache with what we just learned
  if (info.rhymes.length && !suggestionCache.has(`rhyme:${word.rhymeKey}`)) {
    suggestionCache.set(`rhyme:${word.rhymeKey}`, info.rhymes);
  }

  saveState();
  render();
  return word;
}

function removeWord(text) {
  state.words = state.words.filter(w => w.text !== text);
  saveState();
  render();
  if (panelMode === 'group') {
    const stillExists = state.words.some(w => activeKeyOf(w) === selectedGroupKey);
    if (stillExists) openGroupPanel(selectedGroupKey);
    else closePanel();
  }
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
  render();
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

async function openGroupPanel(groupKey) {
  panelMode = 'group';
  selectedGroupKey = groupKey;
  panel.style.display = 'flex';

  const members = state.words.filter(w => activeKeyOf(w) === groupKey);
  panelTitle.textContent = state.mode === 'rhyme'
    ? `Rhyme group “-${groupKey}”`
    : `Alliteration group “${groupKey.toUpperCase()}-”`;

  const memberChips = members
    .map(m => `<span class="chip member" data-word="${m.text}" title="click to remove">${m.text}<span class="x">✕</span></span>`)
    .join('');

  panelBody.innerHTML = `
    <h3>In this poem</h3>
    <div class="chip-list">${memberChips || '<span class="muted">none yet</span>'}</div>
    <h3>${state.mode === 'rhyme' ? 'Rhymes' : 'Same starting sound'} — click to add</h3>
    <div class="chip-list" id="suggestionList"><span class="muted">loading…</span></div>`;

  panelBody.querySelectorAll('.chip.member').forEach(chip => {
    chip.addEventListener('click', () => removeWord(chip.dataset.word));
  });

  render(); // reflect hub selection highlight

  const suggestions = await getSuggestions(groupKey, members);
  // Panel may have changed while we were fetching
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
      // Inherit the group key so true rhymes with odd spellings stay together
      const opts = state.mode === 'rhyme' ? { rhymeKey: groupKey } : { onsetKey: groupKey };
      await addWord(chip.dataset.word, opts);
      openGroupPanel(groupKey);
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
    render();
  });
});

document.querySelector('#newPoemBtn').addEventListener('click', () => {
  if (state.words.length && !confirm('Start a new poem? Current words will be cleared.')) return;
  state.words = [];
  savedPositions.clear();
  suggestionCache.clear();
  closePanel();
  saveState();
  render();
});

svg.on('click', () => { if (panelMode !== 'closed') closePanel(); });

window.addEventListener('resize', render);

// ===== Init =====
// Shareable seed links: workspace.html?seed=lost,name,cost&mode=alliteration
async function initFromSeed() {
  const params = new URLSearchParams(window.location.search);
  const seed = params.get('seed');
  if (!seed) return false;

  state.words = [];
  savedPositions.clear();
  state.mode = params.get('mode') === 'alliteration' ? 'alliteration' : 'rhyme';
  for (const raw of seed.split(',')) {
    await addWord(raw);
  }
  saveState();
  return true;
}

loadState();
initFromSeed().then(seeded => {
  document.querySelectorAll('#modeToggle button').forEach(b =>
    b.classList.toggle('active', b.dataset.mode === state.mode));
  render();
});
