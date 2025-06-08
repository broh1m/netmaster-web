class NetworkAnimation {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.nodes = [];
        this.connections = [];
        this.mouse = { x: 0, y: 0 };
        this.isDarkMode = document.documentElement.getAttribute('data-bs-theme') === 'dark';

        this.init();
    }

    init() {
        // Set canvas as background
        this.canvas.style.position = 'fixed';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.zIndex = '-1';
        this.canvas.style.opacity = '0.7';
        document.body.prepend(this.canvas);

        // Set canvas size
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Create nodes
        this.createNodes();

        // Add mouse move listener
        window.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });

        // Start animation
        this.animate();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    createNodes() {
        const nodeCount = Math.floor((window.innerWidth * window.innerHeight) / 15000);
        for (let i = 0; i < nodeCount; i++) {
            this.nodes.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                radius: Math.random() * 2 + 1
            });
        }
    }

    drawNode(node) {
        this.ctx.beginPath();
        this.ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        this.ctx.fillStyle = this.isDarkMode ? 
            'rgba(74, 144, 226, 0.6)' : 
            'rgba(74, 144, 226, 0.3)';
        this.ctx.fill();

        // Add glow effect in dark mode
        if (this.isDarkMode) {
            this.ctx.shadowColor = 'rgba(74, 144, 226, 0.4)';
            this.ctx.shadowBlur = 10;
            this.ctx.fill();
            this.ctx.shadowBlur = 0;
        }
    }

    drawConnection(node1, node2, distance) {
        const opacity = 1 - (distance / 150);
        this.ctx.beginPath();
        this.ctx.moveTo(node1.x, node1.y);
        this.ctx.lineTo(node2.x, node2.y);
        
        if (this.isDarkMode) {
            this.ctx.strokeStyle = `rgba(74, 144, 226, ${opacity * 0.4})`;
            this.ctx.lineWidth = 0.8;
            // Add glow effect
            this.ctx.shadowColor = 'rgba(74, 144, 226, 0.2)';
            this.ctx.shadowBlur = 5;
        } else {
            this.ctx.strokeStyle = `rgba(74, 144, 226, ${opacity * 0.2})`;
            this.ctx.lineWidth = 0.5;
            this.ctx.shadowBlur = 0;
        }
        
        this.ctx.stroke();
        this.ctx.shadowBlur = 0;
    }

    updateNode(node) {
        // Update position
        node.x += node.vx;
        node.y += node.vy;

        // Bounce off walls
        if (node.x < 0 || node.x > this.canvas.width) node.vx *= -1;
        if (node.y < 0 || node.y > this.canvas.height) node.vy *= -1;

        // Mouse interaction
        const dx = this.mouse.x - node.x;
        const dy = this.mouse.y - node.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < 100) {
            const angle = Math.atan2(dy, dx);
            node.vx -= Math.cos(angle) * 0.2;
            node.vy -= Math.sin(angle) * 0.2;
        }
    }

    animate() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Update and draw nodes
        this.nodes.forEach(node => {
            this.updateNode(node);
            this.drawNode(node);
        });

        // Draw connections
        for (let i = 0; i < this.nodes.length; i++) {
            for (let j = i + 1; j < this.nodes.length; j++) {
                const dx = this.nodes[i].x - this.nodes[j].x;
                const dy = this.nodes[i].y - this.nodes[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < 150) {
                    this.drawConnection(this.nodes[i], this.nodes[j], distance);
                }
            }
        }

        // Continue animation
        requestAnimationFrame(() => this.animate());
    }

    updateTheme(isDark) {
        this.isDarkMode = isDark;
    }
}

// Initialize animation when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const networkAnimation = new NetworkAnimation();

    // Update animation theme when dark mode is toggled
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === 'data-bs-theme') {
                networkAnimation.updateTheme(
                    document.documentElement.getAttribute('data-bs-theme') === 'dark'
                );
            }
        });
    });

    observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-bs-theme']
    });

    // Format all timestamps
    document.querySelectorAll('.timestamp').forEach(element => {
        const utcString = element.getAttribute('data-utc');
        if (utcString) {
            element.textContent = formatTimestamp(utcString);
        }
    });
});

function formatTimestamp(utcString) {
    try {
        const date = new Date(utcString);
        
        // Validate date
        if (isNaN(date.getTime())) {
            console.error('Invalid date:', utcString);
            return 'Invalid date';
        }

        // Use Intl.DateTimeFormat for better timezone handling
        const options = {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
            timeZoneName: 'short'
        };

        return new Intl.DateTimeFormat(undefined, options).format(date);
    } catch (error) {
        console.error('Error formatting date:', error);
        return 'Error formatting date';
    }
} 