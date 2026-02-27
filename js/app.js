import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { WaterSurface } from './water.js';
import { CausticsRenderer } from './caustics.js';
import { FloorPlane } from './floor.js';
import { LightManager } from './light.js';
import { UI } from './ui.js';
import { MediaInput } from './mediaInput.js';
import { Interaction } from './interaction.js';
import { Shortcuts } from './shortcuts.js';
import { VolumetricFog } from './volumetricFog.js';
import { BloomEffect } from './effects/bloom.js';
import { TemporalReprojection } from './effects/temporalReprojection.js';
import { ChromaticAberration } from './effects/chromaticAberration.js';
import { RainEffect } from './effects/rain.js';
import { AudioReactive } from './effects/audioReactive.js';

export class App {
    constructor() {
        this.state = {
            isPlaying: true,
            time: 0,
            
            scene: {
                depth: 2,
                poolSize: 10,
                floorColor: '#1a1a2e',
                waterColor: '#4488aa'
            },
            
            wave: {
                amplitude: 0.3,
                frequency: 2.0,
                speed: 1.0,
                type: 'perlin',
                direction: 0,
                edgeDamping: 0,
                layerCount: 1,
                opacity: 0.8,
                useHeightGradient: false,
                waterColorLow: '#1a3a5c',
                waterColorHigh: '#88ccff',
                layers: [
                    { amplitude: 1.0, frequency: 1.0, speed: 1.0, direction: 0 },
                    { amplitude: 0.5, frequency: 2.0, speed: 1.2, direction: 45 },
                    { amplitude: 0.25, frequency: 4.0, speed: 0.8, direction: 90 },
                    { amplitude: 0.125, frequency: 8.0, speed: 0.6, direction: 135 }
                ]
            },
            
            light: {
                azimuth: 45,
                elevation: 60,
                intensity: 1.5,
                color: '#FFFFFF',
                type: 'directional',
                pointPosition: { x: 0, y: 5, z: 0 },
                pointRadius: 10,
                animate: false,
                animationSpeed: 1.0,
                animationType: 'orbit',
                causticsTint: '#FFFFFF',
                causticsTintStrength: 0
            },
            
            material: {
                ior: 1.33,
                dispersion: 0,
                clarity: 0.8
            },
            
            display: {
                showWater: true,
                showFloor: true,
                showLightHelper: false,
                wireframe: false,
                waterResolution: 128,
                causticsResolution: 256,
                backgroundColor: '#b5b5b5',
                showWalls: true
            },
            
            media: {
                lightMode: 'solid',
                lightChannel: 'luminance',
                waterMode: 'procedural',
                waterChannel: 'luminance',
                waterInfluence: 0.5
            },
            
            effects: {
                godRays: false,
                godRaysIntensity: 0.5,
                godRaysDecay: 0.95,
                godRaysSamples: 50,
                fog: false,
                fogDensity: 1.0,
                fogScattering: 1.0,
                fogAnisotropy: 0.3,
                fogSteps: 32,
                lightRays: false,
                lightRayIntensity: 1.0,
                bloom: false,
                bloomIntensity: 0.5,
                bloomThreshold: 0.8,
                bloomSoftKnee: 0.2,
                bloomRadius: 1.0,
                temporalReprojection: false,
                temporalBlend: 0.1,
                feedbackMin: 0.9,
                feedbackMax: 0.95,
                varianceGamma: 1.0,
                chromaticAberration: false,
                chromaticStrength: 5.0,
                chromaticRadial: true
            },
            
            interaction: {
                enabled: true,
                rippleStrength: 0.5,
                rippleRadius: 1.0,
                rippleDecay: 2.0
            },
            
            rain: {
                enabled: false,
                intensity: 0.5,
                dropSpeed: 8.0,
                dropSize: 0.3,
                windX: 0,
                windZ: 0
            },
            
            audio: {
                enabled: false,
                sensitivity: 1.0,
                smoothing: 0.8,
                amplitudeEnabled: false,
                amplitudeBand: 'bass',
                amplitudeMultiplier: 0.5,
                frequencyEnabled: false,
                frequencyBand: 'mid',
                frequencyMultiplier: 0.3,
                speedEnabled: false,
                speedBand: 'treble',
                speedMultiplier: 0.2
            },
            
            debug: {
                showHeatmap: false,
                heatmapScale: 1.0,
                showNormals: false,
                showStats: false
            },
            
            multiLight: {
                enabled: false,
                count: 1,
                lights: [
                    { type: 'directional', azimuth: 45, elevation: 60, color: '#FFFFFF', intensity: 1.5, position: { x: 0, y: 5, z: 0 } },
                    { type: 'directional', azimuth: 135, elevation: 45, color: '#FF8844', intensity: 1.0, position: { x: 5, y: 4, z: 5 } },
                    { type: 'point', azimuth: 0, elevation: 70, color: '#4488FF', intensity: 1.2, position: { x: -3, y: 6, z: -3 } },
                    { type: 'directional', azimuth: 270, elevation: 30, color: '#FF44FF', intensity: 0.8, position: { x: 0, y: 3, z: 0 } }
                ]
            },
            
            interactionMode: false,
            
            playback: {
                minTime: 0,
                maxTime: 30,
                loop: true
            }
        };
        
        this.presets = {
            pool: {
                scene: { depth: 2, poolSize: 10, floorColor: '#1a1a2e', waterColor: '#4488aa' },
                wave: { amplitude: 0.25, frequency: 2.5, speed: 0.8, type: 'perlin' },
                light: { azimuth: 45, elevation: 60, intensity: 1.5, color: '#FFFFFF' },
                material: { ior: 1.33, dispersion: 0, clarity: 0.85 }
            },
            ocean: {
                scene: { depth: 3, poolSize: 15, floorColor: '#0a1628', waterColor: '#2266aa' },
                wave: { amplitude: 0.5, frequency: 1.5, speed: 1.2, type: 'gerstner' },
                light: { azimuth: 120, elevation: 45, intensity: 2.0, color: '#FFF5E0' },
                material: { ior: 1.33, dispersion: 0, clarity: 0.7 }
            },
            glass: {
                scene: { depth: 1, poolSize: 8, floorColor: '#2a2a3e', waterColor: '#aaddff' },
                wave: { amplitude: 0.1, frequency: 4.0, speed: 0.3, type: 'sine' },
                light: { azimuth: 30, elevation: 70, intensity: 1.2, color: '#FFFFFF' },
                material: { ior: 1.5, dispersion: 0.02, clarity: 0.95 }
            },
            diamond: {
                scene: { depth: 0.5, poolSize: 6, floorColor: '#1a1a1a', waterColor: '#ffffff' },
                wave: { amplitude: 0.15, frequency: 3.0, speed: 0.5, type: 'sine' },
                light: { azimuth: 0, elevation: 80, intensity: 2.5, color: '#FFFFFF' },
                material: { ior: 2.4, dispersion: 0.08, clarity: 1.0 }
            },
            sunset: {
                scene: { depth: 2.5, poolSize: 12, floorColor: '#1a1020', waterColor: '#6688aa' },
                wave: { amplitude: 0.4, frequency: 0.7, speed: 0.5, type: 'perlin', useHeightGradient: true, waterColorLow: '#000000', waterColorHigh: '#0a3e66' },
                light: { azimuth: 270, elevation: 25, intensity: 3.0, color: '#FF8844' },
                material: { ior: 1.33, dispersion: 0, clarity: 0.75 },
                display: { showWalls: false, showFloor: false, waterResolution: 1024 }
            },
            'video-test': {
                scene: { depth: 2, poolSize: 15, floorColor: '#1a1a2e', waterColor: '#4488aa' },
                wave: { amplitude: 1, frequency: 2.0, speed: 1.0, type: 'none', useHeightGradient: true, waterColorLow: '#1a3a5c', waterColorHigh: '#88ccff' },
                light: { azimuth: 45, elevation: 60, intensity: 1.5, color: '#FFFFFF' },
                material: { ior: 1.33, dispersion: 0, clarity: 0.8 },
                display: { showWalls: false, showFloor: false, waterResolution: 256 }
            },
            'neon-pool': {
                scene: { depth: 2, poolSize: 10, floorColor: '#0a0a1a', waterColor: '#00ffff' },
                wave: { amplitude: 0.2, frequency: 3.0, speed: 0.7, type: 'perlin' },
                light: { azimuth: 0, elevation: 70, intensity: 2.0, color: '#ff00ff' },
                material: { ior: 1.33, dispersion: 0.03, clarity: 0.9 },
                effects: { bloom: true, bloomIntensity: 1.2, bloomThreshold: 0.4, chromaticAberration: true, chromaticStrength: 8 }
            },
            'tropical-lagoon': {
                scene: { depth: 1.5, poolSize: 20, floorColor: '#f5e6d3', waterColor: '#40e0d0' },
                wave: { amplitude: 0.15, frequency: 1.5, speed: 0.5, type: 'gerstner' },
                light: { azimuth: 90, elevation: 75, intensity: 2.5, color: '#FFFACD' },
                material: { ior: 1.33, dispersion: 0, clarity: 0.95 }
            },
            'bioluminescence': {
                scene: { depth: 3, poolSize: 12, floorColor: '#050510', waterColor: '#001a33' },
                wave: { amplitude: 0.3, frequency: 2.0, speed: 0.6, type: 'perlin', useHeightGradient: true, waterColorLow: '#000814', waterColorHigh: '#00ff88' },
                light: { azimuth: 180, elevation: 30, intensity: 0.5, color: '#4488ff' },
                material: { ior: 1.33, dispersion: 0, clarity: 0.7 },
                effects: { bloom: true, bloomIntensity: 1.5, bloomThreshold: 0.2 }
            },
            'prism': {
                scene: { depth: 0.3, poolSize: 6, floorColor: '#ffffff', waterColor: '#ffffff' },
                wave: { amplitude: 0.05, frequency: 5.0, speed: 0.2, type: 'sine' },
                light: { azimuth: 45, elevation: 60, intensity: 3.0, color: '#FFFFFF' },
                material: { ior: 2.4, dispersion: 0.15, clarity: 1.0 },
                effects: { chromaticAberration: true, chromaticStrength: 12 }
            },
            'stormy': {
                scene: { depth: 4, poolSize: 25, floorColor: '#1a1a2e', waterColor: '#2d4a6e' },
                wave: { amplitude: 0.8, frequency: 1.2, speed: 2.0, type: 'gerstner' },
                light: { azimuth: 200, elevation: 20, intensity: 1.0, color: '#8899aa' },
                material: { ior: 1.33, dispersion: 0, clarity: 0.6 },
                effects: { fog: true, fogDensity: 0.6, fogScattering: 0.8 }
            },
            'zen-garden': {
                scene: { depth: 0.5, poolSize: 8, floorColor: '#d4c4a8', waterColor: '#8899aa' },
                wave: { amplitude: 0.05, frequency: 4.0, speed: 0.3, type: 'ripple' },
                light: { azimuth: 135, elevation: 50, intensity: 1.2, color: '#FFF8E7' },
                material: { ior: 1.33, dispersion: 0, clarity: 0.98 }
            },
            'lava-lamp': {
                scene: { depth: 2, poolSize: 8, floorColor: '#1a0a0a', waterColor: '#ff4400' },
                wave: { amplitude: 0.4, frequency: 0.8, speed: 0.4, type: 'perlin', useHeightGradient: true, waterColorLow: '#ff2200', waterColorHigh: '#ffcc00' },
                light: { azimuth: 0, elevation: 90, intensity: 2.0, color: '#ff6600' },
                material: { ior: 1.5, dispersion: 0.02, clarity: 0.8 },
                effects: { bloom: true, bloomIntensity: 1.0, bloomThreshold: 0.3 }
            },
            'aurora': {
                scene: { depth: 2, poolSize: 15, floorColor: '#0a0a1a', waterColor: '#1a3a5c' },
                wave: { amplitude: 0.25, frequency: 1.0, speed: 0.3, type: 'perlin', useHeightGradient: true, waterColorLow: '#0a1a2a', waterColorHigh: '#00ff88' },
                light: { azimuth: 0, elevation: 45, intensity: 1.5, color: '#88ffaa' },
                material: { ior: 1.33, dispersion: 0.05, clarity: 0.85 },
                effects: { bloom: true, bloomIntensity: 0.8, chromaticAberration: true, chromaticStrength: 6 }
            },
            'pool-party': {
                scene: { depth: 1.8, poolSize: 12, floorColor: '#4a90a4', waterColor: '#00bfff' },
                wave: { amplitude: 0.35, frequency: 2.5, speed: 1.0, type: 'gerstner' },
                light: { azimuth: 60, elevation: 70, intensity: 2.5, color: '#FFFFFF' },
                material: { ior: 1.33, dispersion: 0, clarity: 0.9 }
            },
            'deep-sea': {
                scene: { depth: 5, poolSize: 20, floorColor: '#020810', waterColor: '#0a1a2a' },
                wave: { amplitude: 0.6, frequency: 0.8, speed: 0.5, type: 'perlin' },
                light: { azimuth: 0, elevation: 90, intensity: 0.3, color: '#4488aa' },
                material: { ior: 1.33, dispersion: 0, clarity: 0.4 },
                effects: { fog: true, fogDensity: 0.8, fogScattering: 0.6 }
            }
        };
    }
    
    init() {
        this.setupRenderer();
        this.setupScene();
        this.setupCamera();
        this.setupControls();
        this.createObjects();
        this.setupUI();
        this.startAnimation();
        
        console.log('Caustics 3D initialized');
    }
    
    setupRenderer() {
        const container = document.getElementById('canvas-container');
        const canvas = document.getElementById('main-canvas');
        
        this.renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: true,
            alpha: false,
            preserveDrawingBuffer: true
        });
        
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        
        this.container = container;
        
        window.addEventListener('resize', () => this.onResize());
    }
    
    setupScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(this.state.display.backgroundColor);
        
        this.scene.add(new THREE.AmbientLight(0x404060, 0.3));
    }
    
    setupCamera() {
        const aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 100);
        this.camera.position.set(8, 6, 8);
        this.camera.lookAt(0, 0, 0);
    }
    
    setupControls() {
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = 3;
        this.controls.maxDistance = 30;
        this.controls.maxPolarAngle = Math.PI * 0.9;
        this.controls.target.set(0, -this.state.scene.depth / 2, 0);
    }
    
    createObjects() {
        this.lightManager = new LightManager(this.scene, this.state.light);
        
        this.waterSurface = new WaterSurface(this.scene, this.state);
        
        this.floorPlane = new FloorPlane(this.scene, this.state.scene);
        
        this.causticsRenderer = new CausticsRenderer(
            this.renderer,
            this.waterSurface,
            this.floorPlane,
            this.lightManager,
            this.state
        );
        
        this.volumetricFog = new VolumetricFog(
            this.renderer,
            this.scene,
            this.camera,
            this.causticsRenderer,
            this.state
        );
        
        this.bloomEffect = new BloomEffect(this.renderer, {
            intensity: this.state.effects.bloomIntensity,
            threshold: this.state.effects.bloomThreshold,
            softKnee: this.state.effects.bloomSoftKnee,
            radius: this.state.effects.bloomRadius
        });
        
        this.temporalReprojection = new TemporalReprojection(this.renderer, {
            temporalBlend: this.state.effects.temporalBlend,
            feedbackMin: this.state.effects.feedbackMin,
            feedbackMax: this.state.effects.feedbackMax,
            varianceGamma: this.state.effects.varianceGamma
        });
        
        this.chromaticAberration = new ChromaticAberration(this.renderer, {
            strength: this.state.effects.chromaticStrength,
            radial: this.state.effects.chromaticRadial
        });
        
        this.rainEffect = new RainEffect(this);
        
        this.audioReactive = new AudioReactive(this);
        
        this.mediaInput = new MediaInput();
    }
    
    setupUI() {
        this.ui = new UI(this);
        this.interaction = new Interaction(this);
        this.shortcuts = new Shortcuts(this);
    }
    
    startAnimation() {
        this.clock = new THREE.Clock();
        this.lastTime = 0;
        this.frameCount = 0;
        
        this.animate();
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        const delta = this.clock.getDelta();
        const elapsed = this.clock.getElapsedTime();
        
        this.frameCount++;
        if (elapsed - this.lastTime >= 1) {
            const fps = Math.round(this.frameCount / (elapsed - this.lastTime));
            document.getElementById('fps-counter').textContent = fps + ' FPS';
            this.frameCount = 0;
            this.lastTime = elapsed;
        }
        
        if (this.state.isPlaying) {
            this.state.time += delta;
            this.waterSurface.update(this.state.time, this.state.wave);
        }
        
        this.rainEffect.update(delta);
        
        this.audioReactive.update(delta);
        
        this.mediaInput.update();
        
        if (this.state.media.waterMode === 'media' && this.mediaInput.hasWaterVideo()) {
            this.ui?.updateVideoTimeDisplay();
        }
        
        this.lightManager.update(this.state.light, this.state.multiLight);
        this.waterSurface.updateLightInfo(this.state.light);
        this.waterSurface.setLightDirection(this.lightManager.getDirection());
        this.waterSurface.updateMultiLight(this.state.multiLight, this.state.light);
        
        this.causticsRenderer.render(this.state.time, this.state);
        
        this.controls.update();
        
        if (this.state.effects.fog) {
            this.volumetricFog.setEnabled(true);
            this.volumetricFog.setDensity(this.state.effects.fogDensity);
            this.volumetricFog.setScattering(this.state.effects.fogScattering);
            this.volumetricFog.setAnisotropy(this.state.effects.fogAnisotropy);
            this.volumetricFog.setSteps(this.state.effects.fogSteps);
            this.volumetricFog.setWaterLevel(0);
            this.volumetricFog.setFloorLevel(-this.state.scene.depth);
            this.volumetricFog.setPoolSize(this.state.scene.poolSize);
            this.volumetricFog.setLightDirection(this.lightManager.getDirection());
            this.volumetricFog.setLightColor(this.state.light.color);
            this.volumetricFog.setLightIntensity(this.state.light.intensity);
            this.volumetricFog.setLightPosition(this.lightManager.getPosition());
            this.volumetricFog.setShowLightRays(this.state.effects.lightRays);
            this.volumetricFog.setLightRayIntensity(this.state.effects.lightRayIntensity);
            this.volumetricFog.setIsPointLight(this.state.light.type === 'point');
            
            const fogTarget = this.volumetricFog.getSceneTarget();
            const depthTarget = this.volumetricFog.getDepthTarget();
            const depthMaterial = this.volumetricFog.getDepthMaterial();
            
            const waterMesh = this.waterSurface.getMesh();
            waterMesh.visible = false;
            
            this.renderer.setRenderTarget(depthTarget);
            this.renderer.setClearColor(new THREE.Color(1, 1, 1), 1);
            this.renderer.clear(true, true, false);
            this.scene.overrideMaterial = depthMaterial;
            this.renderer.render(this.scene, this.camera);
            this.scene.overrideMaterial = null;
            
            waterMesh.visible = true;
            
            this.renderer.setRenderTarget(fogTarget);
            this.renderer.render(this.scene, this.camera);
            this.renderer.setRenderTarget(null);
            
            if (this.state.effects.bloom) {
                this.bloomEffect.resize(this.container.clientWidth, this.container.clientHeight);
                this.bloomEffect.setEnabled(true);
                
                if (!this.fogResultTarget) {
                    this.fogResultTarget = new THREE.WebGLRenderTarget(
                        this.container.clientWidth,
                        this.container.clientHeight,
                        { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, type: THREE.HalfFloatType }
                    );
                }
                
                this.volumetricFog.render(fogTarget.texture, this.state.time, this.fogResultTarget);
                this.bloomEffect.render(this.fogResultTarget.texture, null);
            } else if (this.state.effects.temporalReprojection) {
                this.temporalReprojection.resize(this.container.clientWidth, this.container.clientHeight);
                this.temporalReprojection.setEnabled(true);
                
                if (!this.fogResultTarget) {
                    this.fogResultTarget = new THREE.WebGLRenderTarget(
                        this.container.clientWidth,
                        this.container.clientHeight,
                        { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, type: THREE.HalfFloatType }
                    );
                }
                
                this.volumetricFog.render(fogTarget.texture, this.state.time, this.fogResultTarget);
                this.temporalReprojection.render(this.fogResultTarget.texture, depthTarget.texture, this.camera, null);
            } else {
                this.volumetricFog.render(fogTarget.texture, this.state.time, null);
            }
        } else {
            this.volumetricFog.setEnabled(false);
            
            if (this.state.effects.bloom || this.state.effects.chromaticAberration) {
                this.bloomEffect?.resize(this.container.clientWidth, this.container.clientHeight);
                this.chromaticAberration?.resize(this.container.clientWidth, this.container.clientHeight);
                
                if (!this.sceneTarget) {
                    this.sceneTarget = new THREE.WebGLRenderTarget(
                        this.container.clientWidth,
                        this.container.clientHeight,
                        { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, type: THREE.HalfFloatType }
                    );
                }
                
                if (!this.effectTarget) {
                    this.effectTarget = new THREE.WebGLRenderTarget(
                        this.container.clientWidth,
                        this.container.clientHeight,
                        { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, type: THREE.HalfFloatType }
                    );
                }
                
                this.renderer.setRenderTarget(this.sceneTarget);
                this.renderer.render(this.scene, this.camera);
                
                let currentTexture = this.sceneTarget.texture;
                
                if (this.state.effects.bloom) {
                    this.bloomEffect.setEnabled(true);
                    this.bloomEffect.render(currentTexture, this.effectTarget);
                    currentTexture = this.effectTarget.texture;
                } else {
                    this.bloomEffect.setEnabled(false);
                }
                
                if (this.state.effects.chromaticAberration) {
                    this.chromaticAberration.setEnabled(true);
                    this.chromaticAberration.render(currentTexture, null);
                } else {
                    this.chromaticAberration.setEnabled(false);
                    this.chromaticAberration.render(currentTexture, null);
                }
            } else {
                this.renderer.render(this.scene, this.camera);
            }
        }
    }
    
    onResize() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        
        this.renderer.setSize(width, height);
        this.volumetricFog?.resize(width, height);
        this.bloomEffect?.resize(width, height);
        this.temporalReprojection?.resize(width, height);
        this.chromaticAberration?.resize(width, height);
        
        if (this.sceneTarget) {
            this.sceneTarget.setSize(width, height);
        }
        
        if (this.fogResultTarget) {
            this.fogResultTarget.setSize(width, height);
        }
    }
    
    play() {
        this.state.isPlaying = true;
        this.ui?.setStatus('Playing');
    }
    
    pause() {
        this.state.isPlaying = false;
        this.ui?.setStatus('Paused');
    }
    
    reset() {
        this.state.time = 0;
        this.waterSurface.update(0, this.state.wave);
        this.ui?.setStatus('Reset');
    }
    
    setView(viewName) {
        const views = {
            default: { position: [8, 6, 8], target: [0, -1, 0] },
            top: { position: [0, 12, 0.1], target: [0, -2, 0] },
            side: { position: [15, 2, 0], target: [0, -1, 0] },
            underwater: { position: [0, -3, 5], target: [0, 0, 0] }
        };
        
        const view = views[viewName];
        if (view) {
            this.camera.position.set(...view.position);
            this.controls.target.set(...view.target);
            this.controls.update();
        }
    }
    
    toggleInteractionMode() {
        this.state.interactionMode = !this.state.interactionMode;
        this.controls.enabled = !this.state.interactionMode;
        return this.state.interactionMode;
    }
    
    loadPreset(name) {
        const preset = this.presets[name];
        if (!preset) return;
        
        this.state.scene = { depth: 2, poolSize: 10, floorColor: '#1a1a2e', waterColor: '#4488aa' };
        this.state.wave = { amplitude: 0.3, frequency: 2.0, speed: 1.0, type: 'perlin', direction: 0, edgeDamping: 0, layerCount: 1, opacity: 0.8, useHeightGradient: false, waterColorLow: '#1a3a5c', waterColorHigh: '#88ccff' };
        this.state.light = { azimuth: 45, elevation: 60, intensity: 1.5, color: '#FFFFFF', type: 'directional', pointPosition: { x: 0, y: 5, z: 0 }, pointRadius: 10, animate: false, animationSpeed: 1.0, animationType: 'orbit', causticsTint: '#FFFFFF', causticsTintStrength: 0 };
        this.state.material = { ior: 1.33, dispersion: 0, clarity: 0.8 };
        this.state.display = { showWater: true, showFloor: true, showLightHelper: false, wireframe: false, waterResolution: 128, causticsResolution: 256, backgroundColor: '#b5b5b5', showWalls: true };
        this.state.effects = { godRays: false, godRaysIntensity: 0.5, godRaysDecay: 0.95, godRaysSamples: 50, fog: false, fogDensity: 1.0, fogScattering: 1.0, fogAnisotropy: 0.3, fogSteps: 32, lightRays: false, lightRayIntensity: 1.0, bloom: false, bloomIntensity: 0.5, bloomThreshold: 0.8, bloomSoftKnee: 0.2, bloomRadius: 1.0, temporalReprojection: false, temporalBlend: 0.1, feedbackMin: 0.9, feedbackMax: 0.95, varianceGamma: 1.0, chromaticAberration: false, chromaticStrength: 5.0, chromaticRadial: true };
        
        this.setBloom(false);
        this.setChromaticAberration(false);
        this.setFog(false);
        this.floorPlane?.setWallsVisible(true);
        this.floorPlane?.setVisible(true);
        this.setWaterResolution(128);
        this.scene.background = new THREE.Color('#b5b5b5');
        
        Object.assign(this.state.scene, preset.scene);
        Object.assign(this.state.wave, preset.wave);
        Object.assign(this.state.light, preset.light);
        Object.assign(this.state.material, preset.material);
        
        if (preset.display) {
            Object.assign(this.state.display, preset.display);
            if (preset.display.showWalls !== undefined) {
                this.floorPlane?.setWallsVisible(preset.display.showWalls);
            }
            if (preset.display.showFloor !== undefined) {
                this.floorPlane?.setVisible(preset.display.showFloor);
            }
            if (preset.display.waterResolution !== undefined) {
                this.setWaterResolution(preset.display.waterResolution);
            }
        }
        
        if (preset.effects) {
            Object.assign(this.state.effects, preset.effects);
            if (preset.effects.bloom !== undefined) {
                this.setBloom(preset.effects.bloom, preset.effects.bloomIntensity, preset.effects.bloomThreshold, preset.effects.bloomSoftKnee, preset.effects.bloomRadius);
            }
            if (preset.effects.chromaticAberration !== undefined) {
                this.setChromaticAberration(preset.effects.chromaticAberration, preset.effects.chromaticStrength, preset.effects.chromaticRadial);
            }
            if (preset.effects.fog !== undefined) {
                this.setFog(preset.effects.fog);
                if (preset.effects.fogDensity) this.setFogDensity(preset.effects.fogDensity);
                if (preset.effects.fogScattering) this.setFogScattering(preset.effects.fogScattering);
            }
        }
        
        if (preset.scene.poolSize) {
            this.waterSurface?.setPoolSize(preset.scene.poolSize);
            this.floorPlane?.setPoolSize(preset.scene.poolSize);
        }
        
        this.floorPlane.updateColors(this.state.scene);
        this.waterSurface.updateMaterial(this.state);
        this.lightManager.update(this.state.light);
        
        this.ui?.syncFromState();
        this.ui?.setStatus(`Loaded: ${name}`);
    }
    
    exportScreenshot() {
        this.renderer.render(this.scene, this.camera);
        const link = document.createElement('a');
        link.download = 'caustics-3d.png';
        link.href = this.renderer.domElement.toDataURL('image/png');
        link.click();
        this.ui?.setStatus('Screenshot saved');
    }
    
    exportCausticsTexture() {
        const texture = this.causticsRenderer.getCausticsTexture();
        if (texture) {
            const link = document.createElement('a');
            link.download = 'caustics-texture.png';
            link.href = texture;
            link.click();
            this.ui?.setStatus('Caustics texture saved');
        }
    }
    
    async loadLightMedia(file) {
        try {
            const isVideo = file.type.startsWith('video');
            const texture = isVideo 
                ? await this.mediaInput.loadLightVideo(file)
                : await this.mediaInput.loadLightImage(file);
            
            this.causticsRenderer.setLightTexture(texture);
            this.causticsRenderer.setLightMode('media');
            this.state.media.lightMode = 'media';
            this.ui?.setStatus(`Light ${isVideo ? 'video' : 'image'} loaded`);
        } catch (err) {
            console.error('Failed to load light media:', err);
            this.ui?.setStatus('Failed to load light media');
        }
    }
    
    async loadWaterMedia(file) {
        try {
            const isVideo = file.type.startsWith('video');
            const texture = isVideo 
                ? await this.mediaInput.loadWaterVideo(file)
                : await this.mediaInput.loadWaterImage(file);
            
            this.waterSurface.setDisplacementTexture(texture);
            this.waterSurface.setDisplacementMode('media');
            this.state.media.waterMode = 'media';
            this.ui?.setStatus(`Water ${isVideo ? 'video' : 'image'} loaded`);
            if (isVideo) {
                this.ui?.showVideoControls(true);
            }
        } catch (err) {
            console.error('Failed to load water media:', err);
            this.ui?.setStatus('Failed to load water media');
        }
    }
    
    setLightMode(mode) {
        this.state.media.lightMode = mode;
        this.mediaInput.setLightMode(mode);
        this.causticsRenderer.setLightMode(mode);
    }
    
    setWaterMode(mode) {
        this.state.media.waterMode = mode;
        this.mediaInput.setWaterMode(mode);
        this.waterSurface.setDisplacementMode(mode);
    }
    
    setLightChannel(channel) {
        this.state.media.lightChannel = channel;
        this.causticsRenderer.setLightChannel(channel);
    }
    
    setWaterChannel(channel) {
        this.state.media.waterChannel = channel;
        this.mediaInput.setWaterChannel(channel);
        
        if (channel === 'motion') {
            const motionTexture = this.mediaInput.getMotionTexture();
            if (motionTexture) {
                this.waterSurface.setDisplacementTexture(motionTexture);
            }
        } else {
            if (this.mediaInput.waterTexture) {
                this.waterSurface.setDisplacementTexture(this.mediaInput.waterTexture);
            }
        }
        
        this.waterSurface.setDisplacementChannel(channel);
        this.ui?.toggleMotionSensitivityControl(channel === 'motion');
    }
    
    setMotionSensitivity(sensitivity) {
        this.mediaInput.setMotionSensitivity(sensitivity);
    }
    
    setWaterInfluence(influence) {
        this.state.media.waterInfluence = influence;
        this.waterSurface.setDisplacementInfluence(influence);
    }
    
    setWaterResolution(resolution) {
        this.state.display.waterResolution = resolution;
        this.waterSurface.setGeometryResolution(resolution);
        this.causticsRenderer.setGridResolution(resolution);
    }
    
    setCausticsResolution(resolution) {
        this.state.display.causticsResolution = resolution;
        this.causticsRenderer.setResolution(resolution);
    }
    
    setBackgroundColor(color) {
        this.state.display.backgroundColor = color;
        this.scene.background = new THREE.Color(color);
    }
    
    clearLightMedia() {
        this.mediaInput.setLightMode('solid');
        this.causticsRenderer.setLightMode('solid');
        this.causticsRenderer.setLightTexture(null);
        this.state.media.lightMode = 'solid';
        this.ui?.setStatus('Light media cleared');
    }
    
    clearWaterMedia() {
        this.mediaInput.stopWebcam();
        this.mediaInput.setWaterMode('procedural');
        this.waterSurface.setDisplacementMode('procedural');
        this.waterSurface.setDisplacementTexture(null);
        this.state.media.waterMode = 'procedural';
        this.ui?.setStatus('Water media cleared');
        this.ui?.updateWebcamButton(false);
        this.ui?.showVideoControls(false);
    }
    
    async toggleWebcam() {
        if (this.mediaInput.isWebcamActive()) {
            this.mediaInput.stopWebcam();
            this.waterSurface.setDisplacementTexture(null);
            this.waterSurface.setDisplacementMode('procedural');
            this.state.media.waterMode = 'procedural';
            this.ui?.setStatus('Webcam stopped');
            this.ui?.updateWebcamButton(false);
        } else {
            try {
                const texture = await this.mediaInput.startWebcam();
                this.waterSurface.setDisplacementTexture(texture);
                this.waterSurface.setDisplacementMode('media');
                this.state.media.waterMode = 'webcam';
                this.ui?.setStatus('Webcam active');
                this.ui?.updateWebcamButton(true);
                
                if (this.state.media.waterChannel === 'motion') {
                    const motionTexture = this.mediaInput.getMotionTexture();
                    if (motionTexture) {
                        this.waterSurface.setDisplacementTexture(motionTexture);
                    }
                }
            } catch (err) {
                console.error('Failed to start webcam:', err);
                this.ui?.setStatus('Webcam access denied or unavailable');
            }
        }
    }
    
    setLightType(type) {
        this.state.light.type = type;
        this.lightManager.update(this.state.light);
        this.causticsRenderer.setLightType(type);
    }
    
    setPointLightPosition(x, y, z) {
        this.state.light.pointPosition = { x, y, z };
        this.lightManager.setPointPosition(x, y, z);
        this.causticsRenderer.setPointLightPosition(x, y, z);
    }
    
    setPointLightRadius(radius) {
        this.state.light.pointRadius = radius;
        this.causticsRenderer.setPointLightRadius(radius);
    }
    
    setLightAnimation(enabled, speed, type) {
        this.state.light.animate = enabled;
        if (speed !== undefined) this.state.light.animationSpeed = speed;
        if (type !== undefined) this.state.light.animationType = type;
        this.lightManager.setAnimation(enabled, speed, type);
    }
    
    setCausticsTint(color, strength) {
        this.state.light.causticsTint = color;
        this.state.light.causticsTintStrength = strength;
        this.causticsRenderer.setCausticsTint(color, strength);
    }
    
    setMultiLight(enabled, count) {
        if (enabled !== undefined) this.state.multiLight.enabled = enabled;
        if (count !== undefined) this.state.multiLight.count = Math.min(count, 4);
        this.lightManager.update(this.state.light, this.state.multiLight);
        this.waterSurface.updateMultiLight(this.state.multiLight, this.state.light);
    }
    
    setMultiLightParams(lightIndex, params) {
        if (this.state.multiLight.lights[lightIndex]) {
            Object.assign(this.state.multiLight.lights[lightIndex], params);
            if (this.state.multiLight.enabled) {
                this.lightManager.update(this.state.light, this.state.multiLight);
                this.waterSurface.updateMultiLight(this.state.multiLight, this.state.light);
            }
        }
    }
    
    setDispersion(dispersion) {
        this.state.material.dispersion = dispersion;
        this.causticsRenderer.setDispersion(dispersion);
    }
    
    setGodRays(enabled, intensity, decay, samples) {
        this.state.effects.godRays = enabled;
        if (intensity !== undefined) this.state.effects.godRaysIntensity = intensity;
        if (decay !== undefined) this.state.effects.godRaysDecay = decay;
        if (samples !== undefined) this.state.effects.godRaysSamples = samples;
        this.causticsRenderer.setGodRays(enabled, intensity, decay, samples);
    }
    
    setFog(enabled) {
        this.state.effects.fog = enabled;
        this.volumetricFog?.setEnabled(enabled);
    }
    
    setFogDensity(density) {
        this.state.effects.fogDensity = density;
        this.volumetricFog?.setDensity(density);
    }
    
    setFogScattering(scattering) {
        this.state.effects.fogScattering = scattering;
        this.volumetricFog?.setScattering(scattering);
    }
    
    setFogAnisotropy(anisotropy) {
        this.state.effects.fogAnisotropy = anisotropy;
        this.volumetricFog?.setAnisotropy(anisotropy);
    }
    
    setFogSteps(steps) {
        this.state.effects.fogSteps = steps;
        this.volumetricFog?.setSteps(steps);
    }
    
    setFogDebugMode(mode) {
        this.volumetricFog?.setDebugMode(mode);
    }
    
    setLightRays(enabled) {
        this.state.effects.lightRays = enabled;
        this.volumetricFog?.setShowLightRays(enabled);
    }
    
    setLightRayIntensity(intensity) {
        this.state.effects.lightRayIntensity = intensity;
        this.volumetricFog?.setLightRayIntensity(intensity);
    }
    
    setBloom(enabled, intensity, threshold, softKnee, radius) {
        this.state.effects.bloom = enabled;
        if (intensity !== undefined) {
            this.state.effects.bloomIntensity = intensity;
            this.bloomEffect?.setIntensity(intensity);
        }
        if (threshold !== undefined) {
            this.state.effects.bloomThreshold = threshold;
            this.bloomEffect?.setThreshold(threshold);
        }
        if (softKnee !== undefined) {
            this.state.effects.bloomSoftKnee = softKnee;
            this.bloomEffect?.setSoftKnee(softKnee);
        }
        if (radius !== undefined) {
            this.state.effects.bloomRadius = radius;
            this.bloomEffect?.setRadius(radius);
        }
        this.bloomEffect?.setEnabled(enabled);
    }
    
    setTemporalReprojection(enabled, blend, feedbackMin, feedbackMax, gamma) {
        this.state.effects.temporalReprojection = enabled;
        if (blend !== undefined) {
            this.state.effects.temporalBlend = blend;
            this.temporalReprojection?.setTemporalBlend(blend);
        }
        if (feedbackMin !== undefined) {
            this.state.effects.feedbackMin = feedbackMin;
            this.temporalReprojection?.setFeedbackMin(feedbackMin);
        }
        if (feedbackMax !== undefined) {
            this.state.effects.feedbackMax = feedbackMax;
            this.temporalReprojection?.setFeedbackMax(feedbackMax);
        }
        if (gamma !== undefined) {
            this.state.effects.varianceGamma = gamma;
            this.temporalReprojection?.setVarianceGamma(gamma);
        }
        this.temporalReprojection?.setEnabled(enabled);
        if (enabled) {
            this.temporalReprojection?.reset();
        }
    }
    
    setChromaticAberration(enabled, strength, radial) {
        this.state.effects.chromaticAberration = enabled;
        if (strength !== undefined) {
            this.state.effects.chromaticStrength = strength;
            this.chromaticAberration?.setStrength(strength);
        }
        if (radial !== undefined) {
            this.state.effects.chromaticRadial = radial;
            this.chromaticAberration?.setRadial(radial);
        }
        this.chromaticAberration?.setEnabled(enabled);
    }
    
    setWaveDirection(direction) {
        this.state.wave.direction = direction;
        this.waterSurface.setWaveDirection(direction);
    }
    
    setEdgeDamping(damping) {
        this.state.wave.edgeDamping = damping;
        this.waterSurface.setEdgeDamping(damping);
    }
    
    setLayerCount(count) {
        this.state.wave.layerCount = count;
        this.waterSurface.setLayerCount(count);
    }
    
    setLayerParams(layerIndex, params) {
        if (this.state.wave.layers[layerIndex]) {
            Object.assign(this.state.wave.layers[layerIndex], params);
            this.waterSurface.setLayerParams(layerIndex, params);
        }
    }
    
    setFloorPattern(pattern) {
        this.state.scene.floorPattern = pattern;
        this.floorPlane.setFloorPattern(pattern);
    }
    
    setPatternScale(scale) {
        this.state.scene.patternScale = scale;
        this.floorPlane.setPatternScale(scale);
    }
    
    setShowHeatmap(show) {
        this.state.debug.showHeatmap = show;
        this.floorPlane.setShowHeatmap(show);
    }
    
    setHeatmapScale(scale) {
        this.state.debug.heatmapScale = scale;
        this.floorPlane.setHeatmapScale(scale);
    }
    
    setShowNormals(show) {
        this.state.debug.showNormals = show;
        this.waterSurface.setShowNormals(show);
    }
    
    setInteractionEnabled(enabled) {
        this.state.interaction.enabled = enabled;
        this.interaction.setEnabled(enabled);
    }
    
    setRippleParams(strength, radius, decay) {
        this.interaction.setRippleParams(strength, radius, decay);
    }
    
    clearRipples() {
        this.interaction.clearRipples();
    }
    
    setRainEnabled(enabled) {
        this.state.rain.enabled = enabled;
        this.rainEffect.setEnabled(enabled);
    }
    
    setRainSettings(settings) {
        if (settings.intensity !== undefined) this.state.rain.intensity = settings.intensity;
        if (settings.dropSpeed !== undefined) this.state.rain.dropSpeed = settings.dropSpeed;
        if (settings.dropSize !== undefined) this.state.rain.dropSize = settings.dropSize;
        if (settings.windX !== undefined) this.state.rain.windX = settings.windX;
        if (settings.windZ !== undefined) this.state.rain.windZ = settings.windZ;
        this.rainEffect.setSettings(settings);
    }
    
    async setAudioEnabled(enabled) {
        this.state.audio.enabled = enabled;
        await this.audioReactive.setEnabled(enabled);
    }
    
    setAudioSettings(settings) {
        if (settings.sensitivity !== undefined) this.state.audio.sensitivity = settings.sensitivity;
        if (settings.smoothing !== undefined) this.state.audio.smoothing = settings.smoothing;
        if (settings.amplitudeEnabled !== undefined) this.state.audio.amplitudeEnabled = settings.amplitudeEnabled;
        if (settings.amplitudeBand !== undefined) this.state.audio.amplitudeBand = settings.amplitudeBand;
        if (settings.amplitudeMultiplier !== undefined) this.state.audio.amplitudeMultiplier = settings.amplitudeMultiplier;
        if (settings.frequencyEnabled !== undefined) this.state.audio.frequencyEnabled = settings.frequencyEnabled;
        if (settings.frequencyBand !== undefined) this.state.audio.frequencyBand = settings.frequencyBand;
        if (settings.frequencyMultiplier !== undefined) this.state.audio.frequencyMultiplier = settings.frequencyMultiplier;
        if (settings.speedEnabled !== undefined) this.state.audio.speedEnabled = settings.speedEnabled;
        if (settings.speedBand !== undefined) this.state.audio.speedBand = settings.speedBand;
        if (settings.speedMultiplier !== undefined) this.state.audio.speedMultiplier = settings.speedMultiplier;
        
        this.audioReactive.setSettings({
            sensitivity: settings.sensitivity,
            smoothing: settings.smoothing
        });
        
        if (settings.amplitudeEnabled !== undefined || settings.amplitudeBand !== undefined || settings.amplitudeMultiplier !== undefined) {
            this.audioReactive.setTargetParam('amplitude', settings.amplitudeBand, settings.amplitudeMultiplier, settings.amplitudeEnabled);
        }
        if (settings.frequencyEnabled !== undefined || settings.frequencyBand !== undefined || settings.frequencyMultiplier !== undefined) {
            this.audioReactive.setTargetParam('frequency', settings.frequencyBand, settings.frequencyMultiplier, settings.frequencyEnabled);
        }
        if (settings.speedEnabled !== undefined || settings.speedBand !== undefined || settings.speedMultiplier !== undefined) {
            this.audioReactive.setTargetParam('speed', settings.speedBand, settings.speedMultiplier, settings.speedEnabled);
        }
    }
}
