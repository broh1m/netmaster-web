class SubnetSimulation {
    constructor() {
        this.isRunning = false;
        this.subnetCount = 4;
        this.networkIp = '192.168.1.0/24';
        this.subnets = [];
        this.animationInterval = null;
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.updateSubnetValue();
        this.generateSubnets();
    }

    bindEvents() {
        // Subnet count slider
        document.getElementById('simSubnetCount').addEventListener('input', (e) => {
            this.subnetCount = parseInt(e.target.value);
            this.updateSubnetValue();
            if (this.isRunning) {
                this.generateSubnets();
            }
        });

        // Network IP input
        document.getElementById('simNetworkIp').addEventListener('input', (e) => {
            this.networkIp = e.target.value;
            if (this.isRunning) {
                this.generateSubnets();
            }
        });

        // Start simulation button
        document.getElementById('startSimulation').addEventListener('click', () => {
            this.startSimulation();
        });

        // Reset simulation button
        document.getElementById('resetSimulation').addEventListener('click', () => {
            this.resetSimulation();
        });
    }

    updateSubnetValue() {
        document.getElementById('simSubnetValue').textContent = this.subnetCount;
    }

    generateSubnets() {
        const subnetGroups = document.getElementById('subnetGroups');
        const connectionLines = document.getElementById('connectionLines');
        
        // Clear existing subnets
        subnetGroups.innerHTML = '';
        connectionLines.innerHTML = '';
        
        this.subnets = [];
        
        // Generate subnet data
        const baseNetwork = this.networkIp.split('/')[0];
        const cidr = parseInt(this.networkIp.split('/')[1]);
        const totalHosts = Math.pow(2, 32 - cidr) - 2;
        const hostsPerSubnet = Math.floor(totalHosts / this.subnetCount);
        
        // Calculate new CIDR for each subnet
        const newCidr = 32 - Math.floor(Math.log2(hostsPerSubnet + 2));
        
        // Generate subnet information
        for (let i = 0; i < this.subnetCount; i++) {
            const subnetData = this.calculateSubnet(baseNetwork, newCidr, i);
            this.subnets.push(subnetData);
        }
        
        // Create visual subnet groups
        this.createSubnetGroups();
        this.createConnectionLines();
        this.updateStats();
    }

    calculateSubnet(baseNetwork, cidr, index) {
        // Simple subnet calculation for demonstration
        const baseOctets = baseNetwork.split('.').map(Number);
        const subnetSize = Math.pow(2, 32 - cidr);
        const networkOffset = index * subnetSize;
        
        const networkId = this.ipToInt(baseOctets) + networkOffset;
        const broadcastId = networkId + subnetSize - 1;
        const firstUsable = networkId + 1;
        const lastUsable = broadcastId - 1;
        
        return {
            id: index + 1,
            name: `Subnet ${index + 1}`,
            networkId: this.intToIp(networkId),
            broadcast: this.intToIp(broadcastId),
            firstUsable: this.intToIp(firstUsable),
            lastUsable: this.intToIp(lastUsable),
            usableHosts: subnetSize - 2,
            cidr: cidr,
            subnetMask: this.cidrToSubnetMask(cidr)
        };
    }

    ipToInt(octets) {
        return (octets[0] << 24) + (octets[1] << 16) + (octets[2] << 8) + octets[3];
    }

    intToIp(int) {
        return [
            (int >>> 24) & 255,
            (int >>> 16) & 255,
            (int >>> 8) & 255,
            int & 255
        ].join('.');
    }

    cidrToSubnetMask(cidr) {
        const mask = (0xFFFFFFFF << (32 - cidr)) >>> 0;
        return this.intToIp(mask);
    }

    createSubnetGroups() {
        const subnetGroups = document.getElementById('subnetGroups');
        const container = document.getElementById('networkContainer');
        const containerRect = container.getBoundingClientRect();
        const centerX = containerRect.width / 2;
        const centerY = containerRect.height / 2;
        const radius = Math.min(containerRect.width, containerRect.height) * 0.3;
        
        this.subnets.forEach((subnet, index) => {
            const angle = (index * 2 * Math.PI) / this.subnetCount;
            const x = centerX + radius * Math.cos(angle);
            const y = centerY + radius * Math.sin(angle);
            
            const subnetGroup = document.createElement('div');
            subnetGroup.className = 'subnet-group';
            subnetGroup.style.left = `${x}px`;
            subnetGroup.style.top = `${y}px`;
            subnetGroup.style.transform = 'translate(-50%, -50%)';
            
            subnetGroup.innerHTML = `
                <i class="bi bi-hdd-network"></i>
                <div class="subnet-name">${subnet.name}</div>
                <div class="subnet-range">${subnet.networkId}/${subnet.cidr}</div>
                <div class="host-count">${subnet.usableHosts} hosts</div>
            `;
            
            subnetGroup.addEventListener('click', () => {
                this.showSubnetDetails(subnet);
            });
            
            subnetGroups.appendChild(subnetGroup);
        });
    }

    createConnectionLines() {
        const connectionLines = document.getElementById('connectionLines');
        const container = document.getElementById('networkContainer');
        const containerRect = container.getBoundingClientRect();
        const centerX = containerRect.width / 2;
        const centerY = containerRect.height / 2;
        const radius = Math.min(containerRect.width, containerRect.height) * 0.3;
        
        this.subnets.forEach((subnet, index) => {
            const angle = (index * 2 * Math.PI) / this.subnetCount;
            const x = centerX + radius * Math.cos(angle);
            const y = centerY + radius * Math.sin(angle);
            
            const line = document.createElement('div');
            line.className = 'connection-line';
            
            // Calculate line properties
            const dx = x - centerX;
            const dy = y - centerY;
            const length = Math.sqrt(dx * dx + dy * dy);
            const angleRad = Math.atan2(dy, dx);
            const angleDeg = angleRad * 180 / Math.PI;
            
            line.style.width = `${length}px`;
            line.style.left = `${centerX}px`;
            line.style.top = `${centerY}px`;
            line.style.transform = `rotate(${angleDeg}deg)`;
            
            connectionLines.appendChild(line);
        });
    }

    showSubnetDetails(subnet) {
        // Remove active class from all subnets
        document.querySelectorAll('.subnet-group').forEach(group => {
            group.classList.remove('active');
        });
        
        // Add active class to clicked subnet
        const clickedGroup = event.target.closest('.subnet-group');
        if (clickedGroup) {
            clickedGroup.classList.add('active');
        }
        
        // Show subnet details in a tooltip or modal
        const details = `
            <strong>${subnet.name}</strong><br>
            Network: ${subnet.networkId}<br>
            Subnet Mask: ${subnet.subnetMask}<br>
            Broadcast: ${subnet.broadcast}<br>
            Usable Range: ${subnet.firstUsable} - ${subnet.lastUsable}<br>
            Hosts: ${subnet.usableHosts}
        `;
        
        // Simple alert for now - could be replaced with a modal
        setTimeout(() => {
            alert(details);
        }, 100);
    }

    updateStats() {
        const totalSubnets = this.subnets.length;
        const totalHosts = this.subnets.reduce((sum, subnet) => sum + subnet.usableHosts, 0);
        const efficiency = Math.round((totalHosts / (Math.pow(2, 32 - parseInt(this.networkIp.split('/')[1])) - 2)) * 100);
        const securityZones = totalSubnets;
        
        document.getElementById('totalSubnets').textContent = totalSubnets;
        document.getElementById('totalHosts').textContent = totalHosts.toLocaleString();
        document.getElementById('networkEfficiency').textContent = `${efficiency}%`;
        document.getElementById('securityZones').textContent = securityZones;
    }

    startSimulation() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.generateSubnets();
        
        // Update button state
        document.getElementById('startSimulation').innerHTML = '<i class="bi bi-pause-circle me-2"></i>Pause Simulation';
        document.getElementById('startSimulation').classList.remove('btn-primary');
        document.getElementById('startSimulation').classList.add('btn-success');
        
        // Start animation
        this.startAnimation();
    }

    startAnimation() {
        let frame = 0;
        this.animationInterval = setInterval(() => {
            frame++;
            
            // Animate subnet groups
            document.querySelectorAll('.subnet-group').forEach((group, index) => {
                const delay = index * 0.5;
                const time = (frame * 0.05) + delay;
                const scale = 1 + Math.sin(time) * 0.05;
                group.style.transform = `translate(-50%, -50%) scale(${scale})`;
            });
            
            // Animate connection lines
            document.querySelectorAll('.connection-line').forEach((line, index) => {
                const delay = index * 0.3;
                const time = (frame * 0.03) + delay;
                const opacity = 0.3 + Math.sin(time) * 0.4;
                line.style.opacity = opacity;
            });
            
        }, 50);
    }

    resetSimulation() {
        this.isRunning = false;
        
        // Clear animation
        if (this.animationInterval) {
            clearInterval(this.animationInterval);
            this.animationInterval = null;
        }
        
        // Reset button state
        document.getElementById('startSimulation').innerHTML = '<i class="bi bi-play-circle me-2"></i>Start Simulation';
        document.getElementById('startSimulation').classList.remove('btn-success');
        document.getElementById('startSimulation').classList.add('btn-primary');
        
        // Clear visualization
        document.getElementById('subnetGroups').innerHTML = '';
        document.getElementById('connectionLines').innerHTML = '';
        
        // Reset stats
        document.getElementById('totalSubnets').textContent = '0';
        document.getElementById('totalHosts').textContent = '0';
        document.getElementById('networkEfficiency').textContent = '0%';
        document.getElementById('securityZones').textContent = '0';
        
        // Reset form values
        document.getElementById('simNetworkIp').value = '192.168.1.0/24';
        document.getElementById('simSubnetCount').value = '4';
        this.subnetCount = 4;
        this.networkIp = '192.168.1.0/24';
        this.updateSubnetValue();
    }
}

// Redesigned Subnetting Demo Animation with animated transitions
(function () {
  const canvas = document.getElementById('subnet-simulation-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let width = canvas.width;
  let height = canvas.height;

  // Theme colors
  function getColors() {
    const theme = document.documentElement.getAttribute('data-bs-theme');
    if (theme === 'dark') {
      return {
        bg: '#181c24',
        grid: 'rgba(120,110,180,0.13)',
        card: '#232837',
        text: '#fff',
        accent: '#4a90e2',
        neon: '#a259ff',
        play: '#4a90e2',
        shadow: 'rgba(110,198,255,0.18)'
      };
    } else {
      return {
        bg: '#f8fafd',
        grid: 'rgba(76,110,245,0.08)',
        card: '#fff',
        text: '#232837',
        accent: '#4a90e2',
        neon: '#764ba2',
        play: '#4a90e2',
        shadow: 'rgba(76,110,245,0.13)'
      };
    }
  }

  // Animation state
  let step = 0;
  let running = false;
  let animTimeout = null;
  let animFrame = 0;
  let animating = false;
  let splitProgress = 0; // 0 to 1 for block splitting
  let highlightPulse = 0; // 0 to 1 for glowing effect
  const steps = [
    {
      title: 'Step 1: Start with the /24 network',
      explain: '192.168.1.0/24',
      subnets: [{ base: '192.168.1.0', mask: 24, highlight: true }]
    },
    {
      title: 'Step 2: Calculate subnet mask for 4 subnets',
      explain: 'New mask: /26 (255.255.255.192)',
      subnets: [
        { base: '192.168.1.0', mask: 26, highlight: true },
        { base: '192.168.1.64', mask: 26 },
        { base: '192.168.1.128', mask: 26 },
        { base: '192.168.1.192', mask: 26 }
      ]
    },
    {
      title: 'Step 3: Calculate ranges for each subnet',
      explain: 'Each /26: 62 hosts, 64 IPs',
      subnets: [
        { base: '192.168.1.0', mask: 26, range: '192.168.1.1 - 192.168.1.62', broadcast: '192.168.1.63', highlight: true },
        { base: '192.168.1.64', mask: 26, range: '192.168.1.65 - 192.168.1.126', broadcast: '192.168.1.127' },
        { base: '192.168.1.128', mask: 26, range: '192.168.1.129 - 192.168.1.190', broadcast: '192.168.1.191' },
        { base: '192.168.1.192', mask: 26, range: '192.168.1.193 - 192.168.1.254', broadcast: '192.168.1.255' }
      ]
    },
    {
      title: 'Step 4: All subnets visualized',
      explain: '',
      subnets: [
        { base: '192.168.1.0', mask: 26, range: '192.168.1.1 - 192.168.1.62', broadcast: '192.168.1.63' },
        { base: '192.168.1.64', mask: 26, range: '192.168.1.65 - 192.168.1.126', broadcast: '192.168.1.127' },
        { base: '192.168.1.128', mask: 26, range: '192.168.1.129 - 192.168.1.190', broadcast: '192.168.1.191' },
        { base: '192.168.1.192', mask: 26, range: '192.168.1.193 - 192.168.1.254', broadcast: '192.168.1.255' }
      ]
    }
  ];

  // Color palette for subnets
  const subnetColors = [
    '#4a90e2', '#764ba2', '#43e8d8', '#ffb347', '#e94e77', '#6ec6ff', '#b388ff', '#ff7c43'
  ];

  // Draw grid background
  function drawGrid(colors) {
    ctx.save();
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    const gridSize = 20;
    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Draw neon border at bottom
  function drawNeonBorder(colors) {
    ctx.save();
    const grad = ctx.createLinearGradient(0, height - 8, width, height);
    grad.addColorStop(0, colors.neon);
    grad.addColorStop(1, colors.accent);
    ctx.shadowColor = colors.neon;
    ctx.shadowBlur = 16;
    ctx.fillStyle = grad;
    ctx.fillRect(12, height - 12, width - 24, 6);
    ctx.restore();
  }

  // Draw play icon and title
  function drawTitle(colors) {
    ctx.save();
    ctx.font = 'bold 2.2rem Inter, Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = colors.accent;
    ctx.shadowColor = colors.shadow;
    ctx.shadowBlur = 8;
    // Play icon
    ctx.beginPath();
    ctx.arc(54, 54, 32, 0, 2 * Math.PI);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(54 - 12, 54 - 18);
    ctx.lineTo(54 + 18, 54);
    ctx.lineTo(54 - 12, 54 + 18);
    ctx.closePath();
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.shadowBlur = 0;
    // Title
    ctx.fillStyle = colors.accent;
    ctx.fillText('Subnetting Demo', 100, 66);
    ctx.restore();
  }

  // Draw central message
  function drawCenterMessage(colors, msg) {
    ctx.save();
    ctx.font = 'bold 1.2rem Inter, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.text;
    ctx.shadowColor = colors.neon;
    ctx.shadowBlur = 8;
    ctx.fillText(msg, width / 2, height / 2);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // Draw subnet blocks and info with animation
  function drawSubnetsAnimated(colors, stepObj) {
    const n = stepObj.subnets.length;
    let blockW = (width - 80) / n;
    let y0 = 110, y1 = height - 60;
    // Animate splitting for step 1 to 2
    if (step === 1 && animating) {
      blockW = (width - 80) / 4;
      for (let i = 0; i < 4; i++) {
        ctx.save();
        // Interpolate x positions
        let t = splitProgress;
        let xStart = width / 2 - (blockW * 2);
        let x = xStart + i * blockW + (i - 1.5) * blockW * (1 - t);
        ctx.globalAlpha = 1;
        ctx.fillStyle = subnetColors[i % subnetColors.length];
        ctx.strokeStyle = colors.neon;
        ctx.lineWidth = i === 0 ? 4 : 2;
        ctx.beginPath();
        ctx.moveTo(x, y0);
        ctx.lineTo(x + blockW, y0);
        ctx.lineTo(x + blockW, y1);
        ctx.lineTo(x, y1);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Highlight pulse
        if (i === 0) {
          ctx.save();
          ctx.shadowBlur = 0;
          ctx.restore();
        }
        // Overlay behind text
        ctx.save();
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = '#000';
        ctx.fillRect(x, y1 - 48, blockW, 48);
        ctx.restore();
        // Text (smaller, no shadow)
        ctx.globalAlpha = 1;
        ctx.font = '600 1rem Inter, Arial, sans-serif';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText(`192.168.1.${i * 64}/26`, x + blockW / 2, y1 - 18);
        ctx.restore();
      }
      return;
    }
    // Animate merging for step 0
    if (step === 0 && animating) {
      blockW = (width - 80) / 4;
      let t = 1 - splitProgress;
      let xStart = width / 2 - (blockW * 2);
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.fillStyle = subnetColors[0];
      ctx.strokeStyle = colors.neon;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(xStart + blockW * t, y0);
      ctx.lineTo(xStart + blockW * (4 - t), y0);
      ctx.lineTo(xStart + blockW * (4 - t), y1);
      ctx.lineTo(xStart + blockW * t, y1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Highlight pulse
      ctx.save();
      ctx.shadowBlur = 0;
      ctx.restore();
      // Overlay behind text
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = '#000';
      ctx.fillRect(xStart + blockW * t, y1 - 48, blockW * (4 - 2 * t), 48);
      ctx.restore();
      // Text (smaller, no shadow)
      ctx.globalAlpha = 1;
      ctx.font = '600 1.1rem Inter, Arial, sans-serif';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText('192.168.1.0/24', width / 2, y1 - 18);
      ctx.restore();
      return;
    }
    // Normal drawing for other steps
    for (let i = 0; i < n; i++) {
      const subnet = stepObj.subnets[i];
      ctx.save();
      ctx.globalAlpha = subnet.highlight ? 1 : 0.85;
      ctx.fillStyle = subnetColors[i % subnetColors.length];
      ctx.strokeStyle = subnet.highlight ? colors.neon : colors.accent;
      ctx.lineWidth = subnet.highlight ? 4 : 2;
      ctx.beginPath();
      ctx.moveTo(40 + i * blockW, y0);
      ctx.lineTo(40 + (i + 1) * blockW, y0);
      ctx.lineTo(40 + (i + 1) * blockW, y1);
      ctx.lineTo(40 + i * blockW, y1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Highlight pulse
      if (subnet.highlight) {
        ctx.save();
        ctx.shadowBlur = 0;
        ctx.restore();
      }
      // Overlay behind text
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = '#000';
      ctx.fillRect(40 + i * blockW, y1 - 48, blockW, 48);
      ctx.restore();
      // Text (smaller, no shadow)
      ctx.globalAlpha = 1;
      ctx.font = '600 0.95rem Inter, Arial, sans-serif';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText(`${subnet.base}/${subnet.mask}`, 40 + (i + 0.5) * blockW, y1 - 32);
      if (subnet.range) {
        ctx.font = '500 0.9rem Inter, Arial, sans-serif';
        ctx.fillStyle = '#ffe082';
        ctx.fillText(subnet.range, 40 + (i + 0.5) * blockW, y1 - 18);
      }
      if (subnet.broadcast) {
        ctx.font = '500 0.85rem Inter, Arial, sans-serif';
        ctx.fillStyle = '#b388ff';
        ctx.fillText('Broadcast: ' + subnet.broadcast, 40 + (i + 0.5) * blockW, y1 - 6);
      }
      ctx.restore();
    }
  }

  // Draw step title and explanation
  function drawStepInfo(colors, stepObj) {
    ctx.save();
    ctx.font = '600 1.05rem Inter, Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = colors.accent;
    ctx.fillText(stepObj.title, 32, 100);
    ctx.font = '500 0.95rem Inter, Arial, sans-serif';
    ctx.fillStyle = colors.text;
    ctx.fillText(stepObj.explain, 32, 122);
    ctx.restore();
  }

  // Main draw
  function draw() {
    const colors = getColors();
    ctx.clearRect(0, 0, width, height);
    // Card background
    ctx.save();
    ctx.fillStyle = colors.card;
    ctx.globalAlpha = 0.98;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(width, 0);
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
    // Grid
    drawGrid(colors);
    // Neon border
    drawNeonBorder(colors);
    // Title
    drawTitle(colors);
    // Step
    if (!running) {
      drawCenterMessage(colors, 'Click anywhere to start the animation');
    } else {
      drawStepInfo(colors, steps[step]);
      drawSubnetsAnimated(colors, steps[step]);
    }
  }

  // Animation loop
  function animate() {
    if (!running && !animating) return;
    animFrame++;
    highlightPulse = (animFrame % 60) / 60;
    if (animating) {
      // Animate split/merge progress
      if (step === 1 && splitProgress < 1) {
        splitProgress += 0.04;
        if (splitProgress >= 1) {
          splitProgress = 1;
          animating = false;
          // Continue to next step after a pause
          animTimeout = setTimeout(nextStep, 1200);
        }
      } else if (step === 0 && splitProgress > 0) {
        splitProgress -= 0.04;
        if (splitProgress <= 0) {
          splitProgress = 0;
          animating = false;
        }
      }
    }
    draw();
    requestAnimationFrame(animate);
  }

  // Step animation logic
  function nextStep() {
    if (!running) return;
    if (step === 0) {
      animating = true;
      splitProgress = 0;
      animate();
    } else if (step === 1) {
      animating = true;
      splitProgress = 0;
      animate();
    } else if (step < steps.length - 1) {
      step++;
      draw();
      animTimeout = setTimeout(nextStep, 1800);
      return;
    } else {
      // Pause at last step
      animTimeout = setTimeout(() => {
        running = false;
        step = 0;
        draw();
      }, 2600);
      return;
    }
    // Advance step after animation
    if (!animating) {
      step++;
      draw();
      animTimeout = setTimeout(nextStep, 1800);
    } else {
      // Wait for animation to finish
      // nextStep will be called after animation
    }
  }

  // Responsive
  function resize() {
    width = canvas.width = canvas.offsetWidth;
    height = canvas.height = canvas.offsetHeight;
    draw();
  }
  window.addEventListener('resize', resize);

  // Theme observer
  const observer = new MutationObserver(draw);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-bs-theme'] });

  // Click to start
  canvas.addEventListener('click', () => {
    if (!running) {
      running = true;
      step = 0;
      animFrame = 0;
      splitProgress = 0;
      animating = false;
      draw();
      animTimeout = setTimeout(nextStep, 1200);
    }
  });

  // Tooltip logic
  let hoveredSubnetIdx = null;
  let mouseX = 0, mouseY = 0;
  let tooltipEl = null;

  function ensureTooltip() {
    if (!tooltipEl) {
      tooltipEl = document.createElement('div');
      tooltipEl.id = 'subnet-tooltip';
      tooltipEl.style.position = 'fixed';
      tooltipEl.style.pointerEvents = 'none';
      tooltipEl.style.zIndex = 10000;
      tooltipEl.style.background = 'rgba(24,28,36,0.98)';
      tooltipEl.style.color = '#fff';
      tooltipEl.style.padding = '0.7em 1.1em';
      tooltipEl.style.borderRadius = '0.7em';
      tooltipEl.style.boxShadow = '0 4px 24px 0 rgba(110,198,255,0.18)';
      tooltipEl.style.fontSize = '1rem';
      tooltipEl.style.fontFamily = 'Inter, Arial, sans-serif';
      tooltipEl.style.display = 'none';
      tooltipEl.style.transition = 'opacity 0.18s';
      document.body.appendChild(tooltipEl);
    }
  }

  function showTooltip(subnet, x, y) {
    ensureTooltip();
    let html = `<strong>${subnet.base}/${subnet.mask}</strong><br>`;
    if (subnet.range) html += `Range: ${subnet.range}<br>`;
    if (subnet.broadcast) html += `Broadcast: ${subnet.broadcast}<br>`;
    html += `Hosts: 62`;
    tooltipEl.innerHTML = html;
    tooltipEl.style.left = (x + 18) + 'px';
    tooltipEl.style.top = (y + 18) + 'px';
    tooltipEl.style.display = 'block';
    tooltipEl.style.opacity = 1;
  }

  function hideTooltip() {
    if (tooltipEl) {
      tooltipEl.style.display = 'none';
      tooltipEl.style.opacity = 0;
    }
  }

  canvas.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    if (!running) { hideTooltip(); hoveredSubnetIdx = null; return; }
    // Detect if mouse is over a block
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    let found = false;
    const stepObj = steps[step];
    const n = stepObj.subnets.length;
    let blockW = (canvas.width - 80) / n;
    let y0 = 110, y1 = canvas.height - 60;
    for (let i = 0; i < n; i++) {
      let bx0 = 40 + i * blockW, bx1 = 40 + (i + 1) * blockW;
      if (x >= bx0 && x <= bx1 && y >= y0 && y <= y1) {
        hoveredSubnetIdx = i;
        showTooltip(stepObj.subnets[i], e.clientX, e.clientY);
        found = true;
        break;
      }
    }
    if (!found) {
      hoveredSubnetIdx = null;
      hideTooltip();
    }
  });
  canvas.addEventListener('mouseleave', () => { hoveredSubnetIdx = null; hideTooltip(); });

  // Init
  resize();
  draw();
})();

// Step controls logic
function updateControls() {
  const backBtn = document.getElementById('subnet-sim-back');
  const nextBtn = document.getElementById('subnet-sim-next');
  const replayBtn = document.getElementById('subnet-sim-replay');
  if (!backBtn || !nextBtn || !replayBtn) return;
  if (!running) {
    backBtn.style.display = 'none';
    nextBtn.style.display = '';
    replayBtn.style.display = 'none';
    nextBtn.disabled = false;
    return;
  }
  if (step === 0) {
    backBtn.style.display = 'none';
    nextBtn.style.display = '';
    replayBtn.style.display = 'none';
    nextBtn.disabled = animating;
  } else if (step > 0 && step < steps.length - 1) {
    backBtn.style.display = '';
    nextBtn.style.display = '';
    replayBtn.style.display = 'none';
    nextBtn.disabled = animating;
    backBtn.disabled = animating;
  } else if (step === steps.length - 1) {
    backBtn.style.display = '';
    nextBtn.style.display = 'none';
    replayBtn.style.display = '';
    backBtn.disabled = animating;
    replayBtn.disabled = animating;
  }
}

// Attach event listeners after DOMContentLoaded
window.addEventListener('DOMContentLoaded', () => {
  const backBtn = document.getElementById('subnet-sim-back');
  const nextBtn = document.getElementById('subnet-sim-next');
  const replayBtn = document.getElementById('subnet-sim-replay');
  if (backBtn && nextBtn && replayBtn) {
    backBtn.addEventListener('click', () => {
      if (step > 0 && !animating) {
        step--;
        running = true;
        animating = false;
        draw();
        updateControls();
      }
    });
    nextBtn.addEventListener('click', () => {
      if (step < steps.length - 1 && !animating) {
        step++;
        running = true;
        animating = false;
        draw();
        updateControls();
      }
    });
    replayBtn.addEventListener('click', () => {
      step = 0;
      running = true;
      animating = false;
      draw();
      updateControls();
    });
  }
  updateControls();
});

// Update controls on every draw and step change
const origDraw = draw;
draw = function() {
  origDraw();
  updateControls();
};

// Update controls on animation/step changes
const origNextStep = nextStep;
nextStep = function() {
  origNextStep();
  updateControls();
};

// Scenario selection logic
window.addEventListener('DOMContentLoaded', () => {
  const scenarioSelect = document.getElementById('subnet-sim-scenario');
  const customInputs = document.getElementById('subnet-sim-custom-inputs');
  const customNetwork = document.getElementById('subnet-sim-custom-network');
  const customCount = document.getElementById('subnet-sim-custom-count');

  function setScenario(scenario) {
    let net = '192.168.1.0/24', count = 4;
    if (scenario === '24-26') {
      net = '192.168.1.0/24'; count = 4;
    } else if (scenario === '16-18') {
      net = '10.0.0.0/16'; count = 4;
    } else if (scenario === 'custom') {
      net = customNetwork.value || '10.0.0.0/20';
      count = parseInt(customCount.value) || 4;
    }
    // Update animation steps
    updateSteps(net, count);
    step = 0;
    running = false;
    animating = false;
    draw();
    updateControls && updateControls();
  }

  if (scenarioSelect) {
    scenarioSelect.addEventListener('change', (e) => {
      if (e.target.value === 'custom') {
        customInputs.style.display = '';
      } else {
        customInputs.style.display = 'none';
      }
      setScenario(e.target.value);
    });
  }
  if (customNetwork && customCount) {
    customNetwork.addEventListener('input', () => setScenario('custom'));
    customCount.addEventListener('input', () => setScenario('custom'));
  }
  // Set initial scenario
  setScenario(scenarioSelect ? scenarioSelect.value : '24-26');
});

// Update animation steps for any scenario
function updateSteps(network, count) {
  // Parse network and mask
  let [base, mask] = network.split('/');
  mask = parseInt(mask);
  if (!base || isNaN(mask) || mask < 1 || mask > 30) {
    base = '10.0.0.0'; mask = 20;
  }
  if (!count || count < 2 || count > 32) count = 4;
  // Calculate new mask
  const newMask = mask + Math.ceil(Math.log2(count));
  const subnetSize = Math.pow(2, 32 - newMask);
  // Generate subnets
  let subnets = [];
  function ipToInt(ip) {
    return ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct), 0);
  }
  function intToIp(int) {
    return [
      (int >>> 24) & 255,
      (int >>> 16) & 255,
      (int >>> 8) & 255,
      int & 255
    ].join('.');
  }
  const baseInt = ipToInt(base);
  for (let i = 0; i < count; i++) {
    const netInt = baseInt + i * subnetSize;
    const bcastInt = netInt + subnetSize - 1;
    subnets.push({
      base: intToIp(netInt),
      mask: newMask,
      range: `${intToIp(netInt + 1)} - ${intToIp(bcastInt - 1)}`,
      broadcast: intToIp(bcastInt),
      highlight: i === 0
    });
  }
  // Update steps
  steps.length = 0;
  steps.push(
    {
      title: `Step 1: Start with the ${network} network`,
      explain: `${network}`,
      subnets: [{ base, mask, highlight: true }]
    },
    {
      title: `Step 2: Calculate subnet mask for ${count} subnets`,
      explain: `New mask: /${newMask} (${count} subnets)`,
      subnets: subnets.map((s, i) => ({ base: s.base, mask: s.mask, highlight: i === 0 }))
    },
    {
      title: `Step 3: Calculate ranges for each subnet`,
      explain: `Each /${newMask}: ${subnetSize - 2} hosts, ${subnetSize} IPs`,
      subnets: subnets.map((s, i) => ({ ...s, highlight: i === 0 }))
    },
    {
      title: `Step 4: All subnets visualized`,
      explain: '',
      subnets: subnets
    }
  );
}

// Initialize simulation when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new SubnetSimulation();
}); 