const API_URL = 'http://localhost:3001';

let graphData = null;
let selectedWord = null;
let simulation = null;
let allWords = [];

async function initGraph() {
  try {
    const response = await fetch(`${API_URL}/api/graph`);
    graphData = await response.json();
    renderGraph();
    updateWordList();
  } catch (error) {
    console.error('Error loading graph:', error);
    document.querySelector('.graph-container').innerHTML =
      '<div class="loading">Unable to connect to API. Make sure backend is running on port 3001.</div>';
  }
}

async function fetchAllWords() {
  try {
    const response = await fetch(`${API_URL}/api/words`);
    const data = await response.json();
    allWords = data.words;
    updateWordList();
  } catch (error) {
    console.error('Error fetching words:', error);
  }
}

function renderGraph() {
  const container = document.querySelector('.graph-container');
  const width = container.clientWidth;
  const height = container.clientHeight;

  // Clear previous
  d3.select('#graph').selectAll('*').remove();

  const svg = d3.select('#graph')
    .attr('width', width)
    .attr('height', height);

  const g = svg.append('g');

  // Create color scale based on word similarity
  const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

  // Draw links
  const link = g.selectAll('.link')
    .data(graphData.links)
    .enter()
    .append('line')
    .attr('class', 'link')
    .attr('stroke-width', d => Math.sqrt(d.strength) * 2);

  // Draw nodes
  const node = g.selectAll('.node')
    .data(graphData.nodes)
    .enter()
    .append('circle')
    .attr('class', 'node')
    .attr('r', 20)
    .attr('fill', (d, i) => colorScale(i % 10))
    .attr('cx', d => d.x)
    .attr('cy', d => d.y)
    .on('click', (event, d) => selectWord(d.word))
    .call(d3.drag()
      .on('start', dragStarted)
      .on('drag', dragged)
      .on('end', dragEnded));

  // Draw labels
  const label = g.selectAll('.node-label')
    .data(graphData.nodes)
    .enter()
    .append('text')
    .attr('class', 'node-label')
    .attr('x', d => d.x)
    .attr('y', d => d.y)
    .text(d => d.word.substring(0, 1).toUpperCase())
    .style('pointer-events', 'none');

  // Add zoom
  svg.call(d3.zoom()
    .on('zoom', (event) => {
      g.attr('transform', event.transform);
    }));

  // Simple simulation loop
  let running = true;
  let iteration = 0;

  function tick() {
    link
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y);

    node
      .attr('cx', d => d.x)
      .attr('cy', d => d.y);

    label
      .attr('x', d => d.x)
      .attr('y', d => d.y);

    if (running && iteration < 200) {
      iteration++;
      applyForces();
      requestAnimationFrame(tick);
    }
  }

  function applyForces() {
    // Simple force-directed layout
    const nodes = graphData.nodes;
    const links = graphData.links;

    // Repulsion
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[j].x - nodes[i].x;
        const dy = nodes[j].y - nodes[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = -500 / (dist * dist);

        nodes[i].vx = (nodes[i].vx || 0) + (force * dx) / dist;
        nodes[i].vy = (nodes[i].vy || 0) + (force * dy) / dist;
        nodes[j].vx = (nodes[j].vx || 0) - (force * dx) / dist;
        nodes[j].vy = (nodes[j].vy || 0) - (force * dy) / dist;
      }
    }

    // Springs
    for (const link of links) {
      const dx = link.target.x - link.source.x;
      const dy = link.target.y - link.source.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = (dist - 120) * link.strength * 0.5;

      link.source.vx = (link.source.vx || 0) + (force * dx) / dist;
      link.source.vy = (link.source.vy || 0) + (force * dy) / dist;
      link.target.vx = (link.target.vx || 0) - (force * dx) / dist;
      link.target.vy = (link.target.vy || 0) - (force * dy) / dist;
    }

    // Update positions with damping
    for (const node of nodes) {
      node.vx = (node.vx || 0) * 0.95;
      node.vy = (node.vy || 0) * 0.95;
      node.x += node.vx || 0;
      node.y += node.vy || 0;

      // Boundaries
      if (node.x < 20) node.x = 20;
      if (node.x > width - 20) node.x = width - 20;
      if (node.y < 20) node.y = 20;
      if (node.y > height - 20) node.y = height - 20;
    }
  }

  tick();

  function dragStarted(event, d) {
    d.fx = d.x;
    d.fy = d.y;
  }

  function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }

  function dragEnded(event, d) {
    d.fx = null;
    d.fy = null;
  }
}

async function selectWord(word) {
  selectedWord = word;
  document.querySelectorAll('.node').forEach((node, i) => {
    node.classList.remove('selected');
    if (graphData.nodes[i].word === word) {
      node.classList.add('selected');
    }
  });

  // Fetch rhymes
  try {
    const response = await fetch(`${API_URL}/api/rhymes?word=${word}`);
    const data = await response.json();
    updateRhymeList(data.rhymes);
  } catch (error) {
    console.error('Error fetching rhymes:', error);
  }

  // Fetch similar
  try {
    const response = await fetch(`${API_URL}/api/similar?word=${word}`);
    const data = await response.json();
    updateSimilarList(data.similar);
  } catch (error) {
    console.error('Error fetching similar:', error);
  }
}

function updateWordList() {
  const list = document.querySelector('#wordList');
  const words = graphData ? graphData.nodes.map(n => n.word) : allWords;

  list.innerHTML = words
    .map(word => `
      <li class="word-item ${word === selectedWord ? 'highlight' : ''}" onclick="selectWord('${word}')">
        ${word}
      </li>
    `)
    .join('');
}

function updateRhymeList(rhymes) {
  const list = document.querySelector('#rhymeList');

  if (!rhymes || rhymes.length === 0) {
    list.innerHTML = '<li class="word-item" style="opacity: 0.5;">No rhymes found</li>';
    return;
  }

  list.innerHTML = rhymes
    .slice(0, 8)
    .map(r => `
      <li class="word-item" onclick="selectWord('${r.word}')">
        ${r.word}
        <span class="similarity-score">${(r.score * 100).toFixed(0)}%</span>
      </li>
    `)
    .join('');
}

function updateSimilarList(similar) {
  const list = document.querySelector('#similarList');

  if (!similar || similar.length === 0) {
    list.innerHTML = '<li class="word-item" style="opacity: 0.5;">No similar words</li>';
    return;
  }

  list.innerHTML = similar
    .slice(0, 8)
    .map(s => `
      <li class="word-item" onclick="selectWord('${s.word}')">
        ${s.word}
        <span class="similarity-score">${(s.similarity * 100).toFixed(0)}%</span>
      </li>
    `)
    .join('');
}

function generatePoem() {
  const words = graphData ? graphData.nodes.map(n => n.word) : [];

  if (words.length === 0) {
    alert('No words to generate poem from');
    return;
  }

  const poem = createPoem(words);

  document.querySelector('#poemSection').style.display = 'block';
  document.querySelector('#poemText').textContent = poem;
}

function createPoem(words) {
  // Simple poem generation using the word graph
  const shuffle = (arr) => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const shuffled = shuffle(words);
  const lines = [];

  // Create a simple poem structure
  const structures = [
    ['In the [0], [1] [2]', 'Where [3] meets [4]', 'A [5] of [6]'],
    ['[0] like [1]', '[2] through [3]', '[4] and [5]', '[6] at last'],
    ['The [0] of [1]', 'Whispers [2]', 'In the [3]', '[4] with [5]'],
  ];

  const structure = structures[Math.floor(Math.random() * structures.length)];

  for (const line of structure) {
    let processedLine = line;
    for (let i = 0; i < 7 && shuffled[i]; i++) {
      processedLine = processedLine.replace(`[${i}]`, shuffled[i]);
    }
    lines.push(processedLine);
  }

  return lines.join('\n');
}

async function resetGraph() {
  selectedWord = null;
  document.querySelectorAll('.node').forEach(node => {
    node.classList.remove('selected');
  });
  document.querySelector('#rhymeList').innerHTML = '';
  document.querySelector('#similarList').innerHTML = '';
  document.querySelector('#poemSection').style.display = 'none';
  await initGraph();
}

async function addCustomWords() {
  const input = document.querySelector('#searchInput');
  const words = input.value.split(/[\s,]+/).filter(w => w);

  if (words.length === 0) return;

  try {
    const response = await fetch(`${API_URL}/api/graph`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ words }),
    });

    graphData = await response.json();
    renderGraph();
    updateWordList();
    input.value = '';
  } catch (error) {
    console.error('Error building graph:', error);
  }
}

// Event listeners
document.querySelector('#searchInput').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    addCustomWords();
  }
});

document.querySelector('#poemBtn').addEventListener('click', generatePoem);
document.querySelector('#resetBtn').addEventListener('click', resetGraph);

// Initialize
initGraph();
fetchAllWords();
