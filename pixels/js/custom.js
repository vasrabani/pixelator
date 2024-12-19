$(document).ready(function () {
    const canvasContainer = $('#canvasContainer');
    const canvasElement = $('#pixelCanvas')[0];
    const ctx = canvasElement.getContext('2d');
    const progressLabel = $('#progressLabel');
    const progressPercentage = $('#progressPercentage');

    const clickSound = new Audio('js/click-sound.mp3'); // Path to the click sound file.

    const pixelModal = new bootstrap.Modal(document.getElementById('pixelModal'));

    let cols, rows, totalPixelsToLoad, pixelSize;
    let pixelData = [];
    let lastClickedPixel = null;
    let lastHoveredPixelIndex = null;
    let lastTooltipContent = '';

    // Utility function: Generate random color
    function getRandomColor() {
        return `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`;
    }

    // Utility function: Adjust color brightness
    function adjustColor(color, percent) {
        const num = parseInt(color.slice(1), 16);
        const amt = Math.round(2.55 * percent * 100);
        const R = Math.min(255, Math.max(0, (num >> 16) + amt));
        const G = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amt));
        const B = Math.min(255, Math.max(0, (num & 0x0000FF) + amt));
        return `#${((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1)}`;
    }

    // Utility function: Draw a 3D pixel
    function draw3DPixel(x, y, color) {
        ctx.fillStyle = adjustColor(color, -0.2);
        ctx.fillRect(x + 2, y + 2, pixelSize - 4, pixelSize - 4);

        const gradient = ctx.createLinearGradient(x, y, x + pixelSize, y + pixelSize);
        gradient.addColorStop(0, adjustColor(color, 0.3));
        gradient.addColorStop(1, color);

        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, pixelSize, pixelSize);

        ctx.fillStyle = adjustColor(color, 0.5);
        ctx.fillRect(x + 1, y + 1, pixelSize - 2, pixelSize - 2);
    }

    // Function: Build pixel grid asynchronously
    function buildPixelGridAsync(newPixelSize, totalPixels = 50000) {
        pixelSize = newPixelSize;
    
        cols = Math.floor(canvasContainer.width() / pixelSize);
        rows = Math.ceil(totalPixels / cols);
        totalPixelsToLoad = cols * rows;
    
        canvasElement.width = cols * pixelSize;
        canvasElement.height = rows * pixelSize;
    
        ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        progressLabel.show();
        progressPercentage.text('0%');
    
        pixelData = [];
    
        let pixelsLoaded = 0;
        let currentRow = 0;
    
        // Use an offscreen canvas for batch rendering
        const offscreenCanvas = document.createElement('canvas');
        offscreenCanvas.width = canvasElement.width;
        offscreenCanvas.height = canvasElement.height;
        const offscreenCtx = offscreenCanvas.getContext('2d');
    
        function renderChunk() {
            const CHUNK_SIZE = 100; // Larger chunks for faster rendering
            let rowsRendered = 0;
    
            while (currentRow < rows && rowsRendered < CHUNK_SIZE) {
                for (let col = 0; col < cols; col++) {
                    const x = col * pixelSize;
                    const y = currentRow * pixelSize;
                    const randomColor = getRandomColor();
    
                    // Store pixel data
                    const pixelID = `pixel-${currentRow}-${col}`;
                    pixelData.push({
                        x,
                        y,
                        color: randomColor,
                        id: pixelID,
                        answer: null,
                    });
    
                    // Draw directly on the offscreen canvas
                    draw3DPixelToCanvas(offscreenCtx, x, y, randomColor);
                }
                currentRow++;
                rowsRendered++;
                pixelsLoaded += cols;
            }
    
            // Copy the offscreen canvas to the main canvas
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
    
    // Function: Draw a 3D styled pixel on a given canvas context
    function draw3DPixelToCanvas(canvasCtx, x, y, color) {
        // Darker outer border
        canvasCtx.fillStyle = adjustColor(color, -0.2);
        canvasCtx.fillRect(x + 2, y + 2, pixelSize - 4, pixelSize - 4);
    
        // Gradient fill for 3D effect
        const gradient = canvasCtx.createLinearGradient(x, y, x + pixelSize, y + pixelSize);
        gradient.addColorStop(0, adjustColor(color, 0.3));
        gradient.addColorStop(1, color);
    
        canvasCtx.fillStyle = gradient;
        canvasCtx.fillRect(x, y, pixelSize, pixelSize);
    
        // Highlight for a 3D effect
        canvasCtx.fillStyle = adjustColor(color, 0.5);
        canvasCtx.fillRect(x + 1, y + 1, pixelSize - 2, pixelSize - 2);
    }
    
    // Function: Highlight pixel on hover
    function highlightPixel(pixelIndex) {
        if (lastHoveredPixelIndex !== null && lastHoveredPixelIndex !== pixelIndex) {
            restorePixelColor(lastHoveredPixelIndex);
        }

        if (pixelIndex >= 0 && pixelIndex < pixelData.length) {
            lastHoveredPixelIndex = pixelIndex;
            const p = pixelData[pixelIndex];

            ctx.fillStyle = adjustColor(p.color, 0.2);
            ctx.fillRect(p.x, p.y, pixelSize, pixelSize);
        }
    }

    // Function: Restore pixel color
    function restorePixelColor(pixelIndex) {
        const p = pixelData[pixelIndex];
        draw3DPixel(p.x, p.y, p.color);
    }

    // Function: Remove highlight
    function removeHighlight() {
        if (lastHoveredPixelIndex !== null) {
            restorePixelColor(lastHoveredPixelIndex);
            lastHoveredPixelIndex = null;
        }
    }

    // Tooltip Functions
    function showTooltip(x, y, text) {
        if (lastTooltipContent !== text) {
            const tooltip = $('#pixelTooltip');
            tooltip.text(text);
            tooltip.css({
                top: y + 10 + 'px',
                left: x + 10 + 'px',
                display: 'block',
            });
            lastTooltipContent = text;
        }
    }

    function hideTooltip() {
        const tooltip = $('#pixelTooltip');
        tooltip.hide();
        lastTooltipContent = '';
    }

    // Event Listeners

    // Handle mousemove over canvas
    let isShowingChosenPixels = false; // Global flag to track mode

    // Updated mousemove event listener
    canvasElement.addEventListener('mousemove', function (e) {
        const rect = canvasElement.getBoundingClientRect();
        const hoverX = e.clientX - rect.left;
        const hoverY = e.clientY - rect.top;
    
        const col = Math.floor(hoverX / pixelSize);
        const row = Math.floor(hoverY / pixelSize);
        const pixelIndex = row * cols + col;
    
        if (pixelIndex >= 0 && pixelIndex < pixelData.length) {
            const hoveredPixel = pixelData[pixelIndex];
    
            // Highlight only valid pixels based on mode
            if (!isShowingChosenPixels || (hoveredPixel && hoveredPixel.answer !== null)) {
                highlightPixel(pixelIndex);
    
                // Display tooltip information
                const answerText = hoveredPixel.answer ? `Answer: ${hoveredPixel.answer}` : 'No answer selected';
                const tooltipText = `X: ${col}, Y: ${row} | ${answerText}`;
                showTooltip(e.clientX, e.clientY, tooltipText);
            } else {
                removeHighlight();
                hideTooltip();
            }
        } else {
            removeHighlight();
            hideTooltip();
        }
    });
    
    // Reset to full grid mode
    $('#resetGrid').on('click', function () {
        buildPixelGridAsync(pixelSize); // Rebuild the full grid
        isShowingChosenPixels = false; // Reset mode
    });
    
    // Switch to "Show Chosen Pixels" mode
 

 
    

    // Handle mouse leaving canvas
    $('#canvasContainer').on('mouseleave', function () {
        removeHighlight();
        hideTooltip();
    });

    // Handle zoom level change
    $('#zoom-level').on('change', function () {
        const selectedSize = parseInt($(this).val());
        if (!isNaN(selectedSize)) {
            buildPixelGridAsync(selectedSize);
        }
    });

    // Recolor all pixels
    $('#recolorPixels').on('click', function () {
        pixelData.forEach(pixel => {
            const newColor = getRandomColor();
            if (pixel.color !== newColor) {
                pixel.color = newColor;
                draw3DPixel(pixel.x, pixel.y, newColor);
            }
        });
    });

    $('#showChosenPixels').on('click', function () {
        if (isShowingChosenPixels) {
            // Toggle back to the full grid
            ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
            
            // Re-render all pixels from pixelData
            pixelData.forEach(pixel => {
                draw3DPixel(pixel.x, pixel.y, pixel.color);
            });
    
            isShowingChosenPixels = false;
            $(this).text('Show Chosen Pixels'); // Update button text
        } else {
            // Filter and display only chosen pixels
            const chosenPixels = pixelData.filter(pixel => pixel.answer !== null);
    
            if (chosenPixels.length === 0) {
                alert("No pixels have been selected yet!");
                return;
            }
    
            ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
            chosenPixels.forEach(pixel => {
                draw3DPixel(pixel.x, pixel.y, pixel.color);
            });
    
            isShowingChosenPixels = true;
            $(this).text('Show All Pixels'); // Update button text
        }
    });
    

    // Handle pixel click
    canvasElement.addEventListener('click', function (e) {
        const rect = canvasElement.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        const col = Math.floor(clickX / pixelSize);
        const row = Math.floor(clickY / pixelSize);
        const pixelIndex = row * cols + col;

        if (pixelIndex >= 0 && pixelIndex < pixelData.length && pixelData[pixelIndex].answer === null) {
            const clickedPixel = pixelData[pixelIndex];
            $('#pixel-id-clicked').text(clickedPixel.id);
            lastClickedPixel = clickedPixel;
            pixelModal.show();
            clickSound.play().catch(() => console.warn('Sound file could not be played.'));
        }
    });

    // Submit answer for clicked pixel
    $('#submitAnswer').on('click', function () {
        const chosenAnswer = $('input[name="answer"]:checked').val();
        if (chosenAnswer) {
            if (lastClickedPixel) {
                lastClickedPixel.color = '#ff0000';
                lastClickedPixel.answer = chosenAnswer;
                draw3DPixel(lastClickedPixel.x, lastClickedPixel.y, '#ff0000');
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
    
        // Calculate the cluster dimensions (e.g., 20x20 for 400)
        const clusterDimension = Math.sqrt(selectedClusterSize);
    
        if (!Number.isInteger(clusterDimension)) { // Ensure clusterDimension is an integer
            alert('Cluster size must be a perfect square.');
            return;
        }
    
        console.log(`Cluster Dimension: ${clusterDimension}x${clusterDimension}`);
    
        // Randomly select a starting position for the cluster
        const startCol = Math.floor(Math.random() * (cols - clusterDimension));
        const startRow = Math.floor(Math.random() * (rows - clusterDimension));
    
        // Loop through the cluster and mark pixels as red
        for (let row = 0; row < clusterDimension; row++) {
            for (let col = 0; col < clusterDimension; col++) {
                const pixelIndex = (startRow + row) * cols + (startCol + col);
    
                if (pixelIndex >= 0 && pixelIndex < pixelData.length) {
                    const selectedPixel = pixelData[pixelIndex];
    
                    // Mark the pixel as red and set answer to "Yes"
                    selectedPixel.color = '#ff0000';
                    selectedPixel.answer = 'Yes';
    
                    // Draw the updated pixel
                    draw3DPixel(selectedPixel.x, selectedPixel.y, selectedPixel.color);
                }
            }
        }
    
        alert(`A ${clusterDimension}x${clusterDimension} square block has been marked as red.`);
    });
    
    // Initialize the pixel grid
    buildPixelGridAsync(10);
});
