// Draw coin charts using a texture, for instance an image of a coin.
// Written 2017 by Jonas Byström, highfestiva@gmail.com.
// Open source, use as you like.

'use strict';

var canvasIndex = 0;
var gls = {};
var coinBounce = 0.4;
var scale = 3;	// The actual scale would be much higher, but fps generally too low.


function Coin(x, y, isFill, isStopped) {
	this.x = x;
	this.y = y;
	this.px = this.x;
	this.py = this.y;
	this.vx = 0;
	this.vy = 0;
	this.isFill = isFill;
	this.isStopped = false;
	this.lastCollisionHeight = 0;
	this.lastCollisionSlope = 0;
	this.lastCollisionWithBucket = false;
	this.move = function(gl, t) {
		if (this.isStopped) {
			return;
		}
		this.px = this.x;
		this.py = this.y;
		this.vy -= t * 9.82 * scale;
		this.x += t * this.vx * scale;
		this.y += t * this.vy * scale;
		if (collided(gl, this)) {
			this.vx *= 0.5;
			uncollide(gl, this, t);
			var isInside = insideBucket(gl, this);
			if (this.vy < 0 && this.vy > -10 && !this.lastCollisionWithBucket) {
				if (this.isFill && !isInside) {
					// We're yet to bounce back into the bucket!
				} else {
					this.isStopped = true;
					stopped(gl, this);
					return;
				}
			}
			var collisionFactor = Math.min(Math.abs(this.lastCollisionSlope)*0.2, 3)
			collisionFactor *= this.lastCollisionSlope<0? -1 : +1;
			if (this.isFill) {
				this.vy = Math.abs(this.vy) * coinBounce * (Math.random() + 0.1);
				if (isInside) {
					this.vx = (Math.random()-0.5 + collisionFactor) * scale;
					if (this.lastCollisionWithBucket) {
						this.vx *= 0.2;
						this.vy = 0;
					}
				} else {
					this.vx = (Math.abs(this.x)-gl.bucketBottomWidth) * 0.05 * scale;
					this.vx *= this.x<0? -1 : +1;
					this.vy = Math.max(6*scale, this.vy);
				}
			} else {
				if (isInside) {
					this.vx = (this.x<0? -gl.bucketTopWidth2-this.x : gl.bucketTopWidth2-this.x) * 0.04 * scale;
					this.vy = 35.0 * scale;
				} else {
					this.vx = collisionFactor * scale;
					this.vy = -this.vy * coinBounce * (Math.random() + 0.1);
				}
			}
		}
	}
}

function lerp(t, a, b) {
	return a + (b-a)*t;
}

function bucketScaleHeight(gl, y) {
	var t = y / gl.bucketHeight;
	t = t>1? 1 : t;
	t = t<0? 0 : t;
	return t;
}

function getHeightMapX(gl, coin) {
	//var w2 = gl.bucketBottomHeightMapWidth2;
	var r = gl.recipHeightMapBucketBottomWidth;
	if (insideBucket(gl, coin)) {
		// Bucket streches outwards at the top.
		var t = bucketScaleHeight(gl, coin.y);
		//w2 = lerp(t, gl.bucketHeightMapWidth2, gl.recipHeightMapBucketTopWidth);
		r  = lerp(t, gl.recipHeightMapBucketBottomWidth, gl.recipHeightMapBucketTopWidth);
	}
	return coin.x * r + gl.heightMap.length/2;
}

function heightMapIndexInBucket(gl, i) {
	return Math.abs(i-gl.heightMap.length/2) <= gl.bucketHeightMapIndices2;
}

function getHeightData(gl, coin, heightMapX, i0, i1) {
	var h0 = i0<0||i0>=gl.heightMap.length? 0 : gl.heightMap[i0];
	var h1 = i1<0||i1>=gl.heightMap.length? 0 : gl.heightMap[i1];
	// At the edge of the bucket, we consider the height the same, and the surface flat.
	if (heightMapIndexInBucket(gl, i0) != heightMapIndexInBucket(gl, i1)) {
		var isCoinInside = insideBucket(gl, coin);
		if (isCoinInside != (i0 < gl.heightMap.length/2)) {	// I'm to clever for my own good.
			h1 = h0;
		} else {
			h0 = h1;
		}
	}
	var t = heightMapX - i0;
	return [t,h0,h1];
}

function setHeightData(gl, i, h) {
	if (i >= 0 && i < gl.heightMap.length) {
		gl.heightMap[i] = h;
	}
}

function collided(gl, coin) {
	var heightMapX = getHeightMapX(gl, coin);
	var i0 = Math.floor(heightMapX);
	var i1 = i0 + 1;
	var [t,h0,h1] = getHeightData(gl, coin, heightMapX, i0, i1);
	var height = lerp(t, h0, h1);
	coin.lastCollisionHeight = lerp(0.7, height, Math.min(h0,h1));
	//coin.lastCollisionHeight = height;
	coin.lastCollisionSlope = h0 - h1;
	coin.lastCollisionWithBucket = false;
	var didCollide = coin.y <= height;
	if (!didCollide) {
		if (bucketScaleHeight(gl,coin.y) < 1) {
			didCollide = (insideBucket(gl, coin) != xyInsideBucket(gl,coin.px,coin.py));
			if (didCollide) {
				coin.lastCollisionHeight = (coin.y+coin.py) * 0.5;
				coin.lastCollisionSlope = coin.x<0? 50 : -50;
				coin.lastCollisionWithBucket = true;
			}
		}
	}
	return didCollide;

}

function uncollide(gl, coin, t) {
	coin.vy += (coin.lastCollisionHeight - coin.y) * scale;
	if (coin.lastCollisionWithBucket) {
		coin.x = coin.px;
		coin.y = coin.py;
	} else {
		coin.y = coin.lastCollisionHeight;
	}
}

function stopped(gl, coin) {
	var heightMapX = getHeightMapX(gl, coin);
	var i0 = Math.floor(heightMapX);
	var i1 = i0 + 1;
	var [t,h0,h1] = getHeightData(gl, coin, heightMapX, i0, i1);
	h0 += (1-t) * gl.bucketHeight / gl.fullAmount;
	h1 +=    t  * gl.bucketHeight / gl.fullAmount;
	setHeightData(gl, i0, h0);
	setHeightData(gl, i1, h1);
	return lerp(t, h0, h1);
}

function insideBucket(gl, coin) {
	return xyInsideBucket(gl, coin.x, coin.y);
}

function xyInsideBucket(gl, x, y) {
	var w2 = lerp(bucketScaleHeight(gl, y), gl.bucketBottomWidth2, gl.bucketTopWidth2);
	return x > -w2 && x < +w2;
}

function placeSettledCoin(gl, isFill) {
	var width = gl.bucketBottomWidth2 / gl.bucketHeightMapPercentage;
	var offset = gl.bucketTopWidth2;
	if (isFill) {
		width = gl.bucketBottomWidth2;
		offset = 0;
	}
	var x = Math.random() * width + offset
	x = Math.random()<0.5? -x : +x;
	var coin = new Coin(x, 0, isFill, true);
	var y = stopped(gl, coin);
	coin.y = y;
	return coin;
}

function initGl(canvas, coinTexture, bucketFrontTexture, bucketBackTexture) {
	var key = canvas.getAttribute('coinIndex');
	if (gls[key] == null) {
		key = ++canvasIndex;
		canvas.setAttribute('coinIndex', key);
		canvas.width  = canvas.parentElement.clientWidth;
		canvas.height = canvas.parentElement.clientHeight;
		gls[key] = canvas.getContext('webgl2');
		if (!gls[key]) {
			gls[key] = canvas.getContext("experimental-webgl2");
		}
		if (!gls[key]) {
			alert('Your system does not support WebGL 2.');
			return;
		}
		if (typeof WebGLDebugUtils !== 'undefined') {
			gls[key] = WebGLDebugUtils.makeDebugContext(gls[key]);
		}
	}
	var gl = gls[key];
	gl.coinTexture = coinTexture;
	gl.bucketFrontTexture = bucketFrontTexture;
	gl.bucketBackTexture = bucketBackTexture;
	gl.fill = 0;
	gl.spill = 0;
	gl.fullAmount = 1000;
	gl.heightMap = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
	gl.coins = [];
	var bucketWidth = gl.bucketFrontTexture.width - 40;
	gl.bucketTopWidth = bucketWidth;
	gl.bucketBottomConePart = 0.9;
	gl.bucketBottomWidth = gl.bucketTopWidth * gl.bucketBottomConePart;
	gl.bucketTopWidth2 = gl.bucketTopWidth / 2;
	gl.bucketBottomWidth2 = gl.bucketBottomWidth / 2;
	gl.bucketHeight = gl.bucketFrontTexture.height;
	gl.bucketHeightMapPercentage = 20 / gl.heightMap.length;
	gl.recipHeightMapBucketBottomWidth = gl.heightMap.length / (gl.bucketBottomWidth/gl.bucketHeightMapPercentage);
	gl.recipHeightMapBucketTopWidth = gl.heightMap.length / (gl.bucketTopWidth/gl.bucketHeightMapPercentage);
	gl.bucketBottomHeightMapWidth2 = gl.bucketBottomWidth2 / gl.bucketHeightMapPercentage;
	gl.bucketTopHeightMapWidth2 = gl.bucketTopWidth2 / gl.bucketHeightMapPercentage;
	gl.bucketHeightMapIndices2 = gl.heightMap.length * gl.bucketHeightMapPercentage / 2
	gl.lastTime = Date.now();

	// Create, compile and link shaders.
	var vertCode =
		'attribute vec4 a_pos;' +
		'attribute vec3 a_instanceOffset;' +
		'attribute vec2 a_tex;' +
		'varying vec2 v_tex;' +
		'void main(void) {' +
		'  vec4 vtxPos = a_pos;' +
		'  vtxPos.xyz += a_instanceOffset;' +
		'  gl_Position = vtxPos;' +
		'  v_tex = a_tex;' +
		'}';
	var vertShader = gl.createShader(gl.VERTEX_SHADER);
	gl.shaderSource(vertShader, vertCode);
	gl.compileShader(vertShader);
	var fragCode =
		'precision mediump float;' +
		'uniform sampler2D tex;' +
		'varying vec2 v_tex;' +
		'void main(void) {' +
		'  vec4 col = texture2D(tex, v_tex);' +
		'  gl_FragColor = vec4(col.r, col.g, col.b, col.a);' +
		'  gl_FragColor.rgb *= gl_FragColor.a;' +
		'}';
	var fragShader = gl.createShader(gl.FRAGMENT_SHADER);
	gl.shaderSource(fragShader, fragCode);
	gl.compileShader(fragShader);
	gl.shaderProgram = gl.createProgram();
	gl.attachShader(gl.shaderProgram, vertShader);
	gl.attachShader(gl.shaderProgram, fragShader);
	gl.linkProgram(gl.shaderProgram);
	gl.useProgram(gl.shaderProgram);

	gl.posLocation = gl.getAttribLocation(gl.shaderProgram, 'a_pos');
	gl.texLocation = gl.getAttribLocation(gl.shaderProgram, 'a_tex');
	gl.offsetLocation = gl.getAttribLocation(gl.shaderProgram, 'a_instanceOffset');

	// Setup coin texture and buffers.
	gl.coinTextureId = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, gl.coinTextureId);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, gl.coinTexture);

	gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
	gl.enable(gl.BLEND);
	gl.disable(gl.CULL_FACE);

	// Create coin strip.
	var xf = 2 / canvas.width;
	var yf = 2 / canvas.height;
	var w = gl.coinTexture.width/2;
	gl.coinStrip = [-w*xf,-w*yf, +w*xf,-w*yf, -w*xf,+w*yf, +w*xf,+w*yf];
	var textureStrip = [0,1, 1,1, 0,0, 1,0];

	gl.coinVertexBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, gl.coinVertexBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(gl.coinStrip), gl.STATIC_DRAW);
	gl.bindBuffer(gl.ARRAY_BUFFER, null);
	gl.quadTextureBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, gl.quadTextureBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureStrip), gl.STATIC_DRAW);
	gl.bindBuffer(gl.ARRAY_BUFFER, null);
	gl.offsetBuffer = gl.createBuffer();

	// Setup bucket texture and settings.
	gl.bucketFrontTextureId = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, gl.bucketFrontTextureId);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, gl.bucketFrontTexture);
	gl.bucketBackTextureId = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, gl.bucketBackTextureId);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, gl.bucketBackTexture);

	// Create bucket.
	var w = gl.bucketFrontTexture.width/2;
	var h = gl.bucketFrontTexture.height/2;
	var y = (-canvas.height/2 + h + 6) * yf;
	gl.bucketStrip = [-w*xf,-h*yf+y, +w*xf,-h*yf+y, -w*xf,+h*yf+y, +w*xf,+h*yf+y];

	gl.bucketVertexBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, gl.bucketVertexBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(gl.bucketStrip), gl.STATIC_DRAW);
	gl.bindBuffer(gl.ARRAY_BUFFER, null);
}

function createCoins(gl, count, isFill) {
	if (count > 0) {
		while (count > 1) {
			count -= 1;
			gl.coins.push(placeSettledCoin(gl, isFill));
		}
		gl.coins.push(new Coin((Math.random()-0.5)*gl.bucketBottomWidth, canvas.height, isFill));
	}
}

function update(canvas, fill, spill, fullAmount) {
	var key = canvas.getAttribute('coinIndex');
	var gl = gls[key];

	gl.fullAmount = fullAmount;
	createCoins(gl, fill - gl.fill, true);
	createCoins(gl, spill - gl.spill, false);
	gl.fill = fill;
	gl.spill = spill;
}

function renderScene(canvas) {
	var key = canvas.getAttribute('coinIndex');
	var gl = gls[key];

	// Draw bucket back.
	gl.disable(gl.BLEND);
	gl.enableVertexAttribArray(gl.posLocation);
	gl.bindBuffer(gl.ARRAY_BUFFER, gl.bucketVertexBuffer);
	gl.vertexAttribPointer(gl.posLocation, 2, gl.FLOAT, false, 0, 0);
	gl.enableVertexAttribArray(gl.texLocation);
	gl.bindBuffer(gl.ARRAY_BUFFER, gl.quadTextureBuffer);
	gl.vertexAttribPointer(gl.texLocation, 2, gl.FLOAT, false, 0, 0);
	gl.disableVertexAttribArray(gl.offsetLocation);
	gl.bindTexture(gl.TEXTURE_2D, gl.bucketBackTextureId);
	gl.drawArrays(gl.TRIANGLE_STRIP, 0, gl.bucketStrip.length/2);
	gl.enable(gl.BLEND);

	// Move coins on every render.
	var t = Date.now();
	var dt = t - gl.lastTime;
	gl.lastTime = t;
	if (dt > 0.1) {
		dt = 0.1;
	}
	for (var i=0, N=gl.coins.length; i<N; ++i) {
		gl.coins[i].move(gl, dt);
	}

	// Connect shaders and bind buffers.
	gl.enableVertexAttribArray(gl.posLocation);
	gl.bindBuffer(gl.ARRAY_BUFFER, gl.coinVertexBuffer);
	gl.vertexAttribPointer(gl.posLocation, 2, gl.FLOAT, false, 0, 0);
	gl.enableVertexAttribArray(gl.texLocation);
	gl.bindBuffer(gl.ARRAY_BUFFER, gl.quadTextureBuffer);
	gl.vertexAttribPointer(gl.texLocation, 2, gl.FLOAT, false, 0, 0);

	// Create instancing positions.
	gl.enableVertexAttribArray(gl.offsetLocation);
	var offsets = [];
	var xf = 2 / canvas.width;
	var yf = 2 / canvas.height;
	for (var i=0, N=gl.coins.length; i<N; ++i) {
		var x = gl.coins[i].x * xf;
		var y = (gl.coins[i].y - canvas.height/2 + 20) * yf;
		offsets.push(x, y);
	}
	gl.bindBuffer(gl.ARRAY_BUFFER, gl.offsetBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(offsets), gl.DYNAMIC_DRAW);
        gl.vertexAttribPointer(gl.offsetLocation, 2, gl.FLOAT, false, 2*4, 0);
        gl.vertexAttribDivisor(gl.offsetLocation, 1);

	gl.bindTexture(gl.TEXTURE_2D, gl.coinTextureId);
	gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, gl.coinStrip.length/2, gl.coins.length);
	gl.bindBuffer(gl.ARRAY_BUFFER, null);

	// Draw bucket front.
	gl.bindBuffer(gl.ARRAY_BUFFER, gl.bucketVertexBuffer);
	gl.vertexAttribPointer(gl.posLocation, 2, gl.FLOAT, false, 0, 0);
	gl.bindBuffer(gl.ARRAY_BUFFER, gl.quadTextureBuffer);
	gl.vertexAttribPointer(gl.texLocation, 2, gl.FLOAT, false, 0, 0);
	gl.disableVertexAttribArray(gl.offsetLocation);
	gl.bindTexture(gl.TEXTURE_2D, gl.bucketFrontTextureId);
	gl.drawArrays(gl.TRIANGLE_STRIP, 0, gl.bucketStrip.length/2);
}

function loadImages(urls, callback) {
	var textures = [];
	function onLoadTexture(texture) {
		textures.push(texture);
		if (textures.length == urls.length) {
			// Bubble sort the textures, so they are in the same order as the urls.
			var ordered = [];
			for (var i=0, N=urls.length; i<N; ++i) {
				var url = urls[i];
				for (var j=0; j<N; ++j) {
					if (textures[j].src.endsWith(url)) {
						ordered.push(textures[j]);
						break;
					}
				}
			}
			callback(ordered);
		}
	}
	for (var i=0, N=urls.length; i<N; ++i) {
		var url = urls[i];
		var texture = new Image();
		try {
			if ((new URL(url)).origin !== window.location.origin) {
				texture.crossOrigin = '';
			}
		} catch (e) {}
		texture.src = url;
		texture.onload = function() {
			onLoadTexture(this);
		}
	}
}

function coinBucket(canvas, textureNames, fps) {
	if (textureNames == null) {
		textureNames = ['coin.png', 'bucket-front.png', 'bucket-back.png'];
	}
	fps = fps != null? fps : 60;
	loadImages(textureNames, function(textures) {
		console.log(textures);
		var [coinTexture,bucketFrontTexture,bucketBackTexture] = textures;
		initGl(canvas, coinTexture, bucketFrontTexture, bucketBackTexture);
		setInterval(function() {
			renderScene(canvas);
		}, 1000/fps);
	});
	return {
		update: function(fill, spill, fullAmount) {
			fullAmount = fullAmount != null? fullAmount : canvas.height/5;
			update(canvas, fill, spill, fullAmount);
		},
	};
}
