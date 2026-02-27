import * as THREE from 'three';

export class MediaInput {
    constructor() {
        this.lightTexture = null;
        this.waterTexture = null;
        this.videoElements = {
            light: null,
            water: null
        };
        this.webcamStream = null;
        
        this.motionDetection = {
            enabled: false,
            prevCanvas: null,
            prevCtx: null,
            motionCanvas: null,
            motionCtx: null,
            motionTexture: null,
            sensitivity: 3.0
        };
        
        this.state = {
            lightMode: 'solid',
            waterMode: 'procedural',
            lightChannel: 'luminance',
            waterChannel: 'luminance',
            lightIntensity: 1.0,
            waterInfluence: 0.5
        };
    }
    
    loadLightImage(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const textureLoader = new THREE.TextureLoader();
                textureLoader.load(e.target.result, (texture) => {
                    texture.wrapS = THREE.RepeatWrapping;
                    texture.wrapT = THREE.RepeatWrapping;
                    texture.minFilter = THREE.LinearFilter;
                    texture.magFilter = THREE.LinearFilter;
                    this.lightTexture = texture;
                    this.state.lightMode = 'image';
                    resolve(texture);
                });
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
    
    loadLightVideo(file) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const video = document.createElement('video');
            video.src = url;
            video.loop = true;
            video.muted = true;
            video.playsInline = true;
            
            video.onloadeddata = () => {
                const texture = new THREE.VideoTexture(video);
                texture.wrapS = THREE.RepeatWrapping;
                texture.wrapT = THREE.RepeatWrapping;
                texture.minFilter = THREE.LinearFilter;
                texture.magFilter = THREE.LinearFilter;
                this.lightTexture = texture;
                this.videoElements.light = video;
                this.state.lightMode = 'video';
                video.play();
                resolve(texture);
            };
            video.onerror = reject;
        });
    }
    
    loadWaterImage(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const textureLoader = new THREE.TextureLoader();
                textureLoader.load(e.target.result, (texture) => {
                    texture.wrapS = THREE.RepeatWrapping;
                    texture.wrapT = THREE.RepeatWrapping;
                    texture.minFilter = THREE.LinearFilter;
                    texture.magFilter = THREE.LinearFilter;
                    this.waterTexture = texture;
                    this.state.waterMode = 'image';
                    resolve(texture);
                });
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
    
    loadWaterVideo(file) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const video = document.createElement('video');
            video.src = url;
            video.loop = true;
            video.muted = true;
            video.playsInline = true;
            
            video.onloadeddata = () => {
                const texture = new THREE.VideoTexture(video);
                texture.wrapS = THREE.RepeatWrapping;
                texture.wrapT = THREE.RepeatWrapping;
                texture.minFilter = THREE.LinearFilter;
                texture.magFilter = THREE.LinearFilter;
                this.waterTexture = texture;
                this.videoElements.water = video;
                this.state.waterMode = 'video';
                
                this.setupMotionDetection(video.videoWidth || 640, video.videoHeight || 480);
                
                video.play();
                resolve(texture);
            };
            video.onerror = reject;
        });
    }
    
    async startWebcam() {
        try {
            this.stopWebcam();
            
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 1280, height: 720, facingMode: 'user' }
            });
            
            const video = document.createElement('video');
            video.srcObject = stream;
            video.muted = true;
            video.playsInline = true;
            
            return new Promise((resolve, reject) => {
                video.onloadedmetadata = () => {
                    video.play();
                    
                    const texture = new THREE.VideoTexture(video);
                    texture.wrapS = THREE.RepeatWrapping;
                    texture.wrapT = THREE.RepeatWrapping;
                    texture.minFilter = THREE.LinearFilter;
                    texture.magFilter = THREE.LinearFilter;
                    
                    this.waterTexture = texture;
                    this.videoElements.water = video;
                    this.webcamStream = stream;
                    this.state.waterMode = 'webcam';
                    
                    this.setupMotionDetection(video.videoWidth || 640, video.videoHeight || 480);
                    
                    resolve(texture);
                };
                video.onerror = reject;
            });
        } catch (err) {
            console.error('Webcam error:', err);
            throw err;
        }
    }
    
    setupMotionDetection(width, height) {
        const md = this.motionDetection;
        
        md.prevCanvas = document.createElement('canvas');
        md.prevCanvas.width = width;
        md.prevCanvas.height = height;
        md.prevCtx = md.prevCanvas.getContext('2d', { willReadFrequently: true });
        
        md.motionCanvas = document.createElement('canvas');
        md.motionCanvas.width = width;
        md.motionCanvas.height = height;
        md.motionCtx = md.motionCanvas.getContext('2d', { willReadFrequently: true });
        
        md.motionTexture = new THREE.CanvasTexture(md.motionCanvas);
        md.motionTexture.wrapS = THREE.RepeatWrapping;
        md.motionTexture.wrapT = THREE.RepeatWrapping;
        md.motionTexture.minFilter = THREE.LinearFilter;
        md.motionTexture.magFilter = THREE.LinearFilter;
        
        md.enabled = true;
    }
    
    stopWebcam() {
        if (this.webcamStream) {
            this.webcamStream.getTracks().forEach(track => track.stop());
            this.webcamStream = null;
        }
        if (this.videoElements.water && this.state.waterMode === 'webcam') {
            this.videoElements.water.pause();
            this.videoElements.water = null;
            this.waterTexture = null;
        }
        this.state.waterMode = 'procedural';
        
        const md = this.motionDetection;
        md.enabled = false;
        md.prevCanvas = null;
        md.prevCtx = null;
        md.motionCanvas = null;
        md.motionCtx = null;
        if (md.motionTexture) {
            md.motionTexture.dispose();
            md.motionTexture = null;
        }
    }
    
    isWebcamActive() {
        return this.state.waterMode === 'webcam' && this.webcamStream !== null;
    }
    
    setLightMode(mode) {
        this.state.lightMode = mode;
        if (mode === 'solid' || mode === 'procedural') {
            this.lightTexture = null;
            if (this.videoElements.light) {
                this.videoElements.light.pause();
                this.videoElements.light = null;
            }
        }
    }
    
    setWaterMode(mode) {
        this.state.waterMode = mode;
        if (mode === 'procedural') {
            this.waterTexture = null;
            if (this.videoElements.water) {
                this.videoElements.water.pause();
                this.videoElements.water = null;
            }
            this.stopWebcam();
        }
    }
    
    update() {
        if (this.lightTexture && this.lightTexture.image instanceof HTMLVideoElement) {
            if (this.lightTexture.image.readyState >= this.lightTexture.image.HAVE_CURRENT_DATA) {
                this.lightTexture.needsUpdate = true;
            }
        }
        if (this.waterTexture && this.waterTexture.image instanceof HTMLVideoElement) {
            if (this.waterTexture.image.readyState >= this.waterTexture.image.HAVE_CURRENT_DATA) {
                this.waterTexture.needsUpdate = true;
            }
        }
        
        if (this.motionDetection.enabled && this.videoElements.water && this.state.waterChannel === 'motion') {
            this.updateMotionDetection();
        }
    }
    
    updateMotionDetection() {
        const md = this.motionDetection;
        const video = this.videoElements.water;
        
        if (!video || video.readyState < video.HAVE_CURRENT_DATA) return;
        if (!md.prevCtx || !md.motionCtx) return;
        
        const width = md.prevCanvas.width;
        const height = md.prevCanvas.height;
        
        md.motionCtx.drawImage(video, 0, 0, width, height);
        const currentData = md.motionCtx.getImageData(0, 0, width, height);
        
        if (md.prevCtx) {
            const prevData = md.prevCtx.getImageData(0, 0, width, height);
            const motionData = md.motionCtx.createImageData(width, height);
            
            for (let i = 0; i < currentData.data.length; i += 4) {
                const dr = Math.abs(currentData.data[i] - prevData.data[i]);
                const dg = Math.abs(currentData.data[i + 1] - prevData.data[i + 1]);
                const db = Math.abs(currentData.data[i + 2] - prevData.data[i + 2]);
                
                const motion = Math.min(255, (dr + dg + db) * md.sensitivity / 3);
                
                motionData.data[i] = motion;
                motionData.data[i + 1] = motion;
                motionData.data[i + 2] = motion;
                motionData.data[i + 3] = 255;
            }
            
            md.motionCtx.putImageData(motionData, 0, 0);
            
            if (md.motionTexture) {
                md.motionTexture.needsUpdate = true;
            }
        }
        
        md.prevCtx.drawImage(video, 0, 0, width, height);
    }
    
    getMotionTexture() {
        return this.motionDetection.motionTexture;
    }
    
    setMotionSensitivity(sensitivity) {
        this.motionDetection.sensitivity = sensitivity;
    }
    
    setWaterChannel(channel) {
        this.state.waterChannel = channel;
    }
    
    toggleVideoPlayback() {
        const video = this.videoElements.water;
        if (!video) return null;
        
        if (video.paused) {
            video.play();
            return true;
        } else {
            video.pause();
            return false;
        }
    }
    
    rewindVideo() {
        const video = this.videoElements.water;
        if (video) {
            video.currentTime = 0;
        }
    }
    
    setVideoTime(time) {
        const video = this.videoElements.water;
        if (video) {
            video.currentTime = time;
        }
    }
    
    getVideoState() {
        const video = this.videoElements.water;
        if (!video) return null;
        
        return {
            paused: video.paused,
            currentTime: video.currentTime,
            duration: video.duration || 0
        };
    }
    
    hasWaterVideo() {
        return this.videoElements.water !== null;
    }
    
    getLightTexture() {
        return this.lightTexture;
    }
    
    getWaterTexture() {
        return this.waterTexture;
    }
    
    hasLightMedia() {
        return this.lightTexture !== null;
    }
    
    hasWaterMedia() {
        return this.waterTexture !== null;
    }
    
    dispose() {
        this.stopWebcam();
        if (this.lightTexture) this.lightTexture.dispose();
        if (this.waterTexture) this.waterTexture.dispose();
        Object.values(this.videoElements).forEach(v => {
            if (v) {
                v.pause();
                v.src = '';
            }
        });
    }
}
