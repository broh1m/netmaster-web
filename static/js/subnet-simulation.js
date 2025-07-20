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

// --- NEW SUBNETTING DEMO ANIMATION LOGIC ---
(function () {
  const canvas = document.getElementById('subnet-simulation-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let width = canvas.width;
  let height = canvas.height;

  // Animation state
  let step = 0;
  let running = false;
  let animFrame = 0;
  let animTimeout = null;
  let scenario = { network: '192.168.1.0/24', count: 4 };
  let subnets = [];
  let newMask = 26;
  let subnetSize = 64;

  // Steps for the new animation
  const steps = [
    {
      title: 'Step 1: Start with the original network',
      explain: () => `Original network: ${scenario.network}`,
      draw: function() {
        drawBlock(0, 0, width, height, '#4a90e2', scenario.network);
      }
    },
    {
      title: 'Step 2: Determine number of subnets',
      explain: () => `You need ${scenario.count} subnets.`,
      draw: function() {
        drawBlock(0, 0, width, height, '#4a90e2', scenario.network);
        drawOverlay(`Subnets needed: ${scenario.count}`);
      }
    },
    {
      title: 'Step 3: Calculate new subnet mask',
      explain: () => `New subnet mask: /${newMask} (${subnetMask(newMask)})`,
      draw: function() {
        drawBlock(0, 0, width, height, '#4a90e2', scenario.network);
        drawOverlay(`New mask: /${newMask}`);
      }
    },
    {
      title: 'Step 4: Split the network into subnets',
      explain: () => `The network is split into ${scenario.count} subnets of /${newMask}.`,
      draw: function() {
        for (let i = 0; i < scenario.count; i++) {
          drawSubnetBlock(i, scenario.count, subnets[i]?.network, '#43e8d8');
        }
      }
    },
    {
      title: 'Step 5: Label each subnet',
      explain: () => `Each subnet has its own network address and range.`,
      draw: function() {
        for (let i = 0; i < scenario.count; i++) {
          drawSubnetBlock(i, scenario.count, subnets[i]?.network, '#43e8d8');
          drawSubnetLabel(i, scenario.count, subnets[i]);
        }
      }
    },
    {
      title: 'Step 6: Highlight usable host ranges',
      explain: () => `Usable hosts: ${subnetSize - 2} per subnet.`,
      draw: function() {
        for (let i = 0; i < scenario.count; i++) {
          drawSubnetBlock(i, scenario.count, subnets[i]?.network, '#43e8d8');
          drawSubnetLabel(i, scenario.count, subnets[i]);
          drawHostRange(i, scenario.count, subnets[i]);
        }
      }
    },
    {
      title: 'Step 7: Subnetting complete!',
      explain: () => `All subnets are ready for use.`,
      draw: function() {
        for (let i = 0; i < scenario.count; i++) {
          drawSubnetBlock(i, scenario.count, subnets[i]?.network, '#43e8d8');
          drawSubnetLabel(i, scenario.count, subnets[i]);
          drawHostRange(i, scenario.count, subnets[i]);
        }
        drawOverlay('Subnetting complete!');
      }
    }
  ];

  // Utility: Get block color (fixed to previous color)
  function getBlockColor() {
    const theme = document.documentElement.getAttribute('data-bs-theme');
    if (theme === 'dark') {
      return '#43e8d8'; // light teal for dark mode
    } else {
      return '#009688'; // deeper teal for light mode
    }
  }

  // Utility: Draw a large block
  function drawBlock(x, y, w, h, color, label) {
    ctx.save();
    ctx.fillStyle = getBlockColor();
    ctx.strokeStyle = '#232837';
    ctx.lineWidth = 4;
    ctx.fillRect(x + 20, y + 40, w - 40, h - 80);
    ctx.strokeRect(x + 20, y + 40, w - 40, h - 80);
    ctx.font = 'bold 1.2rem Inter, Arial, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(label, w / 2, h / 2);
    ctx.restore();
  }

  // Utility: Draw overlay text
  function drawOverlay(text) {
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = '#232837';
    ctx.fillRect(0, height - 60, width, 60);
    ctx.font = 'bold 1.1rem Inter, Arial, sans-serif';
    ctx.fillStyle = '#ffe082';
    ctx.textAlign = 'center';
    ctx.fillText(text, width / 2, height - 25);
    if (scenario.warning) {
      ctx.font = 'bold 0.9rem Inter, Arial, sans-serif';
      ctx.fillStyle = '#ff5252';
      ctx.fillText(scenario.warning, width / 2, height - 8);
    }
    ctx.restore();
  }

  // Utility: Draw a subnet block
  function drawSubnetBlock(i, total, label, color) {
    const blockW = (width - 60) / total;
    ctx.save();
    ctx.fillStyle = getBlockColor();
    ctx.strokeStyle = '#232837';
    ctx.lineWidth = 3;
    ctx.fillRect(30 + i * blockW, 60, blockW - 10, height - 120);
    ctx.strokeRect(30 + i * blockW, 60, blockW - 10, height - 120);
    ctx.font = 'bold 1rem Inter, Arial, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(label, 30 + i * blockW + (blockW - 10) / 2, height / 2);
    ctx.restore();
  }

  // Utility: Draw subnet label details
  function drawSubnetLabel(i, total, subnet) {
    if (!subnet) return;
    const blockW = (width - 60) / total;
    const centerX = 30 + i * blockW + (blockW - 10) / 2;
    // Network/mask label near the top
    let y = height / 2 - 18;
    ctx.save();
    ctx.font = 'bold 0.90rem Inter, Arial, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    let label = `${subnet.network}/${subnet.mask}`;
    if (ctx.measureText(label).width > blockW - 16) {
      while (label.length > 0 && ctx.measureText(label + '...').width > blockW - 16) {
        label = label.slice(0, -1);
      }
      label += '...';
    }
    ctx.fillText(label, centerX, y);
    // Range label near the bottom of the block
    ctx.font = 'bold 0.80rem Inter, Arial, sans-serif';
    ctx.fillStyle = '#ffe082';
    let range = `Range: ${subnet.firstUsable} - ${subnet.lastUsable}`;
    if (ctx.measureText(range).width > blockW - 16) {
      while (range.length > 0 && ctx.measureText(range + '...').width > blockW - 16) {
        range = range.slice(0, -1);
      }
      range += '...';
    }
    // Place range label 28px above the bottom of the block
    let rangeY = height - 80;
    ctx.fillText(range, centerX, rangeY);
    ctx.restore();
  }

  // Utility: Highlight usable host range
  function drawHostRange(i, total, subnet) {
    if (!subnet) return;
    const blockW = (width - 60) / total;
    if (blockW < 140) return; // Don't draw if too narrow
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#00e676';
    ctx.fillRect(30 + i * blockW, height / 2 + 54, blockW - 10, 24);
    ctx.globalAlpha = 1;
    ctx.font = '0.80rem Inter, Arial, sans-serif';
    ctx.fillStyle = '#00e676';
    ctx.textAlign = 'center';
    ctx.fillText(`Usable: ${subnet.firstUsable} - ${subnet.lastUsable}`, 30 + i * blockW + (blockW - 10) / 2, height / 2 + 70);
    ctx.restore();
  }

  // Utility: Subnet mask from mask bits
  function subnetMask(mask) {
    let maskArr = [];
    for (let i = 0; i < 4; i++) {
      let bits = Math.min(8, mask);
      maskArr.push(256 - Math.pow(2, 8 - bits));
      mask -= bits;
    }
    return maskArr.join('.');
  }

  // Utility: IP math
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

  // Calculate subnets for scenario
  function calculateSubnets() {
    let [base, mask] = scenario.network.split('/');
    mask = parseInt(mask);
    if (!base || isNaN(mask) || mask < 1 || mask > 30 || !scenario.count || scenario.count < 1) {
      subnets = [];
      newMask = mask || 24;
      subnetSize = 0;
      return;
    }
    // Find the smallest power of two >= count
    let neededSubnets = Math.pow(2, Math.ceil(Math.log2(scenario.count)));
    newMask = mask + Math.ceil(Math.log2(neededSubnets));
    subnetSize = Math.pow(2, 32 - newMask);
    let baseInt = ipToInt(base);
    subnets = [];
    let warning = null;
    if (scenario.count !== neededSubnets) {
      warning = `Note: Only ${neededSubnets} subnets can be created. Showing first ${scenario.count}.`;
    }
    for (let i = 0; i < scenario.count; i++) {
      let netInt = baseInt + i * subnetSize;
      let bcastInt = netInt + subnetSize - 1;
      subnets.push({
        network: intToIp(netInt),
        mask: newMask,
        firstUsable: intToIp(netInt + 1),
        lastUsable: intToIp(bcastInt - 1),
        broadcast: intToIp(bcastInt)
      });
    }
    // Attach warning to the scenario for overlay
    scenario.warning = warning;
  }

  // Main draw
  function draw() {
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.fillStyle = '#232837';
    ctx.globalAlpha = 0.98;
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = 1;
    ctx.restore();
    if (steps[step] && typeof steps[step].draw === 'function') {
      steps[step].draw();
    }
  }

  // Step navigation
  function goToStep(newStep) {
    step = Math.max(0, Math.min(steps.length - 1, newStep));
    draw();
    updateProgressBar();
    updateStepInfo();
    updateControls && updateControls();
  }

  // Responsive
  function resize() {
    width = canvas.width = canvas.offsetWidth;
    height = canvas.height = canvas.offsetHeight;
    draw();
  }
  window.addEventListener('resize', resize);

  // Scenario selection logic
  window.addEventListener('DOMContentLoaded', () => {
    const scenarioSelect = document.getElementById('subnet-sim-scenario');
    const customInputs = document.getElementById('subnet-sim-custom-inputs');
    const customNetwork = document.getElementById('subnet-sim-custom-network');
    const customCount = document.getElementById('subnet-sim-custom-count');
    function setScenario(scenarioVal) {
      if (scenarioVal === '24-26') {
        scenario = { network: '192.168.1.0/24', count: 4 };
      } else if (scenarioVal === '16-18') {
        scenario = { network: '10.0.0.0/16', count: 4 };
      } else if (scenarioVal === 'custom') {
        scenario = {
          network: customNetwork.value || '10.0.0.0/20',
          count: parseInt(customCount.value) || 4
        };
      }
      calculateSubnets();
      running = true;
      goToStep(0);
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

  // Navigation buttons
  window.addEventListener('DOMContentLoaded', () => {
    const backBtn = document.getElementById('subnet-sim-back');
    const nextBtn = document.getElementById('subnet-sim-next');
    const replayBtn = document.getElementById('subnet-sim-replay');
    if (backBtn && nextBtn && replayBtn) {
      backBtn.addEventListener('click', () => {
        goToStep(step - 1);
      });
      nextBtn.addEventListener('click', () => {
        goToStep(step + 1);
      });
      replayBtn.addEventListener('click', () => {
        goToStep(0);
      });
    }
    updateControls && updateControls();
  });

  // Add Reset button logic
  window.addEventListener('DOMContentLoaded', () => {
    const resetBtn = document.getElementById('subnet-sim-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        // Reset scenario controls to default
        const scenarioSelect = document.getElementById('subnet-sim-scenario');
        const customNetwork = document.getElementById('subnet-sim-custom-network');
        const customCount = document.getElementById('subnet-sim-custom-count');
        if (scenarioSelect) scenarioSelect.value = '24-26';
        if (customNetwork) customNetwork.value = '';
        if (customCount) customCount.value = '';
        // Set scenario to default and redraw
        scenario = { network: '192.168.1.0/24', count: 4 };
        calculateSubnets();
        running = true;
        goToStep(0);
      });
    }
  });

  // Progress bar and step info update
  function updateProgressBar() {
    const progressBar = document.getElementById('subnet-sim-progress');
    if (!progressBar) return;
    const percent = Math.round((step / (steps.length - 1)) * 100);
    progressBar.style.width = percent + '%';
    progressBar.setAttribute('aria-valuenow', percent);
    progressBar.textContent = percent + '%';
  }
  function updateStepInfo() {
    const titleEl = document.getElementById('subnet-sim-step-title');
    const explainEl = document.getElementById('subnet-sim-step-explanation');
    if (!titleEl || !explainEl) return;
    titleEl.textContent = steps[step]?.title || '';
    explainEl.textContent = typeof steps[step]?.explain === 'function' ? steps[step].explain() : (steps[step]?.explain || '');
  }

  // Initial draw
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

// --- Progress Bar and Step Info Update Logic ---
function updateProgressBar() {
  const progressBar = document.getElementById('subnet-sim-progress');
  if (!progressBar) return;
  const percent = Math.round((step / (steps.length - 1)) * 100);
  progressBar.style.width = percent + '%';
  progressBar.setAttribute('aria-valuenow', percent);
  progressBar.textContent = percent + '%';
}
function updateStepInfo() {
  const titleEl = document.getElementById('subnet-sim-step-title');
  const explainEl = document.getElementById('subnet-sim-step-explanation');
  if (!titleEl || !explainEl) return;
  titleEl.textContent = steps[step]?.title || '';
  explainEl.textContent = steps[step]?.explain || '';
}
// Patch draw and step functions to update progress bar and step info
const origDraw = draw;
draw = function() {
  origDraw();
  updateProgressBar();
  updateStepInfo();
  updateControls && updateControls();
};
const origNextStep = nextStep;
nextStep = function() {
  origNextStep();
  updateProgressBar();
  updateStepInfo();
  updateControls && updateControls();
};
// On replay/reset, reset progress bar
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    updateProgressBar();
    updateStepInfo();
  });
}

// Initialize simulation when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new SubnetSimulation();
}); 