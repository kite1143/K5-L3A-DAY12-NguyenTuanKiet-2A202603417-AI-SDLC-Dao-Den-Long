import type { ResolvedInput } from '../core/index';

export interface ControlHandlers {
  onPauseToggle: () => void;
  onGesture: () => void;
}

/**
 * Keyboard + mouse input. It produces the same `ResolvedInput` shape the
 * headless runner builds from an inputs file, so the browser and the contract
 * drive the exact same simulation code.
 */
export class Controls {
  /** cam_yaw_deg handed to the simulation (mouse drag rotates it). */
  yaw = 0;
  /** Degrees of camera rotation per pixel of mouse drag. */
  sensitivity = 0.0045;

  private readonly held = new Set<string>();
  private readonly latched = { jump: false, interact: false, pulse: false, dash: false };
  private dragging = false;
  private lastPointerX = 0;

  constructor(private readonly handlers: ControlHandlers) {}

  attach(canvas: HTMLElement): void {
    window.addEventListener('keydown', (event) => {
      this.handlers.onGesture();
      if (event.code === 'Space' || event.code.startsWith('Arrow')) event.preventDefault();

      if (!event.repeat) {
        if (event.code === 'Space') this.latched.jump = true;
        if (event.code === 'KeyE') this.latched.interact = true;
        if (event.code === 'KeyF') this.latched.pulse = true;
        if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') this.latched.dash = true;
        if (event.code === 'Escape' || event.code === 'KeyP') this.handlers.onPauseToggle();
      }
      this.held.add(event.code);
    });

    window.addEventListener('keyup', (event) => {
      this.held.delete(event.code);
    });

    window.addEventListener('blur', () => this.held.clear());

    canvas.addEventListener('pointerdown', (event) => {
      this.handlers.onGesture();
      this.dragging = true;
      this.lastPointerX = event.clientX;
      canvas.setPointerCapture(event.pointerId);
    });

    canvas.addEventListener('pointermove', (event) => {
      if (!this.dragging) return;
      const delta = event.clientX - this.lastPointerX;
      this.lastPointerX = event.clientX;
      this.yaw -= delta * this.sensitivity;
    });

    const stop = (event: PointerEvent): void => {
      this.dragging = false;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    };
    canvas.addEventListener('pointerup', stop);
    canvas.addEventListener('pointercancel', stop);
  }

  /** Resolved input for one simulation step; clears latched actions. */
  take(): ResolvedInput {
    let moveX = 0;
    let moveZ = 0;
    if (this.held.has('KeyW') || this.held.has('ArrowUp')) moveZ += 1;
    if (this.held.has('KeyS') || this.held.has('ArrowDown')) moveZ -= 1;
    // The camera sits behind Mây looking towards +Z, so in a right-handed world
    // the right-hand side of the screen is -X. D therefore feeds -X.
    if (this.held.has('KeyA') || this.held.has('ArrowLeft')) moveX += 1;
    if (this.held.has('KeyD') || this.held.has('ArrowRight')) moveX -= 1;

    const pressed = { ...this.latched, pause: false };
    this.latched.jump = false;
    this.latched.interact = false;
    this.latched.pulse = false;
    this.latched.dash = false;

    return { moveX, moveZ, yawDeg: this.yaw, pressed };
  }

  discard(): void {
    this.latched.jump = false;
    this.latched.interact = false;
    this.latched.pulse = false;
    this.latched.dash = false;
  }
}
