export class UI {
    constructor(app) {
        this.app = app;
        this.elements = {};
        
        this.init();
    }
    
    init() {
        this.cacheElements();
        this.bindEvents();
        this.bindCollapsibleSections();
        this.syncFromState();
    }
    
    cacheElements() {
        const ids = [
            'scene-depth', 'scene-pool-size', 'floor-color', 'water-color',
            'wave-amplitude', 'wave-frequency', 'wave-speed', 'wave-type',
            'wave-direction', 'wave-edge-damping', 'wave-layer-count', 'wave-opacity',
            'light-azimuth', 'light-elevation', 'light-intensity', 'light-color',
            'light-type', 'light-point-x', 'light-point-y', 'light-point-z',
            'light-point-radius', 'light-animate', 'light-animation-speed', 'light-animation-type',
            'light-caustics-tint', 'light-caustics-tint-strength',
            'material-ior', 'material-dispersion', 'material-clarity',
            'show-water', 'show-floor', 'show-light-helper', 'wireframe-mode',
            'water-resolution', 'caustics-resolution',
            'play-btn', 'pause-btn', 'reset-btn',
            'export-screenshot', 'export-caustics',
            'preset-select', 'status-text',
            'light-media-input', 'water-media-input',
            'light-channel', 'water-channel', 'water-influence',
            'clear-light-media', 'clear-water-media',
            'god-rays', 'god-rays-intensity', 'god-rays-decay', 'god-rays-samples',
            'floor-pattern', 'pattern-scale',
            'show-heatmap', 'heatmap-scale',
            'show-normals',
            'interaction-enabled', 'ripple-strength', 'ripple-radius', 'ripple-decay',
            'clear-ripples',
            'mode-toggle',
            'background-color',
            'show-walls',
            'use-height-gradient',
            'water-color-low',
            'water-color-high',
            'toggle-webcam',
            'motion-sensitivity',
            'volumetric-fog', 'fog-density', 'fog-scattering', 'fog-anisotropy', 'fog-steps', 'fog-debug',
            'light-rays', 'light-ray-intensity',
            'bloom', 'bloom-intensity', 'bloom-threshold', 'bloom-soft-knee', 'bloom-radius',
            'temporal-reprojection', 'temporal-blend', 'feedback-min', 'feedback-max', 'variance-gamma',
            'water-video-controls', 'water-video-play', 'water-video-rewind', 'water-video-seek', 'water-video-time',
            'multi-light-enabled', 'multi-light-count',
            'light2-azimuth', 'light2-color', 'light2-intensity',
            'light3-azimuth', 'light3-color', 'light3-intensity'
        ];
        
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) this.elements[id] = el;
        });
        
        this.elements.viewButtons = document.querySelectorAll('[data-view]');
    }
    
    bindEvents() {
        const sliders = [
            { id: 'scene-depth', handler: (v) => this.app.state.scene.depth = v },
            { id: 'scene-pool-size', handler: (v) => {
                this.app.state.scene.poolSize = v;
                this.app.waterSurface?.setPoolSize(v);
                this.app.floorPlane?.setPoolSize(v);
            }},
            { id: 'wave-amplitude', handler: (v) => this.app.state.wave.amplitude = v },
            { id: 'wave-frequency', handler: (v) => this.app.state.wave.frequency = v },
            { id: 'wave-speed', handler: (v) => this.app.state.wave.speed = v },
            { id: 'light-azimuth', handler: (v) => this.app.state.light.azimuth = v },
            { id: 'light-elevation', handler: (v) => this.app.state.light.elevation = v },
            { id: 'light-intensity', handler: (v) => this.app.state.light.intensity = v },
            { id: 'material-ior', handler: (v) => {
                this.app.state.material.ior = v;
                this.app.causticsRenderer?.setDispersion(this.app.state.material.dispersion);
            }},
            { id: 'material-dispersion', handler: (v) => this.app.setDispersion(v) },
            { id: 'material-clarity', handler: (v) => {
                this.app.state.material.clarity = v;
                this.app.waterSurface?.updateMaterial(this.app.state);
            }},
            { id: 'water-resolution', handler: (v) => this.app.setWaterResolution(v) },
            { id: 'caustics-resolution', handler: (v) => this.app.setCausticsResolution(v) }
        ];
        
        sliders.forEach(({ id, handler }) => {
            const el = this.elements[id];
            if (el) {
                el.addEventListener('input', () => {
                    const value = parseFloat(el.value);
                    handler(value);
                    this.updateSliderDisplay(id);
                });
            }
        });
        
        const colors = [
            { id: 'floor-color', handler: (v) => this.app.state.scene.floorColor = v },
            { id: 'water-color', handler: (v) => this.app.state.scene.waterColor = v },
            { id: 'light-color', handler: (v) => this.app.state.light.color = v },
            { id: 'background-color', handler: (v) => this.app.setBackgroundColor(v) }
        ];
        
        colors.forEach(({ id, handler }) => {
            const el = this.elements[id];
            if (el) {
                el.addEventListener('input', () => {
                    handler(el.value);
                    this.app.waterSurface?.updateMaterial(this.app.state);
                    this.app.floorPlane?.updateColors(this.app.state.scene);
                });
            }
        });
        
        if (this.elements['wave-type']) {
            this.elements['wave-type'].addEventListener('change', () => {
                this.app.state.wave.type = this.elements['wave-type'].value;
            });
        }
        
        const checkboxes = [
            { id: 'show-water', handler: (v) => this.app.waterSurface?.setVisible(v) },
            { id: 'show-floor', handler: (v) => this.app.floorPlane?.setVisible(v) },
            { id: 'show-light-helper', handler: (v) => this.app.lightManager?.setHelperVisible(v) },
            { id: 'wireframe-mode', handler: (v) => this.app.waterSurface?.setWireframe(v) },
            { id: 'show-walls', handler: (v) => this.app.floorPlane?.setWallsVisible(v) }
        ];
        
        checkboxes.forEach(({ id, handler }) => {
            const el = this.elements[id];
            if (el) {
                el.addEventListener('change', () => {
                    handler(el.checked);
                });
            }
        });
        
        if (this.elements['play-btn']) {
            this.elements['play-btn'].addEventListener('click', () => this.app.play());
        }
        if (this.elements['pause-btn']) {
            this.elements['pause-btn'].addEventListener('click', () => this.app.pause());
        }
        if (this.elements['reset-btn']) {
            this.elements['reset-btn'].addEventListener('click', () => this.app.reset());
        }
        
        if (this.elements['export-screenshot']) {
            this.elements['export-screenshot'].addEventListener('click', () => this.app.exportScreenshot());
        }
        if (this.elements['export-caustics']) {
            this.elements['export-caustics'].addEventListener('click', () => this.app.exportCausticsTexture());
        }
        
        if (this.elements['preset-select']) {
            this.elements['preset-select'].addEventListener('change', () => {
                if (this.elements['preset-select'].value) {
                    this.app.loadPreset(this.elements['preset-select'].value);
                }
            });
        }
        
        this.elements.viewButtons?.forEach(btn => {
            btn.addEventListener('click', () => {
                this.app.setView(btn.dataset.view);
            });
        });
        
        if (this.elements['light-media-input']) {
            this.elements['light-media-input'].addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) this.app.loadLightMedia(file);
            });
        }
        
        if (this.elements['water-media-input']) {
            this.elements['water-media-input'].addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) this.app.loadWaterMedia(file);
            });
        }
        
        if (this.elements['light-channel']) {
            this.elements['light-channel'].addEventListener('change', () => {
                this.app.setLightChannel(this.elements['light-channel'].value);
            });
        }
        
        if (this.elements['water-channel']) {
            this.elements['water-channel'].addEventListener('change', () => {
                this.app.setWaterChannel(this.elements['water-channel'].value);
            });
        }
        
        if (this.elements['water-influence']) {
            this.elements['water-influence'].addEventListener('input', () => {
                const value = parseFloat(this.elements['water-influence'].value);
                this.app.setWaterInfluence(value);
                this.updateSliderDisplay('water-influence');
            });
        }
        
        if (this.elements['clear-light-media']) {
            this.elements['clear-light-media'].addEventListener('click', () => {
                this.app.clearLightMedia();
            });
        }
        
        if (this.elements['clear-water-media']) {
            this.elements['clear-water-media'].addEventListener('click', () => {
                this.app.clearWaterMedia();
                this.updateWebcamButton(false);
            });
        }
        
        if (this.elements['toggle-webcam']) {
            this.elements['toggle-webcam'].addEventListener('click', () => {
                this.app.toggleWebcam();
            });
        }
        
        const newSliders = [
            { id: 'wave-direction', handler: (v) => this.app.setWaveDirection(v) },
            { id: 'wave-edge-damping', handler: (v) => this.app.setEdgeDamping(v) },
            { id: 'light-point-x', handler: (v) => this.app.setPointLightPosition(v, this.app.state.light.pointPosition.y, this.app.state.light.pointPosition.z) },
            { id: 'light-point-y', handler: (v) => this.app.setPointLightPosition(this.app.state.light.pointPosition.x, v, this.app.state.light.pointPosition.z) },
            { id: 'light-point-z', handler: (v) => this.app.setPointLightPosition(this.app.state.light.pointPosition.x, this.app.state.light.pointPosition.y, v) },
            { id: 'light-point-radius', handler: (v) => this.app.setPointLightRadius(v) },
            { id: 'light-animation-speed', handler: (v) => this.app.setLightAnimation(this.app.state.light.animate, v) },
            { id: 'light-caustics-tint-strength', handler: (v) => this.app.setCausticsTint(this.app.state.light.causticsTint, v) },
            { id: 'god-rays-intensity', handler: (v) => this.app.setGodRays(this.app.state.effects.godRays, v) },
            { id: 'god-rays-decay', handler: (v) => this.app.setGodRays(this.app.state.effects.godRays, undefined, v) },
            { id: 'god-rays-samples', handler: (v) => this.app.setGodRays(this.app.state.effects.godRays, undefined, undefined, Math.round(v)) },
            { id: 'pattern-scale', handler: (v) => this.app.setPatternScale(v) },
            { id: 'heatmap-scale', handler: (v) => this.app.setHeatmapScale(v) },
            { id: 'ripple-strength', handler: (v) => this.app.setRippleParams(v) },
            { id: 'ripple-radius', handler: (v) => this.app.setRippleParams(undefined, v) },
            { id: 'ripple-decay', handler: (v) => this.app.setRippleParams(undefined, undefined, v) }
        ];
        
        newSliders.forEach(({ id, handler }) => {
            const el = this.elements[id];
            if (el) {
                el.addEventListener('input', () => {
                    const value = parseFloat(el.value);
                    handler(value);
                    this.updateSliderDisplay(id);
                });
            }
        });
        
        if (this.elements['light-type']) {
            this.elements['light-type'].addEventListener('change', () => {
                this.app.setLightType(this.elements['light-type'].value);
            });
        }
        
        if (this.elements['light-animate']) {
            this.elements['light-animate'].addEventListener('change', () => {
                this.app.setLightAnimation(this.elements['light-animate'].checked);
            });
        }
        
        if (this.elements['light-animation-type']) {
            this.elements['light-animation-type'].addEventListener('change', () => {
                this.app.setLightAnimation(this.app.state.light.animate, undefined, this.elements['light-animation-type'].value);
            });
        }
        
        if (this.elements['light-caustics-tint']) {
            this.elements['light-caustics-tint'].addEventListener('input', () => {
                this.app.setCausticsTint(this.elements['light-caustics-tint'].value, this.app.state.light.causticsTintStrength);
            });
        }
        
        if (this.elements['multi-light-enabled']) {
            this.elements['multi-light-enabled'].addEventListener('change', () => {
                this.app.setMultiLight(this.elements['multi-light-enabled'].checked);
                this.toggleMultiLightControls(this.elements['multi-light-enabled'].checked);
            });
        }
        
        if (this.elements['multi-light-count']) {
            this.elements['multi-light-count'].addEventListener('input', () => {
                const value = parseInt(this.elements['multi-light-count'].value);
                this.app.setMultiLight(undefined, value);
                this.updateSliderDisplay('multi-light-count');
            });
        }
        
        const multiLightSliders = [
            { id: 'light2-azimuth', handler: (v) => this.app.setMultiLightParams(1, { azimuth: v }) },
            { id: 'light2-intensity', handler: (v) => this.app.setMultiLightParams(1, { intensity: v }) },
            { id: 'light3-azimuth', handler: (v) => this.app.setMultiLightParams(2, { azimuth: v }) },
            { id: 'light3-intensity', handler: (v) => this.app.setMultiLightParams(2, { intensity: v }) }
        ];
        
        multiLightSliders.forEach(({ id, handler }) => {
            const el = this.elements[id];
            if (el) {
                el.addEventListener('input', () => {
                    const value = parseFloat(el.value);
                    handler(value);
                    this.updateSliderDisplay(id);
                });
            }
        });
        
        if (this.elements['light2-color']) {
            this.elements['light2-color'].addEventListener('input', () => {
                this.app.setMultiLightParams(1, { color: this.elements['light2-color'].value });
            });
        }
        
        if (this.elements['light3-color']) {
            this.elements['light3-color'].addEventListener('input', () => {
                this.app.setMultiLightParams(2, { color: this.elements['light3-color'].value });
            });
        }
        
        if (this.elements['god-rays']) {
            this.elements['god-rays'].addEventListener('change', () => {
                this.app.setGodRays(this.elements['god-rays'].checked);
            });
        }
        
        if (this.elements['volumetric-fog']) {
            this.elements['volumetric-fog'].addEventListener('change', () => {
                this.app.setFog(this.elements['volumetric-fog'].checked);
                this.toggleFogControls(this.elements['volumetric-fog'].checked);
            });
        }
        
        const fogSliders = [
            { id: 'fog-density', handler: (v) => this.app.setFogDensity(v) },
            { id: 'fog-scattering', handler: (v) => this.app.setFogScattering(v) },
            { id: 'fog-anisotropy', handler: (v) => this.app.setFogAnisotropy(v) },
            { id: 'fog-steps', handler: (v) => this.app.setFogSteps(Math.round(v)) }
        ];
        
        fogSliders.forEach(({ id, handler }) => {
            const el = this.elements[id];
            if (el) {
                el.addEventListener('input', () => {
                    const value = parseFloat(el.value);
                    handler(value);
                    this.updateSliderDisplay(id);
                });
            }
        });
        
        if (this.elements['fog-debug']) {
            this.elements['fog-debug'].addEventListener('change', () => {
                this.app.setFogDebugMode(parseInt(this.elements['fog-debug'].value));
            });
        }
        
        if (this.elements['light-rays']) {
            this.elements['light-rays'].addEventListener('change', () => {
                this.app.setLightRays(this.elements['light-rays'].checked);
            });
        }
        
        if (this.elements['light-ray-intensity']) {
            this.elements['light-ray-intensity'].addEventListener('input', () => {
                const value = parseFloat(this.elements['light-ray-intensity'].value);
                this.app.setLightRayIntensity(value);
                this.updateSliderDisplay('light-ray-intensity');
            });
        }
        
        if (this.elements['bloom']) {
            this.elements['bloom'].addEventListener('change', () => {
                this.app.setBloom(this.elements['bloom'].checked);
                this.toggleBloomControls(this.elements['bloom'].checked);
            });
        }
        
        const bloomSliders = [
            { id: 'bloom-intensity', handler: (v) => this.app.setBloom(this.app.state.effects.bloom, v) },
            { id: 'bloom-threshold', handler: (v) => this.app.setBloom(this.app.state.effects.bloom, undefined, v) },
            { id: 'bloom-soft-knee', handler: (v) => this.app.setBloom(this.app.state.effects.bloom, undefined, undefined, v) },
            { id: 'bloom-radius', handler: (v) => this.app.setBloom(this.app.state.effects.bloom, undefined, undefined, undefined, v) }
        ];
        
        bloomSliders.forEach(({ id, handler }) => {
            const el = this.elements[id];
            if (el) {
                el.addEventListener('input', () => {
                    const value = parseFloat(el.value);
                    handler(value);
                    this.updateSliderDisplay(id);
                });
            }
        });
        
        if (this.elements['temporal-reprojection']) {
            this.elements['temporal-reprojection'].addEventListener('change', () => {
                this.app.setTemporalReprojection(this.elements['temporal-reprojection'].checked);
                this.toggleTemporalControls(this.elements['temporal-reprojection'].checked);
            });
        }
        
        const temporalSliders = [
            { id: 'temporal-blend', handler: (v) => this.app.setTemporalReprojection(this.app.state.effects.temporalReprojection, v) },
            { id: 'feedback-min', handler: (v) => this.app.setTemporalReprojection(this.app.state.effects.temporalReprojection, undefined, v) },
            { id: 'feedback-max', handler: (v) => this.app.setTemporalReprojection(this.app.state.effects.temporalReprojection, undefined, undefined, v) },
            { id: 'variance-gamma', handler: (v) => this.app.setTemporalReprojection(this.app.state.effects.temporalReprojection, undefined, undefined, undefined, v) }
        ];
        
        temporalSliders.forEach(({ id, handler }) => {
            const el = this.elements[id];
            if (el) {
                el.addEventListener('input', () => {
                    const value = parseFloat(el.value);
                    handler(value);
                    this.updateSliderDisplay(id);
                });
            }
        });
        
        if (this.elements['floor-pattern']) {
            this.elements['floor-pattern'].addEventListener('change', () => {
                this.app.setFloorPattern(this.elements['floor-pattern'].value);
            });
        }
        
        if (this.elements['show-heatmap']) {
            this.elements['show-heatmap'].addEventListener('change', () => {
                this.app.setShowHeatmap(this.elements['show-heatmap'].checked);
            });
        }
        
        if (this.elements['show-normals']) {
            this.elements['show-normals'].addEventListener('change', () => {
                this.app.setShowNormals(this.elements['show-normals'].checked);
            });
        }
        
        if (this.elements['interaction-enabled']) {
            this.elements['interaction-enabled'].addEventListener('change', () => {
                this.app.setInteractionEnabled(this.elements['interaction-enabled'].checked);
            });
        }
        
        if (this.elements['clear-ripples']) {
            this.elements['clear-ripples'].addEventListener('click', () => {
                this.app.clearRipples();
            });
        }
        
        if (this.elements['wave-layer-count']) {
            this.elements['wave-layer-count'].addEventListener('input', () => {
                const value = parseInt(this.elements['wave-layer-count'].value);
                this.app.setLayerCount(value);
                this.updateSliderDisplay('wave-layer-count');
            });
        }
        
        if (this.elements['wave-opacity']) {
            this.elements['wave-opacity'].addEventListener('input', () => {
                const value = parseFloat(this.elements['wave-opacity'].value);
                this.app.state.wave.opacity = value;
                this.app.waterSurface.updateMaterial(this.app.state);
                this.updateSliderDisplay('wave-opacity');
            });
        }
        
        if (this.elements['mode-toggle']) {
            this.elements['mode-toggle'].addEventListener('click', () => {
                this.toggleMode();
            });
        }
        
        if (this.elements['use-height-gradient']) {
            this.elements['use-height-gradient'].addEventListener('change', () => {
                this.app.state.wave.useHeightGradient = this.elements['use-height-gradient'].checked;
                this.app.waterSurface.updateMaterial(this.app.state);
                this.toggleHeightGradientControls(this.elements['use-height-gradient'].checked);
            });
        }
        
        if (this.elements['water-color-low']) {
            this.elements['water-color-low'].addEventListener('input', () => {
                this.app.state.wave.waterColorLow = this.elements['water-color-low'].value;
                this.app.waterSurface.updateMaterial(this.app.state);
            });
        }
        
        if (this.elements['water-color-high']) {
            this.elements['water-color-high'].addEventListener('input', () => {
                this.app.state.wave.waterColorHigh = this.elements['water-color-high'].value;
                this.app.waterSurface.updateMaterial(this.app.state);
            });
        }
        
        if (this.elements['motion-sensitivity']) {
            this.elements['motion-sensitivity'].addEventListener('input', () => {
                const value = parseFloat(this.elements['motion-sensitivity'].value);
                this.app.mediaInput.setMotionSensitivity(value);
                this.updateSliderDisplay('motion-sensitivity');
            });
        }
        
        if (this.elements['water-video-play']) {
            this.elements['water-video-play'].addEventListener('click', () => {
                const playing = this.app.mediaInput.toggleVideoPlayback();
                if (playing !== null) {
                    this.elements['water-video-play'].textContent = playing ? '⏸ Pause' : '▶ Play';
                }
            });
        }
        
        if (this.elements['water-video-rewind']) {
            this.elements['water-video-rewind'].addEventListener('click', () => {
                this.app.mediaInput.rewindVideo();
                this.updateVideoTimeDisplay();
            });
        }
        
        if (this.elements['water-video-seek']) {
            this.elements['water-video-seek'].addEventListener('input', () => {
                const videoState = this.app.mediaInput.getVideoState();
                if (videoState) {
                    const percent = parseFloat(this.elements['water-video-seek'].value);
                    const time = (percent / 100) * videoState.duration;
                    this.app.mediaInput.setVideoTime(time);
                }
            });
        }
    }
    
    bindCollapsibleSections() {
        const sections = document.querySelectorAll('.control-section');
        sections.forEach(section => {
            const header = section.querySelector('.section-header');
            if (header) {
                header.addEventListener('click', () => {
                    section.classList.toggle('collapsed');
                });
            }
        });
    }
    
    toggleMode() {
        const isInteractionMode = this.app.toggleInteractionMode();
        const btn = this.elements['mode-toggle'];
        const cameraIcon = btn.querySelector('.camera-icon');
        const interactionIcon = btn.querySelector('.interaction-icon');
        
        if (isInteractionMode) {
            btn.classList.add('interaction-mode');
            cameraIcon.style.display = 'none';
            interactionIcon.style.display = 'inline';
            this.setStatus('Interaction mode - Drag to create ripples');
        } else {
            btn.classList.remove('interaction-mode');
            cameraIcon.style.display = 'inline';
            interactionIcon.style.display = 'none';
            this.setStatus('Camera mode - Drag to orbit, scroll to zoom');
        }
    }
    
    updateSliderDisplay(id) {
        const el = this.elements[id];
        const displayEl = document.getElementById(id.replace(/-([a-z])/g, (m, c) => c.toUpperCase()) + '-display');
        if (el && displayEl) {
            const value = parseFloat(el.value);
            if (id === 'water-resolution' || id === 'caustics-resolution') {
                displayEl.textContent = Math.round(value);
            } else if (id === 'wave-opacity') {
                displayEl.textContent = value.toFixed(2);
            } else {
                displayEl.textContent = value.toFixed(1);
            }
        }
    }
    
    syncFromState() {
        const state = this.app.state;
        
        const sliderMappings = [
            ['scene-depth', state.scene.depth],
            ['scene-pool-size', state.scene.poolSize],
            ['wave-amplitude', state.wave.amplitude],
            ['wave-frequency', state.wave.frequency],
            ['wave-speed', state.wave.speed],
            ['wave-direction', state.wave.direction],
            ['wave-edge-damping', state.wave.edgeDamping],
            ['wave-layer-count', state.wave.layerCount],
            ['wave-opacity', state.wave.opacity ?? 0.8],
            ['light-azimuth', state.light.azimuth],
            ['light-elevation', state.light.elevation],
            ['light-intensity', state.light.intensity],
            ['light-point-x', state.light.pointPosition.x],
            ['light-point-y', state.light.pointPosition.y],
            ['light-point-z', state.light.pointPosition.z],
            ['light-point-radius', state.light.pointRadius],
            ['light-animation-speed', state.light.animationSpeed],
            ['light-caustics-tint-strength', state.light.causticsTintStrength],
            ['material-ior', state.material.ior],
            ['material-dispersion', state.material.dispersion],
            ['material-clarity', state.material.clarity],
            ['water-resolution', state.display.waterResolution],
            ['caustics-resolution', state.display.causticsResolution],
            ['god-rays-intensity', state.effects.godRaysIntensity],
            ['god-rays-decay', state.effects.godRaysDecay],
            ['god-rays-samples', state.effects.godRaysSamples],
            ['pattern-scale', state.scene.patternScale || 1.0],
            ['heatmap-scale', state.debug.heatmapScale],
            ['ripple-strength', state.interaction.rippleStrength],
            ['ripple-radius', state.interaction.rippleRadius],
            ['ripple-decay', state.interaction.rippleDecay],
            ['fog-density', state.effects.fogDensity],
            ['fog-scattering', state.effects.fogScattering],
            ['fog-anisotropy', state.effects.fogAnisotropy],
            ['fog-steps', state.effects.fogSteps],
            ['light-ray-intensity', state.effects.lightRayIntensity ?? 1.0],
            ['bloom-intensity', state.effects.bloomIntensity ?? 0.5],
            ['bloom-threshold', state.effects.bloomThreshold ?? 0.8],
            ['bloom-soft-knee', state.effects.bloomSoftKnee ?? 0.2],
            ['bloom-radius', state.effects.bloomRadius ?? 1.0],
            ['temporal-blend', state.effects.temporalBlend ?? 0.1],
            ['feedback-min', state.effects.feedbackMin ?? 0.9],
            ['feedback-max', state.effects.feedbackMax ?? 0.95],
            ['variance-gamma', state.effects.varianceGamma ?? 1.0],
            ['multi-light-count', state.multiLight?.count ?? 1],
            ['light2-azimuth', state.multiLight?.lights?.[1]?.azimuth ?? 135],
            ['light2-intensity', state.multiLight?.lights?.[1]?.intensity ?? 1.0],
            ['light3-azimuth', state.multiLight?.lights?.[2]?.azimuth ?? 0],
            ['light3-intensity', state.multiLight?.lights?.[2]?.intensity ?? 1.2]
        ];
        
        sliderMappings.forEach(([id, value]) => {
            const el = this.elements[id];
            if (el) {
                el.value = value;
                this.updateSliderDisplay(id);
            }
        });
        
        const colorMappings = [
            ['floor-color', state.scene.floorColor],
            ['water-color', state.scene.waterColor],
            ['light-color', state.light.color],
            ['light-caustics-tint', state.light.causticsTint],
            ['background-color', state.display.backgroundColor],
            ['water-color-low', state.wave.waterColorLow ?? '#1a3a5c'],
            ['water-color-high', state.wave.waterColorHigh ?? '#88ccff'],
            ['light2-color', state.multiLight?.lights?.[1]?.color ?? '#FF8844'],
            ['light3-color', state.multiLight?.lights?.[2]?.color ?? '#4488FF']
        ];
        
        colorMappings.forEach(([id, value]) => {
            const el = this.elements[id];
            if (el) el.value = value;
        });
        
        if (this.elements['wave-type']) {
            this.elements['wave-type'].value = state.wave.type;
        }
        
        if (this.elements['light-type']) {
            this.elements['light-type'].value = state.light.type;
        }
        
        if (this.elements['light-animation-type']) {
            this.elements['light-animation-type'].value = state.light.animationType;
        }
        
        if (this.elements['floor-pattern']) {
            this.elements['floor-pattern'].value = state.scene.floorPattern || 'solid';
        }
        
        const checkboxMappings = [
            ['show-water', state.display.showWater],
            ['show-floor', state.display.showFloor],
            ['show-light-helper', state.display.showLightHelper],
            ['wireframe-mode', state.display.wireframe],
            ['show-walls', state.display.showWalls],
            ['light-animate', state.light.animate],
            ['god-rays', state.effects.godRays],
            ['show-heatmap', state.debug.showHeatmap],
            ['show-normals', state.debug.showNormals],
            ['interaction-enabled', state.interaction.enabled],
            ['use-height-gradient', state.wave.useHeightGradient ?? false],
            ['volumetric-fog', state.effects.fog],
            ['light-rays', state.effects.lightRays ?? false],
            ['bloom', state.effects.bloom ?? false],
            ['temporal-reprojection', state.effects.temporalReprojection ?? false],
            ['multi-light-enabled', state.multiLight?.enabled ?? false]
        ];
        
        checkboxMappings.forEach(([id, value]) => {
            const el = this.elements[id];
            if (el) el.checked = value;
        });
        
        this.toggleHeightGradientControls(state.wave.useHeightGradient ?? false);
        this.toggleFogControls(state.effects.fog);
        this.toggleBloomControls(state.effects.bloom ?? false);
        this.toggleTemporalControls(state.effects.temporalReprojection ?? false);
        this.toggleMultiLightControls(state.multiLight?.enabled ?? false);
    }
    
    toggleMultiLightControls(show) {
        document.querySelectorAll('.multi-light-controls').forEach(el => {
            el.classList.toggle('visible', show);
        });
    }
    
    toggleHeightGradientControls(show) {
        document.querySelectorAll('.height-gradient-controls').forEach(el => {
            el.classList.toggle('visible', show);
        });
    }
    
    toggleMotionSensitivityControl(show) {
        const control = document.querySelector('.motion-sensitivity-control');
        if (control) {
            control.classList.toggle('visible', show);
        }
    }
    
    toggleFogControls(show) {
        document.querySelectorAll('.fog-controls').forEach(el => {
            el.classList.toggle('visible', show);
        });
    }
    
    toggleBloomControls(show) {
        document.querySelectorAll('.bloom-controls').forEach(el => {
            el.classList.toggle('visible', show);
        });
    }
    
    toggleTemporalControls(show) {
        document.querySelectorAll('.temporal-controls').forEach(el => {
            el.classList.toggle('visible', show);
        });
    }
    
    updateWebcamButton(isActive) {
        const btn = this.elements['toggle-webcam'];
        if (btn) {
            btn.textContent = isActive ? 'Stop Webcam' : 'Start Webcam';
            btn.classList.toggle('btn-danger', isActive);
            btn.classList.toggle('btn-secondary', !isActive);
        }
    }
    
    showVideoControls(show) {
        const controls = this.elements['water-video-controls'];
        if (controls) {
            controls.style.display = show ? 'block' : 'none';
        }
    }
    
    updateVideoTimeDisplay() {
        const videoState = this.app.mediaInput.getVideoState();
        if (!videoState) return;
        
        const seekEl = this.elements['water-video-seek'];
        const timeEl = this.elements['water-video-time'];
        const playBtn = this.elements['water-video-play'];
        
        if (seekEl && videoState.duration > 0) {
            const percent = (videoState.currentTime / videoState.duration) * 100;
            seekEl.value = percent;
        }
        
        if (timeEl) {
            const formatTime = (t) => {
                const mins = Math.floor(t / 60);
                const secs = Math.floor(t % 60);
                return `${mins}:${secs.toString().padStart(2, '0')}`;
            };
            timeEl.textContent = `${formatTime(videoState.currentTime)} / ${formatTime(videoState.duration)}`;
        }
        
        if (playBtn) {
            playBtn.textContent = videoState.paused ? '▶ Play' : '⏸ Pause';
        }
    }
    
    setStatus(text) {
        if (this.elements['status-text']) {
            this.elements['status-text'].textContent = text;
        }
    }
}
