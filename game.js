// ОРБИТАЛЬНЫЙ ГИГАНТ - Main Game Engine

let scene, camera, renderer, clock;
let player, stations = [], debris = [], particles = [];
let stars = [], moons = [];
let currentLevel = 1;
let score = 0;
let fuel = 100;
let pressure = 100;
let shieldActive = false;
let shieldPower = 100;
let gameStarted = false;
let emergencyActive = false;
let emergencyTimer = 0;
let timer = 60;
let landingPad = null;
let holograms = [];
let cranes = [];
let robots = [];
let emergencyObjects = [];
let currentStation = null;

// Магнитная стыковка
let magneticField = null;
let isDocked = false;
let dockProgress = 0;
let dockRange = 80;
let magneticBeam = null;
let landingBeacon = null;
let landingImage = null;

// Физика столкновений
let collisionBodies = [];
let playerVelocity = new THREE.Vector3(0, 0, 0);
const friction = 0.98;
const bounce = 0.5;

const keys = {};
const mouse = { x: 0, y: 0 };

// Инициализация
function init() {
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000011, 0.0008);
    
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
    camera.position.set(0, 100, 300);
    
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    document.body.appendChild(renderer.domElement);
    
    clock = new THREE.Clock();
    
    createStarfield();
    createNebula();
    createMoon();
    createPlayer();
    createLevel(currentLevel);
    createHUD();
    
    // Освещение
    const ambientLight = new THREE.AmbientLight(0x111122, 0.5);
    scene.add(ambientLight);
    
    const sunLight = new THREE.DirectionalLight(0xffffee, 1.5);
    sunLight.position.set(500, 200, 300);
    sunLight.castShadow = true;
    scene.add(sunLight);
    
    const blueLight = new THREE.PointLight(0x0066ff, 2, 500);
    blueLight.position.set(-200, 100, -100);
    scene.add(blueLight);
    
    setupControls();
    animate();
}

// Создание звездного поля
function createStarfield() {
    const starGeometry = new THREE.BufferGeometry();
    const starCount = 5000;
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);
    const sizes = new Float32Array(starCount);
    
    for (let i = 0; i < starCount; i++) {
        const i3 = i * 3;
        const radius = 3000 + Math.random() * 2000;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        
        positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
        positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
        positions[i3 + 2] = radius * Math.cos(phi);
        
        const color = new THREE.Color();
        color.setHSL(0.55 + Math.random() * 0.1, 0.3 + Math.random() * 0.5, 0.7 + Math.random() * 0.3);
        colors[i3] = color.r;
        colors[i3 + 1] = color.g;
        colors[i3 + 2] = color.b;
        
        sizes[i] = 1 + Math.random() * 3;
    }
    
    starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    starGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    
    const starMaterial = new THREE.PointsMaterial({
        size: 2,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending
    });
    
    const starField = new THREE.Points(starGeometry, starMaterial);
    scene.add(starField);
    stars.push(starField);
}

// Туманность
function createNebula() {
    for (let i = 0; i < 5; i++) {
        const geometry = new THREE.SphereGeometry(200 + Math.random() * 300, 16, 16);
        const material = new THREE.MeshBasicMaterial({
            color: new THREE.Color().setHSL(0.6 + Math.random() * 0.2, 0.8, 0.3),
            transparent: true,
            opacity: 0.05,
            side: THREE.BackSide
        });
        const nebula = new THREE.Mesh(geometry, material);
        nebula.position.set(
            (Math.random() - 0.5) * 2000,
            (Math.random() - 0.5) * 2000,
            -1000 - Math.random() * 1000
        );
        scene.add(nebula);
    }
}

// Луна
function createMoon() {
    const moonGeometry = new THREE.SphereGeometry(150, 32, 32);
    const moonMaterial = new THREE.MeshStandardMaterial({
        color: 0xcccccc,
        roughness: 0.8,
        metalness: 0.2
    });
    const moon = new THREE.Mesh(moonGeometry, moonMaterial);
    moon.position.set(800, 300, -1500);
    scene.add(moon);
    moons.push(moon);
    
    // Кратеры
    for (let i = 0; i < 20; i++) {
        const craterGeometry = new THREE.CircleGeometry(5 + Math.random() * 15, 16);
        const craterMaterial = new THREE.MeshStandardMaterial({
            color: 0x888888,
            side: THREE.DoubleSide
        });
        const crater = new THREE.Mesh(craterGeometry, craterMaterial);
        const phi = Math.random() * Math.PI;
        const theta = Math.random() * Math.PI * 2;
        crater.position.set(
            151 * Math.sin(phi) * Math.cos(theta),
            151 * Math.sin(phi) * Math.sin(theta),
            151 * Math.cos(phi)
        );
        crater.lookAt(moon.position);
        moon.add(crater);
    }
}

// Игрок (корабль)
function createPlayer() {
    player = new THREE.Group();
    
    // Основной корпус
    const bodyGeometry = new THREE.ConeGeometry(8, 40, 8);
    const bodyMaterial = new THREE.MeshStandardMaterial({
        color: 0x334455,
        metalness: 0.8,
        roughness: 0.3
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.rotation.x = Math.PI / 2;
    player.add(body);
    
    // Кабина
    const cockpitGeometry = new THREE.SphereGeometry(5, 16, 16);
    const cockpitMaterial = new THREE.MeshStandardMaterial({
        color: 0x00aaff,
        metalness: 0.3,
        roughness: 0.1,
        transparent: true,
        opacity: 0.8
    });
    const cockpit = new THREE.Mesh(cockpitGeometry, cockpitMaterial);
    cockpit.position.z = -12;
    player.add(cockpit);
    
    // Крылья
    const wingGeometry = new THREE.BoxGeometry(30, 1, 10);
    const wingMaterial = new THREE.MeshStandardMaterial({
        color: 0x445566,
        metalness: 0.7,
        roughness: 0.4
    });
    const wings = new THREE.Mesh(wingGeometry, wingMaterial);
    wings.position.z = 5;
    player.add(wings);
    
    // Двигатели
    for (let i = -1; i <= 1; i += 2) {
        const engineGeometry = new THREE.CylinderGeometry(3, 4, 12, 8);
        const engineMaterial = new THREE.MeshStandardMaterial({
            color: 0x666666,
            metalness: 0.9,
            roughness: 0.2
        });
        const engine = new THREE.Mesh(engineGeometry, engineMaterial);
        engine.rotation.x = Math.PI / 2;
        engine.position.set(i * 10, 0, 15);
        player.add(engine);
        
        // Пламя двигателя
        const flameGeometry = new THREE.ConeGeometry(2, 15, 8);
        const flameMaterial = new THREE.MeshBasicMaterial({
            color: 0xff6600,
            transparent: true,
            opacity: 0.8
        });
        const flame = new THREE.Mesh(flameGeometry, flameMaterial);
        flame.rotation.x = -Math.PI / 2;
        flame.position.set(i * 10, 0, 25);
        flame.name = 'flame';
        player.add(flame);
    }
    
    // Щит (голографический)
    const shieldGeometry = new THREE.SphereGeometry(35, 32, 32);
    const shieldMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0,
        wireframe: true,
        side: THREE.DoubleSide
    });
    const shield = new THREE.Mesh(shieldGeometry, shieldMaterial);
    shield.name = 'shield';
    player.add(shield);
    
    // Магнитный луч (для стыковки)
    const beamGeometry = new THREE.CylinderGeometry(0.3, 2, 50, 8);
    const beamMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0
    });
    magneticBeam = new THREE.Mesh(beamGeometry, beamMaterial);
    magneticBeam.rotation.x = Math.PI / 2;
    magneticBeam.position.z = 30;
    magneticBeam.name = 'magneticBeam';
    player.add(magneticBeam);
    
    player.position.set(0, 100, 200);
    scene.add(player);
    
    // Создаём тело столкновения для игрока
    player.userData.collisionBody = createCollisionBody(player, 'sphere', 15);
    player.userData.collisionBody.mass = 5;
    player.userData.collisionBody.velocity = playerVelocity;
}

// Создание уровня
function createLevel(level) {
    clearLevel();
    
    const stationConfigs = [
        { name: 'СТАНЦИЯ "АЛЬФА"', color: 0x0066ff, size: 1, hasCranes: true, hasRobots: true },
        { name: 'СТАНЦИЯ "БЕТА"', color: 0xff6600, size: 1.3, hasCranes: true, hasRobots: false },
        { name: 'СТАНЦИЯ "ГАММА"', color: 0x00ff66, size: 0.8, hasCranes: false, hasRobots: true },
        { name: 'СТАНЦИЯ "ДЕЛЬТА"', color: 0xff00ff, size: 1.5, hasCranes: true, hasRobots: true },
        { name: 'СТАНЦИЯ "ОМЕГА"', color: 0xffff00, size: 1.2, hasCranes: true, hasRobots: true }
    ];
    
    const config = stationConfigs[(level - 1) % stationConfigs.length];
    currentStation = createStation(config);
    
    // Посадочная площадка
    createLandingPad(config);
    
    // Голографические дисплеи
    createHolograms();
    
    if (config.hasCranes) createCranes();
    if (config.hasRobots) createRobots();
    
    showLevelInfo(config.name);
}

// Создание станции
function createStation(config) {
    const station = new THREE.Group();
    
    // Центральный модуль
    const coreGeometry = new THREE.CylinderGeometry(30, 30, 100, 12);
    const coreMaterial = new THREE.MeshStandardMaterial({
        color: config.color,
        metalness: 0.7,
        roughness: 0.3
    });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    core.rotation.x = Math.PI / 2;
    station.add(core);
    
    // Вращающиеся кольца
    for (let i = 0; i < 3; i++) {
        const ringGeometry = new THREE.TorusGeometry(50 + i * 20, 3, 16, 100);
        const ringMaterial = new THREE.MeshStandardMaterial({
            color: new THREE.Color().setHSL((config.color >> 16 & 255) / 255, 0.5, 0.5 + i * 0.1),
            metalness: 0.8,
            roughness: 0.2
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.rotation.x = Math.PI / 2 + (i * 0.2);
        ring.rotation.y = i * 0.3;
        ring.userData = { rotSpeed: 0.002 * (i + 1), axis: i };
        station.add(ring);
    }
    
    // Модули
    const modulePositions = [
        { x: 60, y: 0, z: 0 },
        { x: -60, y: 0, z: 0 },
        { x: 0, y: 60, z: 0 },
        { x: 0, y: -60, z: 0 },
        { x: 0, y: 0, z: 60 },
        { x: 0, y: 0, z: -60 }
    ];
    
    modulePositions.forEach((pos, i) => {
        const moduleGeometry = new THREE.BoxGeometry(20, 20, 20);
        const moduleMaterial = new THREE.MeshStandardMaterial({
            color: new THREE.Color().setHSL(i / 6, 0.6, 0.5),
            metalness: 0.6,
            roughness: 0.4
        });
        const module = new THREE.Mesh(moduleGeometry, moduleMaterial);
        module.position.set(pos.x * config.size, pos.y * config.size, pos.z * config.size);
        station.add(module);
        
        // Соединительные балки
        const beamGeometry = new THREE.CylinderGeometry(2, 2, 30, 8);
        const beamMaterial = new THREE.MeshStandardMaterial({ color: 0x888888 });
        const beam = new THREE.Mesh(beamGeometry, beamMaterial);
        beam.position.set(pos.x * config.size / 2, pos.y * config.size / 2, pos.z * config.size / 2);
        beam.lookAt(new THREE.Vector3(0, 0, 0));
        station.add(beam);
    });
    
    // Солнечные панели
    for (let i = 0; i < 4; i++) {
        const panelGeometry = new THREE.BoxGeometry(60, 2, 20);
        const panelMaterial = new THREE.MeshStandardMaterial({
            color: 0x1a1a4a,
            metalness: 0.9,
            roughness: 0.1,
            emissive: 0x000033
        });
        const panel = new THREE.Mesh(panelGeometry, panelMaterial);
        const angle = (i / 4) * Math.PI * 2;
        panel.position.set(Math.cos(angle) * 80, 0, Math.sin(angle) * 80);
        panel.rotation.y = angle;
        station.add(panel);
    }
    
    station.position.set(0, 0, -300);
    station.userData = { config: config, collisionBodies: [] };
    scene.add(station);
    stations.push(station);
    
    // Добавляем тела столкновения для станции
    const coreBody = createCollisionBody(core, 'box', 0, new THREE.Vector3(30, 30, 50));
    coreBody.isStatic = true;
    coreBody.mass = 1000;
    station.userData.collisionBodies.push(coreBody);
    
    // Модули
    station.children.forEach(child => {
        if (child.geometry && child.geometry.type === 'BoxGeometry') {
            const size = child.geometry.parameters;
            const body = createCollisionBody(child, 'box', 0, new THREE.Vector3(size.width/2, size.height/2, size.depth/2));
            body.isStatic = true;
            body.mass = 500;
            station.userData.collisionBodies.push(body);
        }
    });
    
    return station;
}

// Посадочная площадка
function createLandingPad(config) {
    landingPad = new THREE.Group();
    
    // Основание
    const padGeometry = new THREE.CylinderGeometry(40, 45, 5, 32);
    const padMaterial = new THREE.MeshStandardMaterial({
        color: 0x333333,
        metalness: 0.8,
        roughness: 0.3
    });
    const pad = new THREE.Mesh(padGeometry, padMaterial);
    landingPad.add(pad);
    
    // Маркеры
    for (let i = 0; i < 8; i++) {
        const markerGeometry = new THREE.BoxGeometry(2, 6, 10);
        const markerMaterial = new THREE.MeshBasicMaterial({
            color: i % 2 === 0 ? 0x00ff00 : 0xff0000
        });
        const marker = new THREE.Mesh(markerGeometry, markerMaterial);
        const angle = (i / 8) * Math.PI * 2;
        marker.position.set(Math.cos(angle) * 35, 3, Math.sin(angle) * 35);
        marker.rotation.y = angle;
        landingPad.add(marker);
    }
    
    // Центральный навигатор
    const navGeometry = new THREE.OctahedronGeometry(8, 0);
    const navMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        wireframe: true
    });
    const nav = new THREE.Mesh(navGeometry, navMaterial);
    nav.position.y = 15;
    nav.name = 'navigator';
    landingPad.add(nav);
    
    // Огни
    const lightPositions = [
        { x: 30, z: 30 }, { x: -30, z: 30 },
        { x: 30, z: -30 }, { x: -30, z: -30 }
    ];
    
    lightPositions.forEach(pos => {
        const light = new THREE.PointLight(0x00ff00, 1, 50);
        light.position.set(pos.x, 10, pos.z);
        landingPad.add(light);
    });
    
    // Магнитное поле (индикатор зоны стыковки)
    const magneticGeometry = new THREE.RingGeometry(dockRange - 5, dockRange, 64);
    const magneticMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide
    });
    magneticField = new THREE.Mesh(magneticGeometry, magneticMaterial);
    magneticField.rotation.x = -Math.PI / 2;
    magneticField.position.y = 2;
    magneticField.name = 'magneticField';
    landingPad.add(magneticField);
    
    // Внутреннее кольцо
    const innerRingGeometry = new THREE.RingGeometry(dockRange / 2 - 3, dockRange / 2, 64);
    const innerRingMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ff00,
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide
    });
    const innerRing = new THREE.Mesh(innerRingGeometry, innerRingMaterial);
    innerRing.rotation.x = -Math.PI / 2;
    innerRing.position.y = 2;
    landingPad.add(innerRing);
    
    // Маяк посадки (вертикальный луч)
    const beaconGeometry = new THREE.CylinderGeometry(0.5, 3, 100, 8);
    const beaconMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ff00,
        transparent: true,
        opacity: 0.4
    });
    landingBeacon = new THREE.Mesh(beaconGeometry, beaconMaterial);
    landingBeacon.position.y = 50;
    landingBeacon.name = 'beacon';
    landingPad.add(landingBeacon);
    
    // Точка стыковки (в центре)
    const dockPointGeometry = new THREE.SphereGeometry(5, 16, 16);
    const dockPointMaterial = new THREE.MeshBasicMaterial({
        color: 0xffff00,
        transparent: true,
        opacity: 0.6,
        wireframe: true
    });
    const dockPoint = new THREE.Mesh(dockPointGeometry, dockPointMaterial);
    dockPoint.position.y = 10;
    dockPoint.name = 'dockPoint';
    landingPad.add(dockPoint);
    
    landingPad.position.set(0, -50, -300);
    scene.add(landingPad);
}

// Голографические дисплеи
function createHolograms() {
    const holoPositions = [
        { x: 50, y: 30, z: -280 },
        { x: -50, y: 30, z: -280 },
        { x: 0, y: 60, z: -250 }
    ];
    
    holoPositions.forEach((pos, i) => {
        const holoGroup = new THREE.Group();
        
        // Экран
        const screenGeometry = new THREE.PlaneGeometry(20, 15);
        const screenMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide
        });
        const screen = new THREE.Mesh(screenGeometry, screenMaterial);
        holoGroup.add(screen);
        
        // Рамка
        const frameGeometry = new THREE.EdgesGeometry(screenGeometry);
        const frameMaterial = new THREE.LineBasicMaterial({ color: 0x00ffff });
        const frame = new THREE.LineSegments(frameGeometry, frameMaterial);
        holoGroup.add(frame);
        
        // Данные (простые геометрии)
        for (let j = 0; j < 5; j++) {
            const dataGeometry = new THREE.BoxGeometry(2, 1, 0.5);
            const dataMaterial = new THREE.MeshBasicMaterial({
                color: 0x00ff00,
                transparent: true,
                opacity: 0.5
            });
            const data = new THREE.Mesh(dataGeometry, dataMaterial);
            data.position.set(-6 + j * 3, -3 + j * 1.5, 0.5);
            data.userData = { baseY: data.position.y, speed: 0.5 + Math.random() };
            holoGroup.add(data);
        }
        
        holoGroup.position.set(pos.x, pos.y, pos.z);
        holoGroup.lookAt(player.position);
        scene.add(holoGroup);
        holograms.push(holoGroup);
    });
}

// Краны
function createCranes() {
    for (let i = 0; i < 2; i++) {
        const crane = new THREE.Group();
        
        // Стойка
        const poleGeometry = new THREE.CylinderGeometry(3, 4, 60, 8);
        const poleMaterial = new THREE.MeshStandardMaterial({ color: 0x666666 });
        const pole = new THREE.Mesh(poleGeometry, poleMaterial);
        pole.position.y = 30;
        crane.add(pole);
        
        // Стрела
        const armGeometry = new THREE.BoxGeometry(40, 4, 4);
        const armMaterial = new THREE.MeshStandardMaterial({ color: 0xffaa00 });
        const arm = new THREE.Mesh(armGeometry, armMaterial);
        arm.position.set(20, 58, 0);
        crane.add(arm);
        
        // Трос и крюк
        const ropeGeometry = new THREE.CylinderGeometry(0.5, 0.5, 20, 4);
        const ropeMaterial = new THREE.MeshBasicMaterial({ color: 0xaaaaaa });
        const rope = new THREE.Mesh(ropeGeometry, ropeMaterial);
        rope.position.set(38, 48, 0);
        crane.add(rope);
        
        const hookGeometry = new THREE.TorusGeometry(3, 0.8, 8, 16, Math.PI);
        const hookMaterial = new THREE.MeshStandardMaterial({ color: 0xcccccc });
        const hook = new THREE.Mesh(hookGeometry, hookMaterial);
        hook.position.set(38, 38, 0);
        hook.rotation.x = Math.PI;
        crane.add(hook);
        
        crane.position.set(i === 0 ? -80 : 80, -50, -300);
        crane.userData = { rotSpeed: 0.01, direction: i === 0 ? 1 : -1 };
        scene.add(crane);
        cranes.push(crane);
    }
}

// Роботы
function createRobots() {
    for (let i = 0; i < 3; i++) {
        const robot = new THREE.Group();
        
        // Тело
        const bodyGeometry = new THREE.BoxGeometry(8, 12, 6);
        const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x4488aa });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        robot.add(body);
        
        // Голова
        const headGeometry = new THREE.SphereGeometry(5, 16, 16);
        const headMaterial = new THREE.MeshStandardMaterial({ color: 0x5599bb });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.y = 10;
        robot.add(head);
        
        // Глаз
        const eyeGeometry = new THREE.SphereGeometry(1.5, 8, 8);
        const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const eye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        eye.position.set(0, 10, 4);
        robot.add(eye);
        
        // Руки
        for (let j = -1; j <= 1; j += 2) {
            const armGeometry = new THREE.CylinderGeometry(1.5, 2, 10, 8);
            const armMaterial = new THREE.MeshStandardMaterial({ color: 0x336688 });
            const arm = new THREE.Mesh(armGeometry, armMaterial);
            arm.position.set(j * 6, 0, 0);
            arm.rotation.z = j * 0.3;
            robot.add(arm);
        }
        
        // Ноги
        for (let j = -1; j <= 1; j += 2) {
            const legGeometry = new THREE.CylinderGeometry(2, 2.5, 8, 8);
            const legMaterial = new THREE.MeshStandardMaterial({ color: 0x334455 });
            const leg = new THREE.Mesh(legGeometry, legMaterial);
            leg.position.set(j * 3, -10, 0);
            robot.add(leg);
        }
        
        robot.position.set(-40 + i * 40, -42, -280 + Math.random() * 20);
        robot.userData = { 
            walkSpeed: 0.02 + Math.random() * 0.02,
            baseX: robot.position.x,
            phase: Math.random() * Math.PI * 2
        };
        scene.add(robot);
        robots.push(robot);
    }
}

// Аварийные объекты
function createEmergencyObject() {
    const types = ['asteroid', 'debris', 'malfunction'];
    const type = types[Math.floor(Math.random() * types.length)];
    
    let obj;
    
    if (type === 'asteroid') {
        const geometry = new THREE.DodecahedronGeometry(10 + Math.random() * 15, 0);
        const material = new THREE.MeshStandardMaterial({
            color: 0x666655,
            roughness: 0.9,
            metalness: 0.1
        });
        obj = new THREE.Mesh(geometry, material);
    } else if (type === 'debris') {
        const geometry = new THREE.TetrahedronGeometry(8 + Math.random() * 10, 0);
        const material = new THREE.MeshStandardMaterial({
            color: 0x884422,
            roughness: 0.7,
            metalness: 0.3
        });
        obj = new THREE.Mesh(geometry, material);
    } else {
        const geometry = new THREE.OctahedronGeometry(6, 0);
        const material = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            wireframe: true
        });
        obj = new THREE.Mesh(geometry, material);
    }
    
    obj.position.set(
        (Math.random() - 0.5) * 300,
        (Math.random() - 0.5) * 200 + 50,
        -200 - Math.random() * 200
    );
    
    obj.userData = {
        type: type,
        velocity: new THREE.Vector3(
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2
        ),
        rotSpeed: new THREE.Vector3(
            Math.random() * 0.05,
            Math.random() * 0.05,
            Math.random() * 0.05
        ),
        radius: 10 + Math.random() * 10
    };
    
    scene.add(obj);
    emergencyObjects.push(obj);
    
    // Регистрируем как тело столкновения
    const body = createCollisionBody(obj, 'sphere', obj.userData.radius);
    body.velocity.copy(obj.userData.velocity);
    body.mass = 2;
    obj.userData.collisionBody = body;
}

// Взрыв
function createExplosion(position) {
    const particleCount = 50;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = [];
    
    for (let i = 0; i < particleCount; i++) {
        positions[i * 3] = position.x;
        positions[i * 3 + 1] = position.y;
        positions[i * 3 + 2] = position.z;
        
        velocities.push(new THREE.Vector3(
            (Math.random() - 0.5) * 5,
            (Math.random() - 0.5) * 5,
            (Math.random() - 0.5) * 5
        ));
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const material = new THREE.PointsMaterial({
        color: 0xff6600,
        size: 3,
        transparent: true,
        opacity: 1
    });
    
    const explosion = new THREE.Points(geometry, material);
    explosion.userData = { velocities: velocities, life: 1 };
    scene.add(explosion);
    particles.push(explosion);
}

// Создание HUD (дополнительные элементы)
function createHUD() {
    // Щит индикатор
    const shieldDiv = document.createElement('div');
    shieldDiv.id = 'shieldIndicator';
    shieldDiv.innerHTML = '<div id="shieldBar"></div>';
    document.body.appendChild(shieldDiv);
}

// ===== ФИЗИКА СТОЛКНОВЕНИЙ (СЕЧЕНИЯ ПО ОСИ) =====

/*
  Каждое тело — вращательно-симметричная фигура.
  Форма задаётся полиномом r(t), где t — позиция вдоль центральной оси.
  Столкновение: проекции центров на общую ось, сравнение радиусов сечений.
  Нет пересечения = нет столкновения. Полиномы не спорят.
*/

function createCollisionBody(mesh, type = 'sphere', radius = 10, halfExtents = null) {
    const body = {
        mesh: mesh,
        type: type,
        radius: radius,
        halfExtents: halfExtents || new THREE.Vector3(10, 10, 10),
        velocity: new THREE.Vector3(0, 0, 0),
        mass: 1,
        isStatic: false,
        // Полином сечения: r(t) = c0 + c1*t + c2*t²
        // Для сферы: r(t) = sqrt(R² - t²), аппроксимация полиномом
        profile: null,
        axis: new THREE.Vector3(0, 0, 1) // центральная ось (локальная)
    };
    collisionBodies.push(body);
    return body;
}

function getBodyCenter(body) {
    const center = new THREE.Vector3();
    body.mesh.getWorldPosition(center);
    return center;
}

// === ПРОФИЛИ СЕЧЕНИЙ ===

// Профиль сферы: r(t) = sqrt(R² - t²), аппроксимация
function sphereProfile(R) {
    // Полином 3-й степени, аппроксимирующий полукруг на [-R, R]
    // Pade-подобная: r(t) ≈ R * (1 - (t/R)²)^0.5
    //Taylor: r(t) ≈ R(1 - t²/(2R²) - t⁴/(8R⁴))
    return function(t) {
        const x = t / R;
        if (Math.abs(x) > 1) return 0;
        return R * Math.sqrt(Math.max(0, 1 - x * x));
    };
}

// Профиль цилиндра: r(t) = R для |t| < H/2
function cylinderProfile(R, H) {
    return function(t) {
        return Math.abs(t) <= H / 2 ? R : 0;
    };
}

// Профиль конуса: r(t) = R * (1 - t/H) для t ∈ [0, H]
function coneProfile(R, H) {
    return function(t) {
        if (t < 0 || t > H) return 0;
        return R * (1 - t / H);
    };
}

// Профиль бокса (как цилиндр): r(t) = max(Rx, Ry) для |t| < Hz
function boxProfile(halfExtents) {
    const R = Math.max(halfExtents.x, halfExtents.y);
    const H = halfExtents.z;
    return cylinderProfile(R, H * 2);
}

// Профиль составной: сумма полиномов (для сложных форм)
function compositeProfile(segments) {
    // segments: [{tMin, tMax, fn}]
    return function(t) {
        for (const seg of segments) {
            if (t >= seg.tMin && t <= seg.tMax) {
                return seg.fn(t);
            }
        }
        return 0;
    };
}

// === СЕЧЕНИЕ НА ОСИ ===

// Получить мировую ось тела
function getWorldAxis(body) {
    const axis = body.axis.clone();
    const q = new THREE.Quaternion();
    body.mesh.getWorldQuaternion(q);
    axis.applyQuaternion(q);
    return axis;
}

// Расстояние вдоль оси (проекция разности центров на ось)
function projectAlongAxis(centerA, centerB, axis) {
    const d = centerB.clone().sub(centerA);
    return d.dot(axis);
}

// Сравнение сечений двух тел вдоль оси
function compareSlices(bodyA, profileA, bodyB, profileB, axis, t) {
    const rA = profileA(t);
    const rB = profileB(t);
    return { rA, rB, overlap: Math.min(rA, rB) };
}

// === ГЛАВНАЯ ПРОВЕРКА СТОЛКНОВЕНИЙ ===

function testCollision(a, b) {
    const centerA = getBodyCenter(a);
    const centerB = getBodyCenter(b);

    // 1. Сферы-быстрые: отсечение по расстоянию
    const d3 = centerA.distanceTo(centerB);
    const maxR = a.radius + b.radius;
    if (d3 > maxR * 1.5) return { collided: false }; // далеко — не проверяем

    // 2. Ось = от центра A к центру B
    const axis = centerB.clone().sub(centerA);
    if (axis.length() < 0.001) return { collided: false };
    axis.normalize();

    // 3. Проекции центров на ось
    const projA = 0; // A — начало координат на оси
    const projB = d3; // B на расстоянии d3

    // 4. Профили сечений
    const profileA = a.profile || sphereProfile(a.radius);
    const profileB = b.profile || sphereProfile(b.radius);

    // 5. Сэмплируем вдоль оси — ищем пересечение
    const tMin = Math.max(projA - a.radius, projB - b.radius);
    const tMax = Math.min(projA + a.radius, projB + b.radius);

    if (tMin >= tMax) return { collided: false }; // не пересекаются по оси

    let maxOverlap = 0;
    let overlapT = 0;
    const steps = 8; // мало — быстро

    for (let i = 0; i <= steps; i++) {
        const t = tMin + (tMax - tMin) * (i / steps);
        const rA = profileA(t - projA); // t относительно центра A
        const rB = profileB(t - projB); // t относительно центра B

        // Суммарный радиус сечения
        const totalR = rA + rB;

        // Расстояние от оси между центрами до поверхности (перпендикуляр)
        // = расстояние между центрами проекций на перпендикуляр к оси
        // Упрощение: в 3D перпендикулярное расстояние = d3_perp
        const dPerp = d3; // уже на оси, перпендикуляра 0

        if (d3 <= totalR) {
            const overlap = totalR - d3;
            if (overlap > maxOverlap) {
                maxOverlap = overlap;
                overlapT = t;
            }
        }
    }

    if (maxOverlap > 0.01) {
        // Нормаль = вдоль оси между центрами
        const normal = centerB.clone().sub(centerA).normalize();
        const penetration = maxOverlap;
        const point = centerA.clone().add(normal.clone().multiplyScalar(a.radius));

        return { collided: true, normal, point, penetration };
    }

    return { collided: false };
}

// === РАЗРЕШЕНИЕ СТОЛКНОВЕНИЙ ===

function resolveCollision(a, b, collision) {
    const { normal, penetration } = collision;
    const totalMass = a.mass + b.mass;
    const ratioA = b.mass / totalMass;
    const ratioB = a.mass / totalMass;

    if (!a.isStatic) {
        a.mesh.position.sub(normal.clone().multiplyScalar(penetration * ratioA));
    }
    if (!b.isStatic) {
        b.mesh.position.add(normal.clone().multiplyScalar(penetration * ratioB));
    }

    const relVel = a.velocity.clone().sub(b.velocity);
    const velAlongNormal = relVel.dot(normal);
    if (velAlongNormal > 0) return;

    const j = -(1 + bounce) * velAlongNormal / totalMass;
    const impulse = normal.clone().multiplyScalar(j);

    if (!a.isStatic) a.velocity.sub(impulse.clone().multiplyScalar(a.mass));
    if (!b.isStatic) b.velocity.add(impulse.clone().multiplyScalar(b.mass));
}

// === ГЛАВНАЯ ПРОВЕРКА ===

function checkAllCollisions() {
    const results = [];

    for (let i = 0; i < collisionBodies.length; i++) {
        for (let j = i + 1; j < collisionBodies.length; j++) {
            const a = collisionBodies[i];
            const b = collisionBodies[j];

            const collision = testCollision(a, b);

            if (collision.collided) {
                resolveCollision(a, b, collision);
                results.push({ a, b, collision });
            }
        }
    }
    return results;
}

function applyPhysics(delta) {
    collisionBodies.forEach(body => {
        if (!body.isStatic) {
            body.mesh.position.add(body.velocity.clone().multiplyScalar(delta));
            body.velocity.multiplyScalar(friction);
        }
    });
}

// Управление
function setupControls() {
    document.addEventListener('keydown', (e) => {
        keys[e.code] = true;
        
        if (e.code === 'KeyX') {
            toggleShield();
        }
        if (e.code === 'KeyG' && gameStarted) {
            toggleDocking();
        }
        if (e.code === 'KeyR' && gameStarted) {
            triggerEmergency();
        }
    });
    
    document.addEventListener('keyup', (e) => {
        keys[e.code] = false;
    });
    
    document.addEventListener('mousemove', (e) => {
        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    });
    
    document.addEventListener('click', () => {
        if (gameStarted) {
            checkLanding();
        }
    });
    
    document.getElementById('startBtn').addEventListener('click', startGame);
    
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

// Начало игры
function startGame() {
    document.getElementById('startScreen').style.display = 'none';
    gameStarted = true;
    timer = 60;
    score = 0;
    fuel = 100;
    currentLevel = 1;
    createLevel(currentLevel);
    updateHUD();
}

// Переключение щита
function toggleShield() {
    shieldActive = !shieldActive;
    const shield = player.getObjectByName('shield');
    if (shield) {
        shield.material.opacity = shieldActive ? 0.3 : 0;
    }
    updateStatus(shieldActive ? 'ЩИТ АКТИВЕН' : 'ЩИТ ОТКЛЮЧЕН');
}

// Аварийная ситуация
function triggerEmergency() {
    if (emergencyActive) return;
    
    emergencyActive = true;
    emergencyTimer = 5;
    
    document.getElementById('emergency').style.display = 'block';
    document.getElementById('status').textContent = 'АВАРИЯ!';
    document.getElementById('status').style.color = '#f00';
    
    // Создаем аварийные объекты
    for (let i = 0; i < 5; i++) {
        createEmergencyObject();
    }
    
    // Дымовые эффекты
    for (let i = 0; i < 3; i++) {
        createExplosion(player.position.clone().add(new THREE.Vector3(
            (Math.random() - 0.5) * 50,
            (Math.random() - 0.5) * 50,
            (Math.random() - 0.5) * 50
        )));
    }
    
    fuel = Math.max(0, fuel - 20);
    pressure = Math.max(0, pressure - 15);
}

// Магнитная стыковка
function toggleDocking() {
    if (isDocked) {
        // Отстыковка
        isDocked = false;
        dockProgress = 0;
        const beam = player.getObjectByName('magneticBeam');
        if (beam) beam.material.opacity = 0;
        updateStatus('ОТСТЫКОВКА');
        return;
    }
    
    if (!landingPad) return;
    
    const distance = player.position.distanceTo(landingPad.position);
    
    if (distance < dockRange) {
        // Начинаем стыковку
        isDocked = true;
        dockProgress = 100;
        
        // Позиционируем корабль над площадкой
        player.position.x = landingPad.position.x;
        player.position.z = landingPad.position.z;
        player.position.y = landingPad.position.y + 15;
        
        // Выравниваем
        player.rotation.x = 0;
        player.rotation.z = 0;
        
        // Активируем луч
        const beam = player.getObjectByName('magneticBeam');
        if (beam) {
            beam.material.opacity = 0.6;
            beam.scale.y = 1.5;
        }
        
        // Начисление очков за стыковку
        const accuracyBonus = Math.floor((dockRange - distance) * 10);
        const timeBonus = Math.floor(timer * 5);
        const totalPoints = 500 + accuracyBonus + timeBonus;
        score += totalPoints;
        
        updateStatus(`СТЫКОВКА! +${totalPoints} ОЧКОВ`);
        showDockingResult(totalPoints, accuracyBonus, timeBonus);
    } else {
        updateStatus('ВНЕ ЗОНЫ СТЫКОВКИ');
    }
}

// Показать результат стыковки
function showDockingResult(total, accuracy, time) {
    const resultDiv = document.createElement('div');
    resultDiv.id = 'dockingResult';
    resultDiv.innerHTML = `
        <div style="position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); 
            background:rgba(0,20,40,0.95); border:2px solid #0ff; padding:30px; 
            color:#0ff; font-family:'Courier New',monospace; text-align:center; z-index:300;
            box-shadow: 0 0 50px rgba(0,255,255,0.5);">
            <h2 style="color:#0f0; margin-bottom:20px;">СТЫКОВКА УСПЕШНА</h2>
            <div style="font-size:24px; margin:10px;">ТОЧНОСТЬ: +${accuracy}</div>
            <div style="font-size:24px; margin:10px;">БОНУС ВРЕМЕНИ: +${time}</div>
            <div style="font-size:32px; color:#ff0; margin:20px;">ИТОГО: ${total}</div>
            <div style="margin-top:20px; font-size:14px; color:#888;">
                Нажмите G для отстыковки или ждите загрузки...
            </div>
            <canvas id="screenshotCanvas" width="300" height="200" 
                style="margin-top:20px; border:1px solid #0ff;"></canvas>
            <div style="font-size:12px; color:#0ff; margin-top:5px;">ВИД СТАНЦИИ</div>
        </div>
    `;
    document.body.appendChild(resultDiv);
    
    // Делаем мини-скриншот сцены
    setTimeout(() => {
        const canvas = document.getElementById('screenshotCanvas');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            // Рисуем упрощённое изображение станции
            ctx.fillStyle = '#000011';
            ctx.fillRect(0, 0, 300, 200);
            
            // Звёзды
            for (let i = 0; i < 50; i++) {
                ctx.fillStyle = `rgba(255,255,255,${0.3 + Math.random() * 0.7})`;
                ctx.fillRect(Math.random() * 300, Math.random() * 200, 1, 1);
            }
            
            // Станция
            ctx.fillStyle = '#334';
            ctx.fillRect(100, 60, 100, 80);
            
            // Модули
            ctx.fillStyle = '#0066ff';
            ctx.fillRect(80, 80, 20, 40);
            ctx.fillRect(200, 80, 20, 40);
            ctx.fillStyle = '#00ff66';
            ctx.fillRect(140, 40, 20, 20);
            ctx.fillRect(140, 140, 20, 20);
            
            // Солнечные панели
            ctx.fillStyle = '#1a1a4a';
            ctx.fillRect(30, 90, 50, 8);
            ctx.fillRect(220, 90, 50, 8);
            
            // Посадочная площадка
            ctx.fillStyle = '#00ff00';
            ctx.beginPath();
            ctx.arc(150, 170, 20, 0, Math.PI * 2);
            ctx.fill();
            
            // Корабль
            ctx.fillStyle = '#aaa';
            ctx.beginPath();
            ctx.moveTo(150, 155);
            ctx.lineTo(145, 165);
            ctx.lineTo(155, 165);
            ctx.fill();
            
            // Луч стыковки
            ctx.strokeStyle = 'rgba(0,255,255,0.5)';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(150, 160);
            ctx.lineTo(150, 170);
            ctx.stroke();
        }
    }, 100);
    
    // Удаляем через 3 секунды
    setTimeout(() => {
        if (resultDiv.parentNode) {
            resultDiv.parentNode.removeChild(resultDiv);
        }
    }, 3000);
}

// Проверка посадки
function checkLanding() {
    if (!landingPad) return;
    
    const distance = player.position.distanceTo(landingPad.position);
    const speed = player.userData.velocity ? player.userData.velocity.length() : 0;
    
    if (isDocked) {
        updateStatus('СТЫКОВАН - Нажмите G для отстыковки');
        return;
    }
    
    if (distance < dockRange) {
        updateStatus('В ЗОНЕ СТЫКОВКИ - Нажмите G');
    } else {
        updateStatus('ПРИБЛИЖЬТЕСЬ К ПЛОЩАДКЕ');
    }
}

// Информация об уровне
function showLevelInfo(name) {
    const info = document.getElementById('levelInfo');
    info.innerHTML = `УРОВЕНЬ ${currentLevel}<br>${name}`;
    info.style.display = 'block';
    
    setTimeout(() => {
        info.style.display = 'none';
    }, 3000);
}

// Обновление HUD
function updateHUD() {
    document.getElementById('level').textContent = currentLevel;
    document.getElementById('score').textContent = score;
    document.getElementById('timer').textContent = Math.floor(timer);
    document.getElementById('fuel').textContent = Math.floor(fuel);
    document.getElementById('pressure').textContent = Math.floor(pressure);
    
    const speed = player.userData.velocity ? Math.floor(player.userData.velocity.length() * 10) : 0;
    document.getElementById('speed').textContent = speed;
    document.getElementById('altitude').textContent = Math.floor(player.position.y + 50);
    
    // Углы поворота
    const rollDeg = Math.round((player.rotation.z * 180 / Math.PI) % 360);
    const pitchDeg = Math.round(player.rotation.x * 180 / Math.PI);
    const yawDeg = Math.round((player.rotation.y * 180 / Math.PI) % 360);
    
    document.getElementById('roll').textContent = rollDeg;
    document.getElementById('pitch').textContent = pitchDeg;
    document.getElementById('yaw').textContent = yawDeg;
    
    document.getElementById('shieldBar').style.width = shieldPower + '%';
}

function updateStatus(text) {
    document.getElementById('status').textContent = text;
    document.getElementById('status').style.color = text.includes('АВАРИ') || text.includes('БЫСТРО') ? '#f00' : '#0f0';
}

// Очистка уровня
function clearLevel() {
    stations.forEach(s => {
        if (s.userData.collisionBodies) {
            s.userData.collisionBodies.forEach(b => {
                collisionBodies = collisionBodies.filter(cb => cb !== b);
            });
        }
        scene.remove(s);
    });
    stations = [];
    
    emergencyObjects.forEach(o => {
        if (o.userData.collisionBody) {
            collisionBodies = collisionBodies.filter(b => b !== o.userData.collisionBody);
        }
        scene.remove(o);
    });
    emergencyObjects = [];
    
    cranes.forEach(c => scene.remove(c));
    cranes = [];
    
    robots.forEach(r => scene.remove(r));
    robots = [];
    
    holograms.forEach(h => scene.remove(h));
    holograms = [];
    
    if (landingPad) {
        scene.remove(landingPad);
        landingPad = null;
        magneticField = null;
        landingBeacon = null;
    }
    
    // Сброс стыковки
    isDocked = false;
    dockProgress = 0;
}

// Анимация
function animate() {
    requestAnimationFrame(animate);
    
    const delta = clock.getDelta();
    const time = clock.getElapsedTime();
    
    if (gameStarted) {
        // Параметры полёта
        const yawSpeed = 1.8 * delta;    // Рыскание
        const pitchSpeed = 1.2 * delta;   // Тангаж
        const rollSpeed = 2.5 * delta;    // Крен
        const thrustPower = 120 * delta;  // Тяга
        const brakePower = 80 * delta;    // Торможение
        const lateralPower = 60 * delta;  // Боковое движение
        
        // Рыскание (поворот влево/вправо)
        if (keys['KeyA']) player.rotation.y += yawSpeed;
        if (keys['KeyD']) player.rotation.y -= yawSpeed;
        
        // Тангаж ( наклон вверх/вниз)
        if (keys['KeyW']) player.rotation.x -= pitchSpeed;
        if (keys['KeyS']) player.rotation.x += pitchSpeed;
        
        // Крен (вращение вокруг оси)
        if (keys['KeyQ']) player.rotation.z += rollSpeed;
        if (keys['KeyE']) player.rotation.z -= rollSpeed;
        
        // Ограничение тангажа
        player.rotation.x = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, player.rotation.x));
        
        // Автоматическое возврат крен к нулю при отпускании Q/E
        if (!keys['KeyQ'] && !keys['KeyE']) {
            player.rotation.z *= 0.95;
        }
        
        // Тяга вперёд (в направлении корабля)
        if (keys['Space']) {
            const forward = new THREE.Vector3(0, 0, -1);
            forward.applyQuaternion(player.quaternion);
            player.position.add(forward.multiplyScalar(thrustPower));
        }
        
        // Торможение / реверс
        if (keys['ShiftLeft']) {
            const backward = new THREE.Vector3(0, 0, 1);
            backward.applyQuaternion(player.quaternion);
            player.position.add(backward.multiplyScalar(brakePower));
        }
        
        // Боковое движение (стрейф)
        if (keys['KeyZ']) {
            const left = new THREE.Vector3(-1, 0, 0);
            left.applyQuaternion(player.quaternion);
            player.position.add(left.multiplyScalar(lateralPower));
        }
        if (keys['KeyC']) {
            const right = new THREE.Vector3(1, 0, 0);
            right.applyQuaternion(player.quaternion);
            player.position.add(right.multiplyScalar(lateralPower));
        }
        
        // Подъём/спуск (вертикальный)
        if (keys['KeyF']) player.position.y += lateralPower;
        if (keys['KeyV']) player.position.y -= lateralPower;
        
        // Ограничение высоты
        player.position.y = Math.max(-40, Math.min(300, player.position.y));
        
        // Обновляем скорость игрока для физики
        if (player.userData.collisionBody) {
            player.userData.collisionBody.velocity.copy(playerVelocity);
        }
        
        // Физика столкновений
        checkAllCollisions();
        applyPhysics(delta);
        
        // Обновляем позицию игрока из физического тела
        if (player.userData.collisionBody && !isDocked) {
            // Игрок управляется напрямую, но учитываем столкновения
        }
        
        // Пламя двигателя
        const flames = player.children.filter(c => c.name === 'flame');
        flames.forEach(flame => {
            flame.scale.y = keys['Space'] ? 1 + Math.random() * 0.5 : 0.3;
            flame.material.opacity = keys['Space'] ? 0.8 + Math.random() * 0.2 : 0.3;
        });
        
        // Таймер
        timer -= delta;
        if (timer <= 0) {
            triggerEmergency();
            timer = 30;
        }
        
        // Топливо
        if (keys['Space']) {
            fuel -= delta * 5;
            if (fuel <= 0) {
                fuel = 0;
                updateStatus('НЕТ ТОПЛИВА!');
            }
        }
        
        // Вращение частей станции
        stations.forEach(station => {
            station.children.forEach(child => {
                if (child.userData.rotSpeed) {
                    if (child.userData.axis === 0) child.rotation.x += child.userData.rotSpeed;
                    else if (child.userData.axis === 1) child.rotation.y += child.userData.rotSpeed;
                    else child.rotation.z += child.userData.rotSpeed;
                }
            });
        });
        
        // Анимация кранов
        cranes.forEach(crane => {
            crane.children[1].rotation.y += crane.userData.rotSpeed * crane.userData.direction;
        });
        
        // Анимация роботов
        robots.forEach(robot => {
            robot.position.x = robot.userData.baseX + Math.sin(time * robot.userData.walkSpeed + robot.userData.phase) * 20;
            robot.children[0].rotation.y = Math.sin(time * robot.userData.walkSpeed + robot.userData.phase) * 0.5;
        });
        
        // Анимация голографов
        holograms.forEach(holo => {
            holo.lookAt(camera.position);
            holo.children.forEach(child => {
                if (child.userData.baseY !== undefined) {
                    child.position.y = child.userData.baseY + Math.sin(time * child.userData.speed) * 2;
                }
            });
            holo.children[0].material.opacity = 0.2 + Math.sin(time * 3) * 0.1;
        });
        
        // Навигатор на площадке
        if (landingPad) {
            const nav = landingPad.getObjectByName('navigator');
            if (nav) {
                nav.rotation.y += 0.02;
                nav.rotation.x += 0.01;
                nav.position.y = 15 + Math.sin(time * 2) * 5;
            }
            
            // Магнитное поле - пульсация
            if (magneticField) {
                magneticField.material.opacity = 0.2 + Math.sin(time * 3) * 0.15;
                magneticField.rotation.z += 0.005;
            }
            
            // Маяк - вращение и пульсация
            if (landingBeacon) {
                landingBeacon.rotation.y += 0.02;
                landingBeacon.material.opacity = 0.3 + Math.sin(time * 4) * 0.2;
            }
            
            // Точка стыковки
            const dockPoint = landingPad.getObjectByName('dockPoint');
            if (dockPoint) {
                dockPoint.rotation.y += 0.03;
                dockPoint.rotation.x += 0.02;
            }
        }
        
        // Магнитный луч корабля
        if (magneticBeam && isDocked) {
            magneticBeam.material.opacity = 0.4 + Math.sin(time * 5) * 0.2;
        }
        
        // Аварийные объекты
        emergencyObjects.forEach(obj => {
            // Обновляем позицию из физического тела
            if (obj.userData.collisionBody) {
                obj.position.copy(obj.userData.collisionBody.mesh.position);
                obj.userData.velocity.copy(obj.userData.collisionBody.velocity);
            } else {
                obj.position.add(obj.userData.velocity);
            }
            
            obj.rotation.x += obj.userData.rotSpeed.x;
            obj.rotation.y += obj.userData.rotSpeed.y;
            obj.rotation.z += obj.userData.rotSpeed.z;
            
            // Проверка столкновений с игроком (взаимодействие)
            const distToPlayer = obj.position.distanceTo(player.position);
            if (distToPlayer < obj.userData.radius + 15) {
                if (!shieldActive) {
                    fuel = Math.max(0, fuel - 15);
                    pressure = Math.max(0, pressure - 10);
                    createExplosion(obj.position.clone());
                    
                    // Удаляем тело столкновения
                    if (obj.userData.collisionBody) {
                        collisionBodies = collisionBodies.filter(b => b !== obj.userData.collisionBody);
                    }
                    scene.remove(obj);
                    emergencyObjects = emergencyObjects.filter(o => o !== obj);
                } else {
                    shieldPower = Math.max(0, shieldPower - 20);
                    if (shieldPower <= 0) {
                        shieldActive = false;
                        const shield = player.getObjectByName('shield');
                        if (shield) shield.material.opacity = 0;
                    }
                }
            }
            
            // Удаление удаленных объектов
            if (obj.position.length() > 1000) {
                if (obj.userData.collisionBody) {
                    collisionBodies = collisionBodies.filter(b => b !== obj.userData.collisionBody);
                }
                scene.remove(obj);
                emergencyObjects = emergencyObjects.filter(o => o !== obj);
            }
        });
        
        // Таймер аварии
        if (emergencyActive) {
            emergencyTimer -= delta;
            if (emergencyTimer <= 0) {
                emergencyActive = false;
                document.getElementById('emergency').style.display = 'none';
                document.getElementById('status').textContent = 'НОРМА';
                document.getElementById('status').style.color = '#0f0';
            }
        }
        
        // Щит восстанавливается
        if (!shieldActive && shieldPower < 100) {
            shieldPower = Math.min(100, shieldPower + delta * 10);
        }
        
        // Восстановление давления
        if (pressure < 100 && !emergencyActive) {
            pressure = Math.min(100, pressure + delta * 2);
        }
        
        updateHUD();
    }
    
    // Камера следит за игроком
    const cameraOffset = new THREE.Vector3(0, 30, 80);
    cameraOffset.applyQuaternion(player.quaternion);
    camera.position.lerp(player.position.clone().add(cameraOffset), 0.05);
    camera.lookAt(player.position);
    
    // Вращение звезд
    stars.forEach(star => {
        star.rotation.y += 0.0001;
    });
    
    // Вращение луны
    moons.forEach(moon => {
        moon.rotation.y += 0.0005;
    });
    
    renderer.render(scene, camera);
}

// Запуск
init();
