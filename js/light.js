import * as THREE from 'three';

export class LightManager {
    constructor(scene, lightState) {
        this.scene = scene;
        this.lightState = lightState;
        this.animationTime = 0;
        this.maxLights = 4;
        this.lights = [];
        
        for (let i = 0; i < this.maxLights; i++) {
            const lightData = {
                directional: new THREE.DirectionalLight(0xffffff, i === 0 ? lightState.intensity : 0),
                point: new THREE.PointLight(0xffffff, i === 0 ? lightState.intensity : 0, 50),
                directionalHelper: null,
                pointHelper: null,
                active: i === 0
            };
            
            lightData.directional.position.set(10, 10, 5);
            lightData.directional.castShadow = i === 0;
            if (i === 0) {
                lightData.directional.shadow.mapSize.width = 2048;
                lightData.directional.shadow.mapSize.height = 2048;
                lightData.directional.shadow.camera.near = 0.5;
                lightData.directional.shadow.camera.far = 50;
                lightData.directional.shadow.camera.left = -15;
                lightData.directional.shadow.camera.right = 15;
                lightData.directional.shadow.camera.top = 15;
                lightData.directional.shadow.camera.bottom = -15;
            }
            lightData.directional.visible = i === 0 && lightState.type !== 'point';
            scene.add(lightData.directional);
            
            lightData.directionalHelper = new THREE.DirectionalLightHelper(lightData.directional, 1);
            lightData.directionalHelper.visible = false;
            scene.add(lightData.directionalHelper);
            
            lightData.point.position.set(
                lightState.pointPosition?.x ?? 0,
                lightState.pointPosition?.y ?? 5,
                lightState.pointPosition?.z ?? 0
            );
            lightData.point.castShadow = i === 0;
            lightData.point.visible = i === 0 && lightState.type === 'point';
            scene.add(lightData.point);
            
            lightData.pointHelper = new THREE.PointLightHelper(lightData.point, 0.5);
            lightData.pointHelper.visible = false;
            scene.add(lightData.pointHelper);
            
            this.lights.push(lightData);
        }
        
        this.lightDirection = new THREE.Vector3(0, -1, 0);
        
        this.update(lightState);
    }
    
    update(lightState, multiLightState = null) {
        this.lightState = lightState;
        
        if (multiLightState && multiLightState.enabled) {
            this.updateMultiLight(multiLightState);
        } else {
            this.updateSingleLight(lightState);
        }
    }
    
    updateSingleLight(lightState) {
        const isPoint = lightState.type === 'point';
        
        for (let i = 0; i < this.maxLights; i++) {
            this.lights[i].active = i === 0;
            this.lights[i].directional.visible = i === 0 && !isPoint;
            this.lights[i].point.visible = i === 0 && isPoint;
        }
        
        const light = this.lights[0];
        
        if (isPoint) {
            light.point.color.set(lightState.color);
            light.point.intensity = lightState.intensity;
            
            if (lightState.animate) {
                this.animationTime += 0.016 * lightState.animationSpeed;
                const radius = lightState.pointRadius;
                let x, y, z;
                
                if (lightState.animationType === 'orbit') {
                    x = Math.sin(this.animationTime) * radius;
                    z = Math.cos(this.animationTime) * radius;
                    y = lightState.pointPosition.y;
                } else if (lightState.animationType === 'bounce') {
                    x = lightState.pointPosition.x;
                    y = Math.abs(Math.sin(this.animationTime * 2)) * radius + 1;
                    z = lightState.pointPosition.z;
                } else {
                    x = lightState.pointPosition.x + Math.sin(this.animationTime) * radius * 0.5;
                    y = lightState.pointPosition.y + Math.sin(this.animationTime * 1.5) * radius * 0.3;
                    z = lightState.pointPosition.z + Math.cos(this.animationTime) * radius * 0.5;
                }
                
                light.point.position.set(x, y, z);
            } else {
                light.point.position.set(
                    lightState.pointPosition.x,
                    lightState.pointPosition.y,
                    lightState.pointPosition.z
                );
            }
            
            this.lightDirection.set(
                light.point.position.x,
                light.point.position.y,
                light.point.position.z
            ).normalize().negate();
            
            light.pointHelper.update();
        } else {
            const azimuth = THREE.MathUtils.degToRad(lightState.azimuth);
            const elevation = THREE.MathUtils.degToRad(lightState.elevation);
            
            const x = Math.sin(azimuth) * Math.cos(elevation);
            const y = Math.sin(elevation);
            const z = Math.cos(azimuth) * Math.cos(elevation);
            
            this.lightDirection.set(x, -y, z).normalize();
            
            light.directional.position.set(-x * 15, y * 15, -z * 15);
            light.directional.color.set(lightState.color);
            light.directional.intensity = lightState.intensity;
            
            light.directionalHelper.update();
        }
    }
    
    updateMultiLight(multiLightState) {
        const count = Math.min(multiLightState.count || 1, this.maxLights);
        
        for (let i = 0; i < this.maxLights; i++) {
            const light = this.lights[i];
            light.active = i < count;
            
            if (i < count && multiLightState.lights && multiLightState.lights[i]) {
                const lightConfig = multiLightState.lights[i];
                const isPoint = lightConfig.type === 'point';
                
                light.directional.visible = !isPoint;
                light.point.visible = isPoint;
                
                if (isPoint) {
                    light.point.color.set(lightConfig.color);
                    light.point.intensity = lightConfig.intensity;
                    light.point.position.set(
                        lightConfig.position?.x ?? 0,
                        lightConfig.position?.y ?? 5,
                        lightConfig.position?.z ?? 0
                    );
                    light.pointHelper.update();
                } else {
                    const azimuth = THREE.MathUtils.degToRad(lightConfig.azimuth ?? 45);
                    const elevation = THREE.MathUtils.degToRad(lightConfig.elevation ?? 60);
                    
                    const x = Math.sin(azimuth) * Math.cos(elevation);
                    const y = Math.sin(elevation);
                    const z = Math.cos(azimuth) * Math.cos(elevation);
                    
                    light.directional.position.set(-x * 15, y * 15, -z * 15);
                    light.directional.color.set(lightConfig.color);
                    light.directional.intensity = lightConfig.intensity;
                    light.directionalHelper.update();
                }
            } else {
                light.directional.visible = false;
                light.point.visible = false;
            }
        }
        
        if (this.lights[0].active) {
            const light = this.lights[0];
            if (multiLightState.lights[0].type === 'point') {
                this.lightDirection.copy(light.point.position).normalize().negate();
            } else {
                this.lightDirection.copy(light.directional.position).normalize().negate();
            }
        }
    }
    
    getDirection() {
        return this.lightDirection;
    }
    
    getPosition() {
        if (this.lightState.type === 'point') {
            return this.lights[0].point.position.clone();
        }
        return this.lights[0].directional.position.clone();
    }
    
    getLightData() {
        const data = {
            count: 0,
            positions: [],
            colors: [],
            intensities: [],
            types: []
        };
        
        for (let i = 0; i < this.maxLights; i++) {
            const light = this.lights[i];
            if (!light.active) continue;
            
            data.count++;
            
            if (light.point.visible) {
                data.positions.push(light.point.position.x, light.point.position.y, light.point.position.z);
                data.types.push(1);
            } else {
                const dir = light.directional.position.clone().normalize();
                data.positions.push(dir.x, dir.y, dir.z);
                data.types.push(0);
            }
            
            const color = light.point.visible ? light.point.color : light.directional.color;
            data.colors.push(color.r, color.g, color.b);
            
            data.intensities.push(light.point.visible ? light.point.intensity : light.directional.intensity);
        }
        
        return data;
    }
    
    setHelperVisible(visible) {
        for (const light of this.lights) {
            if (light.active) {
                light.directionalHelper.visible = visible && light.directional.visible;
                light.pointHelper.visible = visible && light.point.visible;
            } else {
                light.directionalHelper.visible = false;
                light.pointHelper.visible = false;
            }
        }
    }
    
    setPointPosition(x, y, z) {
        this.lightState.pointPosition = { x, y, z };
        this.lights[0].point.position.set(x, y, z);
    }
    
    setAnimation(enabled, speed, type) {
        this.lightState.animate = enabled;
        if (speed !== undefined) this.lightState.animationSpeed = speed;
        if (type !== undefined) this.lightState.animationType = type;
    }
    
    setLightCount(count) {
        for (let i = 0; i < this.maxLights; i++) {
            this.lights[i].active = i < count;
        }
    }
}
