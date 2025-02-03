/* 
  bubbleSelector.js
  Creates + animates 1000 3D bubbles.
  On hover => show label "particle-<index>" for each bubble.
  On click => highlight bubble for SELECT_DURATION ms.
  Retains all other functionality (random color, drifting, bounce, shading).
*/

const BubbleSelectorApp = (function () {
  'use strict';

  let canvas, ctx;
  let container;
  let width, height;
  let bubbles = [];
  let running = false;
  let lastTime = 0;

  const NUM_BUBBLES = 1000;
  const BUBBLE_SIZE = 25;
  const SELECT_DURATION = 1200; // highlight time in ms

  // If set from outside, all bubbles use this color
  let overrideColor = null;

  // We'll create a tooltip <div> in the DOM for hover labels
  let tooltipDiv = null;
  let lastHoveredIndex = -1; // track which bubble was last hovered

  function init(config) {
    if (config && config.pixelColor) {
      overrideColor = config.pixelColor;
    }

    container = document.getElementById('bubbleCanvasContainer');
    canvas = document.getElementById('bubbleCanvas');
    if (!container || !canvas) {
      console.error("BubbleSelectorApp: Container or Canvas not found.");
      return;
    }
    ctx = canvas.getContext('2d');

    // Create or get the tooltip <div> from DOM:
    // If you prefer, you can create it in HTML instead, with id="bubbleTooltip"
    // For convenience, we create it dynamically here if not found:
    tooltipDiv = document.getElementById('bubbleTooltip');
    if (!tooltipDiv) {
      tooltipDiv = document.createElement('div');
      tooltipDiv.id = 'bubbleTooltip';
      // Basic tooltip styles: absolutely positioned, hidden initially
      tooltipDiv.style.position = 'absolute';
      tooltipDiv.style.display = 'none';
      tooltipDiv.style.padding = '6px';
      tooltipDiv.style.fontSize = '14px';
      tooltipDiv.style.borderRadius = '5px';
      tooltipDiv.style.background = 'rgba(0,0,0,0.8)';
      tooltipDiv.style.color = '#fff';
      tooltipDiv.style.pointerEvents = 'none';
      tooltipDiv.style.zIndex = '9999';
      document.body.appendChild(tooltipDiv);
    }

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    createBubbles();
    canvas.addEventListener('click', handleClick);
    // NEW: Add mousemove for hover label
    canvas.addEventListener('mousemove', handleHover);
    // Hide label on mouse leave
    canvas.addEventListener('mouseleave', () => {
      hideTooltip();
      lastHoveredIndex = -1;
    });

    running = true;
    lastTime = performance.now();
    requestAnimationFrame(animationLoop);
  }

  function resizeCanvas() {
    width = container.clientWidth;
    height = container.clientHeight;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

    ctx.scale(dpr, dpr);

    console.log(`BubbleSelector: Resized to ${width}x${height}.`);
  }

  function createBubbles() {
    bubbles = [];
    for (let i = 0; i < NUM_BUBBLES; i++) {
      const x = Math.random() * (width - BUBBLE_SIZE);
      const y = Math.random() * (height - BUBBLE_SIZE);
      const vx = (Math.random() - 0.5) * 0.3; // slow drift
      const vy = (Math.random() - 0.5) * 0.3;

      const color = overrideColor ? overrideColor : randomRGB();

      bubbles.push({
        x, 
        y, 
        vx, 
        vy,
        color,
        selectedUntil: 0,
        // NEW: each bubble gets a unique label, e.g. "particle-1"
        label: `particle-${i+1}`
      });
    }
  }

  function randomRGB() {
    const r = Math.floor(Math.random() * 256);
    const g = Math.floor(Math.random() * 256);
    const b = Math.floor(Math.random() * 256);
    return `rgb(${r},${g},${b})`;
  }

  /* 
    handleHover(e):
      1) find top bubble under cursor
      2) if found => show tooltip with that bubble's .label
      3) else hide tooltip
  */
  function handleHover(e) {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // find topmost bubble from back -> front
    let foundIndex = -1;
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      if (
        mx >= b.x && mx <= b.x + BUBBLE_SIZE &&
        my >= b.y && my <= b.y + BUBBLE_SIZE
      ) {
        foundIndex = i;
        break;
      }
    }

    if (foundIndex !== -1) {
      const b = bubbles[foundIndex];
      // Show tooltip with bubble.label
      showTooltip(e.clientX, e.clientY, b.label);
      lastHoveredIndex = foundIndex;
    } else {
      // no bubble found
      hideTooltip();
      lastHoveredIndex = -1;
    }
  }

  function handleClick(e) {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      if (
        mx >= b.x && mx <= b.x + BUBBLE_SIZE &&
        my >= b.y && my <= b.y + BUBBLE_SIZE
      ) {
        b.selectedUntil = performance.now() + SELECT_DURATION;
        console.log(`Bubble #${i} clicked => color: ${b.color}, label: ${b.label}`);
        break;
      }
    }
  }

  function animationLoop(now) {
    if (!running) return;
    const dt = now - lastTime;
    lastTime = now;

    update(dt);
    draw();

    requestAnimationFrame(animationLoop);
  }

  function update(dt) {
    const dtSec = dt / 16.6667;
    for (const b of bubbles) {
      b.x += b.vx * dtSec;
      b.y += b.vy * dtSec;

      // bounce
      if (b.x < 0) {
        b.x = 0; 
        b.vx *= -1;
      } else if (b.x + BUBBLE_SIZE > width) {
        b.x = width - BUBBLE_SIZE;
        b.vx *= -1;
      }
      if (b.y < 0) {
        b.y = 0; 
        b.vy *= -1;
      } else if (b.y + BUBBLE_SIZE > height) {
        b.y = height - BUBBLE_SIZE;
        b.vy *= -1;
      }
    }
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    for (let i = 0; i < bubbles.length; i++) {
      drawBubble(bubbles[i]);
    }
  }

  function drawBubble(b) {
    const now = performance.now();
    const isSelected = now < b.selectedUntil;

    const margin = BUBBLE_SIZE * 0.2;
    const size = BUBBLE_SIZE - margin;
    const offset = margin / 2;
    const cx = b.x + offset + size / 2;
    const cy = b.y + offset + size / 2;

    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(cx - size / 2 + 3, cy - size / 2 + 3, size, size);

    // 3D radial gradient
    const grad = ctx.createRadialGradient(cx, cy, size * 0.15, cx, cy, size * 0.8);
    grad.addColorStop(0, lighten(b.color, 0.4));
    grad.addColorStop(0.5, b.color);
    grad.addColorStop(1, darken(b.color, 0.2));

    ctx.beginPath();
    ctx.arc(cx, cy, size / 2, 0, 2 * Math.PI);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.closePath();

    // highlight ring if selected
    if (isSelected) {
      ctx.save();
      ctx.shadowColor = '#fff';
      ctx.shadowBlur = 15;
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#fff';
      ctx.beginPath();
      ctx.arc(cx, cy, (size / 2) + 2, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Show the tooltip near mouse pointer
  function showTooltip(clientX, clientY, label) {
    if (!tooltipDiv) return;
    tooltipDiv.textContent = label;
    tooltipDiv.style.display = 'block';
    tooltipDiv.style.left = (clientX + 10) + 'px';
    tooltipDiv.style.top = (clientY + 10) + 'px';
  }

  // Hide the tooltip
  function hideTooltip() {
    if (!tooltipDiv) return;
    tooltipDiv.style.display = 'none';
  }

  // lighten/darken logic
  function lighten(color, amt) {
    const [r, g, b] = parseRGB(color);
    const R = Math.min(r + (255 - r) * amt, 255);
    const G = Math.min(g + (255 - g) * amt, 255);
    const B = Math.min(b + (255 - b) * amt, 255);
    return `rgb(${R},${G},${B})`;
  }

  function darken(color, amt) {
    const [r, g, b] = parseRGB(color);
    const R = Math.max(r - r * amt, 0);
    const G = Math.max(g - g * amt, 0);
    const B = Math.max(b - b * amt, 0);
    return `rgb(${R},${G},${B})`;
  }

  function parseRGB(color) {
    const match = color.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
    if (!match) return [255, 255, 255];
    return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
  }

  function stop() {
    running = false;
  }

  return {
    init,
    stop
  };
})();
