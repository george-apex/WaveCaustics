export class AudioReactive {
    constructor(app) {
        this.app = app;
        this.enabled = false;
        this.audioContext = null;
        this.analyser = null;
        this.dataArray = null;
        this.source = null;
        this.stream = null;
        
        this.settings = {
            sensitivity: 1.0,
            smoothing: 0.8,
            frequencyBands: {
                bass: { min: 20, max: 250 },
                mid: { min: 250, max: 2000 },
                treble: { min: 2000, max: 16000 }
            },
            targets: {
                amplitude: { band: 'bass', multiplier: 0.5, enabled: false },
                frequency: { band: 'mid', multiplier: 0.3, enabled: false },
                speed: { band: 'treble', multiplier: 0.2, enabled: false }
            }
        };
        
        this.bands = {
            bass: 0,
            mid: 0,
            treble: 0,
            overall: 0
        };
        
        this.smoothedBands = {
            bass: 0,
            mid: 0,
            treble: 0,
            overall: 0
        };
    }
    
    async setEnabled(enabled) {
        this.enabled = enabled;
        
        if (enabled) {
            if (!this.audioContext) {
                await this.initAudio();
            }
        } else {
            this.stopAudio();
        }
    }
    
    async initAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.source = this.audioContext.createMediaStreamSource(this.stream);
            
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            this.analyser.smoothingTimeConstant = this.settings.smoothing;
            
            this.source.connect(this.analyser);
            
            const bufferLength = this.analyser.frequencyBinCount;
            this.dataArray = new Uint8Array(bufferLength);
            
            return true;
        } catch (err) {
            console.error('Failed to initialize audio:', err);
            this.enabled = false;
            return false;
        }
    }
    
    stopAudio() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        if (this.source) {
            this.source.disconnect();
            this.source = null;
        }
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        this.analyser = null;
        this.dataArray = null;
    }
    
    setSettings(settings) {
        if (settings.sensitivity !== undefined) this.settings.sensitivity = settings.sensitivity;
        if (settings.smoothing !== undefined && this.analyser) {
            this.settings.smoothing = settings.smoothing;
            this.analyser.smoothingTimeConstant = settings.smoothing;
        }
    }
    
    setTargetParam(param, band, multiplier, enabled) {
        if (this.settings.targets[param]) {
            if (band !== undefined) this.settings.targets[param].band = band;
            if (multiplier !== undefined) this.settings.targets[param].multiplier = multiplier;
            if (enabled !== undefined) this.settings.targets[param].enabled = enabled;
        }
    }
    
    update(deltaTime) {
        if (!this.enabled || !this.analyser) return;
        
        this.analyser.getByteFrequencyData(this.dataArray);
        
        const sampleRate = this.audioContext.sampleRate;
        const binCount = this.dataArray.length;
        const binWidth = sampleRate / (binCount * 2);
        
        const bands = this.settings.frequencyBands;
        
        let bassSum = 0, bassCount = 0;
        let midSum = 0, midCount = 0;
        let trebleSum = 0, trebleCount = 0;
        
        for (let i = 0; i < binCount; i++) {
            const freq = i * binWidth;
            const value = this.dataArray[i] / 255;
            
            if (freq >= bands.bass.min && freq < bands.bass.max) {
                bassSum += value;
                bassCount++;
            } else if (freq >= bands.mid.min && freq < bands.mid.max) {
                midSum += value;
                midCount++;
            } else if (freq >= bands.treble.min && freq < bands.treble.max) {
                trebleSum += value;
                trebleCount++;
            }
        }
        
        this.bands.bass = bassCount > 0 ? (bassSum / bassCount) * this.settings.sensitivity : 0;
        this.bands.mid = midCount > 0 ? (midSum / midCount) * this.settings.sensitivity : 0;
        this.bands.treble = trebleCount > 0 ? (trebleSum / trebleCount) * this.settings.sensitivity : 0;
        this.bands.overall = (this.bands.bass + this.bands.mid + this.bands.treble) / 3;
        
        const smoothing = 0.3;
        this.smoothedBands.bass += (this.bands.bass - this.smoothedBands.bass) * smoothing;
        this.smoothedBands.mid += (this.bands.mid - this.smoothedBands.mid) * smoothing;
        this.smoothedBands.treble += (this.bands.treble - this.smoothedBands.treble) * smoothing;
        this.smoothedBands.overall += (this.bands.overall - this.smoothedBands.overall) * smoothing;
        
        this.applyToWave();
    }
    
    applyToWave() {
        const targets = this.settings.targets;
        const wave = this.app.state.wave;
        
        if (targets.amplitude.enabled) {
            const bandValue = this.smoothedBands[targets.amplitude.band];
            const baseAmplitude = wave.amplitude;
            const modAmplitude = baseAmplitude + bandValue * targets.amplitude.multiplier;
            this.app.waterSurface?.setAmplitude(Math.max(0, modAmplitude));
        }
        
        if (targets.frequency.enabled) {
            const bandValue = this.smoothedBands[targets.frequency.band];
            const baseFrequency = wave.frequency;
            const modFrequency = baseFrequency * (1 + bandValue * targets.frequency.multiplier);
            this.app.waterSurface?.setFrequency(Math.max(0.1, modFrequency));
        }
        
        if (targets.speed.enabled) {
            const bandValue = this.smoothedBands[targets.speed.band];
            const baseSpeed = wave.speed;
            const modSpeed = baseSpeed * (1 + bandValue * targets.speed.multiplier);
            this.app.waterSurface?.setSpeed(Math.max(0, modSpeed));
        }
    }
    
    getBands() {
        return { ...this.smoothedBands };
    }
    
    isEnabled() {
        return this.enabled;
    }
}
