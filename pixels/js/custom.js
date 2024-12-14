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

    function buildPixelGridAsync(newPixelSize, totalPixels = 100000) {
        pixelSize = newPixelSize;

        // Calculate columns and rows
        cols = Math.floor(canvasContainer.width() / pixelSize);
        rows = Math.ceil(totalPixels / cols);
        totalPixelsToLoad = cols * rows;

        // Set canvas size
        canvasElement.width = cols * pixelSize;
        canvasElement.height = rows * pixelSize;

        // Clear previous drawings
        ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);

        // Show progress label
        progressLabel.show();
        progressPercentage.text(`0%`);

        pixelData = [];

        let pixelsLoaded = 0;
        let currentRow = 0;

        function renderChunk() {
            const CHUNK_SIZE = 10; // Number of rows to render per chunk
            let rowsRendered = 0;

            while (currentRow < rows && rowsRendered < CHUNK_SIZE) {
                for (let col = 0; col < cols; col++) {
                    const x = col * pixelSize;
                    const y = currentRow * pixelSize;

                    // Generate a random color for this pixel
                    const randomColorInt = Math.floor(Math.random() * 16777215);
                    const randomColorHex = '#' + ('000000' + randomColorInt.toString(16)).slice(-6);

                    ctx.fillStyle = randomColorHex;
                    ctx.fillRect(x, y, pixelSize, pixelSize);

                    // Store pixel data so we can reference it later
                    const pixelID = `pixel-${currentRow}-${col}`;
                    pixelData.push({ x, y, color: randomColorHex, id: pixelID });

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
                // Rendering complete
                progressLabel.hide();
            }
        }

        // Start rendering
        renderChunk();
    }

    // Function to recolor all pixels randomly
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

    // Detect pixel clicks
    canvasElement.addEventListener('click', function (e) {
        const rect = canvasElement.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        // Determine which pixel was clicked
        const col = Math.floor(clickX / pixelSize);
        const row = Math.floor(clickY / pixelSize);
        const pixelIndex = row * cols + col;

        // Check bounds
        if (pixelIndex >= 0 && pixelIndex < pixelData.length) {
            const clickedPixel = pixelData[pixelIndex];
            // Set the pixel ID in the modal
            $('#pixel-id-clicked').text(clickedPixel.id);

            // Show the modal
            pixelModal.show();
        }
    });

    // Add event listener for the submit button in the modal
    $('#submitAnswer').on('click', function () {
        const chosenAnswer = $('input[name="answer"]:checked').val();
        if (chosenAnswer) {
            console.log("Selected answer:", chosenAnswer);
            // Optionally close the modal
            pixelModal.hide();
        } else {
            alert("Please select an answer before submitting.");
        }
    });
});
