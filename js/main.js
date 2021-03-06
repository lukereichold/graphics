// main.js
// Luke Reichold - CSCI 3820 
// Final Project: Asteroids


// ****
// UPDATE LOG FOR FINAL EXAM PROGRESS:
// see http://turing.slu.edu/~lreichol/csci3820/Final/Final.txt
// ****

// Populate array of skybox background images for later use.
const SKYBOX_PATH = './cubemap/galaxy/';
const format = '.png';

var background_urls = [
        SKYBOX_PATH + 'px' + format, SKYBOX_PATH + 'nx' + format,
        SKYBOX_PATH + 'py' + format, SKYBOX_PATH + 'ny' + format,
        SKYBOX_PATH + 'pz' + format, SKYBOX_PATH + 'nz' + format
    ];

var WORLD_SIZE = 3000;
var DEBUG = false;
var WIDTH = window.innerWidth;
var HEIGHT = window.innerHeight;

var scene = new THREE.Scene();
var raycaster = new THREE.Raycaster();

var stats, camera, renderer, controls, listener, sun, effect;

// Sounds:
var asteroid_hit_sound, done_sound, ship_hit_sound;

var alpha, beta, gamma;

var BULLET_SPEED = 15, BULLET_RADIUS = 15;

var DEFAULT_NUM_ASTEROIDS = 15;
var NUM_ASTEROIDS = DEFAULT_NUM_ASTEROIDS;

// Objects
var ship;
var asteroids = [];
var blasts = [];

setup();

addLights();
addShip()
addAsteroids(NUM_ASTEROIDS);

// Add initial game stats
$("#game-stats").append("<span>" + getGameStatsString() + "</span>");

var clock = new THREE.Clock();


function tappedScreen() {
    fireBlaster();
}

// Wait 1 sec before main render loop, so we don't erraneously invoke sounds before they're ready.
setTimeout(function() {
    render();
}, 1000);

function setup() {
    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);
    
    // Side button on Google Cardboard functions as a screen tap.
    renderer.domElement.addEventListener("click", tappedScreen);

    window.addEventListener('keydown', keydown);
    
    // Camera
    var far = WORLD_SIZE * Math.sqrt(2); // diagonal of cube is max possible
    camera = new THREE.PerspectiveCamera(75, WIDTH / HEIGHT, 0.1, far);

    // Sound support
    listener = new THREE.AudioListener();
    camera.add(listener);
    

    // Setup 3 possible sounds
    asteroid_hit_sound = new THREE.Audio( listener );
    asteroid_hit_sound.load('./audio/asteroid-hit.mp3');
    asteroid_hit_sound.setVolume(5.0);
    scene.add(asteroid_hit_sound);

    game_over_sound = new THREE.Audio( listener );
    game_over_sound.load('./audio/game-over.mp3');
    game_over_sound.setVolume(5.0);
    scene.add(game_over_sound);

    ship_hit_sound = new THREE.Audio( listener );
    ship_hit_sound.load('./audio/ship-hit.mp3');
    ship_hit_sound.setVolume(5.0);
    scene.add(ship_hit_sound);
    
    if (DEBUG) {
        var axisHelper = new THREE.AxisHelper( WORLD_SIZE );
        scene.add( axisHelper );
    }
    
    
    // Our preferred controls via DeviceOrientation
    function setOrientationControls(e) {
    
        if (!e.alpha) {
            console.log("This isn't a phone!");
            return;
        }
        
        // This code will be executed by a mobile device:

        alpha = e.alpha;
        beta = e.beta;
        gamma = e.gamma;

/*
        if (Math.abs(gamma) < 45) {
            // Tilt phone toward ground to accelerate
            ship.isAccelerating = true;
        } else {
            ship.isAccelerating = false;
        }
*/

        controls = new THREE.DeviceOrientationControls(camera, true);
        controls.connect();
        controls.update();

        console.log("device orientation controls set!");
        

        window.removeEventListener('deviceorientation', setOrientationControls, true);
    }   
    
    addSkybox();

    
    // Only do stereo VR effects on mobile device.
    if (isMobileDevice()) {
        fullscreen();
        
        effect = new THREE.StereoEffect(renderer);
        effect.setSize(WIDTH, HEIGHT);
    
        window.addEventListener('deviceorientation', setOrientationControls, true);
    } 
    else {
        // Set up instructional text for desktop users:
        addStats();
        $("#help-text").append("<span>A / D = Turn, W = Move, SPACE = Shoot</span>");
    }
    

    window.addEventListener('resize', onWindowResize, false);
}

function refreshGameStats() {
    $("#game-stats span").remove();
    $("#game-stats").append("<span>" + getGameStatsString() + "</span>");
}

function getGameStatsString() {
    return "Playing \"Asteroids\" by Luke Reichold (Spring 2016) • Shields remaining: " + ship.lives + " • Remaining Asteroids: " + asteroids.length;
}

function fullscreen() {
    console.log("Requesting fullscreen!");
    
    if (document.requestFullscreen) {
        document.requestFullscreen();
    } else if (document.msRequestFullscreen) {
        document.msRequestFullscreen();
    } else if (document.mozRequestFullScreen) {
        document.mozRequestFullScreen();
    } else if (document.webkitRequestFullscreen) {
        document.webkitRequestFullscreen();
    }
    
    window.scrollTo(0,1);
}

function isMobileDevice() {
    if ( /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ) {
        return true;
    } else {
        return false;
    }
}

// Sun orb at origin will help ship know where center of map is.
/*
function addSun() {
    var radius = 30;
    var material = new THREE.MeshLambertMaterial({ color:0xFFFF00 }); 
    var geometry = new THREE.SphereGeometry(radius, 18, 18);
    sun = new THREE.Mesh(geometry, material);
    sun.add(new THREE.PointLight(0xffff0f));
    scene.add(sun);
}
*/

function resetShip() {
    ship.remove(camera);
    scene.remove(ship);
    ship = new Spaceship();
    ship.stop();

    ship.add(camera);
    scene.add(ship);
}

function addShip() {
    ship = new Spaceship();
    camera.add(createCrosshairs());

    ship.add(camera);
    scene.add(ship);
}

function createCrosshairs() {
    
    var material = new THREE.LineBasicMaterial({ color: 0x00FF00, linewidth: 3 });
    var geometry = new THREE.Geometry();   
    var size = 0.01; 
    geometry.vertices.push(new THREE.Vector3(0, size, 0));
    geometry.vertices.push(new THREE.Vector3(0, -size, 0));
    geometry.vertices.push(new THREE.Vector3(0, 0, 0));
    geometry.vertices.push(new THREE.Vector3(size, 0, 0));    
    geometry.vertices.push(new THREE.Vector3(-size, 0, 0));
    
    var crosshair = new THREE.Line(geometry, material);

    var middlePercent = 50;
    var crosshairPosX = (middlePercent / 100) * 2 - 1;
    var crosshairPosY = (middlePercent / 100) * 2 - 1;
    
    // place in center of screen
    crosshair.position.x = crosshairPosX * camera.aspect;
    crosshair.position.y = crosshairPosY;
    crosshair.position.z = -0.3;
    return crosshair;
}

// Add given number of asteroids to the scene
function addAsteroids(number) {
    for (var i=0; i < number; i++) { 
        var body = new Asteroid();
        asteroids.push(body);
        scene.add(body);
    }
}

function addSkybox() {
       
    var loader = new THREE.CubeTextureLoader();
    var texture = loader.load( background_urls );
    texture.format = THREE.RGBFormat;

    var shader = THREE.ShaderLib[ "cube" ];
    shader.uniforms[ "tCube" ].value = texture;
    
    var material = new THREE.ShaderMaterial( {
        fragmentShader: shader.fragmentShader,
        vertexShader: shader.vertexShader,
        uniforms: shader.uniforms,
        depthWrite: false,
        side: THREE.BackSide
    } );

    var geometry = new THREE.BoxGeometry( WORLD_SIZE, WORLD_SIZE, WORLD_SIZE );

    skybox = new THREE.Mesh( geometry, material );
    skybox.position.y = -30;
    scene.add( skybox );
}

function addStats() {
    // Create div and display performance stats
    stats = new Stats();
    container = document.createElement( 'div' );
    document.body.appendChild( container );
    stats.domElement.style.position = 'absolute';
    stats.domElement.style.top = '0px';
    container.appendChild( stats.domElement );
}

function onWindowResize() {

    WIDTH = window.innerWidth;
    HEIGHT = window.innerHeight;

    windowHalfX = WIDTH / 2,
    windowHalfY = HEIGHT / 2,

    camera.aspect = WIDTH / HEIGHT;
    camera.updateProjectionMatrix();

    if (isMobileDevice()) {
        effect.setSize( WIDTH, HEIGHT );
    }
}


function render() {
    
    var delta = clock.getDelta();
    
    requestAnimationFrame(render);
    
    // Update bullet ("blast") positions
    for (var i=blasts.length -1; i >= 0; i--){
        blasts[i].translateZ(-BULLET_SPEED);
        blasts[i]._life += 1;
        
        // Let each blast travel the map 1.5 times before disappearing.
        if (blasts[i]._life > (WORLD_SIZE / BULLET_SPEED) * 1.5) {
            scene.remove(blasts[i]);
            blasts.splice(i, 1);
        }
    }

    checkForBulletCollisions();

    checkForShipCollisions();
    
    // Keydown listener
    kd.tick();
    
    ship.move()
    
    // Move all asteroids, check collisions, then remove if necessary
    for (var i=0; i < asteroids.length; i++) {
        asteroids[i].move();
    }
        
    handleMapEdges();
    
    if (isMobileDevice()) {
        controls.update(delta);   
        effect.render( scene, camera );
    }
    else {
        renderer.render(scene, camera);
    }
    
    stats.update();
};

function addLights() {    
    scene.add(new THREE.AmbientLight(0x555555));
}

function handleMapEdges() {
    
    for (var i=0; i < asteroids.length; i++) {
        wrapAround(asteroids[i]);
    }
    
    wrapAround(ship);
    
    for (var i=0; i < blasts.length; i++) {
        wrapAround(blasts[i].position);
    }
}

function checkForBulletCollisions() {
    
    for (var i=0; i < blasts.length; i++) {
        
        var blast = blasts[i];
        
        for (var j=0; j < asteroids.length; j++) {
            
            var asteroid = asteroids[j];
            
            if (blastHitsAsteroid(blast, asteroid)) {
                
                console.log("Blast hit an asteroid!");
                
                asteroid_hit_sound.play();
                                
                // Remove this asteroid that we hit.
                scene.remove(asteroids[j]);
                asteroids.splice(j, 1);
                
                refreshGameStats();
                
                // Remove this bullet.
                scene.remove(blasts[i]);
                blasts.splice(i, 1);
                
                if (asteroids.length == 0 && ship.lives > 0) {
                    
                    window.alert("You win! All asteroids destroyed.");
                    increaseDifficulty();
                    restartGame();
                }
            }
        }
    }
}

function checkForShipCollisions() {
    
    for (var i=asteroids.length - 1; i >= 0; i--) {
        
        var asteroid = asteroids[i];
        
        if (asteroidHitsShip(asteroid, ship)) {
                
            console.log("Asteroid hit the ship!");
                                                
            // Remove this asteroid once it hits the ship.
            scene.remove(asteroid);
            asteroids.splice(i, 1);
            
            ship.lives -= 1;
            
            refreshGameStats();
            
            if (ship.lives <= 0) {
                
                // Play sound when game over
                game_over_sound.play();
                                
                window.alert("No lives remaining. Game over!");
                
                // Go back to easy difficulty.
                resetDifficulty();
                restartGame();
            }
            else if (asteroids.length <= 0) {
                // Otherwise, we win if last asteroid is destroyed and ship is still alive.
                window.alert("You win! All asteroids destroyed.");
                increaseDifficulty();
                restartGame();
            } 
            else {
                // Play sound if hit, but not game over yet. Don't want to play both.
                ship_hit_sound.play();
            }
            
        }
    }
}

function resetDifficulty() {
    NUM_ASTEROIDS = DEFAULT_NUM_ASTEROIDS;
}

function increaseDifficulty() {
    console.log("Increasing # ASTEROIDS from " + NUM_ASTEROIDS + " to " + NUM_ASTEROIDS + 5); 
    NUM_ASTEROIDS += 5;
}

function restartGame() {
    
    // Remove any bullets or asteroids still in the scene
    for (var i=blasts.length - 1; i >= 0; i--) {
        scene.remove(blasts[i]);
        blasts.splice(i, 1);
    }
    
    for (var i=asteroids.length - 1; i >= 0; i--) {
        scene.remove(asteroids[i]);
        asteroids.splice(i, 1);
    }
    
    resetShip();
    
    addAsteroids(NUM_ASTEROIDS);
    
    refreshGameStats();
}

function asteroidHitsShip(asteroid, ship) {
    dist = distance2d(asteroid.position, ship.position);
    if (dist <= ship.radius + asteroid.radius) {
        return true;
    } else {
        return false;
    }
}

function blastHitsAsteroid(blast, asteroid) {
    dist = distance2d(blast.position, asteroid.position);
    if (dist <= BULLET_RADIUS + asteroid.radius) {
        return true;
    } else {
        return false;
    }
}

function distance2d(pos1, pos2) {
    return Math.sqrt(Math.pow(pos1.x - pos2.x, 2) + Math.pow(pos1.z - pos2.z, 2));
}

function wrapAround(obj) {
    
    // If necessary, move obj to other side of map if we hit the map bounds.
    if (obj.x > WORLD_SIZE / 2) {
        obj.x = -WORLD_SIZE / 2;
    } else if (obj.x < -WORLD_SIZE / 2) {
        obj.x = WORLD_SIZE / 2;
    }

    if (obj.y > WORLD_SIZE / 2) {
        obj.y = -WORLD_SIZE / 2;
    } else if (obj.y < -WORLD_SIZE / 2) {
        obj.y = WORLD_SIZE / 2;
    }
} 


// TODO: Limit the number of times per second this can be called.
function fireBlaster() {
    
    console.log("Firing blaster!");
    obj = ship;
    
    var sphereMaterial = new THREE.MeshBasicMaterial({color: 0xEEEEEE});
    var sphereGeo = new THREE.SphereGeometry(BULLET_RADIUS, 6, 6);
    var sphere = new THREE.Mesh(sphereGeo, sphereMaterial);
    
    // bullet starting position at ship
    sphere.position.copy(obj.position);
    sphere.rotation.copy(obj.rotation);
    sphere.translateZ(-ship.radius);
    sphere._direction = camera.getWorldDirection();
    sphere._life = 1;
    
    blasts.push(sphere);
    scene.add(sphere);
}


// Keyboard controls for player motion. 

/*
kd.SPACE.down(function () {
    fireBlaster();
});
*/

kd.W.down(function () {
    ship.isAccelerating = true;
});

kd.W.up(function () {
    ship.isAccelerating = false;
});

kd.A.down(function () {
    ship.rotateLeft();
});

kd.D.down(function () {
    ship.rotateRight();
});

// THIS IS FOR FIRING ONLY ONE BLAST AT A TIME.
function keydown(event) {
    
    switch (event.keyCode) {
        case 32: // spacebar
            fireBlaster();
            break;
    }
}
