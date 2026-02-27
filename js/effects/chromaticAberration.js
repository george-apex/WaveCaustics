import * as THREE from 'three';

const chromaticVertexShader = `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
    }
`;

const chromaticFragmentShader = `
    precision highp float;
    
    uniform sampler2D tDiffuse;
    uniform float uStrength;
    uniform float uRadial;
    uniform vec2 uCenter;
    uniform vec2 uResolution;
    uniform float uEnabled;
    
    varying vec2 vUv;
    
    void main() {
        if (uEnabled < 0.5) {
            gl_FragColor = texture2D(tDiffuse, vUv);
            return;
        }
        
        vec2 center = uCenter;
        vec2 dir = vUv - center;
        
        float dist = length(dir);
        vec2 normalizedDir = normalize(dir + vec2(0.001));
        
        float aberration = uStrength * 0.01;
        if (uRadial > 0.5) {
            aberration *= dist;
        }
        
        vec2 offsetR = normalizedDir * aberration * 1.0;
        vec2 offsetG = normalizedDir * aberration * 0.5;
        vec2 offsetB = normalizedDir * aberration * 0.0;
        
        float r = texture2D(tDiffuse, vUv + offsetR).r;
        float g = texture2D(tDiffuse, vUv + offsetG).g;
        float b = texture2D(tDiffuse, vUv + offsetB).b;
        float a = texture2D(tDiffuse, vUv).a;
        
        gl_FragColor = vec4(r, g, b, a);
    }
`;

export class ChromaticAberration {
    constructor(renderer, options = {}) {
        this.renderer = renderer;
        this.enabled = false;
        
        this.settings = {
            strength: options.strength ?? 5.0,
            radial: options.radial ?? true,
            center: options.center ?? new THREE.Vector2(0.5, 0.5)
        };
        
        this.width = 0;
        this.height = 0;
        
        this.material = null;
        this.target = null;
        
        this.fullscreenQuad = null;
        this.orthoScene = null;
        this.orthoCamera = null;
        
        this.init();
    }
    
    init() {
        this.createMaterial();
        this.createFullscreenQuad();
        this.createOrthoScene();
    }
    
    createOrthoScene() {
        this.orthoScene = new THREE.Scene();
        this.orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        this.orthoScene.add(this.fullscreenQuad);
    }
    
    createMaterial() {
        this.material = new THREE.ShaderMaterial({
            uniforms: {
                tDiffuse: { value: null },
                uStrength: { value: this.settings.strength },
                uRadial: { value: this.settings.radial ? 1.0 : 0.0 },
                uCenter: { value: this.settings.center },
                uResolution: { value: new THREE.Vector2(512, 512) },
                uEnabled: { value: 0.0 }
            },
            vertexShader: chromaticVertexShader,
            fragmentShader: chromaticFragmentShader
        });
    }
    
    createFullscreenQuad() {
        const geometry = new THREE.PlaneGeometry(2, 2);
        this.fullscreenQuad = new THREE.Mesh(geometry, null);
        this.fullscreenQuad.frustumCulled = false;
    }
    
    resize(width, height) {
        if (this.width === width && this.height === height) return;
        
        this.width = width;
        this.height = height;
        
        this.disposeTargets();
        this.createTargets();
        
        this.material.uniforms.uResolution.value.set(width, height);
    }
    
    createTargets() {
        this.target = new THREE.WebGLRenderTarget(this.width, this.height, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            type: THREE.HalfFloatType
        });
    }
    
    disposeTargets() {
        this.target?.dispose();
        this.target = null;
    }
    
    render(inputTexture, renderTarget) {
        if (!this.target) {
            return inputTexture;
        }
        
        this.material.uniforms.tDiffuse.value = inputTexture;
        this.material.uniforms.uStrength.value = this.settings.strength;
        this.material.uniforms.uRadial.value = this.settings.radial ? 1.0 : 0.0;
        this.material.uniforms.uCenter.value.copy(this.settings.center);
        this.material.uniforms.uEnabled.value = this.enabled ? 1.0 : 0.0;
        
        this.fullscreenQuad.material = this.material;
        this.renderer.setRenderTarget(renderTarget);
        this.renderer.render(this.orthoScene, this.orthoCamera);
        
        return this.target.texture;
    }
    
    setEnabled(enabled) {
        this.enabled = enabled;
    }
    
    setStrength(strength) {
        this.settings.strength = strength;
    }
    
    setRadial(radial) {
        this.settings.radial = radial;
        this.material.uniforms.uRadial.value = radial ? 1.0 : 0.0;
    }
    
    setCenter(x, y) {
        this.settings.center.set(x, y);
    }
    
    dispose() {
        this.disposeTargets();
        this.material?.dispose();
        this.fullscreenQuad?.geometry.dispose();
    }
}
