import * as THREE from 'three';

const volumetricFogVertexShader = `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
    }
`;

const volumetricFogFragmentShader = `
    precision highp float;
    
    uniform sampler2D tDiffuse;
    uniform sampler2D tDepth;
    uniform sampler2D tCaustics;
    uniform vec3 uLightDir;
    uniform vec3 uLightColor;
    uniform float uLightIntensity;
    uniform float uFogDensity;
    uniform float uFogScattering;
    uniform float uAnisotropy;
    uniform float uWaterLevel;
    uniform float uFloorLevel;
    uniform float uPoolSize;
    uniform float uTime;
    uniform int uSteps;
    uniform bool uEnabled;
    uniform int uDebugMode;
    uniform mat4 uInverseProjection;
    uniform mat4 uInverseView;
    uniform vec3 uCameraPos;
    uniform float uNear;
    uniform float uFar;
    uniform vec3 uLightPosition;
    uniform bool uShowLightRays;
    uniform float uLightRayIntensity;
    uniform bool uIsPointLight;
    
    varying vec2 vUv;
    
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
    
    float snoise(vec3 v) {
        const vec2 C = vec2(1.0/6.0, 1.0/3.0);
        const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
        vec3 i = floor(v + dot(v, C.yyy));
        vec3 x0 = v - i + dot(i, C.xxx);
        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min(g.xyz, l.zxy);
        vec3 i2 = max(g.xyz, l.zxy);
        vec3 x1 = x0 - i1 + C.xxx;
        vec3 x2 = x0 - i2 + C.yyy;
        vec3 x3 = x0 - D.yyy;
        i = mod289(i);
        vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
        float n_ = 0.142857142857;
        vec3 ns = n_ * D.wyz - D.xzx;
        vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_);
        vec4 x = x_ *ns.x + ns.yyyy;
        vec4 y = y_ *ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);
        vec4 b0 = vec4(x.xy, y.xy);
        vec4 b1 = vec4(x.zw, y.zw);
        vec4 s0 = floor(b0)*2.0 + 1.0;
        vec4 s1 = floor(b1)*2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));
        vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
        vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
        vec3 p0 = vec3(a0.xy, h.x);
        vec3 p1 = vec3(a0.zw, h.y);
        vec3 p2 = vec3(a1.xy, h.z);
        vec3 p3 = vec3(a1.zw, h.w);
        vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
        p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
    }
    
    float fbm(vec3 p) {
        float value = 0.0;
        float amplitude = 0.5;
        for (int i = 0; i < 4; i++) {
            value += amplitude * snoise(p);
            p *= 2.0;
            amplitude *= 0.5;
        }
        return value * 0.5 + 0.5;
    }
    
    float heneyGreenstein(float cosTheta, float g) {
        float g2 = g * g;
        return (1.0 - g2) / (4.0 * 3.14159 * pow(1.0 + g2 - 2.0 * g * cosTheta, 1.5));
    }
    
    float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }
    
    vec3 getWorldPos(vec2 uv, float normalizedDist) {
        float dist = normalizedDist * uFar;
        vec2 ndc = uv * 2.0 - 1.0;
        vec4 rayClip = vec4(ndc, -1.0, 1.0);
        vec4 rayView = uInverseProjection * rayClip;
        rayView = vec4(rayView.xyz / rayView.w, 0.0);
        vec3 rayDir = normalize((uInverseView * rayView).xyz);
        return uCameraPos + rayDir * dist;
    }
    
    float getFogDensity(vec3 worldPos) {
        float halfSize = uPoolSize * 0.5;
        
        if (abs(worldPos.x) > halfSize || abs(worldPos.z) > halfSize) {
            return 0.0;
        }
        
        float fogTop = uWaterLevel + 1.5;
        float fogBottom = uFloorLevel + 0.3;
        
        float heightInFog = fogTop - worldPos.y;
        float fogHeight = fogTop - fogBottom;
        float heightFactor = heightInFog / fogHeight;
        
        float topFade = smoothstep(0.0, 0.3, heightFactor);
        float bottomFade = smoothstep(0.0, 0.3, 1.0 - heightFactor);
        
        float cloudHeight = 0.25;
        float cloudThickness = 0.35;
        float heightDensity = exp(-pow((heightFactor - cloudHeight) / cloudThickness, 2.0) * 2.0);
        
        vec3 noisePos = worldPos * 0.15;
        noisePos.y += uTime * 0.08;
        noisePos.x += uTime * 0.05;
        noisePos.z += uTime * 0.03;
        
        float cloudNoise = fbm(noisePos);
        
        float cloudThreshold = 0.4;
        float cloudDensity = smoothstep(cloudThreshold, cloudThreshold + 0.25, cloudNoise);
        cloudDensity = pow(cloudDensity, 1.3);
        
        float density = uFogDensity * heightDensity * cloudDensity * 2.0;
        density *= topFade * bottomFade;
        
        float edgeDistX = halfSize - abs(worldPos.x);
        float edgeDistZ = halfSize - abs(worldPos.z);
        float minEdgeDist = min(edgeDistX, edgeDistZ);
        density *= smoothstep(0.0, 1.5, minEdgeDist);
        
        return density;
    }
    
    vec3 getCausticsAtPos(vec3 worldPos) {
        float halfSize = uPoolSize * 0.5;
        vec2 causticsUv = (worldPos.xz + halfSize) / uPoolSize;
        causticsUv.y = 1.0 - causticsUv.y;
        causticsUv = clamp(causticsUv, 0.0, 1.0);
        return texture2D(tCaustics, causticsUv).rgb;
    }
    
    float getLightRayDensity(vec3 worldPos, vec3 rayDir) {
        float halfSize = uPoolSize * 0.5;
        if (abs(worldPos.x) > halfSize || abs(worldPos.z) > halfSize) return 0.0;
        
        float rayTop = uWaterLevel;
        float rayBottom = uFloorLevel;
        if (worldPos.y > rayTop || worldPos.y < rayBottom) return 0.0;
        
        vec3 lightDir = normalize(uLightDir);
        
        if (lightDir.y >= -0.1) return 0.0;
        
        float tFloor = (rayBottom - worldPos.y) / lightDir.y;
        vec3 floorPoint = worldPos + lightDir * tFloor;
        
        if (abs(floorPoint.x) > halfSize || abs(floorPoint.z) > halfSize) return 0.0;
        
        vec2 floorUv = (floorPoint.xz + halfSize) / uPoolSize;
        floorUv.y = 1.0 - floorUv.y;
        floorUv = clamp(floorUv, 0.0, 1.0);
        
        float causticsBrightness = texture2D(tCaustics, floorUv).r;
        
        float depthInWater = rayTop - worldPos.y;
        float waterColumnHeight = rayTop - rayBottom;
        float normalizedDepth = depthInWater / waterColumnHeight;
        float depthFactor = pow(normalizedDepth, 0.3);
        
        float rayNoise = 0.9 + 0.1 * snoise(vec3(worldPos.xz * 0.3, uTime * 0.2));
        
        float shimmer = 0.95 + 0.05 * sin(uTime * 2.5 + worldPos.x * 1.5 + worldPos.z * 1.5);
        
        float edgeFade = 1.0;
        float edgeX = (halfSize - abs(worldPos.x)) / halfSize;
        float edgeZ = (halfSize - abs(worldPos.z)) / halfSize;
        edgeFade = smoothstep(0.0, 0.15, min(edgeX, edgeZ));
        
        return causticsBrightness * depthFactor * rayNoise * shimmer * edgeFade;
    }
    
    void main() {
        vec4 sceneColor = texture2D(tDiffuse, vUv);
        
        if (!uEnabled) {
            gl_FragColor = sceneColor;
            return;
        }
        
        float rawDepth = texture2D(tDepth, vUv).r;
        float viewDepth = rawDepth;
        
        if (rawDepth >= 0.999) {
            gl_FragColor = sceneColor;
            return;
        }
        
        vec3 worldPos = getWorldPos(vUv, viewDepth);
        
        vec3 rayOrigin = uCameraPos;
        vec3 rayDir = normalize(worldPos - uCameraPos);
        float sceneDistance = length(worldPos - uCameraPos);
        
        float rayBoundsTop = uWaterLevel + 1.0;
        float rayBoundsBottom = uFloorLevel - 0.5;
        
        float tEnter = 0.0;
        float tExit = sceneDistance;
        
        if (abs(rayDir.y) > 0.001) {
            float tTop = (rayBoundsTop - rayOrigin.y) / rayDir.y;
            float tBottom = (rayBoundsBottom - rayOrigin.y) / rayDir.y;
            float tNear = min(tTop, tBottom);
            float tFar = max(tTop, tBottom);
            
            tEnter = max(0.0, tNear);
            tExit = min(sceneDistance, tFar);
            
            if (rayOrigin.y > rayBoundsBottom && rayOrigin.y < rayBoundsTop) {
                tEnter = 0.0;
            }
        }
        
        if (tEnter >= tExit) {
            gl_FragColor = sceneColor;
            return;
        }
        
        int steps = min(uSteps, 64);
        float stepSize = (tExit - tEnter) / float(steps);
        
        float jitter = hash(vUv + fract(uTime * 0.1)) - 0.5;
        float tJitter = jitter * stepSize;
        
        vec3 fogColor = vec3(0.0);
        float transmittance = 1.0;
        
        for (int i = 0; i < 64; i++) {
            if (i >= steps) break;
            
            float t = tEnter + (float(i) + 0.5) * stepSize + tJitter;
            vec3 samplePos = rayOrigin + rayDir * t;
            
            float density = getFogDensity(samplePos);
            
            if (uShowLightRays) {
                float rayDensity = getLightRayDensity(samplePos, rayDir);
                density = max(density, rayDensity * uLightRayIntensity * 3.0);
            }
            
            if (density < 0.001) continue;
            
            vec3 causticsLight = getCausticsAtPos(samplePos);
            
            float cosTheta = dot(-rayDir, uLightDir);
            float phase = heneyGreenstein(cosTheta, uAnisotropy);
            phase = max(phase, 0.05);
            
            vec3 sampleLight = causticsLight;
            if (uShowLightRays) {
                sampleLight = mix(causticsLight, uLightColor * 1.5, 0.5);
            }
            
            vec3 lightInScatter = sampleLight * uLightColor * uLightIntensity * uFogScattering * phase;
            
            fogColor += lightInScatter * density * stepSize * transmittance * 5.0;
            
            float absorption = density * stepSize * 1.5;
            transmittance *= exp(-absorption);
            
            if (transmittance < 0.01) break;
        }
        
        vec3 fogTint = vec3(0.75, 0.88, 1.0);
        fogColor *= fogTint;
        
        vec3 finalColor = sceneColor.rgb * transmittance + fogColor;
        
        gl_FragColor = vec4(finalColor, sceneColor.a);
    }
`;

export class VolumetricFog {
    constructor(renderer, scene, camera, causticsRenderer, state) {
        this.renderer = renderer;
        this.scene = scene;
        this.camera = camera;
        this.causticsRenderer = causticsRenderer;
        this.state = state;
        
        this.enabled = false;
        this.resolutionScale = 0.5;
        
        this.setupRenderTargets();
        this.setupMaterials();
        this.setupFullscreenQuad();
    }
    
    setupRenderTargets() {
        const size = this.renderer.getSize(new THREE.Vector2());
        const fogWidth = Math.floor(size.x * this.resolutionScale);
        const fogHeight = Math.floor(size.y * this.resolutionScale);
        
        this.sceneTarget = new THREE.WebGLRenderTarget(size.x, size.y, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            type: THREE.HalfFloatType
        });
        
        this.depthTarget = new THREE.WebGLRenderTarget(size.x, size.y, {
            minFilter: THREE.NearestFilter,
            magFilter: THREE.NearestFilter,
            format: THREE.RedFormat,
            type: THREE.FloatType,
            depthBuffer: true,
            stencilBuffer: false
        });
        
        this.fogTarget = new THREE.WebGLRenderTarget(fogWidth, fogHeight, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            type: THREE.HalfFloatType
        });
        
        this.depthMaterial = new THREE.ShaderMaterial({
            vertexShader: `
                varying float vDepth;
                uniform float uFar;
                void main() {
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    vDepth = length(mvPosition.xyz) / uFar;
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                varying float vDepth;
                void main() {
                    gl_FragColor = vec4(vDepth, 0.0, 0.0, 1.0);
                }
            `,
            uniforms: {
                uFar: { value: 100.0 }
            },
            depthTest: true,
            depthWrite: true,
            side: THREE.DoubleSide
        });
    }
    
    setupMaterials() {
        this.fogMaterial = new THREE.ShaderMaterial({
            vertexShader: volumetricFogVertexShader,
            fragmentShader: volumetricFogFragmentShader,
            uniforms: {
                tDiffuse: { value: null },
                tDepth: { value: null },
                tCaustics: { value: null },
                uLightDir: { value: new THREE.Vector3(0, -1, 0) },
                uLightColor: { value: new THREE.Color(1, 1, 1) },
                uLightIntensity: { value: 1.5 },
                uFogDensity: { value: 1.0 },
                uFogScattering: { value: 1.0 },
                uAnisotropy: { value: 0.3 },
                uWaterLevel: { value: 0 },
                uFloorLevel: { value: -2 },
                uPoolSize: { value: 10 },
                uTime: { value: 0 },
                uSteps: { value: 16 },
                uEnabled: { value: false },
                uDebugMode: { value: 0 },
                uInverseProjection: { value: new THREE.Matrix4() },
                uInverseView: { value: new THREE.Matrix4() },
                uCameraPos: { value: new THREE.Vector3() },
                uNear: { value: 0.1 },
                uFar: { value: 100 },
                uLightPosition: { value: new THREE.Vector3(0, 10, 0) },
                uShowLightRays: { value: false },
                uLightRayIntensity: { value: 1.0 },
                uIsPointLight: { value: false }
            }
        });
    }
    
    setupFullscreenQuad() {
        this.quadScene = new THREE.Scene();
        const geometry = new THREE.PlaneGeometry(2, 2);
        const mesh = new THREE.Mesh(geometry, this.fogMaterial);
        this.quadScene.add(mesh);
        this.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    }
    
    setEnabled(enabled) {
        this.enabled = enabled;
        this.fogMaterial.uniforms.uEnabled.value = enabled;
    }
    
    setDensity(density) {
        this.fogMaterial.uniforms.uFogDensity.value = density;
    }
    
    setScattering(scattering) {
        this.fogMaterial.uniforms.uFogScattering.value = scattering;
    }
    
    setAnisotropy(anisotropy) {
        this.fogMaterial.uniforms.uAnisotropy.value = anisotropy;
    }
    
    setSteps(steps) {
        this.fogMaterial.uniforms.uSteps.value = steps;
    }
    
    setDebugMode(mode) {
        this.fogMaterial.uniforms.uDebugMode.value = mode;
    }
    
    setWaterLevel(level) {
        this.fogMaterial.uniforms.uWaterLevel.value = level;
    }
    
    setFloorLevel(level) {
        this.fogMaterial.uniforms.uFloorLevel.value = level;
    }
    
    setPoolSize(size) {
        this.fogMaterial.uniforms.uPoolSize.value = size;
    }
    
    setLightDirection(dir) {
        this.fogMaterial.uniforms.uLightDir.value.copy(dir);
    }
    
    setLightColor(color) {
        this.fogMaterial.uniforms.uLightColor.value.set(color);
    }
    
    setLightIntensity(intensity) {
        this.fogMaterial.uniforms.uLightIntensity.value = intensity;
    }
    
    setLightPosition(pos) {
        this.fogMaterial.uniforms.uLightPosition.value.copy(pos);
    }
    
    setShowLightRays(show) {
        this.fogMaterial.uniforms.uShowLightRays.value = show;
    }
    
    setLightRayIntensity(intensity) {
        this.fogMaterial.uniforms.uLightRayIntensity.value = intensity;
    }
    
    setIsPointLight(isPoint) {
        this.fogMaterial.uniforms.uIsPointLight.value = isPoint;
    }
    
    resize(width, height) {
        this.sceneTarget.setSize(width, height);
        this.depthTarget.setSize(width, height);
        
        const fogWidth = Math.floor(width * this.resolutionScale);
        const fogHeight = Math.floor(height * this.resolutionScale);
        this.fogTarget.setSize(fogWidth, fogHeight);
    }
    
    render(sceneTexture, time, renderTarget = null) {
        if (!this.enabled) {
            return;
        }
        
        this.depthMaterial.uniforms.uFar.value = this.camera.far;
        
        const causticsTex = this.causticsRenderer.getCausticsTextureObject();
        
        this.fogMaterial.uniforms.tDiffuse.value = sceneTexture;
        this.fogMaterial.uniforms.tDepth.value = this.depthTarget.texture;
        this.fogMaterial.uniforms.tCaustics.value = causticsTex;
        this.fogMaterial.uniforms.uTime.value = time;
        
        this.fogMaterial.uniforms.uInverseProjection.value.copy(this.camera.projectionMatrixInverse);
        this.fogMaterial.uniforms.uInverseView.value.copy(this.camera.matrixWorld);
        this.fogMaterial.uniforms.uCameraPos.value.copy(this.camera.position);
        this.fogMaterial.uniforms.uNear.value = this.camera.near;
        this.fogMaterial.uniforms.uFar.value = this.camera.far;
        
        this.renderer.setRenderTarget(renderTarget);
        this.renderer.render(this.quadScene, this.quadCamera);
    }
    
    getDepthMaterial() {
        return this.depthMaterial;
    }
    
    getDepthTarget() {
        return this.depthTarget;
    }
    
    getSceneTarget() {
        return this.sceneTarget;
    }
    
    dispose() {
        this.sceneTarget.dispose();
        this.depthTarget.dispose();
        this.fogTarget.dispose();
        this.fogMaterial.dispose();
        this.depthMaterial.dispose();
    }
}
