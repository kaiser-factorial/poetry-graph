// Force-directed graph layout engine

class ForceDirectedGraph {
  constructor(words, options = {}) {
    this.words = words;
    this.options = {
      width: options.width || 800,
      height: options.height || 600,
      charge: options.charge || -300,
      linkDistance: options.linkDistance || 100,
      iterations: options.iterations || 50,
      temperature: options.temperature || 10,
      ...options,
    };

    this.nodes = words.map((word, i) => ({
      id: word,
      word: word,
      x: Math.random() * this.options.width,
      y: Math.random() * this.options.height,
      vx: 0,
      vy: 0,
      fixed: false,
    }));

    this.links = [];
  }

  addLink(source, target, strength = 1) {
    this.links.push({
      source: this.nodes.find(n => n.id === source),
      target: this.nodes.find(n => n.id === target),
      strength,
    });
  }

  simulate() {
    for (let iter = 0; iter < this.options.iterations; iter++) {
      // Apply coulomb repulsion
      for (let i = 0; i < this.nodes.length; i++) {
        for (let j = i + 1; j < this.nodes.length; j++) {
          const dx = this.nodes[j].x - this.nodes[i].x;
          const dy = this.nodes[j].y - this.nodes[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
          const force = this.options.charge / (dist * dist);

          this.nodes[i].vx -= (force * dx) / dist;
          this.nodes[i].vy -= (force * dy) / dist;
          this.nodes[j].vx += (force * dx) / dist;
          this.nodes[j].vy += (force * dy) / dist;
        }
      }

      // Apply spring forces
      for (const link of this.links) {
        const dx = link.target.x - link.source.x;
        const dy = link.target.y - link.source.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
        const force = (dist - this.options.linkDistance) * link.strength;

        link.source.vx += (force * dx) / dist;
        link.source.vy += (force * dy) / dist;
        link.target.vx -= (force * dx) / dist;
        link.target.vy -= (force * dy) / dist;
      }

      // Apply damping and update positions
      const damping = 0.85;
      const dt = 0.02;

      for (const node of this.nodes) {
        if (!node.fixed) {
          node.vx *= damping;
          node.vy *= damping;
          node.x += node.vx * dt;
          node.y += node.vy * dt;

          // Boundary conditions
          if (node.x < 20) {
            node.x = 20;
            node.vx *= -0.5;
          }
          if (node.x > this.options.width - 20) {
            node.x = this.options.width - 20;
            node.vx *= -0.5;
          }
          if (node.y < 20) {
            node.y = 20;
            node.vy *= -0.5;
          }
          if (node.y > this.options.height - 20) {
            node.y = this.options.height - 20;
            node.vy *= -0.5;
          }
        }
      }
    }

    return this.getLayout();
  }

  getLayout() {
    return {
      nodes: this.nodes.map(n => ({
        id: n.id,
        word: n.word,
        x: n.x,
        y: n.y,
      })),
      links: this.links.map(l => ({
        source: l.source.id,
        target: l.target.id,
        strength: l.strength,
      })),
    };
  }
}

module.exports = ForceDirectedGraph;
