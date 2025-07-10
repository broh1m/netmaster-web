// Network Nodes, Particles, and Lines Animation for #animated-bg
(function () {
  const bgDiv = document.getElementById('animated-bg');
  if (!bgDiv) return;

  // Create and style canvas
  let canvas = document.createElement('canvas');
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  canvas.style.position = 'absolute';
  canvas.style.top = 0;
  canvas.style.left = 0;
  canvas.style.zIndex = 0;
  bgDiv.appendChild(canvas);
  let ctx = canvas.getContext('2d');

  // Animation settings
  const NODE_COUNT = 32;
  const LINE_DIST = 140;
  const PARTICLE_RADIUS = 2.2;
  const NODE_RADIUS = 4.5;
  const SPEED = 0.4;

  let nodes = [];
  let width = 0, height = 0;

  function themeColors() {
    const theme = document.documentElement.getAttribute('data-theme');
    if (theme === 'dark') {
      return {
        bg: 'rgba(24,28,36,0)',
        node: '#4a90e2',
        line: 'rgba(76,110,245,0.09)', // reduced from 0.18
        particle: 'rgba(255,255,255,0.5)', // reduced from 1
      };
    } else {
      return {
        bg: 'rgba(248,250,253,0)',
        node: '#4a90e2',
        line: 'rgba(76,110,245,0.06)', // reduced from 0.13
        particle: 'rgba(74,144,226,0.4)', // reduced from 1
      };
    }
  }

  function resize() {
    width = bgDiv.offsetWidth;
    height = bgDiv.offsetHeight;
    canvas.width = width;
    canvas.height = height;
  }

  function randomNode() {
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * SPEED,
      vy: (Math.random() - 0.5) * SPEED,
    };
  }

  function initNodes() {
    nodes = [];
    for (let i = 0; i < NODE_COUNT; i++) {
      nodes.push(randomNode());
    }
  }

  function draw() {
    const colors = themeColors();
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, width, height);

    // Draw lines
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < LINE_DIST) {
          ctx.save();
          ctx.globalAlpha = 1 - dist / LINE_DIST;
          ctx.strokeStyle = colors.line;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    // Draw nodes
    for (let node of nodes) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, NODE_RADIUS, 0, 2 * Math.PI);
      ctx.fillStyle = colors.node;
      ctx.globalAlpha = 0.28; // reduced from 0.7
      ctx.shadowColor = colors.node;
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    }

    // Draw particles
    for (let node of nodes) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, PARTICLE_RADIUS, 0, 2 * Math.PI);
      ctx.fillStyle = colors.particle;
      ctx.globalAlpha = 0.32; // reduced from 0.9
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function update() {
    for (let node of nodes) {
      node.x += node.vx;
      node.y += node.vy;
      if (node.x < 0 || node.x > width) node.vx *= -1;
      if (node.y < 0 || node.y > height) node.vy *= -1;
    }
  }

  function animate() {
    update();
    draw();
    requestAnimationFrame(animate);
  }

  // Listen for theme changes
  const observer = new MutationObserver(() => draw());
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  // Responsive
  window.addEventListener('resize', () => {
    resize();
    initNodes();
  });

  // Init
  resize();
  initNodes();
  animate();
})(); 