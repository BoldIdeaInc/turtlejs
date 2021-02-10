(function() {

  // convert degrees to radians
  function degToRad(deg) {
    return deg / 180 * Math.PI;
  }

  // convert radians to degrees
  function radToDeg(rad) {
    return rad * 180 / Math.PI;
  }

  // like setTimeout, but using async
  function setTimeoutAsync(fn, ms) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        fn();
        resolve();
      }, ms);
    });
  }

  function clearContext(context) {
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, context.canvas.width, context.canvas.height);
    context.restore();
  }

  function parseColor(...args) {
    // support r, g, b, a? arguments
    if (args.length === 3) {
      return `rgb(${[...args].join(',')})`;
    } else if (arguments.length === 4) {
      return `rgba(${[...args].join(',')})`;
    }
    return args[0];
  }

  // draw the turtle and the current image if redraw is true
  // for complicated drawings it is much faster to turn redraw off
  // use canvas centered coordinates facing upwards
  function centerCoords(context) {
    const width = context.canvas.width;
    const height = context.canvas.height;
    context.translate(width / 2, height / 2);
    context.transform(1, 0, 0, -1, 0, 0);
  }

  function isDifferent(a, b) {
    if (a && !b || b && !a) return true;
    for (let key in a) if (a[key] !== b[key]) return true;
    return false;
  }

  function debounce(func, wait, immediate) {
    var timeout;
    return function() {
      var context = this, args = arguments;
      var later = function() {
        timeout = null;
        if (!immediate) func.apply(context, args);
      };
      var callNow = immediate && !timeout;
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      if (callNow) func.apply(context, args);
    };
  };

  function resizeCanvas(canvas, width, height) {
    // FIXME: This seems to have a xerox effect. The more times this function is
    // called, the more blurry the image becomes.

    // create temporary canvas to save image
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;

    // stamp current image onto tempCanvas
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(canvas, 0, 0);

    // resize original canvas
    canvas.width = width;
    canvas.height = height;

    // stamp tempCtx in the center of canvas
    newCtx = canvas.getContext('2d');
    const x = (canvas.width / 2) - (tempCanvas.width / 2);
    const y = (canvas.height / 2) - (tempCanvas.height / 2);
    newCtx.drawImage(tempCanvas, x, y);
  };

  function fitCanvasToWindow(canvas) {
    resizeCanvas(canvas, window.innerWidth, window.innerHeight);
    canvas.style.position = 'absolute';
    canvas.style.top = 0;
    canvas.style.left = 0;
  }

  SPEEDS = {
    fastest: 0,
    fast: 10,
    normal: 6,
    slow: 3,
    slowest: 1
  }

  class Turtle {
    constructor(canvas) {
      if (typeof(canvas) === 'undefined') {
        // create a default canvas that covers the whole page
        canvas = this.createFullscreenCanvas();
      }

      // create hidden canvas, same size as given canvas
      this._imageCanvas = document.createElement('canvas');
      this._imageCanvas.width = canvas.width;
      this._imageCanvas.height = canvas.height;
      this._imageCanvas.style.display = 'none';
      document.body.appendChild(this._imageCanvas);

      this._imageContext = this._imageCanvas.getContext('2d');
      this._imageContext.textAlign = "center";
      this._imageContext.textBaseline = "middle";

      this._turtleCanvas = canvas;
      this._turtleContext = this._turtleCanvas.getContext('2d');

      // the turtle takes precedence when compositing
      this._turtleContext.globalCompositeOperation = 'destination-over';

      this._init();

      // automatically call done() when page finishes loading
      document.addEventListener('DOMContentLoaded', () => {
        this.done();
      });
    }

    // create a full-screen responsive canvas
    createFullscreenCanvas() {
      const canvas = document.createElement('canvas');
      document.documentElement.style.height = '100%';
      document.body.style.height = '100%';
      document.body.style.margin = '0';
      document.body.appendChild(canvas);
      function onResize() {
        fitCanvasToWindow(canvas);
      }
      onResize();
      window.addEventListener('resize', debounce(onResize, 250));
      return canvas;
    }

    _stateHasChanged() {
      const lastState = this._states[this._states.length - 1];
      if (!lastState) return true;
      return isDifferent(lastState, this._state);
    }

    _pushState() {
      // only push if the state has changed
      if (this._stateHasChanged()) {
        this._states.push({...this._state});
      }
    }

    _init() {
      this._states = [];

      // Note: state must be a flat obj for easy copying
      this._state = {
        x: 0,
        y: 0,
        angle: 0,
        penDown: true,
        width: 1,
        visible: true,
        redraw: true,
        wrap: true,
        color: 'black',
        bgcolor: '',
        speed: SPEEDS.normal,
        clear: false,
        animateMovement: true,
        instant: false
      }
      this._pushState();

      this._imageContext.lineWidth = this._state.width;
      this._imageContext.strokeStyle = "black";
      this._imageContext.globalAlpha = 1;
    }

    // draw the turtle and the current image
    _draw(state) {
      clearContext(this._turtleContext);
      if (state.visible) {
          const x = state.x;
          const y = state.y;
          const w = 10;
          const h = 15;
          this._turtleContext.save();

          // use canvas centered coordinates facing upwards
          centerCoords(this._turtleContext);

          // move the origin to the turtle center
          this._turtleContext.translate(x, y);

          // rotate about the center of the turtle
          this._turtleContext.rotate(-degToRad(state.angle));

          // move the turtle back to its position
          this._turtleContext.translate(-x, -y);

          // draw the turtle icon
          this._turtleContext.beginPath();
          this._turtleContext.moveTo(x - w / 2, y);
          this._turtleContext.lineTo(x + w / 2, y);
          this._turtleContext.lineTo(x, y + h);
          this._turtleContext.closePath();
          this._turtleContext.strokeStyle = state.color;
          this._turtleContext.fillStyle = "green";
          this._turtleContext.fill();
          this._turtleContext.restore();
      }

      this._turtleContext.drawImage(
        this._imageCanvas, 0, 0,
        this._imageCanvas.width, this._imageCanvas.height,
        0, 0,
        this._turtleCanvas.width, this._turtleCanvas.height
      );
    }

    _drawIf(state) {
      if (state.redraw) this._draw(state);
    }

    // clear the display, don't move the turtle
    clear() {
      this._state.clear = true;
      this._pushState();
      this._state.clear = false;
    }

    // reset the whole system, clear the display and move turtle back to
    // origin, facing the Y axis.
    reset() {
      this._init();
      this.clear();
    }

    speed(speed) {
      if (typeof(speed) === 'string') {
        speed = SPEEDS[speed];
        if (typeof(speed) === 'undefined') speed = SPEEDS.normal
      }
      this._state.speed = speed;
      this._pushState();
    }

    _distanceTo(x, y) {
      return Math.hypot(x - this._state.x, y - this._state.y);
    }

    _setPos(x, y) {
      this._state.x = parseFloat(x.toFixed(4));
      this._state.y = parseFloat(y.toFixed(4));
      this._pushState();
    }

    // Trace the forward motion of the turtle, allowing for possible
    // wrap-around at the boundaries of the canvas.
    _moveTo(targetX, targetY) {
      // get the boundaries of the canvas
      const maxX = this._imageContext.canvas.width / 2;
      const minX = -this._imageContext.canvas.width / 2;
      const maxY = this._imageContext.canvas.height / 2;
      const minY = -this._imageContext.canvas.height / 2;
      let x = this._state.x;
      let y = this._state.y;

      let remainingDistance = this._distanceTo(targetX, targetY);
      let angle = Math.atan2(targetX - this._state.x, targetY - this._state.y);

      // trace out the forward steps
      while (remainingDistance > 0) {
        // calculate the new location of the turtle after doing the forward movement
        const cosAngle = Math.cos(angle);
        const sinAngle = Math.sin(angle);
        const newX = x + sinAngle * remainingDistance;
        const newY = y + cosAngle * remainingDistance;

        // wrap on the X boundary
        const xWrap = (cutBound, otherBound) =>  {
          const distanceToEdge = Math.abs((cutBound - x) / sinAngle);
          const edgeY = cosAngle * distanceToEdge + y;
          this._setPos(cutBound, edgeY);
          remainingDistance -= distanceToEdge;
          x = otherBound;
          y = edgeY;
          this.tp(x, y);
        }
        // wrap on the Y boundary
        const yWrap = (cutBound, otherBound) => {
          const distanceToEdge = Math.abs((cutBound - y) / cosAngle);
          const edgeX = sinAngle * distanceToEdge + x;
          this._setPos(edgeX, cutBound);
          remainingDistance -= distanceToEdge;
          x = edgeX;
          y = otherBound;
          this.tp(x, y);
        }
        // don't wrap the turtle on any boundary
        const noWrap = () => {
          this._setPos(newX, newY);
          remainingDistance = 0;
        }
        // if wrap is on, trace a part segment of the path and wrap on boundary if necessary
        if (this._state.wrap) {
          if (newX > maxX) xWrap(maxX, minX);
          else if (newX < minX) xWrap(minX, maxX);
          else if (newY > maxY) yWrap(maxY, minY);
          else if (newY < minY) yWrap(minY, maxY);
          else noWrap();
        } else {
          // wrap is not on. 
          noWrap();
        }
      }
    }

    async done() {
      const startTime = (new Date()).getTime();
      // delay between steps
      const fps = 60; // note: this isn't "true fps", given processing time between frames
      const stepDelay = 1000 / fps;

      let lastDrawnState = null;
      for (let [i, state] of this._states.entries()) {
        const nextState = this._states[i + 1];

        // update all state changes except for position
        if (state.clear || state.reset) {
          clearContext(this._imageContext);
        }

        // set line width
        this._imageContext.lineWidth = state.width;

        // set color
        this._imageContext.strokeStyle = state.color;

        // set bg color
        this._turtleCanvas.style.backgroundColor = state.bgcolor;

        if (isDifferent(lastDrawnState, state)) {
          this._drawIf(state);
          lastDrawnState = state;
          if (!state.instant && state.speed > 0) {
            await setTimeoutAsync(() => {}, stepDelay);
          }
        }

        //const animationDistance = state.speed ? state.speed * 10 : 100;
        const animationDistance = state.speed ? state.speed * state.speed : 500;

        // animate moving to new position
        if (nextState && nextState.animateMovement && (nextState.x != state.x || nextState.y != state.y)) {
          let remainingDistance = Math.hypot(state.x - nextState.x, state.y - nextState.y);
          let {x, y} = state;
          while (remainingDistance > 0) {
            // get the angle betwen both points
            const angle = Math.atan2(nextState.x - state.x, nextState.y - state.y);
            let newX = x + Math.sin(angle) * animationDistance;
            let newY = y + Math.cos(angle) * animationDistance;

            // if distance to next animation point is greater than distance to final point, use
            // the final point instead.
            const distanceToStop = Math.hypot(x - nextState.x, y - nextState.y);
            if (distanceToStop < animationDistance) {
              newX = nextState.x;
              newY = nextState.y;
            }

            // draw line segment for this frame
            await setTimeoutAsync(() => {
              this._imageContext.save();
              centerCoords(this._imageContext);
              this._imageContext.beginPath();
              this._imageContext.moveTo(x, y);
              this._imageContext.lineTo(newX, newY);
              const tempState = {...state, x: newX, y: newY, angle: state.angle}; 
              if (state.penDown) this._imageContext.stroke();
              this._imageContext.restore();
              this._drawIf(tempState);
              lastDrawnState = tempState;
            }, state.speed === 0 ? 0 : (1000 / fps));

            x = newX;
            y = newY;
            remainingDistance -= animationDistance;
          }
        }
      }

      this._states = [];
      const endTime = (new Date()).getTime();
      //console.debug(`Drawn in ${(endTime - startTime) / 1000} seconds`);
    }

    _distanceTarget(distance) {
      const sinAngle = Math.sin(degToRad(this._state.angle));
      const cosAngle = Math.cos(degToRad(this._state.angle));
      const targetX = this._state.x + sinAngle * distance;
      const targetY = this._state.y + cosAngle * distance;
      return {x: targetX, y: targetY};
    }

    forward(distance) {
      const target = this._distanceTarget(distance);
      this._moveTo(target.x, target.y);
    }

    backward(distance) {
      const target = this._distanceTarget(distance * -1);
      this._moveTo(target.x, target.y);
    }

    // turn edge wrapping on/off
    wrap(bool) {
      this._state.wrap = bool;
      this._pushState();
    }

    // show/hide the turtle
    hideTurtle() {
      this._state.visible = false;
      this._pushState();
    }

    // show/hide the turtle
    showTurtle() {
      this._state.visible = true;
      this._pushState();
    }

    // turn on/off redrawing
    redrawOnMove(bool) {
      this._state.redraw = bool;
      this._pushState();
    }

    // lift up the pen (don't draw)
    penup() {
      this._state.penDown = false;
      this._pushState();
    }
    // put the pen down (do draw)
    pendown() {
      this._state.penDown = true;
      this._pushState();
    }

    // turn right by an angle in degrees
    right(angle) {
      this._state.angle += angle;
      this._pushState();
    }

    // turn left by an angle in degrees
    left(angle) {
      this._state.angle -= angle;
      this._pushState();
    }

    // move the turtle to a particular coordinate (if pen is down, draw on the way there)
    goto(x, y) {
      this._moveTo(x, y);
    }

    // Go to the origin (0, 0) and rotate to 0 without drawing
    home() {
      this._state.instant = true;
      this.setheading(0);
      this.tp(0, 0);
      this._state.instant = false;
    }

    // move the turtle to a particular coordinate (don't draw, move instantly)
    tp(x, y) {
      this._state.animateMovement = false;
      this._setPos(x, y);
      this._state.animateMovement = true;
    }

    // set the angle of the turtle in degrees
    setheading(angle) {
      this._state.angle = angle;
      this._pushState();
    }

    setangle(angle) {
      this.setheading(angle);
    }

    // set the width of the line
    width(w) {
      this._state.width = w;
      this._pushState();
    }

    // set the color of the line using RGB values in the range 0 - 255.
    color(color) {
      this._state.color = parseColor(...arguments);
      this._pushState();
    }

    bgcolor(color) {
      this._state.bgcolor = parseColor(...arguments);
      this._pushState();
    }

    // Generate a random integer between low and hi
    random(low, hi) {
      return Math.floor(Math.random() * (hi - low + 1) + low);
    }

    repeat(n, action) {
      for (let count = 1; count <= n; count++) {
        action();
      }
    }

    position() {
      return [this._state.x, this._state.y];
    }

    heading() {
      return this._state.angle;
    }

  }

  window.Turtle = Turtle;

})();
