/* 
  custom.js
  COMPLETE VERSION with:
    ✓ Async chunk-based rendering
    ✓ Hover highlight (fixed offset)
    ✓ Tooltip, color adjustments, random recoloring
    ✓ Color picker for mass recoloring
    ✓ Save/Load to localStorage
    ✓ Background music toggle
    ✓ Cluster marking
    ✓ Modal for pixel selection/answers
    ✓ Cursor alignment fix (no container offset)
    ✓ 3D/immersive pixel drawing (inner highlight, shadows, bubble effect)
    ✓ Pixel Ripple/Explosion Animation on Click
    * Compatible with modern Microsoft Edge (Chromium) and Chrome
    * High-DPI rendering for crisp 3D pixels, bubble + explosion remain in sync
    * When a pixel is chosen (modal submit), draw it as a 3D black circle
*/

const PixelGridApp = (function ($) {
  'use strict';

  // -------------------------------------------------
  // Module-Level Variables / DOM Elements
  // -------------------------------------------------
  let canvasContainer,
      canvasElement,
      ctx,
      hoverCanvasElement,
      hoverCtx,
      progressLabel,
      progressPercentage,
      clickSound,
      bgMusic,
      pixelModal;

  let cols, rows, totalPixelsToLoad, pixelSize;
  let pixelData = [];
  let lastClickedPixel = null;
  let lastHoveredPixelIndex = null;
  let lastTooltipContent = '';
  let isShowingChosenPixels = false;

  // Performance caches
  const adjustColorCache = {};
  const gradientCache = {};

  // rAF (hover) variables
  let hoverAnimationFrameId = null;
  let hoverEventQueued = false;
  const hoverEventData = { event: null };

  // Config constants
  const DEFAULT_PIXEL_SIZE = 10;
  const CHUNK_SIZE = 200; 
  const LOCAL_STORAGE_KEY = 'pixelGridData';

  // Explosion state
  const explosions = [];
  let explosionAnimating = false;

  // -------------------------------------------------
  // High-DPI Canvas Helper
  // -------------------------------------------------
  function setCanvasResolution(canvas, desiredWidth, desiredHeight) {
    const dpr = window.devicePixelRatio || 1;

    canvas.width = desiredWidth * dpr;
    canvas.height = desiredHeight * dpr;

    canvas.style.width = desiredWidth + 'px';
    canvas.style.height = desiredHeight + 'px';

    const context = canvas.getContext('2d');
    context.scale(dpr, dpr);

    // Disable all forms of image smoothing
    context.imageSmoothingEnabled = false;
    context.webkitImageSmoothingEnabled = false;
    context.mozImageSmoothingEnabled = false;
    context.msImageSmoothingEnabled = false;

    return context;
  }

  // -------------------------------------------------
  // Utility Functions
  // -------------------------------------------------
  function getRandomColor() {
    return `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')}`;
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

    const adjusted = `#${((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1)}`;
    adjustColorCache[cacheKey] = adjusted;
    return adjusted;
  }

  /**
   * Avoid double scaling on HiDPI.
   */
  function getMousePosition(event, canvas) {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const scaleX = (canvas.width / dpr) / rect.width;
    const scaleY = (canvas.height / dpr) / rect.height;

    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
      clientX: event.clientX,
      clientY: event.clientY,
    };
  }

  function getPixelIndexFromCoords(x, y) {
    const col = Math.floor(x / pixelSize);
    const row = Math.floor(y / pixelSize);
    const index = row * cols + col;
    return (index >= 0 && index < pixelData.length) ? index : -1;
  }

  // -------------------------------------------------
  // Radial Gradients & Pixel Drawing
  // -------------------------------------------------
  function getRadialGradient(canvasCtx, color, size) {
    const cacheKey = `${color}-${size}`;
    if (gradientCache[cacheKey]) {
      return gradientCache[cacheKey];
    }

    const centerX = size * 0.3;
    const centerY = size * 0.3;
    const maxRadius = size * 0.8;
    const radialGradient = canvasCtx.createRadialGradient(
      centerX,
      centerY,
      size * 0.1,
      size / 2,
      size / 2,
      maxRadius
    );

    radialGradient.addColorStop(0, adjustColor(color, 1.0));
    radialGradient.addColorStop(0.4, color);
    radialGradient.addColorStop(1, adjustColor(color, -0.2));

    gradientCache[cacheKey] = radialGradient;
    return radialGradient;
  }

  function drawPixel(canvasCtx, x, y, color, size) {
    const gradient = getRadialGradient(canvasCtx, color, size);
    canvasCtx.fillStyle = gradient;
    canvasCtx.fillRect(x, y, size, size);

    // Outer stroke
    canvasCtx.strokeStyle = adjustColor(color, -0.3);
    canvasCtx.lineWidth = 1;
    canvasCtx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);

    // Inner highlight
    canvasCtx.beginPath();
    canvasCtx.moveTo(x + 1, y + 1);
    canvasCtx.lineTo(x + size - 2, y + 1);
    canvasCtx.lineTo(x + size - 2, y + size - 2);
    canvasCtx.strokeStyle = adjustColor(color, 0.9);
    canvasCtx.lineWidth = 0.75;
    canvasCtx.stroke();
    canvasCtx.closePath();

    // Bottom-right shadow
    canvasCtx.beginPath();
    canvasCtx.moveTo(x + size - 1, y + size - 1);
    canvasCtx.lineTo(x + 1, y + size - 1);
    canvasCtx.lineTo(x + 1, y + 1);
    canvasCtx.strokeStyle = adjustColor(color, -0.1);
    canvasCtx.lineWidth = 0.75;
    canvasCtx.stroke();
    canvasCtx.closePath();
  }

  function draw3DPixel(x, y, color) {
    drawPixel(ctx, x, y, color, pixelSize);
  }

  function draw3DPixelScaledCentered(canvasCtx, x, y, color, baseSize, scale) {
    const centerX = x + baseSize / 2;
    const centerY = y + baseSize / 2;
    const radius = (baseSize * scale) / 2;

    canvasCtx.beginPath();
    canvasCtx.arc(centerX, centerY, radius, 0, 2 * Math.PI);

    const gradient = canvasCtx.createRadialGradient(
      centerX, centerY,
      radius * 0.5,
      centerX, centerY,
      radius
    );
    gradient.addColorStop(0, adjustColor(color, 0.5));
    gradient.addColorStop(1, color);

    canvasCtx.fillStyle = gradient;
    canvasCtx.fill();

    // Outline stroke
    canvasCtx.strokeStyle = adjustColor(color, -0.2);
    canvasCtx.lineWidth = 2;
    canvasCtx.stroke();
  }

  /**
   * Draw a 3D black circle (same bounding box) for a "deep immersive" effect.
   * This shape replaces the standard square pixel when the user submits an answer.
   */
  function draw3DBlackCirclePixel(x, y) {
    // Clear old square
    ctx.clearRect(x, y, pixelSize, pixelSize);

    // We'll draw a circle with the same bounding region
    const centerX = x + pixelSize / 2;
    const centerY = y + pixelSize / 2;
    const radius = pixelSize / 2;

    // A radial gradient from a slightly lighter black center to darker edge
    const gradient = ctx.createRadialGradient(
      centerX, centerY,
      radius * 0.3,     // smaller inner radius
      centerX, centerY,
      radius
    );
    gradient.addColorStop(0, '#222222');  // lighter black center
    gradient.addColorStop(1, '#000000');  // deeper black edge

    // Fill the circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.fillStyle = gradient;
    ctx.fill();

    // 3D stroke highlight
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#333333';  // a slightly lighter black stroke
    ctx.stroke();

    // Optional subtle highlight line
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.9, -Math.PI / 4, 0, false);
    ctx.strokeStyle = '#555555';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.closePath();
  }

  // -------------------------------------------------
  // Build Grid (Async in Chunks)
  // -------------------------------------------------
  function buildPixelGridAsync(newPixelSize, totalPixels = 50000) {
    pixelSize = newPixelSize;
    cols = Math.floor(canvasContainer.width() / pixelSize);
    rows = Math.ceil(totalPixels / cols);
    totalPixelsToLoad = cols * rows;

    ctx = setCanvasResolution(canvasElement, cols * pixelSize, rows * pixelSize);
    hoverCtx = setCanvasResolution(hoverCanvasElement, cols * pixelSize, rows * pixelSize);

    ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    hoverCtx.clearRect(0, 0, hoverCanvasElement.width, hoverCanvasElement.height);

    progressLabel.show();
    progressPercentage.text('0%');

    pixelData = [];

    let pixelsLoaded = 0;
    let currentRow = 0;

    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = cols * pixelSize;
    offscreenCanvas.height = rows * pixelSize;
    const offscreenCtx = offscreenCanvas.getContext('2d');
    offscreenCtx.imageSmoothingEnabled = false;

    function renderChunk() {
      let rowsRendered = 0;
      while (currentRow < rows && rowsRendered < CHUNK_SIZE) {
        for (let col = 0; col < cols; col++) {
          const x = col * pixelSize;
          const y = currentRow * pixelSize;
          const randomColor = getRandomColor();

          pixelData.push({
            x,
            y,
            color: randomColor,
            id: `pixel-${currentRow}-${col}`,
            answer: null,
          });

          drawPixel(offscreenCtx, x, y, randomColor, pixelSize);
        }
        currentRow++;
        rowsRendered++;
        pixelsLoaded += cols;
      }

      ctx.drawImage(offscreenCanvas, 0, 0);

      const progress = Math.floor((pixelsLoaded / totalPixelsToLoad) * 100);
      progressPercentage.text(`${progress}%`);

      if (currentRow < rows) {
        requestAnimationFrame(renderChunk);
      } else {
        progressLabel.hide();
      }
    }
    renderChunk();
  }

  // -------------------------------------------------
  // Explosion (Ripple) Animation
  // -------------------------------------------------
  function startExplosion(centerX, centerY) {
    explosions.push({
      centerX,
      centerY,
      startTime: performance.now(),
      duration: 600,
      maxRadius: 150,
    });

    if (!explosionAnimating) {
      explosionAnimating = true;
      requestAnimationFrame(animateExplosions);
    }
  }

  function animateExplosions() {
    if (explosions.length === 0) {
      explosionAnimating = false;
      return;
    }

    hoverCtx.clearRect(0, 0, hoverCanvasElement.width, hoverCanvasElement.height);

    const now = performance.now();
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

    requestAnimationFrame(animateExplosions);
  }

  function drawExplosionRing(cx, cy, radius) {
    hoverCtx.save();
    hoverCtx.beginPath();
    hoverCtx.arc(cx, cy, radius, 0, 2 * Math.PI);
    hoverCtx.lineWidth = 4;
    hoverCtx.strokeStyle = 'rgba(255, 255, 0, 0.7)';
    hoverCtx.stroke();
    hoverCtx.restore();
  }

  // -------------------------------------------------
  // Hover & Tooltip (Cursor Sync)
  // -------------------------------------------------
  function handleHover(event) {
    if (!event) return;

    const { x: hoverX, y: hoverY, clientX, clientY } = getMousePosition(event, canvasElement);
    const pixelIndex = getPixelIndexFromCoords(hoverX, hoverY);

    if (lastHoveredPixelIndex !== pixelIndex) {
      hoverCtx.clearRect(0, 0, hoverCanvasElement.width, hoverCanvasElement.height);
      lastHoveredPixelIndex = null;
    }

    if (pixelIndex !== -1) {
      const hoveredPixel = pixelData[pixelIndex];
      if (!isShowingChosenPixels || hoveredPixel.answer !== null) {
        lastHoveredPixelIndex = pixelIndex;

        draw3DPixelScaledCentered(
          hoverCtx,
          hoveredPixel.x,
          hoveredPixel.y,
          hoveredPixel.color,
          pixelSize,
          2
        );

        const answerText = hoveredPixel.answer
          ? `Answer: ${hoveredPixel.answer}`
          : 'No answer selected';
        const tooltipText = `ID: ${hoveredPixel.id} | ${answerText}`;
        showTooltip(clientX, clientY, tooltipText);
      } else {
        hideTooltip();
      }
    } else {
      hideTooltip();
    }
  }

  function scheduleHoverEvent(event) {
    hoverEventData.event = event;
    if (!hoverEventQueued) {
      hoverEventQueued = true;
      hoverAnimationFrameId = requestAnimationFrame(() => {
        handleHover(hoverEventData.event);
        hoverEventQueued = false;
      });
    }
  }

  function showTooltip(x, y, text) {
    if (lastTooltipContent !== text) {
      const tooltip = $('#pixelTooltip');
      tooltip.text(text);
      tooltip.css({
        top: `${y + 10}px`,
        left: `${x + 10}px`,
        display: 'block',
      });
      tooltip.attr({
        'aria-hidden': 'false',
        'aria-label': text,
      });
      lastTooltipContent = text;
    }
  }

  function hideTooltip() {
    const tooltip = $('#pixelTooltip');
    tooltip.hide();
    tooltip.attr('aria-hidden', 'true');
    lastTooltipContent = '';
  }

  // -------------------------------------------------
  // Save/Load (localStorage)
  // -------------------------------------------------
  function saveGridToLocalStorage() {
    try {
      const dataToSave = {
        pixelSize,
        cols,
        rows,
        pixelData,
      };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(dataToSave));
      alert('Grid state saved successfully!');
    } catch (error) {
      console.error('Error saving grid to localStorage:', error);
      alert('Failed to save grid.');
    }
  }

  function loadGridFromLocalStorage() {
    try {
      const storedData = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!storedData) {
        alert('No saved grid found.');
        return;
      }
      const { pixelSize: storedSize, cols: storedCols, rows: storedRows, pixelData: storedPixels } =
        JSON.parse(storedData);

      pixelSize = storedSize;
      cols = storedCols;
      rows = storedRows;
      pixelData = storedPixels;

      ctx = setCanvasResolution(canvasElement, cols * pixelSize, rows * pixelSize);
      hoverCtx = setCanvasResolution(hoverCanvasElement, cols * pixelSize, rows * pixelSize);

      ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
      hoverCtx.clearRect(0, 0, hoverCanvasElement.width, hoverCanvasElement.height);

      pixelData.forEach((p) => draw3DPixel(p.x, p.y, p.color));
      alert('Grid state loaded successfully!');
    } catch (error) {
      console.error('Error loading grid from localStorage:', error);
      alert('Failed to load grid.');
    }
  }

  // -------------------------------------------------
  // Background Music Toggle
  // -------------------------------------------------
  function toggleBackgroundMusic() {
    if (!bgMusic) return;
    if (bgMusic.paused) {
      bgMusic
        .play()
        .then(() => console.log('Music is playing.'))
        .catch((err) => console.error('Failed to play music (autoplay policy):', err));
    } else {
      bgMusic.pause();
    }
  }

  // -------------------------------------------------
  // **New** Function: Draw a black circle for the chosen pixel
  // -------------------------------------------------
  function draw3DBlackCirclePixel(x, y) {
    // Clear out the old square area
    ctx.clearRect(x, y, pixelSize, pixelSize);

    const centerX = x + pixelSize / 2;
    const centerY = y + pixelSize / 2;
    const radius = pixelSize / 2;

    // Radial gradient from dark gray center to black edge
    const gradient = ctx.createRadialGradient(
      centerX, centerY,
      radius * 0.3,
      centerX, centerY,
      radius
    );
    gradient.addColorStop(0, '#444444');  // lighter center
    gradient.addColorStop(1, '#000000');  // black edge

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.fillStyle = gradient;
    ctx.fill();

    // Subtle 3D outline
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#222222';
    ctx.stroke();
  }

  // -------------------------------------------------
  // Event Binding
  // -------------------------------------------------
  function bindEvents() {
    canvasElement.addEventListener('mousemove', scheduleHoverEvent);

    $('#canvasContainer').on('mouseleave', () => {
      hoverCtx.clearRect(0, 0, hoverCanvasElement.width, hoverCanvasElement.height);
      hideTooltip();
      lastHoveredPixelIndex = null;
    });

    // Click => open modal if pixel not answered, also triggers explosion
    canvasElement.addEventListener('click', (e) => {
      const { x: clickX, y: clickY } = getMousePosition(e, canvasElement);
      const pixelIndex = getPixelIndexFromCoords(clickX, clickY);

      startExplosion(clickX, clickY);

      if (pixelIndex !== -1 && pixelData[pixelIndex].answer === null) {
        lastClickedPixel = pixelData[pixelIndex];
        $('#pixel-id-clicked').text(lastClickedPixel.id);
        pixelModal.show();

        clickSound.play().catch((error) => console.error('Sound file playback error:', error));
      }
    });

    $('#resetGrid').on('click', () => {
      buildPixelGridAsync(pixelSize);
      isShowingChosenPixels = false;
    });

    $('#zoom-level').on('change', function () {
      const selectedSize = parseInt($(this).val(), 10);
      if (!isNaN(selectedSize)) {
        buildPixelGridAsync(selectedSize);
      }
    });

    $('#recolorPixels').on('click', () => {
      pixelData.forEach((pixel) => {
        pixel.color = getRandomColor();
      });
      ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
      pixelData.forEach((p) => draw3DPixel(p.x, p.y, p.color));
    });

    $('#colorPicker').on('change', function () {
      const chosenColor = $(this).val();
      pixelData.forEach((pixel) => {
        pixel.color = chosenColor;
      });
      ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
      pixelData.forEach((p) => draw3DPixel(p.x, p.y, p.color));
    });

    $('#showChosenPixels').on('click', function () {
      if (isShowingChosenPixels) {
        ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        pixelData.forEach((pixel) => draw3DPixel(pixel.x, pixel.y, pixel.color));
        isShowingChosenPixels = false;
        $(this).text('Show Chosen Pixels');
      } else {
        const chosenPixels = pixelData.filter((pixel) => pixel.answer !== null);
        if (chosenPixels.length === 0) {
          alert('No pixels have been selected yet!');
          return;
        }
        ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        chosenPixels.forEach((pixel) => {
          // If it’s black circle or normal 3D
          if (pixel.color === '#ff0000') {
            // If user changed color to red earlier, you can decide how to re-draw
            // For now, just do normal 3D
            draw3DPixel(pixel.x, pixel.y, pixel.color);
          } else {
            draw3DPixel(pixel.x, pixel.y, pixel.color);
          }
        });
        isShowingChosenPixels = true;
        $(this).text('Show All Pixels');
      }
      $(this).toggleClass('animate-scale');
      setTimeout(() => $(this).toggleClass('animate-scale'), 300);
    });

    // Modal submission => black circle (immersion)
    $('#submitAnswer').on('click', () => {
      const chosenAnswer = $('input[name="answer"]:checked').val();
      if (chosenAnswer) {
        if (lastClickedPixel) {
          // Mark chosen pixel => black circle
          lastClickedPixel.color = '#000000'; 
          lastClickedPixel.answer = chosenAnswer;

          // Draw the black circle in the bounding box
          draw3DBlackCirclePixel(lastClickedPixel.x, lastClickedPixel.y);
        }
        pixelModal.hide();
      } else {
        alert('Please select an answer before submitting.');
      }
    });

    $('#clusterSizeDropdown').on('change', function () {
      const selectedClusterSize = parseInt($(this).val(), 10);
      if (isNaN(selectedClusterSize)) {
        alert('Please select a valid cluster size.');
        return;
      }
      const clusterDimension = Math.sqrt(selectedClusterSize);
      if (!Number.isInteger(clusterDimension)) {
        alert('Cluster size must be a perfect square.');
        return;
      }

      const maxStartCol = Math.max(0, cols - clusterDimension);
      const maxStartRow = Math.max(0, rows - clusterDimension);

      const startCol = Math.floor(Math.random() * (maxStartCol + 1));
      const startRow = Math.floor(Math.random() * (maxStartRow + 1));

      for (let r = 0; r < clusterDimension; r++) {
        for (let c = 0; c < clusterDimension; c++) {
          const pixelIndex = (startRow + r) * cols + (startCol + c);
          if (pixelIndex >= 0 && pixelIndex < pixelData.length) {
            pixelData[pixelIndex].color = '#ff0000';
            pixelData[pixelIndex].answer = 'Yes';
            draw3DPixel(pixelData[pixelIndex].x, pixelData[pixelIndex].y, '#ff0000');
          }
        }
      }
      alert(`A ${clusterDimension}x${clusterDimension} block has been marked in red.`);
    });

    $('#saveGrid').on('click', saveGridToLocalStorage);
    $('#loadGrid').on('click', loadGridFromLocalStorage);

    $('#toggleMusic').on('click', () => {
      toggleBackgroundMusic();
      $(this).toggleClass('btn-success btn-danger');
      const btnText = bgMusic.paused ? 'Play Music' : 'Pause Music';
      $(this).text(btnText);
    });
  }

  // -------------------------------------------------
  // Initialization
  // -------------------------------------------------
  function init() {
    canvasContainer = $('#canvasContainer');
    canvasElement = $('#pixelCanvas')[0];
    hoverCanvasElement = $('#hoverCanvas')[0];

    progressLabel = $('#progressLabel');
    progressPercentage = $('#progressPercentage');
    clickSound = new Audio('js/click-sound.mp3');

    pixelModal = new bootstrap.Modal(document.getElementById('pixelModal'));

    bgMusic = new Audio('assets/bg-music.mp3');
    bgMusic.loop = true;
    bgMusic.volume = 0.5;
    bgMusic.addEventListener('error', () => {
      console.error('Error loading background music (assets/bg-music.mp3).');
    });

    // Build initial grid
    buildPixelGridAsync(DEFAULT_PIXEL_SIZE);

    // Bind events
    bindEvents();
  }

  // Public API
  return { init };
})(jQuery);

// Initialize after DOM is ready
$(document).ready(() => PixelGridApp.init());
