document.addEventListener("DOMContentLoaded", () => {
    const header = document.querySelector("header");
    
    // Create a container for the pixel background
    const pixelBackground = document.createElement("div");
    pixelBackground.classList.add("header-pixel-background");
    header.appendChild(pixelBackground);
  
    const numPixels = 300; // Adjust the number of pixels
    const headerWidth = header.offsetWidth;
    const headerHeight = header.offsetHeight;
  
    // Function to generate random positions and animations
    function generatePixels() {
      for (let i = 0; i < numPixels; i++) {
        const pixel = document.createElement("div");
        pixel.classList.add("header-pixel");
  
        // Randomize position
        const x = Math.random() * headerWidth;
        const y = Math.random() * headerHeight;
  
        // Apply random animation delay and duration
        const delay = Math.random() * 5; // Up to 5 seconds
        const duration = 3 + Math.random() * 2; // 3 to 5 seconds
  
        pixel.style.left = `${x}px`;
        pixel.style.top = `${y}px`;
        pixel.style.animationDelay = `${delay}s`;
        pixel.style.animationDuration = `${duration}s`;
  
        // Randomize color slightly for variation
        const colorVariation = Math.random() * 0.2;
        pixel.style.backgroundColor = `rgba(75, 136, 106, ${0.8 + colorVariation})`;
  
        pixelBackground.appendChild(pixel);
      }
    }
  
    // Call the function to generate the pixels
    generatePixels();
  
    // Resize handler to regenerate pixels on window resize
    window.addEventListener("resize", () => {
      pixelBackground.innerHTML = ""; // Clear existing pixels
      generatePixels();
    });
  });
  