import * as THREE from 'three';

const motionVertexShader = `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
    }
`;

const motionFragmentShader = `
    precision highp float;
    
    uniform sampler2D tDepth;
    uniform mat4 uPrevViewProjection;
    uniform mat4 uCurrViewProjection;
    uniform mat4 uInverseView;
    uniform float uNear;
    uniform float uFar;
    
    varying vec2 vUv;
    
    float getLinearDepth(float rawDepth) {
        float z = rawDepth * 2.0 - 1.0;
        return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));
    }
    
    vec3 getWorldPos(vec2 uv, float depth) {
        float z = depth * 2.0 - 1.0;
        vec4 clipPos = vec4(uv * 2.0 - 1.0, z, 1.0);
        vec4 viewPos = uInverseView * clipPos;
        return viewPos.xyz / viewPos.w;
    }
    
    void main() {
        float rawDepth = texture2D(tDepth, vUv).r;
        
        if (rawDepth >= 0.999) {
            gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
            return;
        }
        
        vec3 worldPos = getWorldPos(vUv, rawDepth);
        
        vec4 currPos = uCurrViewProjection * vec4(worldPos, 1.0);
        vec4 prevPos = uPrevViewProjection * vec4(worldPos, 1.0);
        
        currPos.xyz /= currPos.w;
        prevPos.xyz /= prevPos.w;
        
        vec2 motion = (currPos.xy - prevPos.xy) * 0.5;
        
        gl_FragColor = vec4(motion, 0.0, 1.0);
    }
`;

const temporalVertexShader = `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
    }
`;

const temporalFragmentShader = `
    precision highp float;
    
    uniform sampler2D tCurrentFog;
    uniform sampler2D tHistoryFog;
    uniform sampler2D tMotionVectors;
    uniform sampler2D tDepth;
    uniform float uTemporalBlend;
    uniform float uFeedbackMin;
    uniform float uFeedbackMax;
    uniform float uVarianceGamma;
    uniform vec2 uTexelSize;
    
    varying vec2 vUv;
    
    void main() {
        vec2 uv = vUv;
        
        vec3 currentFog = texture2D(tCurrentFog, uv).rgb;
        
        vec2 motion = texture2D(tMotionVectors, uv).rg;
        vec2 prevUv = uv - motion;
        
        float validHistory = step(0.0, prevUv.x) * step(prevUv.x, 1.0) *
                             step(0.0, prevUv.y) * step(prevUv.y, 1.0);
        
        vec3 historyFog = texture2D(tHistoryFog, clamp(prevUv, 0.001, 0.999), 0.0).rgb;
        
        vec3 minColor = vec3(1e6);
        vec3 maxColor = vec3(-1e6);
        vec3 mean = vec3(0.0);
        vec3 variance = vec3(0.0);
        
        for (int x = -1; x <= 1; x++) {
            for (int y = -1; y <= 1; y++) {
                vec2 offset = vec2(float(x), float(y)) * uTexelSize;
                vec3 sample = texture2D(tCurrentFog, uv + offset).rgb;
                minColor = min(minColor, sample);
                maxColor = max(maxColor, sample);
                mean += sample;
                variance += sample * sample;
            }
        }
        
        mean /= 9.0;
        variance = variance / 9.0 - mean * mean;
        
        vec3 stdDev = sqrt(max(variance, 0.0));
        vec3 boxMin = mean - uVarianceGamma * stdDev;
        vec3 boxMax = mean + uVarianceGamma * stdDev;
        
        historyFog = clamp(historyFog, max(minColor, boxMin), min(maxColor, boxMax));
        
        float feedback = mix(uFeedbackMin, uFeedbackMax, validHistory);
        vec3 result = mix(historyFog, currentFog, 1.0 - feedback);
        
        gl_FragColor = vec4(result, 1.0);
    }
`;

export class TemporalReprojection {
    constructor(renderer, options = {}) {
        this.renderer = renderer;
        this.enabled = false;
        
        this.settings = {
            temporalBlend: options.temporalBlend ?? 0.1,
            feedbackMin: options.feedbackMin ?? 0.9,
            feedbackMax: options.feedbackMax ?? 0.95,
            varianceGamma: options.varianceGamma ?? 1.0
        };
        
        this.width = 0;
        this.height = 0;
        
        this.motionMaterial = null;
        this.temporalMaterial = null;
        
        this.motionTarget = null;
        this.historyTargets = [null, null];
        this.currentHistoryIndex = 0;
        
        this.fullscreenQuad = null;
        this.orthoScene = null;
        this.orthoCamera = null;
        
        this.prevViewProjection = new THREE.Matrix4();
        this.currViewProjection = new THREE.Matrix4();
        this.firstFrame = true;
        
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
        this.motionMaterial = new THREE.ShaderMaterial({
            uniforms: {
                tDepth: { value: null },
                uPrevViewProjection: { value: new THREE.Matrix4() },
                uCurrViewProjection: { value: new THREE.Matrix4() },
                uInverseView: { value: new THREE.Matrix4() },
                uNear: { value: 0.1 },
                uFar: { value: 100 }
            },
            vertexShader: motionVertexShader,
            fragmentShader: motionFragmentShader
        });
        
        this.temporalMaterial = new THREE.ShaderMaterial({
            uniforms: {
                tCurrentFog: { value: null },
                tHistoryFog: { value: null },
                tMotionVectors: { value: null },
                tDepth: { value: null },
                uTemporalBlend: { value: this.settings.temporalBlend },
                uFeedbackMin: { value: this.settings.feedbackMin },
                uFeedbackMax: { value: this.settings.feedbackMax },
                uVarianceGamma: { value: this.settings.varianceGamma },
                uTexelSize: { value: new THREE.Vector2(1, 1) }
            },
            vertexShader: temporalVertexShader,
            fragmentShader: temporalFragmentShader
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
        
        this.motionTarget = new THREE.WebGLRenderTarget(w, h, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            type: THREE.HalfFloatType
        });
        
        for (let i = 0; i < 2; i++) {
            this.historyTargets[i] = new THREE.WebGLRenderTarget(w, h, {
                minFilter: THREE.LinearFilter,
                magFilter: THREE.LinearFilter,
                format: THREE.RGBAFormat,
                type: THREE.HalfFloatType
            });
        }
        
        this.firstFrame = true;
    }
    
    disposeTargets() {
        this.motionTarget?.dispose();
        this.historyTargets.forEach(t => t?.dispose());
        
        this.motionTarget = null;
        this.historyTargets = [null, null];
    }
    
    computeMotionVectors(depthTexture, camera) {
        this.motionMaterial.uniforms.tDepth.value = depthTexture;
        this.motionMaterial.uniforms.uPrevViewProjection.value.copy(this.prevViewProjection);
        this.motionMaterial.uniforms.uCurrViewProjection.value.copy(this.currViewProjection);
        this.motionMaterial.uniforms.uInverseView.value.copy(camera.matrixWorld);
        this.motionMaterial.uniforms.uNear.value = camera.near;
        this.motionMaterial.uniforms.uFar.value = camera.far;
        
        this.fullscreenQuad.material = this.motionMaterial;
        this.renderer.setRenderTarget(this.motionTarget);
        this.renderer.render(this.orthoScene, this.orthoCamera);
    }
    
    render(currentFogTexture, depthTexture, camera, outputTarget = null) {
        if (!this.enabled) {
            return currentFogTexture;
        }
        
        if (!this.motionTarget || !this.historyTargets[0]) {
            return currentFogTexture;
        }
        
        this.currViewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        
        this.computeMotionVectors(depthTexture, camera);
        
        const historyIndex = this.currentHistoryIndex;
        const historyTarget = this.historyTargets[historyIndex];
        
        if (this.firstFrame) {
            this.fullscreenQuad.material = this.temporalMaterial;
            this.temporalMaterial.uniforms.tCurrentFog.value = currentFogTexture;
            this.temporalMaterial.uniforms.tHistoryFog.value = currentFogTexture;
            this.temporalMaterial.uniforms.tMotionVectors.value = this.motionTarget.texture;
            this.temporalMaterial.uniforms.tDepth.value = depthTexture;
            this.temporalMaterial.uniforms.uTexelSize.value.set(1 / this.width, 1 / this.height);
            
            this.renderer.setRenderTarget(historyTarget);
            this.renderer.render(this.orthoScene, this.orthoCamera);
            
            this.firstFrame = false;
        } else {
            const prevHistoryIndex = 1 - historyIndex;
            const prevHistoryTarget = this.historyTargets[prevHistoryIndex];
            
            this.fullscreenQuad.material = this.temporalMaterial;
            this.temporalMaterial.uniforms.tCurrentFog.value = currentFogTexture;
            this.temporalMaterial.uniforms.tHistoryFog.value = prevHistoryTarget.texture;
            this.temporalMaterial.uniforms.tMotionVectors.value = this.motionTarget.texture;
            this.temporalMaterial.uniforms.tDepth.value = depthTexture;
            this.temporalMaterial.uniforms.uTexelSize.value.set(1 / this.width, 1 / this.height);
            
            this.renderer.setRenderTarget(historyTarget);
            this.renderer.render(this.orthoScene, this.orthoCamera);
        }
        
        this.prevViewProjection.copy(this.currViewProjection);
        this.currentHistoryIndex = 1 - this.currentHistoryIndex;
        
        this.renderer.setRenderTarget(outputTarget);
        this.fullscreenQuad.material = this.temporalMaterial;
        this.temporalMaterial.uniforms.tCurrentFog.value = currentFogTexture;
        this.temporalMaterial.uniforms.tHistoryFog.value = historyTarget.texture;
        this.renderer.render(this.orthoScene, this.orthoCamera);
        
        return historyTarget.texture;
    }
    
    setEnabled(enabled) {
        this.enabled = enabled;
        if (enabled) {
            this.firstFrame = true;
        }
    }
    
    setTemporalBlend(blend) {
        this.settings.temporalBlend = blend;
        this.temporalMaterial.uniforms.uTemporalBlend.value = blend;
    }
    
    setFeedbackMin(min) {
        this.settings.feedbackMin = min;
        this.temporalMaterial.uniforms.uFeedbackMin.value = min;
    }
    
    setFeedbackMax(max) {
        this.settings.feedbackMax = max;
        this.temporalMaterial.uniforms.uFeedbackMax.value = max;
    }
    
    setVarianceGamma(gamma) {
        this.settings.varianceGamma = gamma;
        this.temporalMaterial.uniforms.uVarianceGamma.value = gamma;
    }
    
    reset() {
        this.firstFrame = true;
    }
    
    dispose() {
        this.disposeTargets();
        this.motionMaterial?.dispose();
        this.temporalMaterial?.dispose();
        this.fullscreenQuad?.geometry.dispose();
    }
}
