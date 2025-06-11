class NetworkAnimation {
    constructor() {
        this.container = document.createElement('div');
        this.container.className = 'network-background';
        document.body.appendChild(this.container);
        
        this.nodes = [];
        this.lines = [];
        this.numNodes = 50;
        this.numLines = 30;
        
        this.init();
    }
    
    init() {
        // Create nodes
        for (let i = 0; i < this.numNodes; i++) {
            this.createNode();
        }
        
        // Create lines
        for (let i = 0; i < this.numLines; i++) {
            this.createLine();
        }
        
        // Start animation
        this.animate();
    }
    
    createNode() {
        const node = document.createElement('div');
        node.className = 'network-node';
        
        // Random position
        const x = Math.random() * window.innerWidth;
        const y = Math.random() * window.innerHeight;
        
        node.style.left = `${x}px`;
        node.style.top = `${y}px`;
        
        this.container.appendChild(node);
        this.nodes.push(node);
    }
    
    createLine() {
        const line = document.createElement('div');
        line.className = 'network-line';
        
        // Random position and angle
        const x = Math.random() * window.innerWidth;
        const y = Math.random() * window.innerHeight;
        const angle = Math.random() * 360;
        const length = Math.random() * 100 + 50;
        
        line.style.left = `${x}px`;
        line.style.top = `${y}px`;
        line.style.width = `${length}px`;
        line.style.transform = `rotate(${angle}deg)`;
        
        this.container.appendChild(line);
        this.lines.push(line);
    }
    
    animate() {
        // Animate nodes
        this.nodes.forEach(node => {
            const x = parseFloat(node.style.left);
            const y = parseFloat(node.style.top);
            
            // Random movement
            const newX = x + (Math.random() - 0.5) * 2;
            const newY = y + (Math.random() - 0.5) * 2;
            
            // Keep within bounds
            node.style.left = `${Math.max(0, Math.min(window.innerWidth, newX))}px`;
            node.style.top = `${Math.max(0, Math.min(window.innerHeight, newY))}px`;
        });
        
        // Animate lines
        this.lines.forEach(line => {
            const x = parseFloat(line.style.left);
            const y = parseFloat(line.style.top);
            const angle = parseFloat(line.style.transform.match(/rotate\(([^)]+)\)/)[1]);
            
            // Random movement
            const newX = x + (Math.random() - 0.5) * 2;
            const newY = y + (Math.random() - 0.5) * 2;
            const newAngle = angle + (Math.random() - 0.5) * 2;
            
            // Keep within bounds
            line.style.left = `${Math.max(0, Math.min(window.innerWidth, newX))}px`;
            line.style.top = `${Math.max(0, Math.min(window.innerHeight, newY))}px`;
            line.style.transform = `rotate(${newAngle}deg)`;
        });
        
        requestAnimationFrame(() => this.animate());
    }
}

// Initialize animation when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new NetworkAnimation();
}); 