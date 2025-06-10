// Import Three.js from a CDN.
// In a real production component, you might bundle this.
import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  SphereGeometry,
  MeshBasicMaterial,
  Mesh,
  VideoTexture,
  LinearFilter,
  SRGBColorSpace,
} from "https://cdn.skypack.dev/three@0.132.2";

// HLS.js to play the HLS stream from Home Assistant
import Hls from "https://cdn.jsdelivr.net/npm/hls.js@latest";

class UnifiDewarpCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.scene = new Scene();
    this.camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.renderer = new WebGLRenderer({ antialias: true });
    this.isDragging = false;
    this.previousMousePosition = { x: 0, y: 0 };
    this.rotation = { x: Math.PI, y: 0 }; // Initial view
    this.zoom = 75; // Initial FOV
  }

  // --- LitElement lifecycle methods ---
  // This is the standard for Lovelace custom cards
  set hass(hass) {
    this._hass = hass;
    if (!this.config) {
      return;
    }
    
    const entityState = this._hass.states[this.config.entity];
    if (entityState && !this.videoElement) {
       this.initialize(entityState);
    }
  }

  setConfig(config) {
    if (!config.entity) {
      throw new Error("You need to define an entity");
    }
    this.config = config;
  }

  // --- Main Initialization ---
  async initialize(entityState) {
    // 1. Create a video element in memory
    this.videoElement = document.createElement("video");
    this.videoElement.autoplay = true;
    this.videoElement.muted = true;
    this.videoElement.playsInline = true;

    // 2. Get the stream URL from Home Assistant
    try {
      const streamData = await this._hass.callWS({
        type: "camera/stream",
        entity_id: this.config.entity,
      });
      const hlsUrl = streamData.url;

      // 3. Use HLS.js to play the stream
      if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(hlsUrl);
        hls.attachMedia(this.videoElement);
      } else if (this.videoElement.canPlayType("application/vnd.apple.mpegurl")) {
        // Native HLS support (Safari)
        this.videoElement.src = hlsUrl;
      }
    } catch (err) {
      console.error("Error getting stream URL:", err);
      this.shadowRoot.innerHTML = `<ha-card header="Error"><div class="card-content">Could not get camera stream. Check logs.</div></ha-card>`;
      return;
    }

    // 4. Setup the WebGL Scene
    this.setupScene();
    this.setupControls();

    // 5. Start the animation loop
    this.animate();
  }
  
  setupScene() {
    const card = document.createElement("ha-card");
    card.header = this._hass.states[this.config.entity].attributes.friendly_name;
    this.shadowRoot.appendChild(card);
    
    const container = document.createElement('div');
    container.style.position = 'relative';
    card.appendChild(container);
    
    this.renderer.setSize(card.clientWidth, 450); // Default size
    container.appendChild(this.renderer.domElement);

    // Create the video texture
    const texture = new VideoTexture(this.videoElement);
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.colorSpace = SRGBColorSpace;
    
    // Create the sphere geometry and map the texture to the *inside*
    const geometry = new SphereGeometry(50, 60, 40);
    // Invert the geometry on the x-axis so we see it from the inside
    geometry.scale(-1, 1, 1);

    const material = new MeshBasicMaterial({ map: texture });
    const sphere = new Mesh(geometry, material);
    this.scene.add(sphere);

    this.camera.position.z = 0;
    
    // Handle resizing
    new ResizeObserver(() => {
        if (card.clientWidth > 0) {
            this.camera.aspect = card.clientWidth / 450;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(card.clientWidth, 450);
        }
    }).observe(card);
  }
  
  setupControls() {
    const canvas = this.renderer.domElement;
    canvas.style.cursor = "grab";

    // Mouse events for panning
    canvas.addEventListener("mousedown", (e) => {
      this.isDragging = true;
      canvas.style.cursor = "grabbing";
      this.previousMousePosition = { x: e.offsetX, y: e.offsetY };
    });

    canvas.addEventListener("mouseup", () => {
      this.isDragging = false;
      canvas.style.cursor = "grab";
    });
    
    canvas.addEventListener("mouseleave", () => {
      this.isDragging = false;
      canvas.style.cursor = "grab";
    });

    canvas.addEventListener("mousemove", (e) => {
      if (!this.isDragging) return;
      const deltaX = e.offsetX - this.previousMousePosition.x;
      const deltaY = e.offsetY - this.previousMousePosition.y;

      this.rotation.x += deltaX * 0.005;
      this.rotation.y += deltaY * 0.005;
      
      // Clamp vertical rotation to avoid flipping
      this.rotation.y = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.rotation.y));

      this.previousMousePosition = { x: e.offsetX, y: e.offsetY };
    });

    // Wheel event for zooming
    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      this.zoom += e.deltaY * 0.05;
      this.zoom = Math.max(20, Math.min(100, this.zoom)); // Clamp zoom level
      this.camera.fov = this.zoom;
      this.camera.updateProjectionMatrix();
    });
  }

  animate() {
    requestAnimationFrame(this.animate.bind(this));

    // Update camera rotation based on mouse input
    // This uses spherical coordinates to "look around"
    this.camera.rotation.y = this.rotation.y;
    this.camera.rotation.x = this.rotation.x;

    this.renderer.render(this.scene, this.camera);
  }

  getCardSize() {
    return 5;
  }
}

customElements.define("unifi-dewarp-card", UnifiDewarpCard);