import * as THREE from 'three';

export class Interaction {
    constructor(app) {
        this.app = app;
        this.enabled = true;
        this.maxRipples = 10;
        this.ripples = [];
        this.strengths = [];
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        for (let i = 0; i < this.maxRipples; i++) {
            this.ripples.push(new THREE.Vector3());
            this.strengths.push(0);
        }
        
        this.bindEvents();
    }
    
    bindEvents() {
        const canvas = this.app.renderer.domElement;
        
        canvas.addEventListener('click', (e) => this.onClick(e));
        canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        canvas.addEventListener('touchstart', (e) => this.onTouchStart(e));
        canvas.addEventListener('touchmove', (e) => this.onTouchMove(e));
    }
    
    getWorldPosition(clientX, clientY) {
        const rect = this.app.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
        
        this.raycaster.setFromCamera(this.mouse, this.app.camera);
        
        const waterMesh = this.app.waterSurface.getMesh();
        const intersects = this.raycaster.intersectObject(waterMesh);
        
        if (intersects.length > 0) {
            return intersects[0].point;
        }
        return null;
    }
    
    addRipple(worldPos, strength) {
        if (!this.enabled) return;
        if (!this.app.state.interaction.enabled) return;
        
        const time = this.app.state.time;
        const rippleStrength = strength * this.app.state.interaction.rippleStrength;
        
        let oldestIdx = 0;
        let oldestTime = this.ripples[0].z;
        
        for (let i = 0; i < this.maxRipples; i++) {
            if (this.strengths[i] === 0) {
                this.ripples[i].set(worldPos.x, worldPos.z, time);
                this.strengths[i] = rippleStrength;
                this.updateWaterRipples();
                return;
            }
            if (this.ripples[i].z < oldestTime) {
                oldestTime = this.ripples[i].z;
                oldestIdx = i;
            }
        }
        
        this.ripples[oldestIdx].set(worldPos.x, worldPos.z, time);
        this.strengths[oldestIdx] = rippleStrength;
        this.updateWaterRipples();
    }
    
    updateWaterRipples() {
        let count = 0;
        for (let i = 0; i < this.maxRipples; i++) {
            if (this.strengths[i] > 0) {
                count++;
            }
        }
        this.app.waterSurface.setRipples(this.ripples, this.strengths, count);
    }
    
    onClick(event) {
        if (!this.app.state.interactionMode) return;
        const worldPos = this.getWorldPosition(event.clientX, event.clientY);
        if (worldPos) {
            this.addRipple(worldPos, 1.0);
        }
    }
    
    onMouseMove(event) {
        if (!this.app.state.interactionMode) return;
        if (event.buttons !== 1) return;
        
        const worldPos = this.getWorldPosition(event.clientX, event.clientY);
        if (worldPos) {
            this.addRipple(worldPos, 0.3);
        }
    }
    
    onTouchStart(event) {
        if (!this.app.state.interactionMode) return;
        event.preventDefault();
        const touch = event.touches[0];
        const worldPos = this.getWorldPosition(touch.clientX, touch.clientY);
        if (worldPos) {
            this.addRipple(worldPos, 1.0);
        }
    }
    
    onTouchMove(event) {
        if (!this.app.state.interactionMode) return;
        event.preventDefault();
        const touch = event.touches[0];
        const worldPos = this.getWorldPosition(touch.clientX, touch.clientY);
        if (worldPos) {
            this.addRipple(worldPos, 0.3);
        }
    }
    
    setEnabled(enabled) {
        this.enabled = enabled;
    }
    
    setRippleParams(strength, radius, decay) {
        if (strength !== undefined) this.app.state.interaction.rippleStrength = strength;
        if (radius !== undefined) {
            this.app.state.interaction.rippleRadius = radius;
            this.app.waterSurface.setRippleParams(radius, this.app.state.interaction.rippleDecay);
        }
        if (decay !== undefined) {
            this.app.state.interaction.rippleDecay = decay;
            this.app.waterSurface.setRippleParams(this.app.state.interaction.rippleRadius, decay);
        }
    }
    
    clearRipples() {
        for (let i = 0; i < this.maxRipples; i++) {
            this.strengths[i] = 0;
        }
        this.app.waterSurface.setRipples(this.ripples, this.strengths, 0);
    }
}
