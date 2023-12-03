// GOA Linear Algebra Catalyst Project
// Ray Tracing
// by Harper K. Davis

// Load GL Matrix
for (const key in glMatrix) {
    if (key === 'glMatrix') continue;
    window[key] = glMatrix[key];
}

// The image to be rendered
let res = null;
const RENDER_WIDTH = 400;
const RENDER_HEIGHT = 300;

let RED, GREEN, BLUE, WHITE, BLACK, MIRROR, HALF_MIRROR;

// Setup function, required by p5.js
function setup() {
    createCanvas(RENDER_WIDTH * 2, RENDER_HEIGHT * 2);

    RED = new Material(color(255, 0, 0));
    GREEN = new Material(color(0, 255, 0));
    BLUE = new Material(color(0, 0, 255));
    WHITE = new Material(color(255));
    BLACK = new Material(color(0));
    MIRROR = new Material(color(255), 1);
    HALF_MIRROR = new Material(color(255), 0.5);

    // just draw once
    noLoop();
    noSmooth();
    render();
    
}

// A material describes how light interacts with an object
class Material {

    constructor(color, reflectivity = 0) { 
        this.color = color;
        this.reflectivity = reflectivity;
    }

    shouldReflect() {
        return this.reflectivity > 0;
    }

}

// Something in the scene
class Thing {
    
    constructor(material, position) {
        this.material = material;
        this.position = position;
    }

    intersects(vOrigin, vRay) {
        return false;
    }

    intersect(vOrigin, vRay) {
        return vec3.create();
    }

    normal(vPoint) {
        return vec3.create();
    }
}

class Sphere extends Thing {

    constructor(material, position, radius) {
        super(material, position);
        this.radius = radius;
    }

    // https://www.scratchapixel.com/lessons/3d-basic-rendering/minimal-ray-tracer-rendering-simple-shapes/ray-sphere-intersection.html
    intersect(vOrigin, vRay) {
        const vCenter = this.position;
        const vToCenter = vec3.sub(vec3.create(), vCenter, vOrigin);

        // Project the vector onto the ray
        const tca = vec3.dot(vToCenter, vRay);
        if (tca < 0) return null;

        // Find the square distance from the center to the closest point on the ray
        const d2 = vec3.dot(vToCenter, vToCenter) - tca * tca;
        if (d2 > this.radius * this.radius) return null;

        // Find the distance from the closest point on the ray to the intersection point
        const thc = Math.sqrt(this.radius * this.radius - d2);
        const t0 = tca - thc;
        const t1 = tca + thc;

        // Return the closest point
        if (t0 < 0) return null;
        return vec3.add(vec3.create(), vOrigin, vec3.scale(vec3.create(), vRay, t0));
    }

    normal(vPoint) {
        return vec3.normalize(vec3.create(), vec3.sub(vec3.create(), vPoint, this.position));
    }

}

function mod(n, m) {
    return ((n % m) + m) % m;
}

const SUN = vec3.normalize(vec3.create(), vec3.fromValues(-1, 2, 1));

// Get color of pixel when given a ray
// vOrigin: the origin of the ray
// vRay: a unit vector that is the direction of the ray
function ray(vOrigin, vRay, scene, depth = 0) {

    if (depth > 3) return color(0);

    let closest = Infinity;
    let closestThing = null, vPoint = null;
    for (const thing of scene) {
        const intersect = thing.intersect(vOrigin, vRay);
        if (intersect) {
            const vIntersectPoint = intersect;
            const distance = vec3.distance(vOrigin, vIntersectPoint);
            if (distance < closest) {
                closest = distance;
                closestThing = thing;
                vPoint = vIntersectPoint;
            }
        }
    }
    if (closestThing) {
        const thing = closestThing;
        const vNormal = thing.normal(vPoint);

        // Get the dot product of the normal and the sun direction
        // This will give amount of light that hits the object from the sun
        const dot = vec3.dot(vNormal, SUN);
        const light = map(constrain(dot, 0, 1), 0, 1, 0.2, 1);
        
        const col = color(red(thing.material.color) * light, green(thing.material.color) * light, blue(thing.material.color) * light);

        if (thing.material.shouldReflect()) {
            // https://math.stackexchange.com/questions/13261/how-to-get-a-reflection-vector
            const vReflected = vec3.sub(vec3.create(), vRay, vec3.scale(vec3.create(), vNormal, 2 * vec3.dot(vRay, vNormal)));

            const reflectedColor = ray(vPoint, vReflected, scene, depth + 1);
            return color(
                lerp(red(col), red(reflectedColor), thing.material.reflectivity),
                lerp(green(col), green(reflectedColor), thing.material.reflectivity),
                lerp(blue(col), blue(reflectedColor), thing.material.reflectivity),
            );
        }
        return col;
    }

    if (vRay[2] < 0) { // vector is pointing down
        const distance = -vOrigin[2] / vRay[2];
        const vPoint = vec3.add(vec3.create(), vOrigin, vec3.scale(vec3.create(), vRay, distance));
        const checker = mod(round(vPoint[0]) + round(vPoint[1]), 2);
        if (checker === 0) {
            return color(0, 0, 255);
        } else {
            return color(0, 0, 127);
        }
    }

    return color(0);
}

// Position of the camera
let vCamera = vec3.fromValues(-2, 0, 1);

// Function to render the image
function render() {
    const startTime = Date.now();
    let lastUpdate = Date.now();

    res = createGraphics(RENDER_WIDTH, RENDER_HEIGHT);

    res.background(0);
    res.loadPixels();

    const scene = [
        new Sphere(RED, vec3.fromValues(4, -2, 1), 1),
        new Sphere(GREEN, vec3.fromValues(3, 2, 1), 1),
        new Sphere(BLUE, vec3.fromValues(4, 1, 3), 1),
        new Sphere(WHITE, vec3.fromValues(5, -3, 4), 1),
        new Sphere(MIRROR, vec3.fromValues(3, 0, 1), 1),
        new Sphere(HALF_MIRROR, vec3.fromValues(2, -1, 2), 1),
    ];

    // Camera target
    const vCameraTarget = vec3.fromValues(3, 0, 1);
    const angle = atan2(vCameraTarget[1] - vCamera[1], vCameraTarget[0] - vCamera[0]);

    const lensLength = 1;

    const aspectRatio = res.width / res.height;

    // Calculate the bounds of the screen
    // The screen is 1 unit away from the camera
    const screenTop = 1
    const screenBottom = -1;
    const screenRight = aspectRatio;
    const screenLeft = -aspectRatio;

    // Loop through each pixel
    for (let x = 0; x < res.width; x += 1) {
        for (let y = 0; y < res.height; y += 1) {

            // First get the vector from the center of the screen to the current pixel
            const scrY = lerp(screenLeft, screenRight, x / res.width);
            const scrZ = lerp(screenTop, screenBottom, y / res.height);
            const vScreen = vec3.fromValues(
                lensLength,
                scrY,
                scrZ
            );

            // Spin the screen vector around the view direction (vViewDirection)
            const vScreenRotated = vec3.rotateZ(vec3.create(), vScreen, vec3.create(), angle);

            const vRay = vec3.normalize(vec3.create(), vScreenRotated);
        
            // Get the color of the pixel
            const color = ray(vCamera, vRay, scene);
            res.set(x, y, color);

            if (Date.now() - lastUpdate > 1000) {
                console.log(`Rendering... (${Date.now() - startTime}ms}) - ${Math.round((x + y * res.width) / (res.width * res.height) * 1000) / 10}%`);
                document.querySelector('#render-time').innerHTML = `Rendering... (${Date.now() - startTime}ms}) - ${Math.round((x + y * res.width) / (res.width * res.height) * 1000) / 10}%`
                lastUpdate = Date.now();
            }
        }
    }

    res.updatePixels();

    const endTime = Date.now();
    document.querySelector('#render-time').innerHTML = `Rendered in ${endTime - startTime}ms`;
}

function draw() {
    background(0);
    image(res, 0, 0, width, height);
}

function moveCamera(x, y, z) {
    
    vCamera[0] += x;
    vCamera[1] += y;
    vCamera[2] += z;
    render();
    draw();
}