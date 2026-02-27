import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { App } from './app.js';

const app = new App();

document.addEventListener('DOMContentLoaded', () => {
    app.init();
});

window.Caustics3D = app;
