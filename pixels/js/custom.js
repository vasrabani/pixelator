$(document).ready(function () {
    const canvasContainer = $('#canvasContainer');
    const canvasElement = $('#pixelCanvas')[0];
    const ctx = canvasElement.getContext('2d');
    const progressLabel = $('#progressLabel');
    const progressPercentage = $('#progressPercentage');

    // Initialize the Bootstrap modal instance
    const pixelModal = new bootstrap.Modal(document.getElementById('pixelModal'));

    let cols, rows, totalPixelsToLoad, pixelSize;
    let pixelData = [];
    let lastClickedPixel = null;
    let lastHoveredPixelIndex = null;  // Track the currently highlighted pixel

    function buildPixelGridAsync(newPixelSize, totalPixels = 100000) {
        pixelSize = newPixelSize;

        // Calculate columns and rows
        cols = Math.floor(canvasContainer.width() / pixelSize);
        rows = Math.ceil(totalPixels / cols);
        totalPixelsToLoad = cols * rows;

        // Set canvas dimensions
        canvasElement.width = cols * pixelSize;
        canvasElement.height = rows * pixelSize;

        // Clear previous drawings
        ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);

        // Show progress label
        progressLabel.show();
        progressPercentage.text('0%');

        pixelData = [];

        let pixelsLoaded = 0;
        let currentRow = 0;

        function renderChunk() {
            const CHUNK_SIZE = 10; // rows per chunk
            let rowsRendered = 0;

            while (currentRow < rows && rowsRendered < CHUNK_SIZE) {
                for (let col = 0; col < cols; col++) {
                    const x = col * pixelSize;
                    const y = currentRow * pixelSize;

                    // Random color
                    const randomColorInt = Math.floor(Math.random() * 16777215);
                    const randomColorHex = '#' + ('000000' + randomColorInt.toString(16)).slice(-6);

                    ctx.fillStyle = randomColorHex;
                    ctx.fillRect(x, y, pixelSize, pixelSize);

                    const pixelID = `pixel-${currentRow}-${col}`;
                    pixelData.push({
                        x,
                        y,
                        color: randomColorHex,
                        id: pixelID,
                        answer: null
                    });

                    pixelsLoaded++;
                }

                currentRow++;
                rowsRendered++;
            }

            // Update progress
            const progress = Math.floor((pixelsLoaded / totalPixelsToLoad) * 100);
            progressPercentage.text(`${progress}%`);

            if (currentRow < rows) {
                requestAnimationFrame(renderChunk);
            } else {
                // Completed rendering
                progressLabel.hide();
            }
        }

        // Start rendering the grid
        renderChunk();
    }

    // Recolor all pixels randomly
    function colorPixelsRandomly() {
        for (let i = 0; i < pixelData.length; i++) {
            const { x, y } = pixelData[i];
            const randomColorInt = Math.floor(Math.random() * 16777215);
            const randomColorHex = '#' + ('000000' + randomColorInt.toString(16)).slice(-6);

            pixelData[i].color = randomColorHex;
            ctx.fillStyle = randomColorHex;
            ctx.fillRect(x, y, pixelSize, pixelSize);
        }
    }

    // Initialize with a default pixel size
    buildPixelGridAsync(10);

    // Zoom-level change handler
    $('#zoom-level').on('change', function () {
        const selectedSize = parseInt($(this).val());
        if (!isNaN(selectedSize)) {
            buildPixelGridAsync(selectedSize);
        }
    });

    // Recolor pixels on button click
    $('#recolorPixels').on('click', colorPixelsRandomly);

    // When a pixel is clicked, show the modal
    canvasElement.addEventListener('click', function (e) {
        const rect = canvasElement.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        const col = Math.floor(clickX / pixelSize);
        const row = Math.floor(clickY / pixelSize);
        const pixelIndex = row * cols + col;

        if (pixelIndex >= 0 && pixelIndex < pixelData.length) {
            const clickedPixel = pixelData[pixelIndex];
            $('#pixel-id-clicked').text(clickedPixel.id);
            lastClickedPixel = clickedPixel;
            pixelModal.show();
        }
    });

    // On submit, set chosen answer and turn pixel red
    $('#submitAnswer').on('click', function () {
        const chosenAnswer = $('input[name="answer"]:checked').val();
        if (chosenAnswer) {
            console.log("Selected answer:", chosenAnswer);

            if (lastClickedPixel) {
                console.log("Clicked Pixel Coordinates: x =", lastClickedPixel.x, ", y =", lastClickedPixel.y);
                alert(`The clicked pixel's coordinates are x: ${lastClickedPixel.x}, y: ${lastClickedPixel.y}`);

                lastClickedPixel.color = '#ff0000';
                lastClickedPixel.answer = chosenAnswer;
                ctx.fillStyle = '#ff0000';
                ctx.fillRect(lastClickedPixel.x, lastClickedPixel.y, pixelSize, pixelSize);
            }

            pixelModal.hide();
        } else {
            alert("Please select an answer before submitting.");
        }
    });

    // Highlight a pixel by index
    function highlightPixel(pixelIndex) {
        // If we're moving to a new pixel, restore the previous one first
        if (lastHoveredPixelIndex !== null && lastHoveredPixelIndex !== pixelIndex) {
            restorePixelColor(lastHoveredPixelIndex);
        }

        if (pixelIndex >= 0 && pixelIndex < pixelData.length) {
            lastHoveredPixelIndex = pixelIndex;
            const p = pixelData[pixelIndex];

            // Redraw the pixel in its original color
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, pixelSize, pixelSize);

            // Draw a border fully inside the pixel
            ctx.beginPath();
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2;
            ctx.strokeRect(p.x + 0.5, p.y + 0.5, pixelSize - 1, pixelSize - 1);
            ctx.closePath();
        }
    }

    function removeHighlight() {
        if (lastHoveredPixelIndex !== null) {
            restorePixelColor(lastHoveredPixelIndex);
            lastHoveredPixelIndex = null;
        }
    }

    function restorePixelColor(pixelIndex) {
        const p = pixelData[pixelIndex];
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, pixelSize, pixelSize);
    }

    // On mouse move, highlight hovered pixel or remove highlight if none
    canvasElement.addEventListener('mousemove', function (e) {
        const rect = canvasElement.getBoundingClientRect();
        const hoverX = e.clientX - rect.left;
        const hoverY = e.clientY - rect.top;

        const col = Math.floor(hoverX / pixelSize);
        const row = Math.floor(hoverY / pixelSize);
        const pixelIndex = row * cols + col;

        if (pixelIndex >= 0 && pixelIndex < pixelData.length) {
            // Hovering over a valid pixel: highlight it
            highlightPixel(pixelIndex);
        } else {
            // Not hovering over any pixel: remove highlight
            removeHighlight();
        }
    });

    // When mouse leaves the container, remove highlight
    $('#canvasContainer').on('mouseleave', function() {
        removeHighlight();
    });

    // **New Code Here:**
    // When the "Show Chosen Pixels" button is clicked, display all submitted pixels
    $('#showChosenPixels').on('click', function() {
        // Filter to get only chosen pixels
        const chosenPixels = pixelData.filter(pixel => pixel.answer !== null);
        
        // Clear the canvas
        ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
        // Redraw only the chosen pixels
        for (let p of chosenPixels) {
            ctx.fillStyle = p.color; // This should be red (or whatever color chosen)
            ctx.fillRect(p.x, p.y, pixelSize, pixelSize);
        }
    
        if (chosenPixels.length === 0) {
            alert("No pixels have been chosen from the modal form yet.");
        }
    });    
});
