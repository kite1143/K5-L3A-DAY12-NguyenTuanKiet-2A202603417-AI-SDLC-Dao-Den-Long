import type { ResolvedInput } from '../core/index';

export type Action =
  | 'forward'
  | 'back'
  | 'left'
  | 'right'
  | 'jump'
  | 'dash'
  | 'interact'
  | 'pulse'
  | 'pause';

export const ACTION_LABELS: Record<Action, string> = {
  forward: 'Đi tới',
  back: 'Đi lùi',
  left: 'Sang trái',
  right: 'Sang phải',
  jump: 'Nhảy',
  dash: 'Lướt',
  interact: 'Tương tác',
  pulse: 'Tỏa sáng',
  pause: 'Tạm dừng',
};

export const DEFAULT_KEYS: Record<Action, string> = {
  forward: 'KeyW',
  back: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  jump: 'Space',
  dash: 'ShiftLeft',
  interact: 'KeyE',
  pulse: 'KeyF',
  pause: 'Escape',
};

export type KeyMap = Record<Action, string>;

export function keyLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Arrow')) return `↑↓←→`.charAt(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(code)) || code;
  const map: Record<string, string> = {
    Space: 'Space',
    Escape: 'Esc',
    ShiftLeft: 'Shift',
    ShiftRight: 'Shift',
    ControlLeft: 'Ctrl',
    ControlRight: 'Ctrl',
    AltLeft: 'Alt',
    AltRight: 'Alt',
    Enter: 'Enter',
    Tab: 'Tab',
  };
  return map[code] ?? code;
}

/** Which action (if any) a keydown code belongs to, honouring the key map. */
export function actionForCode(code: string, keys: KeyMap): Action | null {
  for (const action of Object.keys(keys) as Action[]) {
    if (keys[action] === code) return action;
  }
  // Both shift keys dash unless the player rebound the dash key.
  if (keys.dash === 'ShiftLeft' && code === 'ShiftRight') return 'dash';
  return null;
}

export interface ControlHandlers {
  onPauseToggle: () => void;
  onGesture: () => void;
  /** Called with a keydown code while the settings panel is capturing a key. */
  onCaptureKey?: (code: string) => boolean;
}

export class Controls {
  yaw = 0;
  sensitivity = 0.0045;
  keys: KeyMap = { ...DEFAULT_KEYS };

  private readonly held = new Set<string>();
  private readonly latched = { jump: false, interact: false, pulse: false, dash: false };
  private dragging = false;
  private lastPointerX = 0;

  constructor(private readonly handlers: ControlHandlers) {}

  setKeyMap(keys: KeyMap): void {
    this.keys = { ...keys };
    this.held.clear();
  }

  attach(canvas: HTMLElement): void {
    window.addEventListener('keydown', (event) => {
      this.handlers.onGesture();
      if (this.handlers.onCaptureKey?.(event.code)) {
        event.preventDefault();
        return;
      }
      if (event.code === 'Space' || event.code.startsWith('Arrow')) event.preventDefault();

      if (!event.repeat) {
        const action = actionForCode(event.code, this.keys);
        if (action === 'jump') this.latched.jump = true;
        if (action === 'interact') this.latched.interact = true;
        if (action === 'pulse') this.latched.pulse = true;
        if (action === 'dash') this.latched.dash = true;
        if (action === 'pause') this.handlers.onPauseToggle();
      }
      this.held.add(event.code);
    });

    window.addEventListener('keyup', (event) => this.held.delete(event.code));
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

  take(): ResolvedInput {
    let moveX = 0;
    let moveZ = 0;
    for (const code of this.held) {
      const action = actionForCode(code, this.keys);
      if (action === 'forward') moveZ += 1;
      if (action === 'back') moveZ -= 1;
      if (action === 'left') moveX += 1;
      if (action === 'right') moveX -= 1;
    }

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
