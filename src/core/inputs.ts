import type { ResolvedInput } from './types';
import type { InputFrame } from './scenario';

/**
 * Replays an `--inputs` file as a per-tick stream.
 *
 * Contract rules honoured here:
 *  - defaults before the first frame: move [0,0], cam_yaw_deg 0, every button false;
 *  - a frame only changes the fields it contains;
 *  - `jump`, `interact`, `pulse`, `dash` and `pause` fire on the false -> true edge.
 */
export class InputTimeline {
  private readonly frames: InputFrame[];
  private index = 0;

  private moveX = 0;
  private moveZ = 0;
  private yawDeg = 0;
  private jump = false;
  private interact = false;
  private pulse = false;
  private dash = false;
  private pause = false;

  constructor(frames: InputFrame[] = []) {
    this.frames = frames;
  }

  /** Resolved input for `tick` (the tick whose state is read by that step). */
  at(tick: number): ResolvedInput {
    const prev = {
      jump: this.jump,
      interact: this.interact,
      pulse: this.pulse,
      dash: this.dash,
      pause: this.pause,
    };

    while (this.index < this.frames.length && this.frames[this.index].tick <= tick) {
      const f = this.frames[this.index];
      this.index += 1;
      if (f.moveX !== undefined) this.moveX = f.moveX;
      if (f.moveZ !== undefined) this.moveZ = f.moveZ;
      if (f.yawDeg !== undefined) this.yawDeg = f.yawDeg;
      if (f.jump !== undefined) this.jump = f.jump;
      if (f.interact !== undefined) this.interact = f.interact;
      if (f.pulse !== undefined) this.pulse = f.pulse;
      if (f.dash !== undefined) this.dash = f.dash;
      if (f.pause !== undefined) this.pause = f.pause;
    }

    return {
      moveX: this.moveX,
      moveZ: this.moveZ,
      yawDeg: this.yawDeg,
      pressed: {
        jump: this.jump && !prev.jump,
        interact: this.interact && !prev.interact,
        pulse: this.pulse && !prev.pulse,
        dash: this.dash && !prev.dash,
        pause: this.pause && !prev.pause,
      },
    };
  }
}

/** Resolves a raw stick vector into a unit-length direction (or a shorter one). */
export function normaliseMove(moveX: number, moveZ: number): { x: number; z: number } {
  const len = Math.hypot(moveX, moveZ);
  if (len > 1) return { x: moveX / len, z: moveZ / len };
  return { x: moveX, z: moveZ };
}

/**
 * Turn stick input into a world-space direction using the camera yaw, exactly as
 * the contract specifies:
 *   x' = x*cos(theta) + z*sin(theta)
 *   z' = -x*sin(theta) + z*cos(theta)
 */
export function worldDirection(moveX: number, moveZ: number, yawDeg: number): { x: number; z: number } {
  const { x, z } = normaliseMove(moveX, moveZ);
  const th = (yawDeg * Math.PI) / 180;
  const c = Math.cos(th);
  const s = Math.sin(th);
  return { x: x * c + z * s, z: -x * s + z * c };
}
