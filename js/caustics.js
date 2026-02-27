import * as THREE from 'three';

const causticsVertexShader = `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const causticsFragmentShader = `
    uniform sampler2D uLightTexture;
    uniform vec3 uLightDir;
    uniform float uIOR;
    uniform float uDispersion;
    uniform float uDepth;
    uniform vec3 uLightColor;
    uniform float uIntensity;
    uniform float uPoolSize;
    uniform int uLightMode;
    uniform int uLightChannel;
    uniform sampler2D uWaveDataTexture;
    uniform int uLightType;
    uniform vec3 uPointLightPos;
    uniform float uPointLightRadius;
    uniform vec3 uCausticsTint;
    uniform float uCausticsTintStrength;
    uniform bool uGodRays;
    uniform float uGodRaysIntensity;
    uniform float uGodRaysDecay;
    uniform int uGodRaysSamples;
    
    uniform bool uMultiLightEnabled;
    uniform int uLightCount;
    uniform vec3 uLightPositions[4];
    uniform vec3 uLightColors[4];
    uniform float uLightIntensities[4];
    uniform int uLightTypes[4];
    
    varying vec2 vUv;
    
    float getChannelValue(vec3 color, int channel) {
        if (channel == 0) return dot(color, vec3(0.299, 0.587, 0.114));
        else if (channel == 1) return color.r;
        else if (channel == 2) return color.g;
        else if (channel == 3) return color.b;
        return dot(color, vec3(0.299, 0.587, 0.114));
    }
    
    vec3 refractVec(vec3 incident, vec3 normal, float eta) {
        float cosi = dot(-incident, normal);
        float sin2t = eta * eta * (1.0 - cosi * cosi);
        if (sin2t > 1.0) return vec3(0.0);
        float cost = sqrt(1.0 - sin2t);
        return eta * incident + (eta * cosi - cost) * normal;
    }
    
    vec3 getDispersionRay(vec3 incident, vec3 normal, float baseIOR, float offset) {
        float ior = baseIOR + offset;
        return refractVec(incident, normal, 1.0 / ior);
    }
    
    vec3 computeLightContribution(vec3 floorPos3D, vec3 waterPos, vec3 normal, vec3 lightPosOrDir, int lightType, vec3 lightColor, float lightIntensity, float pointRadius) {
        vec3 incident;
        if (lightType == 1) {
            incident = normalize(waterPos - lightPosOrDir);
        } else {
            incident = normalize(lightPosOrDir);
        }
        
        float halfSize = uPoolSize * 0.5;
        float floorY = -uDepth;
        
        if (uDispersion > 0.001) {
            vec3 redRefracted = getDispersionRay(incident, normal, uIOR, uDispersion * 2.0);
            vec3 greenRefracted = getDispersionRay(incident, normal, uIOR, 0.0);
            vec3 blueRefracted = getDispersionRay(incident, normal, uIOR, -uDispersion * 2.0);
            
            vec3 result = vec3(0.0);
            
            if (redRefracted.y < 0.0) {
                float t = (floorY - waterPos.y) / redRefracted.y;
                vec3 hitPoint = waterPos + redRefracted * t;
                float dist = length(hitPoint.xz - floorPos3D.xz);
                float influence = exp(-dist * dist * 6.0);
                if (influence > 0.02) {
                    float intensity = exp(-length(redRefracted * t) * 0.02) / (1.0 + abs(redRefracted.y) * 1.5);
                    result.r += intensity * influence;
                }
            }
            
            if (greenRefracted.y < 0.0) {
                float t = (floorY - waterPos.y) / greenRefracted.y;
                vec3 hitPoint = waterPos + greenRefracted * t;
                float dist = length(hitPoint.xz - floorPos3D.xz);
                float influence = exp(-dist * dist * 6.0);
                if (influence > 0.02) {
                    float intensity = exp(-length(greenRefracted * t) * 0.02) / (1.0 + abs(greenRefracted.y) * 1.5);
                    result.g += intensity * influence;
                }
            }
            
            if (blueRefracted.y < 0.0) {
                float t = (floorY - waterPos.y) / blueRefracted.y;
                vec3 hitPoint = waterPos + blueRefracted * t;
                float dist = length(hitPoint.xz - floorPos3D.xz);
                float influence = exp(-dist * dist * 6.0);
                if (influence > 0.02) {
                    float intensity = exp(-length(blueRefracted * t) * 0.02) / (1.0 + abs(blueRefracted.y) * 1.5);
                    result.b += intensity * influence;
                }
            }
            
            return result * lightColor * lightIntensity;
        } else {
            vec3 refracted = refractVec(incident, normal, 1.0 / uIOR);
            
            if (refracted.y >= 0.0) return vec3(0.0);
            
            float t = (floorY - waterPos.y) / refracted.y;
            vec3 hitPoint = waterPos + refracted * t;
            
            float dist = length(hitPoint.xz - floorPos3D.xz);
            float influence = exp(-dist * dist * 6.0);
            
            if (influence < 0.02) return vec3(0.0);
            
            float intensity = 1.0;
            float rayLength = length(refracted * t);
            intensity *= exp(-rayLength * 0.02);
            intensity *= 1.0 / (1.0 + abs(refracted.y) * 1.5);
            
            if (lightType == 1) {
                float lightDist = length(waterPos - lightPosOrDir);
                intensity *= pointRadius / (pointRadius + lightDist * lightDist);
            }
            
            return lightColor * intensity * influence * lightIntensity;
        }
    }
    
    void main() {
        float halfSize = uPoolSize * 0.5;
        vec2 floorPos = (vUv - 0.5) * uPoolSize;
        float floorY = -uDepth;
        
        vec3 totalLight = vec3(0.0);
        
        float searchRadius = 1.5;
        int samples = 16;
        float stepSize = searchRadius * 2.0 / float(samples);
        
        for (int i = 0; i < 16; i++) {
            for (int j = 0; j < 16; j++) {
                vec2 waterPos2D = floorPos + vec2(
                    (float(i) - float(samples) * 0.5 + 0.5) * stepSize,
                    (float(j) - float(samples) * 0.5 + 0.5) * stepSize
                );
                
                if (abs(waterPos2D.x) > halfSize || abs(waterPos2D.y) > halfSize) continue;
                
                vec2 waveUv = (waterPos2D + halfSize) / uPoolSize;
                waveUv.y = 1.0 - waveUv.y;
                vec4 waveData = texture2D(uWaveDataTexture, waveUv);
                float waterY = waveData.r;
                vec3 normal = waveData.gba;
                
                vec3 waterPos = vec3(waterPos2D.x, waterY, waterPos2D.y);
                vec3 floorPos3D = vec3(floorPos.x, floorY, floorPos.y);
                
                if (uMultiLightEnabled) {
                    for (int l = 0; l < 4; l++) {
                        if (l >= uLightCount) break;
                        
                        vec3 lightContrib = computeLightContribution(
                            floorPos3D, waterPos, normal,
                            uLightPositions[l],
                            uLightTypes[l],
                            uLightColors[l],
                            uLightIntensities[l],
                            uPointLightRadius
                        );
                        
                        totalLight += lightContrib * stepSize * stepSize;
                    }
                } else {
                    vec3 incident;
                    
                    if (uLightType == 1) {
                        incident = normalize(waterPos - uPointLightPos);
                    } else {
                        incident = normalize(uLightDir);
                    }
                    
                    if (uDispersion > 0.001) {
                        vec3 redRefracted = getDispersionRay(incident, normal, uIOR, uDispersion * 2.0);
                        vec3 greenRefracted = getDispersionRay(incident, normal, uIOR, 0.0);
                        vec3 blueRefracted = getDispersionRay(incident, normal, uIOR, -uDispersion * 2.0);
                        
                        if (redRefracted.y < 0.0) {
                            float t = (floorY - waterPos.y) / redRefracted.y;
                            vec3 hitPoint = waterPos + redRefracted * t;
                            float dist = length(hitPoint.xz - floorPos);
                            float influence = exp(-dist * dist * 6.0);
                            if (influence > 0.02) {
                                float intensity = exp(-length(redRefracted * t) * 0.02) / (1.0 + abs(redRefracted.y) * 1.5);
                                totalLight.r += intensity * influence * stepSize * stepSize;
                            }
                        }
                        
                        if (greenRefracted.y < 0.0) {
                            float t = (floorY - waterPos.y) / greenRefracted.y;
                            vec3 hitPoint = waterPos + greenRefracted * t;
                            float dist = length(hitPoint.xz - floorPos);
                            float influence = exp(-dist * dist * 6.0);
                            if (influence > 0.02) {
                                float intensity = exp(-length(greenRefracted * t) * 0.02) / (1.0 + abs(greenRefracted.y) * 1.5);
                                totalLight.g += intensity * influence * stepSize * stepSize;
                            }
                        }
                        
                        if (blueRefracted.y < 0.0) {
                            float t = (floorY - waterPos.y) / blueRefracted.y;
                            vec3 hitPoint = waterPos + blueRefracted * t;
                            float dist = length(hitPoint.xz - floorPos);
                            float influence = exp(-dist * dist * 6.0);
                            if (influence > 0.02) {
                                float intensity = exp(-length(blueRefracted * t) * 0.02) / (1.0 + abs(blueRefracted.y) * 1.5);
                                totalLight.b += intensity * influence * stepSize * stepSize;
                            }
                        }
                    } else {
                        vec3 refracted = refractVec(incident, normal, 1.0 / uIOR);
                        
                        if (refracted.y >= 0.0) continue;
                        
                        float t = (floorY - waterPos.y) / refracted.y;
                        vec3 hitPoint = waterPos + refracted * t;
                        
                        float dist = length(hitPoint.xz - floorPos);
                        float influence = exp(-dist * dist * 6.0);
                        
                        if (influence < 0.02) continue;
                        
                        float intensity = 1.0;
                        float rayLength = length(refracted * t);
                        intensity *= exp(-rayLength * 0.02);
                        intensity *= 1.0 / (1.0 + abs(refracted.y) * 1.5);
                        
                        if (uLightType == 1) {
                            float lightDist = length(waterPos - uPointLightPos);
                            intensity *= uPointLightRadius / (uPointLightRadius + lightDist * lightDist);
                        }
                        
                        if (uLightMode == 1) {
                            vec2 lightUv = (waterPos2D + halfSize) / uPoolSize;
                            lightUv.y = 1.0 - lightUv.y;
                            vec3 lightTexColor = texture2D(uLightTexture, lightUv).rgb;
                            float lightValue = getChannelValue(lightTexColor, uLightChannel);
                            intensity *= lightValue;
                        }
                        
                        totalLight += uLightColor * intensity * influence * stepSize * stepSize;
                    }
                }
            }
        }
        
        totalLight *= uIntensity * 1.2;
        
        if (uCausticsTintStrength > 0.0) {
            totalLight = mix(totalLight, totalLight * uCausticsTint, uCausticsTintStrength);
        }
        
        if (uGodRays) {
            vec2 screenCenter = vec2(0.5, 0.5);
            vec2 rayDir = normalize(vUv - screenCenter);
            vec3 godRayLight = vec3(0.0);
            float totalWeight = 0.0;
            
            for (int s = 0; s < 50; s++) {
                if (s >= uGodRaysSamples) break;
                float fi = float(s);
                vec2 sampleUv = vUv - rayDir * fi * 0.02;
                if (sampleUv.x < 0.0 || sampleUv.x > 1.0 || sampleUv.y < 0.0 || sampleUv.y > 1.0) continue;
                float weight = pow(uGodRaysDecay, fi);
                godRayLight += totalLight * weight;
                totalWeight += weight;
            }
            
            if (totalWeight > 0.0) {
                godRayLight /= totalWeight;
                totalLight += godRayLight * uGodRaysIntensity;
            }
        }
        
        gl_FragColor = vec4(totalLight, 1.0);
    }
`;

const blurFragmentShader = `
    uniform sampler2D tDiffuse;
    uniform vec2 uDirection;
    uniform float uResolution;
    
    varying vec2 vUv;
    
    void main() {
        vec2 texelSize = vec2(1.0) / uResolution;
        float weights[5];
        weights[0] = 0.227027;
        weights[1] = 0.1945946;
        weights[2] = 0.1216216;
        weights[3] = 0.054054;
        weights[4] = 0.016216;
        
        vec3 result = texture2D(tDiffuse, vUv).rgb * weights[0];
        
        for (int i = 1; i < 5; i++) {
            vec2 offset = uDirection * texelSize * float(i);
            result += texture2D(tDiffuse, vUv + offset).rgb * weights[i];
            result += texture2D(tDiffuse, vUv - offset).rgb * weights[i];
        }
        
        gl_FragColor = vec4(result, 1.0);
    }
`;

export class CausticsRenderer {
    constructor(renderer, waterSurface, floorPlane, lightManager, state) {
        this.renderer = renderer;
        this.waterSurface = waterSurface;
        this.floorPlane = floorPlane;
        this.lightManager = lightManager;
        this.state = state;
        
        this.resolution = 256;
        
        this.setupRenderTargets();
        this.setupMaterials();
        this.setupFullscreenQuad();
    }
    
    setupRenderTargets() {
        this.waveDataTarget = new THREE.WebGLRenderTarget(256, 256, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            type: THREE.FloatType
        });
        
        this.causticsTarget = new THREE.WebGLRenderTarget(this.resolution, this.resolution, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat
        });
        
        this.causticsBlurH = new THREE.WebGLRenderTarget(this.resolution, this.resolution, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat
        });
        
        this.causticsBlurV = new THREE.WebGLRenderTarget(this.resolution, this.resolution, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat
        });
    }
    
    setupMaterials() {
        const waveFunctions = `
            uniform float uTime;
            uniform float uAmplitude;
            uniform float uFrequency;
            uniform int uWaveType;
            uniform float uSpeed;
            uniform sampler2D uDisplacementTexture;
            uniform int uDisplacementMode;
            uniform int uDisplacementChannel;
            uniform float uDisplacementInfluence;
            uniform float uPoolSize;
            
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
            
            float getSineWave(vec2 pos, float time) {
                return sin(pos.x * uFrequency + time * uSpeed) * cos(pos.y * uFrequency * 0.8 + time * uSpeed * 0.7);
            }
            float getPerlinWave(vec2 pos, float time) {
                float noise1 = snoise(vec3(pos * uFrequency * 0.5, time * uSpeed * 0.3));
                float noise2 = snoise(vec3(pos * uFrequency, time * uSpeed * 0.5)) * 0.5;
                float noise3 = snoise(vec3(pos * uFrequency * 2.0, time * uSpeed * 0.7)) * 0.25;
                return noise1 + noise2 + noise3;
            }
            float getGerstnerWave(vec2 pos, float time) {
                float wave = 0.0; float amp = 1.0; float freq = uFrequency;
                for (int i = 0; i < 4; i++) {
                    vec2 dir = vec2(cos(float(i) * 0.7), sin(float(i) * 0.7));
                    wave += amp * cos(dot(pos, dir * freq) + time * uSpeed);
                    amp *= 0.5; freq *= 1.8;
                }
                return wave;
            }
            float getRippleWave(vec2 pos, float time) {
                float dist = length(pos);
                return sin(dist * uFrequency * 2.0 - time * uSpeed * 3.0) * exp(-dist * 0.15);
            }
            float getChannelValue(vec3 color, int channel) {
                if (channel == 0) return dot(color, vec3(0.299, 0.587, 0.114));
                else if (channel == 1) return color.r;
                else if (channel == 2) return color.g;
                else if (channel == 3) return color.b;
                return dot(color, vec3(0.299, 0.587, 0.114));
            }
            float getWaveHeight(vec2 pos, float time) {
                float height = 0.0;
                if (uWaveType == 0) height = getSineWave(pos, time);
                else if (uWaveType == 1) height = getPerlinWave(pos, time);
                else if (uWaveType == 2) height = getGerstnerWave(pos, time);
                else height = getRippleWave(pos, time);
                if (uDisplacementMode == 1) {
                    vec2 dispUv = (pos + uPoolSize * 0.5) / uPoolSize;
                    dispUv.y = 1.0 - dispUv.y;
                    vec3 texColor = texture2D(uDisplacementTexture, dispUv).rgb;
                    float dispValue = getChannelValue(texColor, uDisplacementChannel);
                    height = mix(height, dispValue * 2.0 - 1.0, uDisplacementInfluence);
                }
                return height * uAmplitude;
            }
        `;
        
        this.waveDataMaterial = new THREE.ShaderMaterial({
            vertexShader: causticsVertexShader,
            fragmentShader: waveFunctions + `
                varying vec2 vUv;
                
                void main() {
                    float halfSize = uPoolSize * 0.5;
                    vec2 worldPos = (vUv - 0.5) * uPoolSize;
                    worldPos.y = -worldPos.y;
                    
                    float height = getWaveHeight(worldPos, uTime);
                    
                    float eps = 0.02;
                    float hL = getWaveHeight(worldPos + vec2(-eps, 0.0), uTime);
                    float hR = getWaveHeight(worldPos + vec2(eps, 0.0), uTime);
                    float hD = getWaveHeight(worldPos + vec2(0.0, -eps), uTime);
                    float hU = getWaveHeight(worldPos + vec2(0.0, eps), uTime);
                    vec3 normal = normalize(vec3((hL - hR) / eps, 2.0, (hD - hU) / eps));
                    
                    gl_FragColor = vec4(height, normal.x, normal.y, normal.z);
                }
            `,
            uniforms: {
                uTime: { value: 0 },
                uAmplitude: { value: 0.3 },
                uFrequency: { value: 2.0 },
                uWaveType: { value: 1 },
                uSpeed: { value: 1.0 },
                uDisplacementTexture: { value: null },
                uDisplacementMode: { value: 0 },
                uDisplacementChannel: { value: 0 },
                uDisplacementInfluence: { value: 0.5 },
                uPoolSize: { value: 10 }
            }
        });
        
        this.causticsMaterial = new THREE.ShaderMaterial({
            vertexShader: causticsVertexShader,
            fragmentShader: causticsFragmentShader,
            uniforms: {
                uLightTexture: { value: null },
                uLightDir: { value: new THREE.Vector3(0, -1, 0) },
                uIOR: { value: 1.33 },
                uDispersion: { value: 0 },
                uDepth: { value: 2.0 },
                uLightColor: { value: new THREE.Color(1, 1, 1) },
                uIntensity: { value: 1.5 },
                uPoolSize: { value: 10 },
                uLightMode: { value: 0 },
                uLightChannel: { value: 0 },
                uWaveDataTexture: { value: null },
                uLightType: { value: 0 },
                uPointLightPos: { value: new THREE.Vector3(0, 5, 0) },
                uPointLightRadius: { value: 10 },
                uCausticsTint: { value: new THREE.Color(1, 1, 1) },
                uCausticsTintStrength: { value: 0 },
                uGodRays: { value: false },
                uGodRaysIntensity: { value: 0.5 },
                uGodRaysDecay: { value: 0.95 },
                uGodRaysSamples: { value: 50 },
                uMultiLightEnabled: { value: false },
                uLightCount: { value: 1 },
                uLightPositions: { value: [
                    new THREE.Vector3(0, 10, 0),
                    new THREE.Vector3(0, 10, 0),
                    new THREE.Vector3(0, 10, 0),
                    new THREE.Vector3(0, 10, 0)
                ]},
                uLightColors: { value: [
                    new THREE.Color(1, 1, 1),
                    new THREE.Color(1, 1, 1),
                    new THREE.Color(1, 1, 1),
                    new THREE.Color(1, 1, 1)
                ]},
                uLightIntensities: { value: [1.5, 1.5, 1.5, 1.5] },
                uLightTypes: { value: [0, 0, 0, 0] }
            }
        });
        
        this.blurMaterial = new THREE.ShaderMaterial({
            vertexShader: causticsVertexShader,
            fragmentShader: blurFragmentShader,
            uniforms: {
                tDiffuse: { value: null },
                uDirection: { value: new THREE.Vector2(1, 0) },
                uResolution: { value: this.resolution }
            }
        });
    }
    
    setupFullscreenQuad() {
        this.quad = new THREE.Mesh(
            new THREE.PlaneGeometry(2, 2),
            null
        );
        this.quadScene = new THREE.Scene();
        this.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        this.quadScene.add(this.quad);
        
        this.waterCamera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 20);
        this.waterCamera.position.set(0, 10, 0);
        this.waterCamera.lookAt(0, 0, 0);
    }
    
    render(time, state) {
        this.waveDataMaterial.uniforms.uTime.value = time;
        this.waveDataMaterial.uniforms.uAmplitude.value = state.wave.amplitude;
        this.waveDataMaterial.uniforms.uFrequency.value = state.wave.frequency;
        this.waveDataMaterial.uniforms.uWaveType.value = this.getWaveTypeIndex(state.wave.type);
        this.waveDataMaterial.uniforms.uSpeed.value = state.wave.speed;
        this.waveDataMaterial.uniforms.uPoolSize.value = state.scene.poolSize;
        this.waveDataMaterial.uniforms.uDisplacementTexture.value = this.waterSurface.material.uniforms.uDisplacementTexture.value;
        this.waveDataMaterial.uniforms.uDisplacementMode.value = this.waterSurface.material.uniforms.uDisplacementMode.value;
        this.waveDataMaterial.uniforms.uDisplacementChannel.value = this.waterSurface.material.uniforms.uDisplacementChannel.value;
        this.waveDataMaterial.uniforms.uDisplacementInfluence.value = this.waterSurface.material.uniforms.uDisplacementInfluence.value;
        
        this.quad.material = this.waveDataMaterial;
        this.renderer.setRenderTarget(this.waveDataTarget);
        this.renderer.render(this.quadScene, this.quadCamera);
        
        this.causticsMaterial.uniforms.uLightDir.value.copy(this.lightManager.getDirection());
        this.causticsMaterial.uniforms.uIOR.value = state.material.ior;
        this.causticsMaterial.uniforms.uDispersion.value = state.material.dispersion;
        this.causticsMaterial.uniforms.uDepth.value = state.scene.depth;
        this.causticsMaterial.uniforms.uLightColor.value.set(state.light.color);
        this.causticsMaterial.uniforms.uIntensity.value = state.light.intensity;
        this.causticsMaterial.uniforms.uPoolSize.value = state.scene.poolSize;
        this.causticsMaterial.uniforms.uWaveDataTexture.value = this.waveDataTarget.texture;
        this.causticsMaterial.uniforms.uLightType.value = state.light.type === 'point' ? 1 : 0;
        this.causticsMaterial.uniforms.uPointLightPos.value.set(
            state.light.pointPosition.x,
            state.light.pointPosition.y,
            state.light.pointPosition.z
        );
        this.causticsMaterial.uniforms.uPointLightRadius.value = state.light.pointRadius;
        this.causticsMaterial.uniforms.uCausticsTint.value.set(state.light.causticsTint);
        this.causticsMaterial.uniforms.uCausticsTintStrength.value = state.light.causticsTintStrength;
        this.causticsMaterial.uniforms.uGodRays.value = state.effects.godRays;
        this.causticsMaterial.uniforms.uGodRaysIntensity.value = state.effects.godRaysIntensity;
        this.causticsMaterial.uniforms.uGodRaysDecay.value = state.effects.godRaysDecay;
        this.causticsMaterial.uniforms.uGodRaysSamples.value = state.effects.godRaysSamples;
        
        if (state.multiLight && state.multiLight.enabled) {
            this.causticsMaterial.uniforms.uMultiLightEnabled.value = true;
            this.causticsMaterial.uniforms.uLightCount.value = state.multiLight.count;
            
            const lightData = this.lightManager.getLightData();
            for (let i = 0; i < 4; i++) {
                if (i < lightData.count) {
                    this.causticsMaterial.uniforms.uLightPositions.value[i].set(
                        lightData.positions[i * 3],
                        lightData.positions[i * 3 + 1],
                        lightData.positions[i * 3 + 2]
                    );
                    this.causticsMaterial.uniforms.uLightColors.value[i].setRGB(
                        lightData.colors[i * 3],
                        lightData.colors[i * 3 + 1],
                        lightData.colors[i * 3 + 2]
                    );
                    this.causticsMaterial.uniforms.uLightIntensities.value[i] = lightData.intensities[i];
                    this.causticsMaterial.uniforms.uLightTypes.value[i] = lightData.types[i];
                }
            }
        } else {
            this.causticsMaterial.uniforms.uMultiLightEnabled.value = false;
        }
        
        this.quad.material = this.causticsMaterial;
        this.renderer.setRenderTarget(this.causticsTarget);
        this.renderer.render(this.quadScene, this.quadCamera);
        
        this.blurMaterial.uniforms.tDiffuse.value = this.causticsTarget.texture;
        this.blurMaterial.uniforms.uDirection.value.set(1, 0);
        this.quad.material = this.blurMaterial;
        this.renderer.setRenderTarget(this.causticsBlurH);
        this.renderer.render(this.quadScene, this.quadCamera);
        
        this.blurMaterial.uniforms.tDiffuse.value = this.causticsBlurH.texture;
        this.blurMaterial.uniforms.uDirection.value.set(0, 1);
        this.renderer.setRenderTarget(this.causticsBlurV);
        this.renderer.render(this.quadScene, this.quadCamera);
        
        this.floorPlane.setCausticsTexture(this.causticsBlurV.texture);
        
        this.renderer.setRenderTarget(null);
    }
    
    getWaveTypeIndex(type) {
        const types = { sine: 0, perlin: 1, gerstner: 2, ripple: 3 };
        return types[type] ?? 1;
    }
    
    setLightTexture(texture) {
        this.causticsMaterial.uniforms.uLightTexture.value = texture;
    }
    
    setLightMode(mode) {
        this.causticsMaterial.uniforms.uLightMode.value = mode === 'media' ? 1 : 0;
    }
    
    setLightChannel(channel) {
        const channels = { luminance: 0, red: 1, green: 2, blue: 3, alpha: 4 };
        this.causticsMaterial.uniforms.uLightChannel.value = channels[channel] ?? 0;
    }
    
    setLightType(type) {
        this.causticsMaterial.uniforms.uLightType.value = type === 'point' ? 1 : 0;
    }
    
    setPointLightPosition(x, y, z) {
        this.causticsMaterial.uniforms.uPointLightPos.value.set(x, y, z);
    }
    
    setPointLightRadius(radius) {
        this.causticsMaterial.uniforms.uPointLightRadius.value = radius;
    }
    
    setDispersion(dispersion) {
        this.causticsMaterial.uniforms.uDispersion.value = dispersion;
    }
    
    setCausticsTint(color, strength) {
        this.causticsMaterial.uniforms.uCausticsTint.value.set(color);
        this.causticsMaterial.uniforms.uCausticsTintStrength.value = strength;
    }
    
    setGodRays(enabled, intensity, decay, samples) {
        this.causticsMaterial.uniforms.uGodRays.value = enabled;
        if (intensity !== undefined) this.causticsMaterial.uniforms.uGodRaysIntensity.value = intensity;
        if (decay !== undefined) this.causticsMaterial.uniforms.uGodRaysDecay.value = decay;
        if (samples !== undefined) this.causticsMaterial.uniforms.uGodRaysSamples.value = samples;
    }
    
    setResolution(resolution) {
        this.resolution = resolution;
        this.causticsTarget.dispose();
        this.causticsBlurH.dispose();
        this.causticsBlurV.dispose();
        
        this.causticsTarget = new THREE.WebGLRenderTarget(resolution, resolution, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat
        });
        this.causticsBlurH = new THREE.WebGLRenderTarget(resolution, resolution, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat
        });
        this.causticsBlurV = new THREE.WebGLRenderTarget(resolution, resolution, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat
        });
        this.blurMaterial.uniforms.uResolution.value = resolution;
    }
    
    setGridResolution(resolution) {
        this.gridSize = resolution;
        this.waveDataTarget.dispose();
        
        this.waveDataTarget = new THREE.WebGLRenderTarget(resolution, resolution, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            type: THREE.FloatType
        });
    }
    
    getCausticsTexture() {
        this.renderer.setRenderTarget(this.causticsBlurV);
        const width = this.resolution;
        const height = this.resolution;
        const buffer = new Uint8Array(width * height * 4);
        this.renderer.readRenderTargetPixels(this.causticsBlurV, 0, 0, width, height, buffer);
        this.renderer.setRenderTarget(null);
        
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        const imageData = ctx.createImageData(width, height);
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const srcIdx = ((height - 1 - y) * width + x) * 4;
                const dstIdx = (y * width + x) * 4;
                imageData.data[dstIdx] = buffer[srcIdx];
                imageData.data[dstIdx + 1] = buffer[srcIdx + 1];
                imageData.data[dstIdx + 2] = buffer[srcIdx + 2];
                imageData.data[dstIdx + 3] = 255;
            }
        }
        
        ctx.putImageData(imageData, 0, 0);
        return canvas.toDataURL('image/png');
    }
    
    getCausticsTextureObject() {
        return this.causticsBlurV ? this.causticsBlurV.texture : null;
    }
}
