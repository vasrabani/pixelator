/* 
  custom.js - Optimized Version with Focus Mode
  ---------------------------------------------------
  Final Enhancement:
    - On returning from selector.html with ?focusPixelID=..., 
      we re-center that pixel at scale=10 so it remains enlarged.
    - Only shrink if user clicks outside it.
*/

const PixelGridApp = (function ($) {
  "use strict";

  // -------------------------------------------------
  // 1) QuadTree Implementation (unchanged)
  // -------------------------------------------------
  class Rectangle {
    constructor(x, y, w, h) {
      this.x = x;
      this.y = y;
      this.w = w;
      this.h = h;
    }
    intersectsRange(range) {
      return !(
        range.x > this.x + this.w ||
        range.x + range.w < this.x ||
        range.y > this.y + this.h ||
        range.y + range.h < this.y
      );
    }
  }

  class Quadtree {
    constructor(boundary, capacity = 10, level = 0, maxLevel = 10) {
      this.boundary = boundary;
      this.capacity = capacity;
      this.level = level;
      this.maxLevel = maxLevel;
      this.items = [];
      this.divided = false;
    }

    subdivide() {
      const { x, y, w, h } = this.boundary;
      const halfW = w / 2;
      const halfH = h / 2;
      this.northeast = new Quadtree(
        new Rectangle(x + halfW, y, halfW, halfH),
        this.capacity,
        this.level + 1,
        this.maxLevel
      );
      this.northwest = new Quadtree(
        new Rectangle(x, y, halfW, halfH),
        this.capacity,
        this.level + 1,
        this.maxLevel
      );
      this.southeast = new Quadtree(
        new Rectangle(x + halfW, y + halfH, halfW, halfH),
        this.capacity,
        this.level + 1,
        this.maxLevel
      );
      this.southwest = new Quadtree(
        new Rectangle(x, y + halfH, halfW, halfH),
        this.capacity,
        this.level + 1,
        this.maxLevel
      );
      this.divided = true;
    }

    clear() {
      this.items = [];
      if (this.divided) {
        this.northeast.clear();
        this.northwest.clear();
        this.southeast.clear();
        this.southwest.clear();
      }
      this.divided = false;
    }

    insert(item) {
      if (
        !this.boundary.intersectsRange(
          new Rectangle(item.x, item.y, item.w, item.h)
        )
      ) {
        return false;
      }
      if (this.items.length < this.capacity || this.level === this.maxLevel) {
        this.items.push(item);
        return true;
      }
      if (!this.divided) this.subdivide();
      if (this.northeast.insert(item)) return true;
      if (this.northwest.insert(item)) return true;
      if (this.southeast.insert(item)) return true;
      if (this.southwest.insert(item)) return true;
      return false;
    }

    query(range, found) {
      if (!this.boundary.intersectsRange(range)) return;
      for (const it of this.items) {
        const itX2 = it.x + it.w;
        const itY2 = it.y + it.h;
        if (
          itX2 >= range.x &&
          it.x <= range.x + range.w &&
          itY2 >= range.y &&
          it.y <= range.y + range.h
        ) {
          found.push(it);
        }
      }
      if (this.divided) {
        this.northwest.query(range, found);
        this.northeast.query(range, found);
        this.southwest.query(range, found);
        this.southeast.query(range, found);
      }
    }
  }

  // -------------------------------------------------
  // 2) Module-Level Vars
  // -------------------------------------------------
  let canvasContainer, canvasElement, ctx;
  let hoverCanvasElement, hoverCtx;
  let progressLabel, progressPercentage;
  let pixelModal, bgMusic;

  const clickSoundBase = new Audio("js/click-sound.mp3");
  clickSoundBase.volume = 0.5;
  let lastClickTime = 0;
  const CLICK_COOLDOWN = 100; // ms

  let pixelData = [];
  let pixelSize;
  let totalPixelsToLoad;
  let isBuilding = false;

  let quad = null;

  const waves = [];
  const explosions = [];
  let animating = false;
  let lastFrameTime = 0;
  let frameCounter = 0;

  // Interaction
  let lastClickedPixel = null;
  let lastHoveredPixelIndex = null;
  let lastTooltipContent = "";
  let isShowingChosenPixels = false;
  let lastWaveHoveredPixel = -1;

  // Performance caches
  const adjustColorCache = {};
  const gradientCache = {};

  // Donation/leaderboard
  const LEADERBOARD_KEY = "donationLeaderboard";
  let userDonationsMap = {};

  // Gamification
  let userPoints = 0;
  let totalPixelsOwned = 0;
  let totalDonated = 0;

  // Charity
  let currentRaised = 0;
  const target = 10000;

  // Config
  const DEFAULT_PIXEL_SIZE = 10;
  const CHUNK_SIZE = 200;
  const LOCAL_STORAGE_KEY = "pixelGridData";
  const MAX_PIXELS = 1000;

  // Rebuild quadtree every N frames
  const quadRebuildInterval = 3;

  // Focus mode
  const focusMode = {
    index: -1,
    state: null, // "focusing" | "focused" | null
    startTime: 0,
    duration: 600
  };

  // -------------------------------------------------
  // 4) Utility
  // -------------------------------------------------
  function getRandomColor() {
    return `#${Math.floor(Math.random() * 0xffffff)
      .toString(16)
      .padStart(6, "0")}`;
  }

  function adjustColor(color, percent) {
    const cacheKey = `${color}-${percent}`;
    if (adjustColorCache[cacheKey]) {
      return adjustColorCache[cacheKey];
    }
    const num = parseInt(color.slice(1), 16);
    const amt = Math.round(2.55 * (percent * 100));
    const R = Math.min(255, Math.max(0, (num >> 16) + amt));
    const G = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amt));
    const B = Math.min(255, Math.max(0, (num & 0xff) + amt));
    const adjusted = `#${((1 << 24) + (R << 16) + (G << 8) + B)
      .toString(16)
      .slice(1)}`;
    adjustColorCache[cacheKey] = adjusted;
    return adjusted;
  }

  function randRange(min, max) {
    return Math.random() * (max - min) + min;
  }

  function setCanvasResolution(canvas, w, h) {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";

    const context = canvas.getContext("2d");
    context.scale(dpr, dpr);
    context.imageSmoothingEnabled = false;
    return context;
  }

  function lerp(start, end, t) {
    return start + (end - start) * t;
  }

  function playClickSound() {
    const now = performance.now();
    if (now - lastClickTime < CLICK_COOLDOWN) {
      return;
    }
    lastClickTime = now;
    const sfx = clickSoundBase.cloneNode();
    sfx.play().catch(() => {});
  }

  // -------------------------------------------------
  // 5) Build Pixel Grid
  // -------------------------------------------------
  function buildPixelGridAsync(newPixelSize, totalPixels = MAX_PIXELS) {
    pixelSize = newPixelSize;
    pixelData = [];
    isShowingChosenPixels = false;
    totalPixelsToLoad = totalPixels;
    isBuilding = true;

    let width = canvasContainer.width();
    let height = canvasContainer.height();
    if (width < 1 || height < 1) {
      console.warn("[buildPixelGridAsync] Container 0 dimension => fallback 800x600");
      width = 800;
      height = 600;
    }

    ctx = setCanvasResolution(canvasElement, width, height);
    hoverCtx = setCanvasResolution(hoverCanvasElement, width, height);

    ctx.clearRect(0, 0, width, height);
    hoverCtx.clearRect(0, 0, width, height);

    progressLabel.show();
    progressPercentage.text("0%");

    let pixelsCreated = 0;

    function renderChunk() {
      let chunkCount = 0;
      while (pixelsCreated < totalPixelsToLoad && chunkCount < CHUNK_SIZE) {
        const floatX = randRange(0, width - pixelSize);
        const floatY = randRange(0, height - pixelSize);
        const velocityX = randRange(-0.2, 0.2);
        const velocityY = randRange(-0.2, 0.2);

        pixelData.push({
          floatX,
          floatY,
          velocityX,
          velocityY,
          color: getRandomColor(),
          id: `pixel-${pixelsCreated}`,
          answer: null,
          // focus mode
          scale: 1,
          origX: floatX,
          origY: floatY,
          origScale: 1,
          targetX: floatX,
          targetY: floatY,
          targetScale: 1
        });

        chunkCount++;
        pixelsCreated++;
      }

      const progress = Math.floor((pixelsCreated / totalPixelsToLoad) * 100);
      progressPercentage.text(`${progress}%`);

      if (pixelsCreated < totalPixelsToLoad) {
        requestAnimationFrame(renderChunk);
      } else {
        progressLabel.hide();
        isBuilding = false;
      }
    }
    renderChunk();
  }

  // -------------------------------------------------
  // 6) Quadtree Rebuild
  // -------------------------------------------------
  function rebuildQuadtree() {
    if (quad) quad.clear();
    let w = canvasContainer.width();
    let h = canvasContainer.height();
    if (w < 1 || h < 1) {
      console.warn("[rebuildQuadtree] Container 0 dimension => fallback 800x600");
      w = 800;
      h = 600;
    }

    quad = new Quadtree(new Rectangle(0, 0, w, h), 30, 0, 10);

    for (let i = 0; i < pixelData.length; i++) {
      const p = pixelData[i];
      if (isShowingChosenPixels && !p.answer) continue;

      const sc = p.scale || 1;
      quad.insert({
        x: p.floatX,
        y: p.floatY,
        w: pixelSize * sc,  // scaled width
        h: pixelSize * sc,  // scaled height
        pixelRef: i
      });
    }
  }

  // -------------------------------------------------
  // 7) Drawing Utilities
  // -------------------------------------------------
  function getRadialGradientLocal(ctx, color, size) {
    const cacheKey = `${color}-${size}`;
    if (gradientCache[cacheKey]) {
      return gradientCache[cacheKey];
    }
    const centerX = size * 0.4;
    const centerY = size * 0.4;
    const maxRadius = size;
    const radialGradient = ctx.createRadialGradient(
      centerX,
      centerY,
      size * 0.1,
      size / 2,
      size / 2,
      maxRadius
    );
    radialGradient.addColorStop(0, adjustColor(color, 0.8));
    radialGradient.addColorStop(0.5, color);
    radialGradient.addColorStop(1, adjustColor(color, -0.3));
    gradientCache[cacheKey] = radialGradient;
    return radialGradient;
  }

  function drawPixel(canvasCtx, x, y, color, size) {
    const margin = Math.max(1, size * 0.2);
    const innerSize = size - margin;
    const offset = margin / 2;

    const shadowOffset = Math.max(1, size * 0.1);
    canvasCtx.fillStyle = "rgba(0,0,0,0.3)";
    canvasCtx.fillRect(
      x + offset + shadowOffset,
      y + offset + shadowOffset,
      innerSize,
      innerSize
    );

    const grad = getRadialGradientLocal(canvasCtx, color, innerSize);
    canvasCtx.fillStyle = grad;
    canvasCtx.fillRect(x + offset, y + offset, innerSize, innerSize);

    canvasCtx.strokeStyle = adjustColor(color, -0.4);
    canvasCtx.lineWidth = 1;
    canvasCtx.strokeRect(
      x + offset + 0.5,
      y + offset + 0.5,
      innerSize - 1,
      innerSize - 1
    );

    canvasCtx.beginPath();
    canvasCtx.moveTo(x + offset + 1, y + offset + 1);
    canvasCtx.lineTo(x + offset + innerSize - 2, y + offset + 1);
    canvasCtx.strokeStyle = adjustColor(color, 0.6);
    canvasCtx.lineWidth = 0.75;
    canvasCtx.stroke();
    canvasCtx.closePath();
  }

  function draw3DBlackCirclePixel(canvasCtx, px, py, size) {
    const margin = Math.max(1, size * 0.2);
    const innerSize = size - margin;
    const offset = margin / 2;
    const shadowOffset = Math.max(1, size * 0.1);

    canvasCtx.fillStyle = "rgba(0,0,0,0.3)";
    canvasCtx.fillRect(
      px + offset + shadowOffset,
      py + offset + shadowOffset,
      innerSize,
      innerSize
    );

    const centerX = px + offset + innerSize / 2;
    const centerY = py + offset + innerSize / 2;
    const radius = innerSize / 2;

    const grad = canvasCtx.createRadialGradient(
      centerX,
      centerY,
      radius * 0.3,
      centerX,
      centerY,
      radius
    );
    grad.addColorStop(0, "#555");
    grad.addColorStop(1, "#000");

    canvasCtx.beginPath();
    canvasCtx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    canvasCtx.fillStyle = grad;
    canvasCtx.fill();
    canvasCtx.lineWidth = 1.5;
    canvasCtx.strokeStyle = "#222";
    canvasCtx.stroke();
  }

  // -------------------------------------------------
  // 8) Motion, Waves, Explosions
  // -------------------------------------------------
  function updatePixelPositions(dt) {
    const dtSec = dt / 16.6667;
    let width = canvasContainer.width();
    let height = canvasContainer.height();

    if (width < 1 || height < 1) {
      width = 800;
      height = 600;
    }

    for (const p of pixelData) {
      p.floatX += p.velocityX * dtSec;
      p.floatY += p.velocityY * dtSec;

      // bounce
      if (p.floatX < 0) {
        p.floatX = 0;
        p.velocityX *= -1;
      } else if (p.floatX + pixelSize > width) {
        p.floatX = width - pixelSize;
        p.velocityX *= -1;
      }
      if (p.floatY < 0) {
        p.floatY = 0;
        p.velocityY *= -1;
      } else if (p.floatY + pixelSize > height) {
        p.floatY = height - pixelSize;
        p.velocityY *= -1;
      }
    }
  }

  function startWave(cx, cy) {
    waves.push({
      centerX: cx,
      centerY: cy,
      startTime: performance.now(),
      duration: 600,
      maxOffset: 150
    });
  }

  function startExplosion(cx, cy) {
    explosions.push({
      centerX: cx,
      centerY: cy,
      startTime: performance.now(),
      duration: 600,
      maxRadius: 150
    });
  }

  function clearOldWaves(now) {
    for (let i = 0; i < waves.length; i++) {
      if (now - waves[i].startTime > waves[i].duration) {
        waves.splice(i, 1);
        i--;
      }
    }
  }

  function animateExplosions(now) {
    hoverCtx.clearRect(0, 0, hoverCanvasElement.width, hoverCanvasElement.height);

    for (let i = 0; i < explosions.length; i++) {
      const exp = explosions[i];
      const elapsed = now - exp.startTime;
      const fraction = elapsed / exp.duration;
      if (fraction >= 1) {
        explosions.splice(i, 1);
        i--;
        continue;
      }
      const currentRadius = fraction * exp.maxRadius;
      drawExplosionRing(exp.centerX, exp.centerY, currentRadius);
    }
  }

  function drawExplosionRing(cx, cy, radius) {
    hoverCtx.save();
    hoverCtx.beginPath();
    hoverCtx.arc(cx, cy, radius, 0, 2 * Math.PI);
    hoverCtx.lineWidth = 4;
    hoverCtx.strokeStyle = "rgba(255,255,0,0.7)";
    hoverCtx.stroke();
    hoverCtx.restore();
  }

  function applyWaveOffsets(now) {
    for (const wave of waves) {
      const elapsed = now - wave.startTime;
      const fraction = elapsed / wave.duration;
      if (fraction <= 1) {
        const waveRadius = fraction * wave.maxOffset;
        let w = canvasContainer.width();
        let h = canvasContainer.height();
        if (w < 1 || h < 1) {
          w = 800;
          h = 600;
        }

        const minX = wave.centerX - waveRadius;
        const minY = wave.centerY - waveRadius;
        const boxSize = waveRadius * 2;

        const found = [];
        if (quad) {
          quad.query({ x: minX, y: minY, w: boxSize, h: boxSize }, found);
        }
        for (const item of found) {
          const p = pixelData[item.pixelRef];
          const dx = p.floatX + pixelSize / 2 - wave.centerX;
          const dy = p.floatY + pixelSize / 2 - wave.centerY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < waveRadius) {
            const push = (waveRadius - dist) * 0.05;
            const dirX = dx / dist || 0;
            const dirY = dy / dist || 0;
            p._waveOffsetX = (p._waveOffsetX || 0) + dirX * push;
            p._waveOffsetY = (p._waveOffsetY || 0) + dirY * push;
          }
        }
      }
    }
  }

  // -------------------------------------------------
  // 9) Focus Mode
  // -------------------------------------------------
  function applyFocusAnimation() {
    if (!focusMode.state) return;
    const now = performance.now();
    const elapsed = now - focusMode.startTime;
    const t = Math.min(elapsed / focusMode.duration, 1);

    const focusingPixels = pixelData.filter(
      (p) =>
        p.origX !== p.targetX ||
        p.origY !== p.targetY ||
        p.origScale !== p.targetScale
    );

    for (const p of focusingPixels) {
      if (focusMode.state === "focusing" || focusMode.state === "focused") {
        p.floatX = lerp(p.origX, p.targetX, t);
        p.floatY = lerp(p.origY, p.targetY, t);
        p.scale = lerp(p.origScale, p.targetScale, t);
      }
    }

    // once done animating
    if (t >= 1 && focusMode.state === "focusing") {
      focusMode.state = "focused";
    }
  }

  function setupFocusAnimation(fIdx) {
    let w = canvasContainer.width();
    let h = canvasContainer.height();
    if (w < 1 || h < 1) {
      console.warn("[setupFocusAnimation] 0 dimension => fallback 800x600");
      w = 800;
      h = 600;
    }

    const scaleFactor = 10;
    const halfScaled = (pixelSize * scaleFactor) / 2;
    const finalX = (w / 2) - halfScaled;
    const finalY = (h / 2) - halfScaled;

    const fp = pixelData[fIdx];
    fp.origX = fp.floatX;
    fp.origY = fp.floatY;
    fp.origScale = fp.scale || 1;
    fp.targetScale = scaleFactor;
    fp.targetX = finalX;
    fp.targetY = finalY;

    // push others to edges
    for (let i = 0; i < pixelData.length; i++) {
      if (i === fIdx) continue;
      const p = pixelData[i];
      p.origX = p.floatX;
      p.origY = p.floatY;
      p.origScale = p.scale || 1;
      p.targetScale = 1;

      if (p.floatX < w / 2) {
        p.targetX = 0;
      } else {
        p.targetX = w - pixelSize;
      }
      p.targetY = p.floatY;
    }

    // Rebuild quadtree with scaled w,h so second click sees new bounding box
    rebuildQuadtree();
  }

  function exitFocusMode() {
    focusMode.index = -1;
    focusMode.state = null;
    for (const p of pixelData) {
      p.scale = 1;
      p.targetScale = 1;
    }
  }

  // -------------------------------------------------
  // 10) Main Draw Loop
  // -------------------------------------------------
  function redrawGridWithAnimations() {
    let w = canvasContainer.width();
    let h = canvasContainer.height();
    if (w < 1 || h < 1) {
      w = 800;
      h = 600;
    }

    applyFocusAnimation();

    ctx.clearRect(0, 0, w, h);

    for (let i = 0; i < pixelData.length; i++) {
      const p = pixelData[i];
      if (isShowingChosenPixels && !p.answer) continue;

      const offsetX = p._waveOffsetX || 0;
      const offsetY = p._waveOffsetY || 0;
      const drawX = p.floatX + offsetX;
      const drawY = p.floatY + offsetY;
      const sc = p.scale || 1;

      if (p.color === "#000000" && p.answer !== null) {
        draw3DBlackCirclePixel(ctx, drawX, drawY, pixelSize * sc);
      } else {
        drawPixel(ctx, drawX, drawY, p.color, pixelSize * sc);
      }

      p._waveOffsetX = 0;
      p._waveOffsetY = 0;
    }
  }

  // -------------------------------------------------
  // 11) Continuous Animation Loop
  // -------------------------------------------------
  function mainAnimationLoop(timestamp) {
    if (!animating) return;
    frameCounter++;

    const dt = timestamp - lastFrameTime;
    lastFrameTime = timestamp;

    if (!isBuilding) {
      updatePixelPositions(dt);

      if (frameCounter % quadRebuildInterval === 0) {
        rebuildQuadtree();
      }

      const now = performance.now();
      clearOldWaves(now);
      applyWaveOffsets(now);
      animateExplosions(now);

      redrawGridWithAnimations();
    }

    requestAnimationFrame(mainAnimationLoop);
  }

  // -------------------------------------------------
  // 12) Hover & Click
  // -------------------------------------------------
  let hoverTimeout;
  function handleHoverDebounced(e) {
    clearTimeout(hoverTimeout);
    hoverTimeout = setTimeout(() => handleHover(e), 20);
  }

  function handleMouseLeave() {
    clearTimeout(hoverTimeout);
    hideTooltip();
    lastHoveredPixelIndex = -1;
  }

  function handleHover(e) {
    const rect = canvasElement.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    hoverCtx.clearRect(0, 0, hoverCanvasElement.width, hoverCanvasElement.height);

    const pixelIndex = findPixelUnderMouse(mx, my);
    if (pixelIndex !== -1) {
      const hoveredPixel = pixelData[pixelIndex];
      if (!isShowingChosenPixels || hoveredPixel.answer !== null) {
        lastHoveredPixelIndex = pixelIndex;
        const bubbleX = hoveredPixel.floatX;
        const bubbleY = hoveredPixel.floatY;

        drawPixel(
          hoverCtx,
          bubbleX - pixelSize / 2,
          bubbleY - pixelSize / 2,
          hoveredPixel.color,
          pixelSize * 2
        );

        const chosenAnswer = hoveredPixel.answer ? hoveredPixel.answer : "No answer";
        const tooltipText = `ID: ${hoveredPixel.id} | Answer: ${chosenAnswer}`;
        showTooltip(e.clientX, e.clientY, tooltipText);

        if (pixelIndex !== lastWaveHoveredPixel) {
          lastWaveHoveredPixel = pixelIndex;
          const centerX = bubbleX + pixelSize / 2;
          const centerY = bubbleY + pixelSize / 2;
          startWave(centerX, centerY);
        }
      } else {
        hideTooltip();
      }
    } else {
      hideTooltip();
      lastHoveredPixelIndex = -1;
    }
  }

  function findPixelUnderMouse(mx, my) {
    if (!quad) return -1;
    const found = [];
    quad.query({ x: mx - 2, y: my - 2, w: 4, h: 4 }, found);

    for (let i = found.length - 1; i >= 0; i--) {
      const item = found[i];
      const p = pixelData[item.pixelRef];
      const sizeForHitTest = pixelSize * (p.scale || 1);
      if (
        mx >= p.floatX &&
        mx <= p.floatX + sizeForHitTest &&
        my >= p.floatY &&
        my <= p.floatY + sizeForHitTest
      ) {
        return item.pixelRef;
      }
    }
    return -1;
  }

  function showTooltip(clientX, clientY, text) {
    const tooltip = $("#pixelTooltip");
    if (lastTooltipContent !== text) {
      tooltip.text(text);
      tooltip.css({
        top: `${clientY + 10}px`,
        left: `${clientX + 10}px`,
        display: "block",
      });
      tooltip.attr({ "aria-hidden": "false", "aria-label": text });
      lastTooltipContent = text;
    }
  }

  function hideTooltip() {
    const tooltip = $("#pixelTooltip");
    tooltip.hide();
    tooltip.attr("aria-hidden", "true");
    lastTooltipContent = "";
  }

  // -------------------------------------------------
  // 13) Focus Mode Click
  // -------------------------------------------------
  function handlePixelClick(p, mx, my) {
    // If pixel is unowned => focus logic
    if (p.answer === null) {
      // 1st click => focusing
      if (focusMode.index === -1) {
        startExplosion(mx, my);
        lastClickedPixel = p;
        focusMode.index = pixelData.indexOf(p);
        focusMode.state = "focusing";
        focusMode.startTime = performance.now();
        setupFocusAnimation(focusMode.index);

      } else {
        // 2nd click => same pixel => go to selector
        // ALLOW "focusing" or "focused"
        const samePixel = focusMode.index === pixelData.indexOf(p);
        const isAlreadyFocused = ["focusing", "focused"].includes(focusMode.state);

        if (samePixel && isAlreadyFocused) {
          const pixelID = encodeURIComponent(p.id);
          const pixelColor = encodeURIComponent(p.color);
          window.location.href = `selector.html?pixelID=${pixelID}&pixelColor=${pixelColor}`;
          playClickSound();
        }
      }
    } else {
      // Owned => open modal or other logic
      // pixelModal.show();
    }
  }

  // -------------------------------------------------
  // 14) Donation & Leaderboard
  // -------------------------------------------------
  function processDonation(donorName, amount) {
    if (!donorName || !amount || amount < 1) {
      alert("Invalid name or donation amount!");
      return false;
    }
    if (!userDonationsMap[donorName]) {
      userDonationsMap[donorName] = 0;
    }
    userDonationsMap[donorName] += amount;
    totalDonated += amount;
    saveDonationLeaderboard();
    return true;
  }

  function saveDonationLeaderboard() {
    try {
      localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(userDonationsMap));
    } catch (e) {
      console.error("Failed to save leaderboard:", e);
    }
  }

  function loadDonationLeaderboard() {
    try {
      const data = localStorage.getItem(LEADERBOARD_KEY);
      if (data) {
        userDonationsMap = JSON.parse(data);
      }
    } catch (e) {
      console.error("Failed to load leaderboard:", e);
    }
  }

  function updateLeaderboardTable() {
    const tableBody = $("#leaderboardTable tbody");
    tableBody.empty();

    const leaderboardArray = Object.entries(userDonationsMap).map(([name, donation]) => ({
      name,
      donation,
    }));
    leaderboardArray.sort((a, b) => b.donation - a.donation);

    leaderboardArray.forEach((entry, index) => {
      const row = `<tr>
        <td>${index + 1}</td>
        <td>${entry.name}</td>
        <td>$${entry.donation}</td>
      </tr>`;
      tableBody.append(row);
    });
  }

  function openSocialShare(donorName, amount) {
    const shareText = encodeURIComponent(
      `I just donated $${amount} to the Charity Fundraiser! Join me in making a difference.`
    );
    const shareUrl = encodeURIComponent("https://your-charity-fundraiser.example.com");
    const twitterUrl = `https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`;

    const userChoice = confirm("Donation successful! Would you like to share on Twitter?");
    if (userChoice) {
      window.open(twitterUrl, "_blank");
    }
  }

  // -------------------------------------------------
  // 15) Gamification & Challenges
  // -------------------------------------------------
  function addPoints(points) {
    userPoints += points;
    $("#userPoints").text(userPoints);
  }

  function checkChallenges() {
    $("#challenge-1-status").text(`${totalPixelsOwned}/5`);
    if (totalPixelsOwned >= 5) {
      $("#challenge-1-status").removeClass("bg-secondary").addClass("bg-success");
    }
    $("#challenge-2-status").text(`$${totalDonated}/50`);
    if (totalDonated >= 50) {
      $("#challenge-2-status").removeClass("bg-secondary").addClass("bg-success");
    }
  }

  // -------------------------------------------------
  // 16) Charity Progress
  // -------------------------------------------------
  function updateCharityProgress(newDonation) {
    currentRaised += newDonation;
    const progressBar = $("#charityProgressBar");
    const progressLabel = $("#charityProgressLabel");
    let percent = Math.floor((currentRaised / target) * 100);
    if (percent > 100) percent = 100;

    progressBar.css("width", percent + "%");
    progressLabel.text(`$${currentRaised}`);

    const answeredCount = pixelData.filter((p) => p.answer !== null).length;
    const answeredPct = Math.floor((answeredCount / pixelData.length) * 100);
    $("#pixelStats").text(
      `${answeredCount} / ${pixelData.length} pixels answered (${answeredPct}%)`
    );
  }

  // -------------------------------------------------
  // 17) Save/Load
  // -------------------------------------------------
  function saveGridToLocalStorage() {
    try {
      const dataToSave = {
        pixelSize,
        pixelData,
        currentRaised,
        totalDonated,
        totalPixelsOwned,
        userPoints,
      };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(dataToSave));
      alert("Grid state saved successfully!");
    } catch (error) {
      console.error("Error saving grid:", error);
      alert("Failed to save grid.");
    }
  }

  function loadGridFromLocalStorage() {
    try {
      const storedData = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!storedData) {
        alert("No saved grid found.");
        return;
      }
      const parsed = JSON.parse(storedData);
      pixelSize = parsed.pixelSize;
      pixelData = parsed.pixelData;
      currentRaised = parsed.currentRaised || 0;
      totalDonated = parsed.totalDonated || 0;
      totalPixelsOwned = parsed.totalPixelsOwned || 0;
      userPoints = parsed.userPoints || 0;

      let w = canvasContainer.width();
      let h = canvasContainer.height();
      if (w < 1 || h < 1) {
        console.warn("[loadGridFromLocalStorage] Container dimension is zero => fallback 800x600");
        w = 800;
        h = 600;
      }
      ctx = setCanvasResolution(canvasElement, w, h);
      hoverCtx = setCanvasResolution(hoverCanvasElement, w, h);

      $("#userPoints").text(userPoints);
      updateCharityProgress(0);
      checkChallenges();
      alert("Grid state loaded successfully!");
    } catch (error) {
      console.error("Error loading grid:", error);
      alert("Failed to load grid.");
    }
  }

  // -------------------------------------------------
  // 18) Background Music
  // -------------------------------------------------
  function toggleBackgroundMusic() {
    if (!bgMusic) return;
    if (bgMusic.paused) {
      bgMusic.play().catch((err) => console.error("Music play error:", err));
    } else {
      bgMusic.pause();
    }
  }

  // -------------------------------------------------
  // 19) Event Binding
  // -------------------------------------------------
  function bindEvents() {
    // hover
    canvasElement.addEventListener("mousemove", handleHoverDebounced);
    canvasElement.addEventListener("mouseleave", handleMouseLeave);

    // click
    function handleCanvasClick(e) {
      const rect = canvasElement.getBoundingClientRect();
      const touch = e.touches ? e.touches[0] : e;
      const mx = touch.clientX - rect.left;
      const my = touch.clientY - rect.top;

      // If user is already focusing a pixel => only exit if we truly clicked outside that pixel
      // We'll see if findPixelUnderMouse() hits the same pixel in focus, or none
      const pixelIndex = findPixelUnderMouse(mx, my);
      if (pixelIndex === -1) {
        // truly outside
        if (focusMode.index !== -1) {
          exitFocusMode();
        }
        startExplosion(mx, my);
      } else {
        // we clicked a pixel => handle
        startExplosion(mx, my);
        const p = pixelData[pixelIndex];
        handlePixelClick(p, mx, my);
      }
    }
    canvasElement.addEventListener("click", handleCanvasClick);
    canvasElement.addEventListener("touchstart", handleCanvasClick, { passive: true });

    // Zoom => rebuild
    $("#zoom-level").on("change", function () {
      const selectedSize = parseInt($(this).val(), 10);
      if (!isNaN(selectedSize)) {
        buildPixelGridAsync(selectedSize);
      }
    });

    // Reset
    $("#resetGrid").on("click", () => {
      buildPixelGridAsync(pixelSize);
      isShowingChosenPixels = false;
    });

    // Recolor
    $("#recolorPixels").on("click", () => {
      for (const p of pixelData) {
        p.color = getRandomColor();
      }
    });

    // Color Picker => single color
    $("#colorPicker").on("change", function () {
      const chosenColor = $(this).val();
      for (const p of pixelData) {
        p.color = chosenColor;
      }
    });

    // Show/hide chosen
    $("#showChosenPixels").on("click", function () {
      if (isShowingChosenPixels) {
        isShowingChosenPixels = false;
        $(this).html('<i class="bi bi-flag" title="Show Chosen Pixels"></i>');
      } else {
        const chosenPixels = pixelData.filter((pixel) => pixel.answer !== null);
        if (chosenPixels.length === 0) {
          alert("No pixels have been selected yet!");
          return;
        }
        isShowingChosenPixels = true;
        $(this).html('<i class="bi bi-grid" title="Show All Pixels"></i>');
      }
      $(this).toggleClass("animate-scale");
      setTimeout(() => $(this).toggleClass("animate-scale"), 300);
    });

    // Submit Answer
    $("#submitAnswer").on("click", () => {
      const chosenAnswer = $('input[name="answer"]:checked').val();
      if (!chosenAnswer) {
        alert("Please select an answer.");
        return;
      }
      if (!lastClickedPixel) {
        alert("No pixel selected.");
        return;
      }
      lastClickedPixel.answer = chosenAnswer;
      lastClickedPixel.color = "#000000";
      totalPixelsOwned++;
      addPoints(10);
      checkChallenges();
      alert("Answer submitted. You now own this pixel!");
    });

    // Donate
    $("#donateNow").on("click", () => {
      if (!lastClickedPixel || !lastClickedPixel.answer) {
        alert("Own the pixel first by submitting an answer.");
        return;
      }
      const donorName = $("#donorName").val();
      const amount = parseFloat($("#donationAmount").val());
      if (!donorName || isNaN(amount) || amount <= 0) {
        alert("Enter a valid donor name and amount.");
        return;
      }
      const success = processDonation(donorName, amount);
      if (success) {
        updateCharityProgress(amount);
        checkChallenges();
        openSocialShare(donorName, amount);
        pixelModal.hide();
      }
    });

    // Cluster marking
    $("#clusterSizeDropdown").on("change", function () {
      const selectedClusterSize = parseInt($(this).val(), 10);
      if (isNaN(selectedClusterSize)) {
        alert("Select a valid cluster size.");
        return;
      }
      for (let i = 0; i < selectedClusterSize; i++) {
        const randomIndex = Math.floor(Math.random() * pixelData.length);
        pixelData[randomIndex].color = "#ff0000";
        pixelData[randomIndex].answer = "Yes";
      }
      alert(`Marked ${selectedClusterSize} pixels in red.`);
      checkChallenges();
    });

    // Mona Lisa
    $("#renderMonaLisa").on("click", () => {
      alert("Placeholder: Mona Lisa logic goes here.");
    });

    // Toggle Music
    $("#toggleMusic").on("click", () => {
      toggleBackgroundMusic();
      $(this).toggleClass("btn-success btn-danger");
      const icon = bgMusic.paused ? "bi-music-note" : "bi-music-note-beamed";
      $(this).html(`<i class="bi ${icon}" title="Play Music"></i>`);
    });

    // Leaderboard
    $("#leaderboardModal").on("show.bs.modal", updateLeaderboardTable);

    // Theme
    $("#themeDropdown").on("change", function () {
      const themeValue = $(this).val();
      if (themeValue && themeValue !== "Apply Theme") {
        applyTheme(themeValue);
      }
    });

    // Upload Theme
    $("#uploadThemeImage").on("click", () => {
      $("#themeImageInput").click();
    });
    $("#themeImageInput").on("change", function (e) {
      const file = e.target.files[0];
      if (file) {
        applyImageTheme(file);
      }
    });
  }

  // -------------------------------------------------
  // 20) Themes
  // -------------------------------------------------
  function applyTheme(themeType) {
    switch (themeType) {
      case "random":
        pixelData.forEach((p) => {
          p.color = getRandomColor();
        });
        break;
      case "rainbow":
        pixelData.forEach((p, i) => {
          const hue = (i * 5) % 360;
          p.color = `hsl(${hue}, 100%, 50%)`;
        });
        break;
      case "grayscale":
        pixelData.forEach((p) => {
          const shade = Math.floor(Math.random() * 256);
          const hex = shade.toString(16).padStart(2, "0");
          p.color = `#${hex}${hex}${hex}`;
        });
        break;
      case "solid": {
        const solidColor = $("#colorPicker").val() || "#ffffff";
        pixelData.forEach((p) => {
          p.color = solidColor;
        });
        break;
      }
      default:
        return;
    }
  }

  function applyImageTheme(file) {
    const img = new Image();
    img.onload = function () {
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = img.width;
      tempCanvas.height = img.height;
      const tempCtx = tempCanvas.getContext("2d");
      tempCtx.drawImage(img, 0, 0);

      let width = canvasContainer.width();
      let height = canvasContainer.height();
      if (width < 1 || height < 1) {
        console.warn("[applyImageTheme] Container dimension => fallback 800x600");
        width = 800;
        height = 600;
      }

      for (const p of pixelData) {
        const sampleX = Math.floor((p.floatX / width) * img.width);
        const sampleY = Math.floor((p.floatY / height) * img.height);
        const pixelArr = tempCtx.getImageData(sampleX, sampleY, 1, 1).data;
        const [r, g, b] = pixelArr;
        p.color = `rgb(${r},${g},${b})`;
      }
      alert("Image theme applied!");
    };
    img.onerror = function () {
      alert("Failed to load image.");
    };
    img.src = URL.createObjectURL(file);
  }

  // -------------------------------------------------
  // 21) Initialization
  // -------------------------------------------------
  function init() {
    canvasContainer = $("#canvasContainer");
    canvasElement = $("#pixelCanvas")[0];
    hoverCanvasElement = $("#hoverCanvas")[0];
    progressLabel = $("#progressLabel");
    progressPercentage = $("#progressPercentage");

    pixelModal = new bootstrap.Modal(document.getElementById("pixelModal"));

    bgMusic = new Audio("assets/bg-music.mp3");
    bgMusic.loop = true;
    bgMusic.volume = 0.5;

    // Load donation data
    loadDonationLeaderboard();

    // Build initial pixel grid
    buildPixelGridAsync(DEFAULT_PIXEL_SIZE, MAX_PIXELS);

    // Bind event listeners
    bindEvents();

    // Start main animation
    animating = true;
    lastFrameTime = performance.now();
    requestAnimationFrame(mainAnimationLoop);

    // ********** ADDED: Check if returning from selector with focusPixelID **********
    const params = new URLSearchParams(window.location.search);
    const focusPixelID = params.get("focusPixelID"); 
    if (focusPixelID) {
      // Wait a short time for buildPixelGridAsync to finish => or do check in next microtask
      // We'll do a setTimeout(..., 600) or something. 
      // For reliability, you might want to wait until isBuilding===false in a loop or so.
      const waitInterval = setInterval(() => {
        if (!isBuilding) {
          clearInterval(waitInterval);
          // Find that pixel
          const pIndex = pixelData.findIndex(px => px.id === focusPixelID);
          if (pIndex !== -1) {
            // Force it into "focused" state, scale=10 at center
            focusMode.index = pIndex;
            focusMode.state = "focused";

            let w = canvasContainer.width();
            let h = canvasContainer.height();
            if (w < 1 || h < 1) { w=800; h=600; }

            const scaleFactor = 10;
            const halfScaled = (pixelSize * scaleFactor) / 2;
            const finalX = (w / 2) - halfScaled;
            const finalY = (h / 2) - halfScaled;

            const fp = pixelData[pIndex];
            // Immediately set floatX/floatY/scale => no animation
            fp.floatX = finalX;
            fp.floatY = finalY;
            fp.scale  = scaleFactor;

            // push others
            for (let i=0; i<pixelData.length; i++) {
              if (i === pIndex) continue;
              const p = pixelData[i];
              p.scale = 1;
              if (p.floatX < w/2) {
                p.floatX = 0;
              } else {
                p.floatX = w - pixelSize;
              }
            }
            // rebuild quadtree with scaled bounding box
            rebuildQuadtree();
          }
        }
      }, 200);
    }
  }

  return { init };
})(jQuery);
