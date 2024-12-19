document.addEventListener('DOMContentLoaded', function () {
    const canvasContainer = document.getElementById('canvasContainer');
    const canvasElement = document.getElementById('pixelCanvas');
    const ctx = canvasElement.getContext('2d');

    // Total number of pixels
    const totalPixels = 100000;

    // Button event listener for rendering Mona Lisa
    document.getElementById('renderMonaLisa').addEventListener('click', function () {
        // Load Mona Lisa image
        const monaLisaImage = new Image();
        monaLisaImage.src = 'img/mona-lisa.jpg';

        monaLisaImage.onload = function () {
            // Get image dimensions
            const imgWidth = monaLisaImage.naturalWidth;
            const imgHeight = monaLisaImage.naturalHeight;

            // Calculate aspect ratio
            const aspectRatio = imgWidth / imgHeight;

            // Adjust canvas dimensions to maintain aspect ratio
            const canvasWidth = Math.sqrt(totalPixels * aspectRatio);
            const canvasHeight = canvasWidth / aspectRatio;
            const pixelSize = Math.floor(Math.sqrt((canvasWidth * canvasHeight) / totalPixels));

            canvasElement.width = Math.floor(canvasWidth / pixelSize) * pixelSize;
            canvasElement.height = Math.floor(canvasHeight / pixelSize) * pixelSize;

            const cols = canvasElement.width / pixelSize;
            const rows = canvasElement.height / pixelSize;

            // Draw the Mona Lisa image on the canvas
            ctx.drawImage(monaLisaImage, 0, 0, canvasElement.width, canvasElement.height);

            // Get image data for pixelation
            const imageData = ctx.getImageData(0, 0, canvasElement.width, canvasElement.height);
            const data = imageData.data;

            // Clear the canvas before pixelating
            ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);

            // Pixelate the Mona Lisa
            for (let row = 0; row < rows; row++) {
                for (let col = 0; col < cols; col++) {
                    const x = col * pixelSize;
                    const y = row * pixelSize;

                    // Calculate the average color for each pixel block
                    const avgColor = getAverageColor(data, x, y, canvasElement.width, pixelSize);
                    ctx.fillStyle = `rgb(${avgColor.r}, ${avgColor.g}, ${avgColor.b})`;
                    ctx.fillRect(x, y, pixelSize, pixelSize);
                }
            }

            //alert('Mona Lisa rendered successfully!');
        };
    });

    // Function to calculate the average color of a pixel block
    function getAverageColor(data, x, y, width, size) {
        let r = 0, g = 0, b = 0, count = 0;

        for (let dy = 0; dy < size; dy++) {
            for (let dx = 0; dx < size; dx++) {
                const px = (y + dy) * width + (x + dx);
                const offset = px * 4;

                if (data[offset] !== undefined) {
                    r += data[offset];     // Red
                    g += data[offset + 1]; // Green
                    b += data[offset + 2]; // Blue
                    count++;
                }
            }
        }

        return {
            r: Math.floor(r / count),
            g: Math.floor(g / count),
            b: Math.floor(b / count)
        };
    }
});
