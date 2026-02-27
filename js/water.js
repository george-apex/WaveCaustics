import * as THREE from 'three';

const waterVertexShader = `
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
    uniform float uWaveDirection;
    uniform float uEdgeDamping;
    uniform int uLayerCount;
    uniform float uLayer0Amplitude;
    uniform float uLayer0Frequency;
    uniform float uLayer0Speed;
    uniform float uLayer0Direction;
    uniform float uLayer1Amplitude;
    uniform float uLayer1Frequency;
    uniform float uLayer1Speed;
    uniform float uLayer1Direction;
    uniform float uLayer2Amplitude;
    uniform float uLayer2Frequency;
    uniform float uLayer2Speed;
    uniform float uLayer2Direction;
    uniform float uLayer3Amplitude;
    uniform float uLayer3Frequency;
    uniform float uLayer3Speed;
    uniform float uLayer3Direction;
    uniform vec3 uRipples[10];
    uniform float uRippleStrengths[10];
    uniform int uRippleCount;
    uniform float uRippleRadius;
    uniform float uRippleDecay;
    uniform bool uShowNormals;
    
    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying vec2 vUv;
    varying float vHeight;
    
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
        vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
        
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
        p0 *= norm.x;
        p1 *= norm.y;
        p2 *= norm.z;
        p3 *= norm.w;
        
        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
    }
    
    vec2 rotateByDirection(vec2 pos, float directionDeg) {
        float rad = directionDeg * 0.01745329;
        float c = cos(rad);
        float s = sin(rad);
        return vec2(pos.x * c - pos.y * s, pos.x * s + pos.y * c);
    }
    
    float getSineWave(vec2 pos, float time, float freq, float speed, float direction) {
        vec2 rotated = rotateByDirection(pos, direction);
        return sin(rotated.x * freq + time * speed) * 
               cos(rotated.y * freq * 0.8 + time * speed * 0.7);
    }
    
    float getPerlinWave(vec2 pos, float time, float freq, float speed, float direction) {
        vec2 rotated = rotateByDirection(pos, direction);
        float noise1 = snoise(vec3(rotated * freq * 0.5, time * speed * 0.3));
        float noise2 = snoise(vec3(rotated * freq, time * speed * 0.5)) * 0.5;
        float noise3 = snoise(vec3(rotated * freq * 2.0, time * speed * 0.7)) * 0.25;
        return noise1 + noise2 + noise3;
    }
    
    float getGerstnerWave(vec2 pos, float time, float freq, float speed, float direction) {
        float wave = 0.0;
        float amp = 1.0;
        float f = freq;
        
        for (int i = 0; i < 4; i++) {
            vec2 dir = vec2(cos(float(i) * 0.7 + direction * 0.01745329), sin(float(i) * 0.7 + direction * 0.01745329));
            wave += amp * cos(dot(pos, dir * f) + time * speed);
            amp *= 0.5;
            f *= 1.8;
        }
        return wave;
    }
    
    float getRippleWave(vec2 pos, float time, float freq, float speed, float direction) {
        vec2 rotated = rotateByDirection(pos, direction);
        float dist = length(rotated);
        return sin(dist * freq * 2.0 - time * speed * 3.0) * exp(-dist * 0.15);
    }
    
    float getWave(vec2 pos, float time, int waveType, float freq, float speed, float direction) {
        if (waveType == 0) return getSineWave(pos, time, freq, speed, direction);
        else if (waveType == 1) return getPerlinWave(pos, time, freq, speed, direction);
        else if (waveType == 2) return getGerstnerWave(pos, time, freq, speed, direction);
        else if (waveType == 3) return getRippleWave(pos, time, freq, speed, direction);
        return 0.0;
    }
    
    float getMultiLayerWave(vec2 pos, float time, int waveType) {
        float height = 0.0;
        
        if (uLayerCount >= 1) {
            height += getWave(pos, time, waveType, uFrequency * uLayer0Frequency, uSpeed * uLayer0Speed, uWaveDirection + uLayer0Direction) * uLayer0Amplitude;
        }
        if (uLayerCount >= 2) {
            height += getWave(pos, time, waveType, uFrequency * uLayer1Frequency, uSpeed * uLayer1Speed, uWaveDirection + uLayer1Direction) * uLayer1Amplitude;
        }
        if (uLayerCount >= 3) {
            height += getWave(pos, time, waveType, uFrequency * uLayer2Frequency, uSpeed * uLayer2Speed, uWaveDirection + uLayer2Direction) * uLayer2Amplitude;
        }
        if (uLayerCount >= 4) {
            height += getWave(pos, time, waveType, uFrequency * uLayer3Frequency, uSpeed * uLayer3Speed, uWaveDirection + uLayer3Direction) * uLayer3Amplitude;
        }
        
        return height;
    }
    
    float getInteractiveRipples(vec2 pos, float time) {
        float height = 0.0;
        for (int i = 0; i < 10; i++) {
            if (i >= uRippleCount) break;
            vec2 ripplePos = vec2(uRipples[i].x, uRipples[i].y);
            float rippleTime = uRipples[i].z;
            float strength = uRippleStrengths[i];
            
            float dist = length(pos - ripplePos);
            float age = time - rippleTime;
            float wave = sin(dist * 10.0 - age * 5.0);
            float envelope = exp(-age * uRippleDecay) * exp(-dist / uRippleRadius);
            height += wave * envelope * strength;
        }
        return height;
    }
    
    float getEdgeDamping(vec2 pos) {
        if (uEdgeDamping < 0.001) return 1.0;
        float halfSize = uPoolSize * 0.5;
        float edgeDist = min(
            min(halfSize - abs(pos.x), halfSize - abs(pos.y)),
            halfSize
        );
        float dampingZone = uPoolSize * 0.2 * uEdgeDamping;
        return smoothstep(0.0, dampingZone, edgeDist);
    }
    
    float getChannelValue(vec3 color, int channel) {
        if (channel == 0) return dot(color, vec3(0.299, 0.587, 0.114));
        else if (channel == 1) return color.r;
        else if (channel == 2) return color.g;
        else if (channel == 3) return color.b;
        else if (channel == 4) return max(max(color.r, color.g), color.b);
        return dot(color, vec3(0.299, 0.587, 0.114));
    }
    
    void main() {
        vUv = uv;
        vec3 pos = position;
        
        float height = getMultiLayerWave(pos.xz, uTime, uWaveType);
        
        height += getInteractiveRipples(pos.xz, uTime);
        
        if (uDisplacementMode == 1) {
            vec2 dispUv = (pos.xz + uPoolSize * 0.5) / uPoolSize;
            dispUv.y = 1.0 - dispUv.y;
            vec3 texColor = texture2D(uDisplacementTexture, dispUv).rgb;
            float dispValue = getChannelValue(texColor, uDisplacementChannel);
            height = mix(height, dispValue * 2.0 - 1.0, uDisplacementInfluence);
        }
        
        float damping = getEdgeDamping(pos.xz);
        height *= damping;
        
        pos.y += height * uAmplitude;
        vHeight = height * uAmplitude;
        
        float eps = 0.05;
        float hL = getMultiLayerWave(pos.xz + vec2(-eps, 0.0), uTime, uWaveType) * damping;
        float hR = getMultiLayerWave(pos.xz + vec2(eps, 0.0), uTime, uWaveType) * damping;
        float hD = getMultiLayerWave(pos.xz + vec2(0.0, -eps), uTime, uWaveType) * damping;
        float hU = getMultiLayerWave(pos.xz + vec2(0.0, eps), uTime, uWaveType) * damping;
        
        hL += getInteractiveRipples(pos.xz + vec2(-eps, 0.0), uTime);
        hR += getInteractiveRipples(pos.xz + vec2(eps, 0.0), uTime);
        hD += getInteractiveRipples(pos.xz + vec2(0.0, -eps), uTime);
        hU += getInteractiveRipples(pos.xz + vec2(0.0, eps), uTime);
        
        vec3 normal = normalize(vec3(
            (hL - hR) * uAmplitude / eps,
            2.0,
            (hD - hU) * uAmplitude / eps
        ));
        
        vNormal = normalMatrix * normal;
        vWorldPosition = (modelMatrix * vec4(pos, 1.0)).xyz;
        
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
`;

const waterFragmentShader = `
    uniform vec3 uWaterColor;
    uniform float uClarity;
    uniform float uIOR;
    uniform vec3 uLightDir;
    uniform float uLightIntensity;
    uniform bool uShowNormals;
    uniform float uOpacity;
    uniform vec3 uLightColor;
    uniform bool uIsPointLight;
    uniform vec3 uPointLightPos;
    uniform bool uUseHeightGradient;
    uniform vec3 uWaterColorLow;
    uniform vec3 uWaterColorHigh;
    uniform bool uMultiLightEnabled;
    uniform int uMultiLightCount;
    uniform vec3 uLight1Dir;
    uniform vec3 uLight1Color;
    uniform float uLight1Intensity;
    uniform bool uLight1IsPoint;
    uniform vec3 uLight1Pos;
    uniform vec3 uLight2Dir;
    uniform vec3 uLight2Color;
    uniform float uLight2Intensity;
    uniform bool uLight2IsPoint;
    uniform vec3 uLight2Pos;
    uniform vec3 uLight3Dir;
    uniform vec3 uLight3Color;
    uniform float uLight3Intensity;
    uniform bool uLight3IsPoint;
    uniform vec3 uLight3Pos;
    uniform vec3 uLight4Dir;
    uniform vec3 uLight4Color;
    uniform float uLight4Intensity;
    uniform bool uLight4IsPoint;
    uniform vec3 uLight4Pos;
    
    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying vec2 vUv;
    varying float vHeight;
    
    void main() {
        vec3 normal = normalize(vNormal);
        
        if (uShowNormals) {
            vec3 normalColor = normal * 0.5 + 0.5;
            gl_FragColor = vec4(normalColor, 1.0);
            return;
        }
        
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        
        float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 3.0);
        fresnel = mix(0.1, 1.0, fresnel);
        
        vec3 waterCol;
        if (uUseHeightGradient) {
            float heightNorm = clamp(vHeight * 0.8 + 0.5, 0.0, 1.0);
            waterCol = mix(uWaterColorLow, uWaterColorHigh, heightNorm);
        } else {
            vec3 deepColor = uWaterColor * 0.3;
            vec3 shallowColor = uWaterColor;
            waterCol = mix(deepColor, shallowColor, 0.5 + vHeight * 2.0);
        }
        
        vec3 color = mix(waterCol, vec3(0.6, 0.8, 0.95), fresnel * 0.5);
        
        if (uMultiLightEnabled) {
            vec3 lDir;
            float lDist;
            float diff;
            vec3 refl;
            float spec;
            float atten;
            float effInt;
            
            if (uMultiLightCount >= 1) {
                lDir = normalize(uLight1Dir);
                lDist = 1.0;
                if (uLight1IsPoint) {
                    vec3 lVec = uLight1Pos - vWorldPosition;
                    lDist = length(lVec);
                    lDir = normalize(lVec);
                }
                diff = max(dot(normal, lDir), 0.0);
                refl = reflect(-viewDir, normal);
                spec = pow(max(dot(refl, lDir), 0.0), 64.0);
                atten = uLight1IsPoint ? 1.0 / (1.0 + 0.01 * lDist * lDist) : 1.0;
                effInt = uLight1Intensity * atten;
                color += waterCol * diff * effInt * 0.3 * uLight1Color;
                color += uLight1Color * spec * effInt * 0.8;
            }
            if (uMultiLightCount >= 2) {
                lDir = normalize(uLight2Dir);
                lDist = 1.0;
                if (uLight2IsPoint) {
                    vec3 lVec = uLight2Pos - vWorldPosition;
                    lDist = length(lVec);
                    lDir = normalize(lVec);
                }
                diff = max(dot(normal, lDir), 0.0);
                refl = reflect(-viewDir, normal);
                spec = pow(max(dot(refl, lDir), 0.0), 64.0);
                atten = uLight2IsPoint ? 1.0 / (1.0 + 0.01 * lDist * lDist) : 1.0;
                effInt = uLight2Intensity * atten;
                color += waterCol * diff * effInt * 0.3 * uLight2Color;
                color += uLight2Color * spec * effInt * 0.8;
            }
            if (uMultiLightCount >= 3) {
                lDir = normalize(uLight3Dir);
                lDist = 1.0;
                if (uLight3IsPoint) {
                    vec3 lVec = uLight3Pos - vWorldPosition;
                    lDist = length(lVec);
                    lDir = normalize(lVec);
                }
                diff = max(dot(normal, lDir), 0.0);
                refl = reflect(-viewDir, normal);
                spec = pow(max(dot(refl, lDir), 0.0), 64.0);
                atten = uLight3IsPoint ? 1.0 / (1.0 + 0.01 * lDist * lDist) : 1.0;
                effInt = uLight3Intensity * atten;
                color += waterCol * diff * effInt * 0.3 * uLight3Color;
                color += uLight3Color * spec * effInt * 0.8;
            }
            if (uMultiLightCount >= 4) {
                lDir = normalize(uLight4Dir);
                lDist = 1.0;
                if (uLight4IsPoint) {
                    vec3 lVec = uLight4Pos - vWorldPosition;
                    lDist = length(lVec);
                    lDir = normalize(lVec);
                }
                diff = max(dot(normal, lDir), 0.0);
                refl = reflect(-viewDir, normal);
                spec = pow(max(dot(refl, lDir), 0.0), 64.0);
                atten = uLight4IsPoint ? 1.0 / (1.0 + 0.01 * lDist * lDist) : 1.0;
                effInt = uLight4Intensity * atten;
                color += waterCol * diff * effInt * 0.3 * uLight4Color;
                color += uLight4Color * spec * effInt * 0.8;
            }
        } else {
            vec3 lightDir;
            float lightDist = 1.0;
            
            if (uIsPointLight) {
                vec3 lightVec = uPointLightPos - vWorldPosition;
                lightDist = length(lightVec);
                lightDir = normalize(lightVec);
            } else {
                lightDir = normalize(uLightDir);
            }
            
            float diffuse = max(dot(normal, lightDir), 0.0);
            vec3 reflectDir = reflect(-viewDir, normal);
            float spec = pow(max(dot(reflectDir, lightDir), 0.0), 64.0);
            float attenuation = uIsPointLight ? 1.0 / (1.0 + 0.01 * lightDist * lightDist) : 1.0;
            float effectiveIntensity = uLightIntensity * attenuation;
            
            color += waterCol * diffuse * effectiveIntensity * 0.3 * uLightColor;
            color += uLightColor * spec * effectiveIntensity * 0.8;
        }
        
        float baseAlpha = mix(0.3, 0.9, fresnel) * uClarity;
        float alpha = mix(baseAlpha * 0.3, 1.0, uOpacity);
        
        gl_FragColor = vec4(color, alpha);
    }
`;

export class WaterSurface {
    constructor(scene, state) {
        this.scene = scene;
        this.state = state;
        
        this.geometry = new THREE.PlaneGeometry(
            state.scene.poolSize,
            state.scene.poolSize,
            128,
            128
        );
        this.geometry.rotateX(-Math.PI / 2);
        
        this.material = new THREE.ShaderMaterial({
            vertexShader: waterVertexShader,
            fragmentShader: waterFragmentShader,
            uniforms: {
                uTime: { value: 0 },
                uAmplitude: { value: state.wave.amplitude },
                uFrequency: { value: state.wave.frequency },
                uWaveType: { value: this.getWaveTypeIndex(state.wave.type) },
                uSpeed: { value: state.wave.speed },
                uWaterColor: { value: new THREE.Color(state.scene.waterColor) },
                uClarity: { value: state.material.clarity },
                uIOR: { value: state.material.ior },
                uLightDir: { value: new THREE.Vector3(0, -1, 0) },
                uLightIntensity: { value: state.light.intensity },
                uDisplacementTexture: { value: null },
                uDisplacementMode: { value: 0 },
                uDisplacementChannel: { value: 0 },
                uDisplacementInfluence: { value: 0.5 },
                uPoolSize: { value: state.scene.poolSize },
                uWaveDirection: { value: state.wave.direction },
                uEdgeDamping: { value: state.wave.edgeDamping },
                uLayerCount: { value: state.wave.layerCount },
                uLayer0Amplitude: { value: state.wave.layers[0].amplitude },
                uLayer0Frequency: { value: state.wave.layers[0].frequency },
                uLayer0Speed: { value: state.wave.layers[0].speed },
                uLayer0Direction: { value: state.wave.layers[0].direction },
                uLayer1Amplitude: { value: state.wave.layers[1].amplitude },
                uLayer1Frequency: { value: state.wave.layers[1].frequency },
                uLayer1Speed: { value: state.wave.layers[1].speed },
                uLayer1Direction: { value: state.wave.layers[1].direction },
                uLayer2Amplitude: { value: state.wave.layers[2].amplitude },
                uLayer2Frequency: { value: state.wave.layers[2].frequency },
                uLayer2Speed: { value: state.wave.layers[2].speed },
                uLayer2Direction: { value: state.wave.layers[2].direction },
                uLayer3Amplitude: { value: state.wave.layers[3].amplitude },
                uLayer3Frequency: { value: state.wave.layers[3].frequency },
                uLayer3Speed: { value: state.wave.layers[3].speed },
                uLayer3Direction: { value: state.wave.layers[3].direction },
                uRipples: { value: new Array(10).fill(new THREE.Vector3()) },
                uRippleStrengths: { value: new Array(10).fill(0) },
                uRippleCount: { value: 0 },
                uRippleRadius: { value: state.interaction.rippleRadius },
                uRippleDecay: { value: state.interaction.rippleDecay },
                uShowNormals: { value: state.debug.showNormals },
                uOpacity: { value: state.wave.opacity ?? 0.8 },
                uLightColor: { value: new THREE.Color(state.light.color) },
                uIsPointLight: { value: state.light.type === 'point' },
                uPointLightPos: { value: new THREE.Vector3(
                    state.light.pointPosition.x,
                    state.light.pointPosition.y,
                    state.light.pointPosition.z
                ) },
                uUseHeightGradient: { value: state.wave.useHeightGradient ?? false },
                uWaterColorLow: { value: new THREE.Color(state.wave.waterColorLow ?? '#1a3a5c') },
                uWaterColorHigh: { value: new THREE.Color(state.wave.waterColorHigh ?? '#88ccff') },
                uMultiLightEnabled: { value: false },
                uMultiLightCount: { value: 1 },
                uLight1Dir: { value: new THREE.Vector3(0, -1, 0) },
                uLight1Color: { value: new THREE.Color('#FFFFFF') },
                uLight1Intensity: { value: 1.5 },
                uLight1IsPoint: { value: false },
                uLight1Pos: { value: new THREE.Vector3(0, 5, 0) },
                uLight2Dir: { value: new THREE.Vector3(0, -1, 0) },
                uLight2Color: { value: new THREE.Color('#FF8844') },
                uLight2Intensity: { value: 1.0 },
                uLight2IsPoint: { value: false },
                uLight2Pos: { value: new THREE.Vector3(5, 4, 5) },
                uLight3Dir: { value: new THREE.Vector3(0, -1, 0) },
                uLight3Color: { value: new THREE.Color('#4488FF') },
                uLight3Intensity: { value: 1.2 },
                uLight3IsPoint: { value: true },
                uLight3Pos: { value: new THREE.Vector3(-3, 6, -3) },
                uLight4Dir: { value: new THREE.Vector3(0, -1, 0) },
                uLight4Color: { value: new THREE.Color('#FF44FF') },
                uLight4Intensity: { value: 0.8 },
                uLight4IsPoint: { value: false },
                uLight4Pos: { value: new THREE.Vector3(0, 3, 0) }
            },
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        
        this.mesh = new THREE.Mesh(this.geometry, this.material);
        this.mesh.position.y = 0;
        this.mesh.receiveShadow = true;
        this.mesh.castShadow = true;
        
        scene.add(this.mesh);
    }
    
    getWaveTypeIndex(type) {
        const types = { none: 4, sine: 0, perlin: 1, gerstner: 2, ripple: 3 };
        return types[type] ?? 1;
    }
    
    update(time, waveParams) {
        this.material.uniforms.uTime.value = time;
        this.material.uniforms.uAmplitude.value = waveParams.amplitude;
        this.material.uniforms.uFrequency.value = waveParams.frequency;
        this.material.uniforms.uSpeed.value = waveParams.speed;
        this.material.uniforms.uWaveType.value = this.getWaveTypeIndex(waveParams.type);
        this.material.uniforms.uWaveDirection.value = waveParams.direction ?? 0;
        this.material.uniforms.uEdgeDamping.value = waveParams.edgeDamping ?? 0;
        this.material.uniforms.uLayerCount.value = waveParams.layerCount ?? 1;
        
        if (waveParams.layers) {
            for (let i = 0; i < 4; i++) {
                const layer = waveParams.layers[i];
                if (layer) {
                    this.material.uniforms[`uLayer${i}Amplitude`].value = layer.amplitude;
                    this.material.uniforms[`uLayer${i}Frequency`].value = layer.frequency;
                    this.material.uniforms[`uLayer${i}Speed`].value = layer.speed;
                    this.material.uniforms[`uLayer${i}Direction`].value = layer.direction;
                }
            }
        }
    }
    
    updateMaterial(state) {
        this.material.uniforms.uWaterColor.value.set(state.scene.waterColor);
        this.material.uniforms.uClarity.value = state.material.clarity;
        this.material.uniforms.uIOR.value = state.material.ior;
        this.material.uniforms.uLightIntensity.value = state.light.intensity;
        this.material.uniforms.uOpacity.value = state.wave.opacity ?? 0.8;
        this.material.uniforms.uLightColor.value.set(state.light.color);
        this.material.uniforms.uIsPointLight.value = state.light.type === 'point';
        this.material.uniforms.uUseHeightGradient.value = state.wave.useHeightGradient ?? false;
        this.material.uniforms.uWaterColorLow.value.set(state.wave.waterColorLow ?? '#1a3a5c');
        this.material.uniforms.uWaterColorHigh.value.set(state.wave.waterColorHigh ?? '#88ccff');
    }
    
    updateLightInfo(lightState) {
        this.material.uniforms.uLightColor.value.set(lightState.color);
        this.material.uniforms.uIsPointLight.value = lightState.type === 'point';
        if (lightState.type === 'point') {
            this.material.uniforms.uPointLightPos.value.set(
                lightState.pointPosition.x,
                lightState.pointPosition.y,
                lightState.pointPosition.z
            );
        }
    }
    
    updateMultiLight(multiLightState, primaryLightState) {
        if (!multiLightState) return;
        
        this.material.uniforms.uMultiLightEnabled.value = multiLightState.enabled ?? false;
        this.material.uniforms.uMultiLightCount.value = multiLightState.count ?? 1;
        
        if (primaryLightState) {
            const azimuthRad = (primaryLightState.azimuth ?? 45) * Math.PI / 180;
            const elevationRad = (primaryLightState.elevation ?? 60) * Math.PI / 180;
            this.material.uniforms.uLight1Dir.value.set(
                Math.cos(elevationRad) * Math.sin(azimuthRad),
                -Math.sin(elevationRad),
                Math.cos(elevationRad) * Math.cos(azimuthRad)
            );
            this.material.uniforms.uLight1Color.value.set(primaryLightState.color ?? '#FFFFFF');
            this.material.uniforms.uLight1Intensity.value = primaryLightState.intensity ?? 1.5;
            this.material.uniforms.uLight1IsPoint.value = primaryLightState.type === 'point';
            this.material.uniforms.uLight1Pos.value.set(
                primaryLightState.pointPosition?.x ?? 0,
                primaryLightState.pointPosition?.y ?? 5,
                primaryLightState.pointPosition?.z ?? 0
            );
        }
        
        if (multiLightState.lights && multiLightState.lights[1]) {
            const light = multiLightState.lights[1];
            const azimuthRad = (light.azimuth ?? 135) * Math.PI / 180;
            const elevationRad = (light.elevation ?? 45) * Math.PI / 180;
            this.material.uniforms.uLight2Dir.value.set(
                Math.cos(elevationRad) * Math.sin(azimuthRad),
                -Math.sin(elevationRad),
                Math.cos(elevationRad) * Math.cos(azimuthRad)
            );
            this.material.uniforms.uLight2Color.value.set(light.color ?? '#FF8844');
            this.material.uniforms.uLight2Intensity.value = light.intensity ?? 1.0;
            this.material.uniforms.uLight2IsPoint.value = light.type === 'point';
            this.material.uniforms.uLight2Pos.value.set(
                light.position?.x ?? 5,
                light.position?.y ?? 4,
                light.position?.z ?? 5
            );
        }
        
        if (multiLightState.lights && multiLightState.lights[2]) {
            const light = multiLightState.lights[2];
            const azimuthRad = (light.azimuth ?? 0) * Math.PI / 180;
            const elevationRad = (light.elevation ?? 70) * Math.PI / 180;
            this.material.uniforms.uLight3Dir.value.set(
                Math.cos(elevationRad) * Math.sin(azimuthRad),
                -Math.sin(elevationRad),
                Math.cos(elevationRad) * Math.cos(azimuthRad)
            );
            this.material.uniforms.uLight3Color.value.set(light.color ?? '#4488FF');
            this.material.uniforms.uLight3Intensity.value = light.intensity ?? 1.2;
            this.material.uniforms.uLight3IsPoint.value = light.type === 'point';
            this.material.uniforms.uLight3Pos.value.set(
                light.position?.x ?? -3,
                light.position?.y ?? 6,
                light.position?.z ?? -3
            );
        }
        
        if (multiLightState.lights && multiLightState.lights[3]) {
            const light = multiLightState.lights[3];
            const azimuthRad = (light.azimuth ?? 270) * Math.PI / 180;
            const elevationRad = (light.elevation ?? 30) * Math.PI / 180;
            this.material.uniforms.uLight4Dir.value.set(
                Math.cos(elevationRad) * Math.sin(azimuthRad),
                -Math.sin(elevationRad),
                Math.cos(elevationRad) * Math.cos(azimuthRad)
            );
            this.material.uniforms.uLight4Color.value.set(light.color ?? '#FF44FF');
            this.material.uniforms.uLight4Intensity.value = light.intensity ?? 0.8;
            this.material.uniforms.uLight4IsPoint.value = light.type === 'point';
            this.material.uniforms.uLight4Pos.value.set(
                light.position?.x ?? 0,
                light.position?.y ?? 3,
                light.position?.z ?? 0
            );
        }
    }
    
    setLightDirection(dir) {
        this.material.uniforms.uLightDir.value.copy(dir);
    }
    
    setVisible(visible) {
        this.mesh.visible = visible;
    }
    
    setWireframe(wireframe) {
        this.material.wireframe = wireframe;
    }
    
    getGeometry() {
        return this.geometry;
    }
    
    getMesh() {
        return this.mesh;
    }
    
    setDisplacementTexture(texture) {
        this.material.uniforms.uDisplacementTexture.value = texture;
    }
    
    setDisplacementMode(mode) {
        this.material.uniforms.uDisplacementMode.value = mode === 'media' ? 1 : 0;
    }
    
    setDisplacementChannel(channel) {
        const channels = { luminance: 0, red: 1, green: 2, blue: 3, alpha: 4, motion: 0 };
        this.material.uniforms.uDisplacementChannel.value = channels[channel] ?? 0;
    }
    
    setDisplacementInfluence(influence) {
        this.material.uniforms.uDisplacementInfluence.value = influence;
    }
    
    setGeometryResolution(resolution) {
        this.scene.remove(this.mesh);
        this.geometry.dispose();
        this.geometry = new THREE.PlaneGeometry(
            this.state.scene.poolSize,
            this.state.scene.poolSize,
            resolution,
            resolution
        );
        this.geometry.rotateX(-Math.PI / 2);
        this.mesh.geometry = this.geometry;
        this.scene.add(this.mesh);
    }
    
    setPoolSize(size) {
        this.state.scene.poolSize = size;
        this.material.uniforms.uPoolSize.value = size;
        this.scene.remove(this.mesh);
        this.geometry.dispose();
        this.geometry = new THREE.PlaneGeometry(
            size,
            size,
            this.state.display.waterResolution,
            this.state.display.waterResolution
        );
        this.geometry.rotateX(-Math.PI / 2);
        this.mesh.geometry = this.geometry;
        this.scene.add(this.mesh);
    }
    
    setRipples(ripples, strengths, count) {
        for (let i = 0; i < 10; i++) {
            if (i < count && ripples[i]) {
                this.material.uniforms.uRipples.value[i] = ripples[i];
                this.material.uniforms.uRippleStrengths.value[i] = strengths[i] ?? 0;
            } else {
                this.material.uniforms.uRipples.value[i] = new THREE.Vector3();
                this.material.uniforms.uRippleStrengths.value[i] = 0;
            }
        }
        this.material.uniforms.uRippleCount.value = count;
    }
    
    setRippleParams(radius, decay) {
        this.material.uniforms.uRippleRadius.value = radius;
        this.material.uniforms.uRippleDecay.value = decay;
    }
    
    setShowNormals(show) {
        this.material.uniforms.uShowNormals.value = show;
    }
    
    setWaveDirection(direction) {
        this.material.uniforms.uWaveDirection.value = direction;
    }
    
    setEdgeDamping(damping) {
        this.material.uniforms.uEdgeDamping.value = damping;
    }
    
    setLayerCount(count) {
        this.material.uniforms.uLayerCount.value = count;
    }
    
    setLayerParams(layerIndex, params) {
        if (layerIndex >= 0 && layerIndex < 4) {
            if (params.amplitude !== undefined) 
                this.material.uniforms[`uLayer${layerIndex}Amplitude`].value = params.amplitude;
            if (params.frequency !== undefined) 
                this.material.uniforms[`uLayer${layerIndex}Frequency`].value = params.frequency;
            if (params.speed !== undefined) 
                this.material.uniforms[`uLayer${layerIndex}Speed`].value = params.speed;
            if (params.direction !== undefined) 
                this.material.uniforms[`uLayer${layerIndex}Direction`].value = params.direction;
        }
    }
    
    setAmplitude(value) {
        this.material.uniforms.uAmplitude.value = value;
    }
    
    setFrequency(value) {
        this.material.uniforms.uFrequency.value = value;
    }
    
    setSpeed(value) {
        this.material.uniforms.uSpeed.value = value;
    }
}
