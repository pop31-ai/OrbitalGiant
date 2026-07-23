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
    
    player.position.set(0, 100, 200);
    scene.add(player);
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
    station.userData = { config: config };
    scene.add(station);
    stations.push(station);
    
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
        )
    };
    
    scene.add(obj);
    emergencyObjects.push(obj);
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

// Управление
function setupControls() {
    document.addEventListener('keydown', (e) => {
        keys[e.code] = true;
        
        if (e.code === 'KeyE') {
            toggleShield();
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

// Проверка посадки
function checkLanding() {
    if (!landingPad) return;
    
    const distance = player.position.distanceTo(landingPad.position);
    const speed = player.userData.velocity ? player.userData.velocity.length() : 0;
    
    if (distance < 60 && speed < 2) {
        // Успешная посадка!
        score += 1000 + Math.floor(timer * 10);
        updateStatus('ПОСАДКА ВЫПОЛНЕНА!');
        
        setTimeout(() => {
            currentLevel++;
            timer = 60;
            fuel = Math.min(100, fuel + 30);
            pressure = Math.min(100, pressure + 20);
            createLevel(currentLevel);
        }, 2000);
    } else if (distance < 60) {
        updateStatus('СЛИШКОМ БЫСТРО!');
        fuel = Math.max(0, fuel - 10);
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
    
    document.getElementById('shieldBar').style.width = shieldPower + '%';
}

function updateStatus(text) {
    document.getElementById('status').textContent = text;
    document.getElementById('status').style.color = text.includes('АВАРИ') || text.includes('БЫСТРО') ? '#f00' : '#0f0';
}

// Очистка уровня
function clearLevel() {
    stations.forEach(s => scene.remove(s));
    stations = [];
    
    emergencyObjects.forEach(o => scene.remove(o));
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
    }
}

// Анимация
function animate() {
    requestAnimationFrame(animate);
    
    const delta = clock.getDelta();
    const time = clock.getElapsedTime();
    
    if (gameStarted) {
        // Движение игрока
        const moveSpeed = 100 * delta;
        const rotSpeed = 1.5 * delta;
        
        if (keys['KeyW']) player.position.z -= moveSpeed;
        if (keys['KeyS']) player.position.z += moveSpeed;
        if (keys['KeyA']) player.position.x -= moveSpeed;
        if (keys['KeyD']) player.position.x += moveSpeed;
        if (keys['Space']) player.position.y += moveSpeed;
        if (keys['ShiftLeft']) player.position.y -= moveSpeed;
        
        // Вращение мышью
        player.rotation.y += mouse.x * rotSpeed;
        player.rotation.x += mouse.y * rotSpeed * 0.5;
        
        // Ограничение высоты
        player.position.y = Math.max(-40, Math.min(300, player.position.y));
        
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
        }
        
        // Аварийные объекты
        emergencyObjects.forEach(obj => {
            obj.position.add(obj.userData.velocity);
            obj.rotation.x += obj.userData.rotSpeed.x;
            obj.rotation.y += obj.userData.rotSpeed.y;
            obj.rotation.z += obj.userData.rotSpeed.z;
            
            // Проверка столкновений
            const distToPlayer = obj.position.distanceTo(player.position);
            if (distToPlayer < 20) {
                if (!shieldActive) {
                    fuel = Math.max(0, fuel - 15);
                    pressure = Math.max(0, pressure - 10);
                    createExplosion(obj.position.clone());
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
