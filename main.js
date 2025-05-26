'use strict';

let gl;                         // The webgl context.
let surface;                    // A surface model
let surfaceWebCam;              // A substrate for webcam image
let shProgram;                  // A shader program
let spaceball;                  // A SimpleRotator object that lets the user rotate the view by mouse.
let stereoCam;                  // Object holding stereo camera and its parameters

let iTextureWebCam = -1;

let video;

// Constructor
function ShaderProgram(name, program) {

    this.name = name;
    this.prog = program;

    // Location of the attribute variable in the shader program.
    this.iAttribVertex = -1;
    // Location of the uniform specifying a color for the primitive.
    this.iColor = -1;
    // Location of the uniform matrix representing the combined transformation.
    this.iModelViewProjectionMatrix = -1;

    this.Use = function() {
        gl.useProgram(this.prog);
    }
}


/* Draws a colored cube, along with a set of coordinate axes.
 * (Note that the use of the above drawPrimitive function is not an efficient
 * way to draw with WebGL.  Here, the geometry is so simple that it doesn't matter.)
 */
function draw() { 
    gl.clearColor(0,0,0,0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);



    // PATH ZERO: DRAW ZERO PARALLAX WEBCAM

    if (iTextureWebCam >= 0 && video.readyState >= video.HAVE_CURRENT_DATA) {
		gl.bindTexture(gl.TEXTURE_2D, iTextureWebCam);
		gl.texImage2D(
			gl.TEXTURE_2D, 0, gl.RGBA,
			gl.RGBA, gl.UNSIGNED_BYTE,
			video
		);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0,0, gl.RGBA, gl.UNSIGNED_BYTE, video);
    }

    let matrOrth = m4.orthographic(0,1,0,1, 8,20);
    
    // TODO: Place your code here to draw webCam surface

    
    /* Get the view matrix from the SimpleRotator object.*/
    let modelView = spaceball.getViewMatrix();

    let rotateToPointZero = m4.axisRotation([0.707,0.707,0], 0.7);
    let translateToPointZero = m4.translation(0,0,-10);

    const colorPolygon = new Float32Array([0.5,0.5,0.5,0.5]);
    const colorEdge    = new Float32Array([1,1,1,1]);

    // The FIRST PASS (for the left eye)

    let matrLeftFrustum = stereoCam.calcLeftFrustum();
    gl.uniformMatrix4fv(shProgram.iProjectionMatrix, false, matrLeftFrustum);

    let translateLeftEye = m4. translation(stereoCam.eyeSeparation/2, 0, 0);

    let matAccum0 = m4.multiply(rotateToPointZero, modelView );
    let matAccum1 = m4.multiply(translateLeftEye, matAccum0 );
    let matAccum2 = m4.multiply(translateToPointZero, matAccum1 );
        
    gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, matAccum2 );

    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(1,0);
    
    gl.colorMask(true, false, false, true);
    gl.uniform4fv(shProgram.iColor, colorPolygon );
    surface.Draw();
    gl.uniform4fv(shProgram.iColor, colorEdge );
    surface.DrawWireframe();

    // The SECOND PASS (for the right eye)

    gl.clear(gl.DEPTH_BUFFER_BIT);

    let matrRightFrustum = stereoCam.calcRightFrustum();
    gl.uniformMatrix4fv(shProgram.iProjectionMatrix, false, matrRightFrustum);

    let translateRightEye = m4. translation(-stereoCam.eyeSeparation/2, 0, 0);

    matAccum0 = m4.multiply(rotateToPointZero, modelView );
    matAccum1 = m4.multiply(translateRightEye, matAccum0 );
    matAccum2 = m4.multiply(translateToPointZero, matAccum1 );

    gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, matAccum2 );

    gl.colorMask(false, true, true, true);
    gl.uniform4fv(shProgram.iColor, colorPolygon );
    surface.Draw();
    gl.uniform4fv(shProgram.iColor, colorEdge );
    surface.DrawWireframe();

    // RESET specific params to their default state

    gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.colorMask(true, true, true, true);
}

const renderingParams = {
    eyeSeparation: 0.7,
    fov: 45 * Math.PI / 180,
    nearClip: 8,
    convergence: 20,
	farClip: 12
};





/* Initialize the WebGL context. Called from init() */
function initGL() {
    let prog = createProgram( gl, vertexShaderSource, fragmentShaderSource );

    shProgram = new ShaderProgram('Basic', prog);
    shProgram.Use();

    shProgram.iAttribVertex              = gl.getAttribLocation(prog, "vertex");
    shProgram.iModelViewMatrix           = gl.getUniformLocation(prog, "ModelViewMatrix");
    shProgram.iProjectionMatrix          = gl.getUniformLocation(prog, "ProjectionMatrix");
    shProgram.iColor                     = gl.getUniformLocation(prog, "color");

    let data = {};
    
    CreateSurfaceData(data)

    surface = new Model('Surface');
    surface.BufferData(data.verticesF32, data.indicesU16);

    surfaceWebCam = new Model('SurfaceWebCam');
    // TODO: Place your code here to load two triangle geomtery


    stereoCam = new StereoCamera(
        renderingParams.eyeSeparation,     // decimeters
        renderingParams.convergence,   // decimeters
		canvas.width / canvas.height,
        renderingParams.fov,
        renderingParams.nearClip,
        renderingParams.farClip
    );

    gl.enable(gl.DEPTH_TEST);
}


/* Creates a program for use in the WebGL context gl, and returns the
 * identifier for that program.  If an error occurs while compiling or
 * linking the program, an exception of type Error is thrown.  The error
 * string contains the compilation or linking error.  If no error occurs,
 * the program identifier is the return value of the function.
 * The second and third parameters are strings that contain the
 * source code for the vertex shader and for the fragment shader.
 */
function createProgram(gl, vShader, fShader) {
    let vsh = gl.createShader( gl.VERTEX_SHADER );
    gl.shaderSource(vsh,vShader);
    gl.compileShader(vsh);
    if ( ! gl.getShaderParameter(vsh, gl.COMPILE_STATUS) ) {
        throw new Error("Error in vertex shader:  " + gl.getShaderInfoLog(vsh));
     }
    let fsh = gl.createShader( gl.FRAGMENT_SHADER );
    gl.shaderSource(fsh, fShader);
    gl.compileShader(fsh);
    if ( ! gl.getShaderParameter(fsh, gl.COMPILE_STATUS) ) {
       throw new Error("Error in fragment shader:  " + gl.getShaderInfoLog(fsh));
    }
    let prog = gl.createProgram();
    gl.attachShader(prog,vsh);
    gl.attachShader(prog, fsh);
    gl.linkProgram(prog);
    if ( ! gl.getProgramParameter( prog, gl.LINK_STATUS) ) {
       throw new Error("Link error in program:  " + gl.getProgramInfoLog(prog));
    }
    return prog;
}


/**
 * initialization function that will be called when the page has loaded
 */
let canvas;
function init() {
    
    try {
        canvas = document.getElementById("webglcanvas");
        gl = canvas.getContext("webgl");
        if ( ! gl ) {
            throw "Browser does not support WebGL";
        }
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not get a WebGL graphics context.</p>";
        return;
    }
    try {
        initGL();  // initialize the WebGL graphics context
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not initialize the WebGL graphics context: " + e + "</p>";
        return;
    }

	document.getElementById('eyeSeparation').addEventListener('input', e => {
        renderingParams.eyeSeparation = +e.target.value;
        stereoCam.eyeSeparation = +e.target.value;
        document.getElementById('eyeSeparationValue').innerText = e.target.value;
    });

	document.getElementById('fov').addEventListener('input', e => {
		renderingParams.fov = e.target.value * Math.PI / 180;
		stereoCam.FOV = renderingParams.fov;
		document.getElementById('fovValue').innerText = e.target.value;
	});

	document.getElementById('nearClip').addEventListener('input', e => {
		renderingParams.nearClip = +e.target.value;
		stereoCam.nearClippingDistance = +e.target.value;
		document.getElementById('nearClipValue').innerText = e.target.value;
	});

	document.getElementById('convergence').addEventListener('input', e => {
		renderingParams.convergence = +e.target.value;
		stereoCam.convergence = +e.target.value;
		document.getElementById('convergenceValue').innerText = e.target.value;
	});
	
	document.getElementById('farclip').addEventListener('input', e => {
		renderingParams.farClip = +e.target.value;
		stereoCam.farClippingDistance = +e.target.value;
		document.getElementById('farClipValue').innerText = e.target.value;
	});
	
	
    video = document.createElement('video');
	document.getElementById("canvas-holder").appendChild(video);
    video.autoplay = true;
	video.style.position = 'absolute';
	video.style.top = '200';
	video.style.left = '200';
	video.style.width = '600px';
	video.style.height = '600px';
	video.style.zIndex = '0';

    // Connect to video stream
    let constraints = {video: true};
    navigator.mediaDevices.getUserMedia(constraints).then(function (stream) {
        video.srcObject = stream;

        let track = stream.getVideoTracks()[0];
        let settings = track.getSettings();

        iTextureWebCam = CreateWebCamTexture(settings.width, settings.height);

        video.play();
    }  )
    .catch(function(err) {
        console.log(err.name + ": " + err.message);
    }
    );

    setInterval(draw, 50);
	
    spaceball = new TrackballRotator(canvas, draw, 0);

    draw();
}


