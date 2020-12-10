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

  function colorToRGBA(color) {
    // Returns the color as an array of [r, g, b, a] -- all range from 0 - 255
    // color must be a valid canvas fillStyle. This will cover most anything you'd want to use.
    // Examples:
    // colorToRGBA('red')  # [255, 0, 0, 255]
    // colorToRGBA('#f00') # [255, 0, 0, 255]
    const cvs = document.createElement('canvas');
    cvs.height = 1;
    cvs.width = 1;
    const ctx = cvs.getContext('2d');
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    return ctx.getImageData(0, 0, 1, 1).data;
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
        canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 600;
        document.body.appendChild(canvas);
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
          this._turtleContext.rotate(-state.angle);

          // move the turtle back to its position
          this._turtleContext.translate(-x, -y);

          // draw the turtle icon
          this._turtleContext.beginPath();
          this._turtleContext.moveTo(x - w / 2, y);
          this._turtleContext.lineTo(x + w / 2, y);
          this._turtleContext.lineTo(x, y + h);
          this._turtleContext.closePath();
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
        speed = SPEEDS[speed] || SPEEDS.normal;
      }
      this._state.speed = speed;
      this._pushState();
    }

    _distanceTo(x, y) {
      return Math.hypot(x - this._state.x, y - this._state.y);
    }

    _setPos(x, y) {
      //console.log('setPos', x, y);
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

      // trace out the forward steps
      while (remainingDistance > 0) {
        // calculate the new location of the turtle after doing the forward movement
        const cosAngle = Math.cos(this._state.angle);
        const sinAngle = Math.sin(this._state.angle)
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
      // TODO: set the animationDistance
      const animationDistance = 3;
      // delay between steps
      const fps = 60; // note: this isn't "true fps", given processing time between frames
      const stepDelay = 1000;

      let lastDrawnState = null;
      for (const [i, state] of this._states.entries()) {
        console.group(state);
        const nextState = this._states[i + 1];

        // update all state changes except for position
        if (state.clear || state.reset) {
          clearContext(this._imageContext);
        }

        // set line width
        this._imageContext.lineWidth = state.width;

        // set color
        //const [r, g, b, a] = colorToRGBA(state.color);
        //this._imageContext.strokeStyle = "rgba(" + r + "," + g + "," + b + "," + a + ")";
        this._imageContext.strokeStyle = state.color;

        if (isDifferent(lastDrawnState, state)) {
          this._drawIf(state);
          lastDrawnState = state;
          if (!state.instant) {
            await setTimeoutAsync(() => {}, stepDelay);
          }
        }

        // animate moving to new position
        if (nextState && nextState.animateMovement && (nextState.x != state.x || nextState.y != state.y)) {
          let remainingDistance = Math.hypot(state.x - nextState.x, state.y - nextState.y);
          let {x, y} = state;
          console.log('drawing to', nextState.x, nextState.y);
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
            }, 1000 / fps);

            x = newX;
            y = newY;
            remainingDistance -= animationDistance;
          }
        }
        console.groupEnd();
      }

      this._states = [];
    }

    forward(distance) {
      const sinAngle = Math.sin(this._state.angle)
      const cosAngle = Math.cos(this._state.angle);
      const targetX = this._state.x + sinAngle * distance;
      const targetY = this._state.y + cosAngle * distance;
      this._moveTo(targetX, targetY);
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
      this._state.angle += degToRad(angle);
      this._pushState();
    }

    // turn left by an angle in degrees
    left(angle) {
      this._state.angle -= degToRad(angle);
      this._pushState();
    }

    // move the turtle to a particular coordinate (if pen is down, draw on the way there)
    goto(x, y) {
      this._setPos(x, y);
    }

    // Go to the origin (0, 0) and rotate to 0 without drawing
    home() {
      this._state.instant = true;
      this.angle(0);
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
    angle(angle) {
      this._state.angle = degToRad(angle);
      this._pushState();
    }

    // set the width of the line
    width(w) {
      this._state.width = w;
      this._pushState();
    }

    // set the color of the line using RGB values in the range 0 - 255.
    color(color) {
      // support r, g, b, a? arguments
      if (arguments.length === 3) {
        color = `rgb(${arguments.join(',')})`;
      } else if (arguments.length === 4) {
        color = `rgba(${arguments.join(',')})`;
      }
      this._state.color = color
      this._pushState();
    }

    // Generate a random integer between low and hi
    random(low, hi) {
      return Math.floor(Math.random() * (hi - low + 1) + low);
    }

    repeat(n, action) {
      for (const count = 1; count <= n; count++) {
        action();
      }
    }

  }

  window.Turtle = Turtle;

})();
