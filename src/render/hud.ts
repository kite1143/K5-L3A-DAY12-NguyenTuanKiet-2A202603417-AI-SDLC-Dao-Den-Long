import { TUNING } from '../core/index';
import type { World } from '../core/index';

function must<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector(selector);
  if (!element) throw new Error(`HUD element missing: ${selector}`);
  return element as T;
}

function pad(value: number): string {
  return value < 10 ? `0${value}` : `${value}`;
}

export interface HudHandlers {
  onPlay: () => void;
  onRestartNight: () => void;
  onNextNight: () => void;
  onResume: () => void;
  onMenu: () => void;
  onSettings: () => void;
  onCloseSettings: () => void;
  onVolume: (value: number) => void;
  onSensitivity: (value: number) => void;
}

/**
 * DOM heads-up display and the overlay screens (menu, night intro, result,
 * dawn, pause, settings), following the HUD list in Ticket-02 part 3.
 */
export class Hud {
  private readonly root: HTMLDivElement;
  private readonly flames: HTMLSpanElement;
  private readonly clock: HTMLSpanElement;
  private readonly lanternCount: HTMLSpanElement;
  private readonly score: HTMLSpanElement;
  private readonly moteBar: HTMLDivElement;
  private readonly prompt: HTMLDivElement;
  private readonly arrow: HTMLDivElement;
  private readonly dashCooldown: HTMLDivElement;
  private readonly pulseCooldown: HTMLDivElement;
  private readonly overlay: HTMLDivElement;
  private readonly card: HTMLDivElement;
  private readonly title: HTMLHeadingElement;
  private readonly subtitle: HTMLParagraphElement;
  private readonly story: HTMLParagraphElement;
  private readonly stats: HTMLParagraphElement;
  private readonly buttons: HTMLDivElement;
  private readonly settingsPanel: HTMLDivElement;
  private readonly volume: HTMLInputElement;
  private readonly sensitivity: HTMLInputElement;
  private lastPrompt = '';
  private moteSlotCount = 0;

  constructor(handlers: HudHandlers) {
    this.root = document.createElement('div');
    this.root.className = 'hud';
    this.root.innerHTML = `
      <div class="panel panel-left">
        <div class="row"><span class="label">Ngọn lửa</span><span class="flames value"></span></div>
        <div class="row small"><span class="label">Đêm</span><span class="night value"></span></div>
      </div>
      <div class="clock-wrap"><span class="clock value"></span></div>
      <div class="panel panel-right">
        <div class="row"><span class="label">Đèn</span><span class="lanterns value"></span></div>
        <div class="row"><span class="label">Điểm</span><span class="score value"></span></div>
      </div>
      <div class="mote-bar"></div>
      <div class="cooldowns">
        <div class="cd" data-kind="dash"><span class="cd-icon">⇢</span><span class="cd-text">Lướt</span><div class="cd-fill"></div></div>
        <div class="cd" data-kind="pulse"><span class="cd-icon">✦</span><span class="cd-text">Tỏa sáng</span><div class="cd-fill"></div></div>
      </div>
      <div class="prompt"></div>
      <div class="arrow"><span></span></div>
      <div class="overlay">
        <div class="card">
          <h1></h1>
          <p class="subtitle"></p>
          <p class="story"></p>
          <p class="stats"></p>
          <div class="buttons"></div>
        </div>
      </div>
      <div class="settings hidden">
        <div class="card">
          <h1>Cài đặt</h1>
          <label>Âm lượng <input type="range" class="volume" min="0" max="100" step="1" /></label>
          <label>Độ nhạy chuột <input type="range" class="sensitivity" min="20" max="300" step="5" /></label>
          <div class="buttons"><button type="button" class="close">Xong</button></div>
        </div>
      </div>
    `;
    document.body.appendChild(this.root);

    this.flames = must<HTMLSpanElement>(this.root, '.flames');
    this.clock = must<HTMLSpanElement>(this.root, '.clock');
    this.lanternCount = must<HTMLSpanElement>(this.root, '.lanterns');
    this.score = must<HTMLSpanElement>(this.root, '.score');
    this.moteBar = must<HTMLDivElement>(this.root, '.mote-bar');
    this.prompt = must<HTMLDivElement>(this.root, '.prompt');
    this.arrow = must<HTMLDivElement>(this.root, '.arrow');
    this.dashCooldown = must<HTMLDivElement>(this.root, '.cd[data-kind="dash"]');
    this.pulseCooldown = must<HTMLDivElement>(this.root, '.cd[data-kind="pulse"]');
    this.overlay = must<HTMLDivElement>(this.root, '.overlay');
    this.card = must<HTMLDivElement>(this.root, '.overlay .card');
    this.title = must<HTMLHeadingElement>(this.card, 'h1');
    this.subtitle = must<HTMLParagraphElement>(this.card, '.subtitle');
    this.story = must<HTMLParagraphElement>(this.card, '.story');
    this.stats = must<HTMLParagraphElement>(this.card, '.stats');
    this.buttons = must<HTMLDivElement>(this.card, '.buttons');
    this.settingsPanel = must<HTMLDivElement>(this.root, '.settings');
    this.volume = must<HTMLInputElement>(this.root, '.volume');
    this.sensitivity = must<HTMLInputElement>(this.root, '.sensitivity');

    must<HTMLButtonElement>(this.root, '.settings .close').addEventListener('click', handlers.onCloseSettings);
    this.volume.addEventListener('input', () => handlers.onVolume(Number(this.volume.value)));
    this.sensitivity.addEventListener('input', () => handlers.onSensitivity(Number(this.sensitivity.value)));

    (this.root as unknown as { __handlers: HudHandlers }).__handlers = handlers;
  }

  private button(label: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', onClick);
    this.buttons.appendChild(button);
    return button;
  }

  private clearButtons(): void {
    this.buttons.innerHTML = '';
  }

  /** Enter triggers the primary action of whatever overlay is showing. */
  clickPrimary(): void {
    const button = this.buttons.querySelector('button');
    if (button) button.click();
  }

  update(world: World, highlightSeconds: number): void {
    const flames = Math.max(0, world.player.flames);
    this.flames.textContent = `${'●'.repeat(flames)}${'○'.repeat(Math.max(0, TUNING.flames - flames))}`;
    must<HTMLSpanElement>(this.root, '.night').textContent = `${world.night}`;
    this.score.textContent = `${world.score}`;
    const lit = world.lanterns.filter((l) => l.lit).length;
    this.lanternCount.textContent = `${lit}/${world.lanterns.length}`;

    const seconds = Math.max(0, Math.ceil(world.timeLeftTicks / 60));
    this.clock.textContent = `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;
    this.clock.classList.toggle('urgent', seconds <= 30);
    this.clock.classList.toggle('blink', seconds <= highlightSeconds && seconds <= 10);

    if (this.moteSlotCount !== TUNING.carry_capacity) {
      this.moteBar.innerHTML = '';
      for (let i = 0; i < TUNING.carry_capacity; i += 1) {
        const slot = document.createElement('span');
        slot.className = 'mote-slot';
        this.moteBar.appendChild(slot);
      }
      this.moteSlotCount = TUNING.carry_capacity;
    }
    const slots = this.moteBar.children;
    for (let i = 0; i < slots.length; i += 1) slots[i].classList.toggle('full', i < world.player.carried);

    const dashRatio = world.player.dashCdTicks / (TUNING.dash_cooldown_s * 60);
    const pulseRatio = world.player.pulseCdTicks / (TUNING.pulse_cooldown_s * 60);
    must<HTMLDivElement>(this.dashCooldown, '.cd-fill').style.height = `${Math.round(dashRatio * 100)}%`;
    must<HTMLDivElement>(this.pulseCooldown, '.cd-fill').style.height = `${Math.round(pulseRatio * 100)}%`;
    this.dashCooldown.classList.toggle('ready', world.player.dashCdTicks <= 0);
    this.pulseCooldown.classList.toggle('ready', world.player.pulseCdTicks <= 0 && world.player.carried >= TUNING.pulse_cost);
  }

  setPrompt(text: string): void {
    if (text === this.lastPrompt) return;
    this.lastPrompt = text;
    this.prompt.textContent = text;
    this.prompt.classList.toggle('visible', text.length > 0);
  }

  /** Screen-space direction (degrees, 0 = up) to the nearest unlit lantern. */
  setArrow(angleDeg: number | null): void {
    if (angleDeg === null) {
      this.arrow.classList.remove('visible');
      return;
    }
    this.arrow.classList.add('visible');
    must<HTMLSpanElement>(this.arrow, 'span').style.transform = `rotate(${angleDeg}deg)`;
  }

  showMenu(bestScore: number): void {
    this.overlay.classList.remove('hidden');
    this.settingsPanel.classList.add('hidden');
    this.title.textContent = 'Đảo Đèn Lồng';
    this.subtitle.textContent = 'Ba hòn đảo — ba đêm';
    this.story.textContent =
      'Sương đen đã nuốt hết ánh sáng của đảo. Mây phải gom đom đóm, mang về thắp lại từng Đèn Lồng Lớn trước khi trời sáng, qua Đảo Bến, Đảo Cau và Đảo Chuông.';
    this.stats.textContent =
      `Điểm cao nhất: ${bestScore}  ·  WASD di chuyển · Space nhảy · Shift lướt · E nạp đèn · F tỏa sáng · Esc tạm dừng`;
    this.clearButtons();
    const handlers = (this.root as unknown as { __handlers: HudHandlers }).__handlers;
    this.button('Bắt đầu', handlers.onPlay);
    this.button('Cài đặt', handlers.onSettings);
  }

  showNightIntro(night: number, name: string, quote: string, onPlay: () => void): void {
    this.overlay.classList.remove('hidden');
    this.settingsPanel.classList.add('hidden');
    this.title.textContent = `Đêm ${night} — ${name}`;
    this.subtitle.textContent = `Ngọn lửa: ${TUNING.flames}`;
    this.story.textContent = quote;
    this.stats.textContent = 'Ông Đăng: “Ánh sáng không tự đến. Con phải mang nó về.”';
    this.clearButtons();
    this.button('Vào đêm', onPlay);
  }

  showResult(won: boolean, night: number, score: number, reason: string, handlers: HudHandlers): void {
    this.overlay.classList.remove('hidden');
    this.title.textContent = won ? `Đêm ${night} đã sáng` : `Đêm ${night} chưa xong`;
    this.subtitle.textContent = won ? 'Thắng' : reason;
    this.story.textContent = won
      ? 'Cả những ngọn đèn đã cháy, sương tan dần ở mép đảo.'
      : 'Trời chưa sáng hết, nhưng ánh sáng đã cạn.';
    this.stats.textContent = `Điểm đêm này: ${score}`;
    this.clearButtons();
    if (won) this.button(night >= 3 ? 'Bình minh' : 'Đêm tiếp theo', handlers.onNextNight);
    else this.button('Chơi lại đêm này', handlers.onRestartNight);
    this.button('Về menu', handlers.onMenu);
  }

  showDawn(totalScore: number, handlers: HudHandlers): void {
    this.overlay.classList.remove('hidden');
    this.title.textContent = 'Bình minh';
    this.subtitle.textContent = 'Ba đêm đã qua';
    this.story.textContent = 'Mặt trời lên trên biển mây. Đảo Đèn Lồng đã trở lại.';
    this.stats.textContent = `Tổng điểm: ${totalScore}`;
    this.clearButtons();
    this.button('Chơi lại từ Đêm 1', handlers.onPlay);
    this.button('Về menu', handlers.onMenu);
  }

  showPause(handlers: HudHandlers): void {
    this.overlay.classList.remove('hidden');
    this.title.textContent = 'Tạm dừng';
    this.subtitle.textContent = 'Trò chơi đang dừng';
    this.story.textContent = 'Nhấn Esc để tiếp tục.';
    this.stats.textContent = '';
    this.clearButtons();
    this.button('Tiếp tục', handlers.onResume);
    this.button('Chơi lại đêm', handlers.onRestartNight);
    this.button('Cài đặt', handlers.onSettings);
    this.button('Về menu', handlers.onMenu);
  }

  showSettings(volume: number, sensitivity: number): void {
    this.settingsPanel.classList.remove('hidden');
    this.volume.value = String(volume);
    this.sensitivity.value = String(sensitivity);
  }

  hideSettings(): void {
    this.settingsPanel.classList.add('hidden');
  }

  hideOverlay(): void {
    this.overlay.classList.add('hidden');
  }

  setVisible(visible: boolean): void {
    this.root.classList.toggle('in-game', visible);
  }

  destroy(): void {
    this.root.remove();
  }
}
