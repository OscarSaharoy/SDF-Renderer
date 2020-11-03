
// square mesh just to fill screen
const square = [
    -1.0, -1.0, 
    -1.0,  1.0, 
     1.0, -1.0, 
     1.0,  1.0
];

// This array defines two triangles, using the
// indices into the vertex array to specify each triangle's position.
const squareIndices = [ 0, 1, 2,  1, 2, 3 ];

// vector constants
var forward  = vec3.fromValues(1, 0, 0);
var up       = vec3.fromValues(0, 1, 0);
var right    = vec3.fromValues(0, 0, 1);
var zero     = vec3.fromValues(0, 0, 0);

const vsSource = `

precision mediump float;

attribute vec4 aVertexPosition;
varying vec4 vFragCoord;

void main() {
    gl_Position = aVertexPosition;
    vFragCoord.xy = aVertexPosition.xy;
}

`;

const fsSource = `

#define dx vec3(1.0, 0.0, 0.0)
#define dy vec3(0.0, 1.0, 0.0)
#define dz vec3(0.0, 0.0, 1.0)
#define lightPos vec3(5.0, 10.0, 5.0)
#define lightDir vec3(-1.0 / 2.45, -2.0 / 2.45, -1.0 / 2.45)


precision mediump float;

varying vec4 vFragCoord;

uniform float uFrame;
uniform vec2 uResolution;
uniform vec2 uMouse;
uniform vec2 uMouseDelta;
uniform mat4 uViewMatrix;

vec3 cameraToClip = vec3( 0.0, 0.0, 3.0 );
vec3 cameraPos    = vec3( 0.0, 0.0, -4.0 );



// SDF functions //

float mandelbulbSignedDist(vec3 pos) {

    float power = 8.0; //1.1 + clamp(uFrame, 0.0, 500.0) / 100.0;

    vec3 w  = vec3(pos.x, -pos.y, pos.z);
    float m = dot(w, w);
    float d = 1.0;
    
    for( int i=0; i<4; i++ ) {

        d = power * pow(m, 0.5*(power-1.0)) * d + 1.0;
        
        float r = length(w);
        float b = power*acos( w.y/r);
        float a = 8.0*atan( w.x, w.z );
        w = pos + pow(r, power) * vec3( sin(b)*sin(a), cos(b), sin(b)*cos(a) );

        m = dot(w, w);
        if( m > 256.0 ) break;
    }

    return 0.25 * log(m) * sqrt(m) / d;
}

float sphereSignedDist(vec3 pos) {

    float radius = 0.5;
    vec3 centre  = vec3(0.0, 0.0, 0.0); 

    radius = 0.5 + 0.25 * sin(uFrame / 30.0);

    return length(pos - centre) - radius;
}

float cuboidSignedDist(vec3 pos) {

    vec3 centreToCorner = vec3(0.3, 0.3, 0.3);
    float roundness = 0.0;

    vec3 q = abs(pos) - centreToCorner;
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - roundness;
}

float cylinderSignedDist(vec3 pos) {

    float radius = 0.2;
    float height = 0.6;

    vec2 d = abs( vec2(length(pos.xz), pos.y) ) - vec2(radius, height);
    return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}

vec3 repeat(vec3 pos, vec3 separation) {

    // causes SDF to be repeated in every 3x3x3 box in space
    return mod(pos + 0.5 * separation, separation) - 0.5 * separation;
}

float signedDist(vec3 pos) {

    pos = repeat(pos, vec3(3.0, 3.0, 3.0));

    // can pick between these SDFs by uncommenting

    return sphereSignedDist(pos);
    //return cuboidSignedDist(pos);
    //return cylinderSignedDist(pos);
    //return mandelbulbSignedDist(pos);
}



bool highlights = true;
vec3 tint = vec3(0.7, 0.9, 1.0);

// Lighting Functions //

vec3 getNormal(vec3 pos) {
    
    float h = 1e-4;
    vec3 grad = vec3( signedDist(pos + dx*h) - signedDist(pos - dx*h),
                      signedDist(pos + dy*h) - signedDist(pos - dy*h),
                      signedDist(pos + dz*h) - signedDist(pos - dz*h) );

    return normalize( grad );
}

vec4 getColor(vec3 nor, vec3 pos, vec3 viewRay) {

    float lightDot = dot(-lightDir, nor);
    
    vec3 reflected = viewRay - 2.0 * nor * dot(viewRay, nor);
    float reflectedDot = dot(-reflected, lightDir);
    
    vec3 phong = (lightDot * 0.3 + 0.3) * tint + exp(reflectedDot*18.5 - 19.0);

    return vec4( phong, 1.0 );
}

void main() {

    vec3 clipPos = vec3( vFragCoord );
    clipPos.x   /= uResolution.y / uResolution.x;
    vec3 clipRay = normalize(clipPos + cameraToClip);
    vec3 viewRay = vec3(uViewMatrix * vec4(clipRay, 1.0) );
    vec3 currentPos = vec3( uViewMatrix * vec4(cameraPos, 1.0) );

    // gradient up the screen
    gl_FragColor.xyz = (vFragCoord.y / 5.0 + 0.4) * tint;
    gl_FragColor.w = 1.0;

    for( float n = 0.0; n < 512.0; ++n ) {

        float dist = signedDist(currentPos);

        if(dist > 1000.0) {

            if(highlights) gl_FragColor += n/150.0;
            break;
        }

        else if(dist < 2.5e-3) {

            gl_FragColor = getColor(getNormal(currentPos), currentPos, viewRay);
            if(highlights) gl_FragColor += n/150.0;
            break;
        }
        else {

            currentPos += viewRay * dist;
        }
    }
}

`;

function loadShader(gl, type, source) {
  
    const shader = gl.createShader(type);

    // Send the source to the shader object
    gl.shaderSource(shader, source);

    // Compile the shader program
    gl.compileShader(shader);
    
    if ( !gl.getShaderParameter(shader, gl.COMPILE_STATUS) ) {
        
        console.log('Shader compilation error: ' + gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }

    return shader;
}

function makeShaderProgram(gl, vsSource, fsSource) {
  
    const vertexShader   = loadShader(gl, gl.VERTEX_SHADER,   vsSource);
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

    // Create the shader program
    const shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    return shaderProgram;
}

function initgl() {

    const canvas = document.querySelector("#glCanvas");
    
    const { width, height } = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio;

    canvas.width  = width  * dpr;
    canvas.height = height * dpr;

    const gl = canvas.getContext("webgl");

    return [canvas, gl];
}

function initBuffers(gl) {
    
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(square), gl.STATIC_DRAW);
    
    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

    // Now send the element array to GL
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(squareIndices), gl.STATIC_DRAW);

    return {position: positionBuffer,
            indices:  indexBuffer   };
}

function drawScene(gl, programInfo, buffers) {
    
    const { width, height } = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio;
    
    vec2.set(uResolution, width * dpr, height * dpr);


    // Clear the canvas before we start drawing on it.
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
       
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
      
    gl.vertexAttribPointer(
        programInfo.attribLocations.vertexPosition,
        2, gl.FLOAT, false, 0, 0);
      
    gl.enableVertexAttribArray( programInfo.attribLocations.vertexPosition );
    
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indices);
    
    // Tell WebGL to use our program when drawing
    gl.useProgram(programInfo.program);
  
    gl.uniform1f(programInfo.uniformLocations.uFrame, uFrame);
    uFrame += 1;
  
    gl.uniform2fv(programInfo.uniformLocations.uResolution, uResolution);
    gl.uniform2fv(programInfo.uniformLocations.uMouse, uMouse);
    gl.uniform2fv(programInfo.uniformLocations.uMouseDelta, uMouseDelta);
    gl.uniformMatrix4fv(programInfo.uniformLocations.uViewMatrix, false, uViewMatrix);
    
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
  
    requestAnimationFrame( () => drawScene(gl, programInfo, buffers) );
}


function downFunc(e, prop) { 
   
    e.preventDefault(); 
    uClicked = true;
    vec2.set(uMousePrev, prop.clientX, prop.clientY);
}

function moveFunc(e, prop) {
    
    if(uClicked) {
        e.preventDefault();
        
        vec2.set(uMouse, prop.clientX, prop.clientY);
        vec2.subtract(uMouseDelta, uMouse, uMousePrev);
        vec2.copy(uMousePrev, uMouse);
        
        var ds = vec3.fromValues(uMouseDelta[0], -uMouseDelta[1], 0.0);
        
        var axis = vec3.create();
        vec3.cross(axis, right, ds);
        
        mat4.rotate(uViewMatrix, uViewMatrix, vec3.length(ds)/300, axis);
    }
}

function scrollFunc(e) {
    
}

function upFunc(e) {
    
    e.preventDefault();
    uClicked = false;
}


var uResolution = vec2.create();
var uFrame      = 0;
var uClicked    = false;
var uMouse      = vec2.create();
var uMousePrev  = vec2.create();
var uMouseDelta = vec2.create();
var uViewMatrix = mat4.create();

const [canvas, gl]  = initgl();
const shaderProgram = makeShaderProgram(gl, vsSource, fsSource);
const buffers = initBuffers(gl);

canvas.addEventListener("mousedown", (e) => downFunc(e, e) );
canvas.addEventListener("mousemove", (e) => moveFunc(e, e) );
canvas.addEventListener("mouseup",   upFunc );

canvas.addEventListener("touchstart", (e) => downFunc(e, e.touches[0]) );
canvas.addEventListener("touchmove",  (e) => moveFunc(e, e.touches[0]) );
canvas.addEventListener("touchend",   upFunc );

const programInfo = {
    
    program: shaderProgram,
    
    attribLocations: {
        vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition')
    },
  
    uniformLocations: {
        uResolution: gl.getUniformLocation(shaderProgram, 'uResolution'),
        uFrame: gl.getUniformLocation(shaderProgram, 'uFrame'),
        uMouse: gl.getUniformLocation(shaderProgram, 'uMouse'),
        uMouseDelta: gl.getUniformLocation(shaderProgram, 'uMouseDelta'),
        uViewMatrix: gl.getUniformLocation(shaderProgram, 'uViewMatrix')
    }
};

drawScene(gl, programInfo, buffers);