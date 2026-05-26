const fs = require('fs');
let code = fs.readFileSync('app/projectile.js', 'utf8');

const oldHitbox = `        if (circleOverlapsCrescentArc(this.originX, this.originY, this.angle, this.traveled, e.x, e.y, e.size)) {`;

const newHitbox = `        const pLifeHit = 1 - (this.life / this.maxLife);
        const scaleHit = Math.min(3.0, (this.radius || 30) / 30);
        const rx = (30 + pLifeHit * 30) * scaleHit + e.size; 
        const ry = (60 + pLifeHit * 70) * scaleHit + e.size; 
        const sweepHalf = Math.min(Math.PI, Math.PI * 0.4 + (this.charges || 0) * 0.15);
        
        const dx = e.x - this.x, dy = e.y - this.y;
        const cosA = Math.cos(-this.angle), sinA = Math.sin(-this.angle);
        const localX = dx * cosA - dy * sinA;
        const localY = dx * sinA + dy * cosA;
        
        // Outer ellipse check
        const inOuter = (localX * localX) / (rx * rx) + (localY * localY) / (ry * ry) <= 1;
        // Inner ellipse check (with inner shift -8)
        const inrx = (rx - e.size) * 0.8 - e.size;
        const inry = (ry - e.size) * 0.85 - e.size;
        const inInner = inrx > 0 && inry > 0 ? ((localX + 8) * (localX + 8)) / (inrx * inrx) + (localY * localY) / (inry * inry) < 1 : false;
        // Angle check
        const inAngle = Math.abs(Math.atan2(localY, localX)) <= sweepHalf;
        
        if (inOuter && !inInner && inAngle) {`;

code = code.replace(oldHitbox, newHitbox);

// Now let's fix the drawing
const oldDraw1 = `      ctx.globalAlpha = alpha * 0.6; // Increased transparency so entities are visible`;
const newDraw1 = `      ctx.globalAlpha = alpha * 0.35; // Lower opacity so it doesn't blind the screen`;

const oldDraw2 = `      ctx.lineWidth = 3 + charges * 2;`;
const newDraw2 = `      ctx.lineWidth = Math.min(10, 3 + charges * 1.5);`;

const oldDraw3 = `      ctx.lineWidth = 6 + charges * 3;`;
const newDraw3 = `      ctx.lineWidth = Math.min(15, 6 + charges * 2);`;

const oldDraw4 = `      ctx.globalAlpha = alpha * (0.15 + 0.1 * pulse); // Fill is very transparent`;
const newDraw4 = `      ctx.globalAlpha = alpha * (0.05 + 0.05 * pulse); // Fill is extremely transparent`;

code = code.replace(oldDraw1, newDraw1);
code = code.replace(oldDraw2, newDraw2);
code = code.replace(oldDraw3, newDraw3);
code = code.replace(oldDraw4, newDraw4);

fs.writeFileSync('app/projectile.js', code);
console.log('Fixed hitbox and visibility');
