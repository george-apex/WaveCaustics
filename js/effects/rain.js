import * as THREE from 'three';

export class RainEffect {
    constructor(app) {
        this.app = app;
        this.enabled = false;
        this.drops = [];
        this.maxDrops = 200;
        this.spawnAccumulator = 0;
        this.dropMeshes = [];
        this.dropGeometry = null;
        this.dropMaterial = null;
        
        this.settings = {
            intensity: 0.5,
            dropSpeed: 8.0,
            dropSize: 0.3,
            windX: 0,
            windZ: 0,
            spawnHeight: 5
        };
        
        this.initGeometry();
    }
    
    initGeometry() {
        this.dropGeometry = new THREE.CylinderGeometry(0.01, 0.01, 0.15, 4);
        this.dropMaterial = new THREE.MeshBasicMaterial({
            color: 0x88ccff,
            transparent: true,
            opacity: 0.6
        });
    }
    
    setEnabled(enabled) {
        this.enabled = enabled;
        if (!enabled) {
            this.drops = [];
            this.spawnAccumulator = 0;
            this.clearMeshes();
        }
    }
    
    clearMeshes() {
        for (const mesh of this.dropMeshes) {
            this.app.scene.remove(mesh);
            mesh.geometry.dispose();
        }
        this.dropMeshes = [];
    }
    
    setSettings(settings) {
        if (settings.intensity !== undefined) this.settings.intensity = settings.intensity;
        if (settings.dropSpeed !== undefined) this.settings.dropSpeed = settings.dropSpeed;
        if (settings.dropSize !== undefined) this.settings.dropSize = settings.dropSize;
        if (settings.windX !== undefined) this.settings.windX = settings.windX;
        if (settings.windZ !== undefined) this.settings.windZ = settings.windZ;
    }
    
    update(deltaTime) {
        if (!this.enabled) return;
        
        const poolSize = this.app.state.scene.poolSize;
        const halfPool = poolSize * 0.5;
        
        this.spawnAccumulator += this.settings.intensity * deltaTime * 10;
        
        while (this.spawnAccumulator >= 1 && this.drops.length < this.maxDrops) {
            this.spawnAccumulator -= 1;
            
            const drop = {
                x: (Math.random() - 0.5) * poolSize * 1.5,
                z: (Math.random() - 0.5) * poolSize * 1.5,
                y: this.settings.spawnHeight + Math.random() * 2,
                speed: this.settings.dropSpeed * (0.8 + Math.random() * 0.4),
                size: this.settings.dropSize * (0.5 + Math.random() * 0.5)
            };
            this.drops.push(drop);
            
            const mesh = new THREE.Mesh(this.dropGeometry, this.dropMaterial);
            mesh.position.set(drop.x, drop.y, drop.z);
            mesh.scale.y = drop.size * 3;
            this.app.scene.add(mesh);
            this.dropMeshes.push(mesh);
        }
        
        for (let i = this.drops.length - 1; i >= 0; i--) {
            const drop = this.drops[i];
            const mesh = this.dropMeshes[i];
            
            drop.y -= drop.speed * deltaTime;
            drop.x += this.settings.windX * deltaTime;
            drop.z += this.settings.windZ * deltaTime;
            
            if (mesh) {
                mesh.position.set(drop.x, drop.y, drop.z);
            }
            
            if (drop.y <= 0) {
                if (Math.abs(drop.x) < halfPool && Math.abs(drop.z) < halfPool) {
                    this.app.interaction?.addRipple(
                        { x: drop.x, z: drop.z },
                        drop.size
                    );
                }
                
                this.app.scene.remove(mesh);
                if (mesh) mesh.geometry.dispose();
                this.drops.splice(i, 1);
                this.dropMeshes.splice(i, 1);
            }
        }
    }
    
    clear() {
        this.drops = [];
        this.spawnAccumulator = 0;
        this.clearMeshes();
    }
}
