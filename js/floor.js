import * as THREE from 'three';

const floorVertexShader = `
    varying vec2 vUv;
    varying vec3 vWorldPosition;
    
    void main() {
        vUv = uv;
        vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const floorFragmentShader = `
    uniform sampler2D uCausticsTexture;
    uniform vec3 uFloorColor;
    uniform float uPoolSize;
    uniform float uDepth;
    uniform int uFloorPattern;
    uniform float uPatternScale;
    uniform bool uShowHeatmap;
    uniform float uHeatmapScale;
    
    varying vec2 vUv;
    varying vec3 vWorldPosition;
    
    vec3 heatmapColor(float t) {
        vec3 cold = vec3(0.0, 0.0, 0.5);
        vec3 cool = vec3(0.0, 0.5, 1.0);
        vec3 warm = vec3(1.0, 1.0, 0.0);
        vec3 hot = vec3(1.0, 0.0, 0.0);
        
        if (t < 0.33) return mix(cold, cool, t * 3.0);
        else if (t < 0.66) return mix(cool, warm, (t - 0.33) * 3.0);
        else return mix(warm, hot, (t - 0.66) * 3.0);
    }
    
    float checkerboard(vec2 uv, float scale) {
        vec2 grid = floor(uv * scale);
        return mod(grid.x + grid.y, 2.0);
    }
    
    float grid(vec2 uv, float scale) {
        vec2 grid = fract(uv * scale);
        float line = step(0.95, grid.x) + step(0.95, grid.y);
        return min(line, 1.0);
    }
    
    float dots(vec2 uv, float scale) {
        vec2 cell = fract(uv * scale) - 0.5;
        return 1.0 - step(0.3, length(cell));
    }
    
    float hexagon(vec2 uv, float scale) {
        vec2 s = vec2(1.0, 1.732);
        vec2 a = mod(uv * scale, s * 2.0) - s;
        vec2 b = mod(uv * scale - s, s * 2.0) - s;
        return min(dot(a, a), dot(b, b));
    }
    
    void main() {
        vec2 causticsUv = (vWorldPosition.xz + uPoolSize * 0.5) / uPoolSize;
        
        vec3 caustics = vec3(0.0);
        float causticsIntensity = 0.0;
        if (causticsUv.x >= 0.0 && causticsUv.x <= 1.0 && causticsUv.y >= 0.0 && causticsUv.y <= 1.0) {
            caustics = texture2D(uCausticsTexture, causticsUv).rgb;
            causticsIntensity = (caustics.r + caustics.g + caustics.b) / 3.0;
        }
        
        float distFromCenter = length(vWorldPosition.xz);
        float vignette = 1.0 - smoothstep(uPoolSize * 0.4, uPoolSize * 0.55, distFromCenter);
        
        vec3 baseColor = uFloorColor * 0.3;
        
        if (uFloorPattern > 0) {
            float pattern = 0.0;
            vec2 patternUv = (vWorldPosition.xz + uPoolSize * 0.5) / uPoolSize;
            
            if (uFloorPattern == 1) {
                pattern = checkerboard(patternUv, uPatternScale);
            } else if (uFloorPattern == 2) {
                pattern = grid(patternUv, uPatternScale);
            } else if (uFloorPattern == 3) {
                pattern = dots(patternUv, uPatternScale);
            } else if (uFloorPattern == 4) {
                pattern = 1.0 - smoothstep(0.0, 0.3, hexagon(patternUv, uPatternScale));
            }
            
            baseColor = mix(baseColor, baseColor * 1.5, pattern * 0.3);
        }
        
        vec3 causticsEnhanced = caustics * 3.0;
        causticsEnhanced = pow(causticsEnhanced, vec3(0.8));
        
        vec3 color = baseColor + causticsEnhanced * vignette;
        
        if (uShowHeatmap) {
            float heat = causticsIntensity * uHeatmapScale;
            heat = clamp(heat, 0.0, 1.0);
            vec3 heatColor = heatmapColor(heat);
            color = mix(color, heatColor, 0.7);
        }
        
        color = color / (1.0 + color * 0.3);
        
        gl_FragColor = vec4(color, 1.0);
    }
`;

export class FloorPlane {
    constructor(scene, sceneState) {
        this.scene = scene;
        this.state = sceneState;
        
        this.geometry = new THREE.PlaneGeometry(
            sceneState.poolSize,
            sceneState.poolSize,
            1,
            1
        );
        this.geometry.rotateX(-Math.PI / 2);
        
        this.dummyTexture = new THREE.DataTexture(
            new Uint8Array([128, 128, 128, 255]),
            1, 1,
            THREE.RGBAFormat
        );
        this.dummyTexture.needsUpdate = true;
        
        this.material = new THREE.ShaderMaterial({
            vertexShader: floorVertexShader,
            fragmentShader: floorFragmentShader,
            uniforms: {
                uCausticsTexture: { value: this.dummyTexture },
                uFloorColor: { value: new THREE.Color(sceneState.floorColor) },
                uPoolSize: { value: sceneState.poolSize },
                uDepth: { value: sceneState.depth },
                uFloorPattern: { value: 0 },
                uPatternScale: { value: 5.0 },
                uShowHeatmap: { value: false },
                uHeatmapScale: { value: 1.0 }
            }
        });
        
        this.mesh = new THREE.Mesh(this.geometry, this.material);
        this.mesh.position.y = -sceneState.depth;
        this.mesh.receiveShadow = true;
        
        scene.add(this.mesh);
        
        this.createPoolWalls(scene, sceneState);
    }
    
    createPoolWalls(scene, sceneState) {
        this.walls = [];
        
        const wallMaterial = new THREE.MeshStandardMaterial({
            color: 0x2a2a3e,
            roughness: 0.8,
            metalness: 0.1,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.15
        });
        
        const halfSize = sceneState.poolSize / 2;
        const depth = sceneState.depth;
        
        const wallGeom = new THREE.PlaneGeometry(sceneState.poolSize, depth);
        
        const frontWall = new THREE.Mesh(wallGeom, wallMaterial);
        frontWall.position.set(0, -depth / 2, halfSize);
        scene.add(frontWall);
        this.walls.push(frontWall);
        
        const backWall = new THREE.Mesh(wallGeom, wallMaterial);
        backWall.position.set(0, -depth / 2, -halfSize);
        backWall.rotation.y = Math.PI;
        scene.add(backWall);
        this.walls.push(backWall);
        
        const sideWallGeom = new THREE.PlaneGeometry(sceneState.poolSize, depth);
        
        const leftWall = new THREE.Mesh(sideWallGeom, wallMaterial);
        leftWall.position.set(-halfSize, -depth / 2, 0);
        leftWall.rotation.y = Math.PI / 2;
        scene.add(leftWall);
        this.walls.push(leftWall);
        
        const rightWall = new THREE.Mesh(sideWallGeom, wallMaterial);
        rightWall.position.set(halfSize, -depth / 2, 0);
        rightWall.rotation.y = -Math.PI / 2;
        scene.add(rightWall);
        this.walls.push(rightWall);
    }
    
    setWallsVisible(visible) {
        this.walls.forEach(wall => {
            wall.visible = visible;
        });
    }
    
    setCausticsTexture(texture) {
        this.material.uniforms.uCausticsTexture.value = texture;
    }
    
    updateColors(sceneState) {
        this.material.uniforms.uFloorColor.value.set(sceneState.floorColor);
        this.material.uniforms.uPoolSize.value = sceneState.poolSize;
        this.material.uniforms.uDepth.value = sceneState.depth;
        
        this.mesh.position.y = -sceneState.depth;
    }
    
    setVisible(visible) {
        this.mesh.visible = visible;
    }
    
    setFloorPattern(pattern) {
        const patterns = { none: 0, solid: 0, checkerboard: 1, grid: 2, dots: 3, hexagon: 4 };
        this.material.uniforms.uFloorPattern.value = patterns[pattern] ?? 0;
    }
    
    setPatternScale(scale) {
        this.material.uniforms.uPatternScale.value = scale;
    }
    
    setShowHeatmap(show) {
        this.material.uniforms.uShowHeatmap.value = show;
    }
    
    setHeatmapScale(scale) {
        this.material.uniforms.uHeatmapScale.value = scale;
    }
    
    setPoolSize(size) {
        this.state.poolSize = size;
        this.material.uniforms.uPoolSize.value = size;
        
        this.scene.remove(this.mesh);
        this.geometry.dispose();
        this.geometry = new THREE.PlaneGeometry(
            size,
            size,
            1,
            1
        );
        this.geometry.rotateX(-Math.PI / 2);
        this.mesh.geometry = this.geometry;
        this.scene.add(this.mesh);
        
        this.updateWallGeometry(size);
    }
    
    updateWallGeometry(size) {
        const depth = this.state.depth;
        const halfSize = size / 2;
        
        this.walls.forEach((wall, i) => {
            this.scene.remove(wall);
            wall.geometry.dispose();
            wall.geometry = new THREE.PlaneGeometry(size, depth);
            
            if (i === 0) {
                wall.position.set(0, -depth / 2, halfSize);
            } else if (i === 1) {
                wall.position.set(0, -depth / 2, -halfSize);
            } else if (i === 2) {
                wall.position.set(-halfSize, -depth / 2, 0);
            } else {
                wall.position.set(halfSize, -depth / 2, 0);
            }
            
            this.scene.add(wall);
        });
    }
}
