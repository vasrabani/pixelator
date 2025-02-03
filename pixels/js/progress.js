// Total and answered pixel counts
let totalPixels = 1000; // Total number of pixels in the canvas
let answeredPixels = 0; // Counter for answered pixels

// Grab progress bar and label elements
const progressBar = document.getElementById("charityProgressBar");
const progressLabel = document.getElementById("charityProgressLabel");
const pixelStats = document.getElementById("pixelStats");

// Function to update progress bar and stats
function updateCharityProgress() {
  // Calculate percentage
  const percentage = (answeredPixels / totalPixels) * 100;

  // Update progress bar width and aria-valuenow
  progressBar.style.width = percentage + "%";
  progressBar.setAttribute("aria-valuenow", percentage);

  // Update progress label (e.g., donation amount)
  const donationAmount = answeredPixels * 10; // Example: $10 per pixel
  progressLabel.textContent = `$${donationAmount.toLocaleString()}`;

  // Update pixel stats display
  if (pixelStats) {
    pixelStats.textContent = `${answeredPixels} / ${totalPixels} pixels answered (${percentage.toFixed(1)}%)`;
  }
}

// Function to handle pixel click
function onPixelClick(event) {
  const pixel = event.target;

  // Check if the pixel is already clicked
  if (pixel.dataset.clicked === "true") {
    return; // Skip if already clicked
  }

  // Mark the pixel as clicked
  pixel.dataset.clicked = "true";
  answeredPixels++; // Increment the answered pixels counter
  updateCharityProgress(); // Update the progress
}

// Initialize pixels and attach event listeners
function initializePixels() {
  const pixels = document.querySelectorAll(".header-pixel"); // Adjust selector for your pixels
  pixels.forEach((pixel) => {
    // Attach click event listener to each pixel
    pixel.addEventListener("click", onPixelClick);
  });
}

// Initialize everything on page load
document.addEventListener("DOMContentLoaded", () => {
  initializePixels();
  updateCharityProgress(); // Set initial progress
});
