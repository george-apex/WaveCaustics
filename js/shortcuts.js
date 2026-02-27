export class Shortcuts {
    constructor(app) {
        this.app = app;
        this.bindEvents();
    }
    
    bindEvents() {
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
    }
    
    onKeyDown(event) {
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
            return;
        }
        
        switch (event.key.toLowerCase()) {
            case ' ':
                event.preventDefault();
                this.togglePlay();
                break;
            case 'r':
                this.app.reset();
                break;
            case 's':
                if (event.shiftKey) {
                    this.app.exportCausticsTexture();
                } else {
                    this.app.exportScreenshot();
                }
                break;
            case 'w':
                this.toggleWater();
                break;
            case 'f':
                this.toggleFloor();
                break;
            case 'h':
                this.toggleLightHelper();
                break;
            case 'n':
                this.toggleNormals();
                break;
            case 'm':
                this.toggleHeatmap();
                break;
            case 'g':
                this.toggleGodRays();
                break;
            case '1':
                this.app.setView('default');
                break;
            case '2':
                this.app.setView('top');
                break;
            case '3':
                this.app.setView('side');
                break;
            case '4':
                this.app.setView('underwater');
                break;
            case 'p':
                if (event.shiftKey) {
                    this.cyclePreset();
                }
                break;
            case '?':
            case '/':
                this.showHelp();
                break;
        }
    }
    
    togglePlay() {
        if (this.app.state.isPlaying) {
            this.app.pause();
        } else {
            this.app.play();
        }
    }
    
    toggleWater() {
        this.app.state.display.showWater = !this.app.state.display.showWater;
        this.app.waterSurface.setVisible(this.app.state.display.showWater);
        this.app.ui?.syncFromState();
    }
    
    toggleFloor() {
        this.app.state.display.showFloor = !this.app.state.display.showFloor;
        this.app.floorPlane.setVisible(this.app.state.display.showFloor);
        this.app.ui?.syncFromState();
    }
    
    toggleLightHelper() {
        this.app.state.display.showLightHelper = !this.app.state.display.showLightHelper;
        this.app.lightManager.setHelperVisible(this.app.state.display.showLightHelper);
        this.app.ui?.syncFromState();
    }
    
    toggleNormals() {
        this.app.state.debug.showNormals = !this.app.state.debug.showNormals;
        this.app.waterSurface.setShowNormals(this.app.state.debug.showNormals);
        this.app.ui?.syncFromState();
    }
    
    toggleHeatmap() {
        this.app.state.debug.showHeatmap = !this.app.state.debug.showHeatmap;
        this.app.floorPlane.setShowHeatmap(this.app.state.debug.showHeatmap);
        this.app.ui?.syncFromState();
    }
    
    toggleGodRays() {
        this.app.state.effects.godRays = !this.app.state.effects.godRays;
        this.app.causticsRenderer.setGodRays(this.app.state.effects.godRays);
        this.app.ui?.syncFromState();
    }
    
    cyclePreset() {
        const presets = Object.keys(this.app.presets);
        const currentIdx = presets.indexOf(this.app.state.currentPreset);
        const nextIdx = (currentIdx + 1) % presets.length;
        const nextPreset = presets[nextIdx];
        this.app.loadPreset(nextPreset);
        this.app.state.currentPreset = nextPreset;
    }
    
    showHelp() {
        const helpText = `
Keyboard Shortcuts:
  Space  - Play/Pause
  R      - Reset
  S      - Screenshot
  Shift+S - Export caustics texture
  W      - Toggle water
  F      - Toggle floor
  H      - Toggle light helper
  N      - Toggle normals view
  M      - Toggle heatmap
  G      - Toggle god rays
  1-4    - Camera views
  Shift+P - Cycle presets
  ?      - Show this help
        `;
        console.log(helpText);
        this.app.ui?.setStatus('Check console for keyboard shortcuts');
    }
}
