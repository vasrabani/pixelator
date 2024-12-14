$(document).ready(function () {
  const canvasContainer = $('#canvasContainer');
  const canvas = $('#pixelCanvas');
  const progressLabel = $('#progressLabel');
  const progressPercentage = $('#progressPercentage');

  // Function to build the grid asynchronously
  function buildPixelGridAsync(pixelSize, totalPixels = 100000) {
      const cols = Math.floor(canvasContainer.width() / pixelSize); // Total columns in view
      const rows = Math.ceil(totalPixels / cols); // Total rows

      // Set canvas size for scrolling
      canvas.attr('width', cols * pixelSize);
      canvas.attr('height', rows * pixelSize);

      // Show progress label
      progressLabel.show();
      progressPercentage.text(`0%`);

      canvas.empty(); // Clear previous pixels

      const fragment = document.createDocumentFragment();
      let pixelsLoaded = 0;
      const totalPixelsToLoad = cols * rows;

      let currentRow = 0;

      // Function to render the grid in chunks
      function renderChunk() {
          const CHUNK_SIZE = 10; // Number of rows to render in each chunk
          let rowsRendered = 0;

          while (currentRow < rows && rowsRendered < CHUNK_SIZE) {
              for (let col = 0; col < cols; col++) {
                  const pixelID = `pixel-${currentRow}-${col}`;
                  const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                  rect.setAttribute("x", col * pixelSize);
                  rect.setAttribute("y", currentRow * pixelSize);
                  rect.setAttribute("width", pixelSize);
                  rect.setAttribute("height", pixelSize);
                  rect.setAttribute("id", pixelID);
                  rect.setAttribute("class", "fund-pixel");
                  rect.setAttribute("fill", "#ccc"); // Default fill color
                  rect.style.cursor = "pointer";

                  fragment.appendChild(rect);
                  pixelsLoaded++;
              }

              currentRow++;
              rowsRendered++;
          }

          // Append the fragment to the canvas after rendering the chunk
          canvas[0].appendChild(fragment);

          // Update progress percentage
          const progress = Math.floor((pixelsLoaded / totalPixelsToLoad) * 100);
          progressPercentage.text(`${progress}%`);

          // Continue rendering the next chunk if rows remain
          if (currentRow < rows) {
              requestAnimationFrame(renderChunk); // Schedule the next chunk
          } else {
              // Hide progress label when rendering is complete
              progressLabel.hide();

              // Color all pixels randomly after rendering
              colorPixelsRandomly();
          }
      }

      // Start rendering the first chunk
      renderChunk();
  }

  // Function to color pixels randomly
  function colorPixelsRandomly() {
      // Select all rect elements in the grid
      const pixels = document.querySelectorAll("#pixelCanvas rect");

      // Iterate over each pixel and assign a random color
      pixels.forEach(pixel => {
          const randomColor = `#${Math.floor(Math.random() * 16777215).toString(16)}`;
          pixel.setAttribute("fill", randomColor);
      });
  }

  // Initialize the grid with a default pixel size
  buildPixelGridAsync(10);

  // Zoom level change handler
  $('#zoom-level').on('change', function () {
      const selectedSize = parseInt($(this).val());
      buildPixelGridAsync(selectedSize);
  });

  // Optional button to recolor pixels dynamically
  $('#recolorPixels').on('click', colorPixelsRandomly);
});
