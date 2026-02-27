import * as THREE from 'three';

const brightnessVertexShader = `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
    }
`;

const brightnessFragmentShader = `
    precision highp float;
    
    uniform sampler2D tDiffuse;
    uniform float uThreshold;
    uniform float uSoftKnee;
    
    varying vec2 vUv;
    
    vec3 extractBright(vec3 color) {
        float brightness = max(color.r, max(color.g, color.b));
        
        float soft = brightness - uThreshold + uSoftKnee;
        soft = clamp(soft, 0.0, 2.0 * uSoftKnee);
        soft = soft * soft / (4.0 * uSoftKnee);
        
        float contribution = max(soft, brightness - uThreshold) / max(brightness, 0.001);
        return color * contribution;
    }
    
    void main() {
        vec4 texel = texture2D(tDiffuse, vUv);
        gl_FragColor = vec4(extractBright(texel.rgb), 1.0);
    }
`;

const blurVertexShader = `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
    }
`;

const blurFragmentShader = `
    precision highp float;
    
    uniform sampler2D tDiffuse;
    uniform vec2 uDirection;
    uniform float uResolution;
    
    varying vec2 vUv;
    
    void main() {
        vec2 texelSize = 1.0 / uResolution;
        vec3 result = vec3(0.0);
        
        float weights[5];
        weights[0] = 0.2270;
        weights[1] = 0.1945;
        weights[2] = 0.1216;
        weights[3] = 0.0540;
        weights[4] = 0.0163;
        
        float offsets[5];
        offsets[0] = 0.0;
        offsets[1] = 1.0;
        offsets[2] = 2.0;
        offsets[3] = 3.0;
        offsets[4] = 4.0;
        
        for (int i = 0; i < 5; i++) {
            vec2 offset = uDirection * texelSize * offsets[i];
            result += texture2D(tDiffuse, vUv + offset).rgb * weights[i];
            if (i > 0) {
                result += texture2D(tDiffuse, vUv - offset).rgb * weights[i];
            }
        }
        
        gl_FragColor = vec4(result, 1.0);
    }
`;

const compositeVertexShader = `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
    }
`;

const compositeFragmentShader = `
    precision highp float;
    
    uniform sampler2D tDiffuse;
    uniform sampler2D tBloom;
    uniform float uIntensity;
    
    varying vec2 vUv;
    
    void main() {
        vec3 sceneColor = texture2D(tDiffuse, vUv).rgb;
        vec3 bloomColor = texture2D(tBloom, vUv).rgb;
        
        vec3 result = sceneColor + bloomColor * uIntensity;
        
        gl_FragColor = vec4(result, 1.0);
    }
`;

export class BloomEffect {
    constructor(renderer, options = {}) {
        this.renderer = renderer;
        this.enabled = false;
        
        this.settings = {
            intensity: options.intensity ?? 0.5,
            threshold: options.threshold ?? 0.8,
            softKnee: options.softKnee ?? 0.2,
            radius: options.radius ?? 1.0,
            mipLevels: options.mipLevels ?? 5
        };
        
        this.width = 0;
        this.height = 0;
        
        this.brightnessMaterial = null;
        this.blurMaterials = [];
        this.compositeMaterial = null;
        
        this.brightnessTarget = null;
        this.blurTargets = [];
        this.compositeTarget = null;
        
        this.fullscreenQuad = null;
        this.orthoScene = null;
        this.orthoCamera = null;
        
        this.init();
    }
    
    init() {
        this.createMaterials();
        this.createFullscreenQuad();
        this.createOrthoScene();
    }
    
    createOrthoScene() {
        this.orthoScene = new THREE.Scene();
        this.orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        this.orthoScene.add(this.fullscreenQuad);
    }
    
    createMaterials() {
        this.brightnessMaterial = new THREE.ShaderMaterial({
            uniforms: {
                tDiffuse: { value: null },
                uThreshold: { value: this.settings.threshold },
                uSoftKnee: { value: this.settings.softKnee }
            },
            vertexShader: brightnessVertexShader,
            fragmentShader: brightnessFragmentShader
        });
        
        for (let i = 0; i < 2; i++) {
            this.blurMaterials.push(new THREE.ShaderMaterial({
                uniforms: {
                    tDiffuse: { value: null },
                    uDirection: { value: new THREE.Vector2(1, 0) },
                    uResolution: { value: 512 }
                },
                vertexShader: blurVertexShader,
                fragmentShader: blurFragmentShader
            }));
        }
        
        this.compositeMaterial = new THREE.ShaderMaterial({
            uniforms: {
                tDiffuse: { value: null },
                tBloom: { value: null },
                uIntensity: { value: this.settings.intensity }
            },
            vertexShader: compositeVertexShader,
            fragmentShader: compositeFragmentShader
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
    }
    
    createTargets() {
        const w = this.width;
        const h = this.height;
        
        this.brightnessTarget = new THREE.WebGLRenderTarget(w, h, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            type: THREE.HalfFloatType
        });
        
        const mipCount = this.settings.mipLevels;
        for (let i = 0; i < mipCount; i++) {
            const scale = Math.pow(0.5, i);
            const mipW = Math.max(1, Math.floor(w * scale));
            const mipH = Math.max(1, Math.floor(h * scale));
            
            for (let j = 0; j < 2; j++) {
                this.blurTargets.push(new THREE.WebGLRenderTarget(mipW, mipH, {
                    minFilter: THREE.LinearFilter,
                    magFilter: THREE.LinearFilter,
                    format: THREE.RGBAFormat,
                    type: THREE.HalfFloatType
                }));
            }
        }
        
        this.compositeTarget = new THREE.WebGLRenderTarget(w, h, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            type: THREE.HalfFloatType
        });
    }
    
    disposeTargets() {
        this.brightnessTarget?.dispose();
        this.blurTargets.forEach(t => t.dispose());
        this.compositeTarget?.dispose();
        
        this.brightnessTarget = null;
        this.blurTargets = [];
        this.compositeTarget = null;
    }
    
    render(inputTexture, renderTarget) {
        if (!this.enabled) {
            return inputTexture;
        }
        
        const mipCount = this.settings.mipLevels;
        if (this.blurTargets.length < mipCount * 2) {
            return inputTexture;
        }
        
        this.brightnessMaterial.uniforms.tDiffuse.value = inputTexture;
        this.brightnessMaterial.uniforms.uThreshold.value = this.settings.threshold;
        this.brightnessMaterial.uniforms.uSoftKnee.value = this.settings.softKnee;
        
        this.fullscreenQuad.material = this.brightnessMaterial;
        this.renderer.setRenderTarget(this.brightnessTarget);
        this.renderer.render(this.orthoScene, this.orthoCamera);
        
        let currentTexture = this.brightnessTarget.texture;
        
        for (let i = 0; i < mipCount; i++) {
            const targetIndex = i * 2;
            const blurH = this.blurTargets[targetIndex];
            const blurV = this.blurTargets[targetIndex + 1];
            
            const scale = Math.pow(0.5, i);
            const res = Math.max(1, Math.floor(this.width * scale));
            
            this.blurMaterials[0].uniforms.tDiffuse.value = currentTexture;
            this.blurMaterials[0].uniforms.uDirection.value.set(this.settings.radius, 0);
            this.blurMaterials[0].uniforms.uResolution.value = res;
            
            this.fullscreenQuad.material = this.blurMaterials[0];
            this.renderer.setRenderTarget(blurH);
            this.renderer.render(this.orthoScene, this.orthoCamera);
            
            this.blurMaterials[1].uniforms.tDiffuse.value = blurH.texture;
            this.blurMaterials[1].uniforms.uDirection.value.set(0, this.settings.radius);
            this.blurMaterials[1].uniforms.uResolution.value = res;
            
            this.fullscreenQuad.material = this.blurMaterials[1];
            this.renderer.setRenderTarget(blurV);
            this.renderer.render(this.orthoScene, this.orthoCamera);
            
            currentTexture = blurV.texture;
        }
        
        this.compositeMaterial.uniforms.tDiffuse.value = inputTexture;
        this.compositeMaterial.uniforms.tBloom.value = currentTexture;
        this.compositeMaterial.uniforms.uIntensity.value = this.settings.intensity;
        
        this.fullscreenQuad.material = this.compositeMaterial;
        this.renderer.setRenderTarget(renderTarget);
        this.renderer.render(this.orthoScene, this.orthoCamera);
        
        return this.compositeTarget.texture;
    }
    
    setEnabled(enabled) {
        this.enabled = enabled;
    }
    
    setIntensity(intensity) {
        this.settings.intensity = intensity;
    }
    
    setThreshold(threshold) {
        this.settings.threshold = threshold;
    }
    
    setSoftKnee(softKnee) {
        this.settings.softKnee = softKnee;
    }
    
    setRadius(radius) {
        this.settings.radius = radius;
    }
    
    dispose() {
        this.disposeTargets();
        this.brightnessMaterial?.dispose();
        this.blurMaterials.forEach(m => m.dispose());
        this.compositeMaterial?.dispose();
        this.fullscreenQuad?.geometry.dispose();
    }
}
