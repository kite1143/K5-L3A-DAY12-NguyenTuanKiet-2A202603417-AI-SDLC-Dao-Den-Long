import { LOW_FUEL_UNITS, TUNING } from '../core/index';
import type { World } from '../core/index';
import { ACTION_LABELS, keyLabel } from './input';
import type { Action, KeyMap } from './input';
import type { Entry } from './leaderboard';
import { NAME_RE } from './leaderboard';

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
  onColorblind: (enabled: boolean) => void;
  onReduceMotion: (enabled: boolean) => void;
  onLargeText: (enabled: boolean) => void;
  onRebind: (action: Action) => void;
  onResetKeys: () => void;
  onLeaderboard: () => void;
  onProof: () => void;
  onSubmitScore: (name: string) => void;
  onSkipScore: () => void;
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
  private readonly colorblind: HTMLInputElement;
  private readonly meterLabel: HTMLSpanElement;
  private readonly warning: HTMLDivElement;
  private readonly toasts: HTMLDivElement;
  private readonly shadeArrow: HTMLDivElement;
  private readonly boardOverlay: HTMLDivElement;
  private readonly proofOverlay: HTMLDivElement;
  private readonly keymapList: HTMLDivElement;
  private readonly reduceMotion: HTMLInputElement;
  private readonly largeText: HTMLInputElement;
  private readonly scoreEntry: HTMLDivElement;
  private readonly nameInput: HTMLInputElement;
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
      <div class="mote-wrap"><div class="mote-bar"></div><span class="meter-label"></span></div>
      <div class="warning">⚠ <span class="warning-text"></span></div>
      <div class="cooldowns">
        <div class="cd" data-kind="dash"><span class="cd-icon">⇢</span><span class="cd-text">Lướt</span><div class="cd-fill"></div></div>
        <div class="cd" data-kind="pulse"><span class="cd-icon">✦</span><span class="cd-text">Tỏa sáng</span><div class="cd-fill"></div></div>
      </div>
      <div class="prompt"></div>
      <div class="arrow"><span></span></div>
      <div class="shade-arrow"><span></span></div>
      <div class="toasts"></div>
      <div class="overlay">
        <div class="card">
          <h1></h1>
          <p class="subtitle"></p>
          <p class="story"></p>
          <p class="stats"></p>
          <div class="buttons"></div>
          <div class="score-entry hidden">
            <input class="name-input" type="text" maxlength="12" placeholder="Tên (3-12 chữ/số)" />
            <button type="button" class="save-score">Lưu điểm</button>
            <button type="button" class="skip-score">Bỏ qua</button>
            <p class="name-error"></p>
          </div>
        </div>
      </div>
      <div class="settings hidden">
        <div class="card">
          <h1>Cài đặt</h1>
          <label>Âm lượng <input type="range" class="volume" min="0" max="100" step="1" /></label>
          <label>Độ nhạy chuột <input type="range" class="sensitivity" min="20" max="300" step="5" /></label>
          <label>Bảng màu dễ phân biệt <input type="checkbox" class="colorblind" /></label>
          <label>Giảm chuyển động <input type="checkbox" class="reduce-motion" /></label>
          <label>Chữ lớn (×1.25) <input type="checkbox" class="large-text" /></label>
          <h2>Đổi phím</h2>
          <div class="keymap"></div>
          <p class="keymap-error"></p>
          <div class="buttons">
            <button type="button" class="reset-keys">Khôi phục mặc định</button>
            <button type="button" class="close">Xong</button>
          </div>
        </div>
      </div>
      <div class="overlay board-overlay hidden">
        <div class="card">
          <h1>Bảng xếp hạng</h1>
          <p class="subtitle">Top 10 điểm cao nhất</p>
          <ol class="board-list"></ol>
          <div class="buttons"><button type="button" class="board-close">Đóng</button></div>
        </div>
      </div>
      <div class="overlay proof-overlay hidden">
        <div class="card">
          <h1>Bằng chứng</h1>
          <p class="subtitle">Số đo trên máy tác giả</p>
          <pre class="proof-body"></pre>
          <div class="buttons"><button type="button" class="proof-close">Đóng</button></div>
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
    this.colorblind = must<HTMLInputElement>(this.root, '.colorblind');
    this.meterLabel = must<HTMLSpanElement>(this.root, '.meter-label');
    this.warning = must<HTMLDivElement>(this.root, '.warning');
    this.toasts = must<HTMLDivElement>(this.root, '.toasts');
    this.shadeArrow = must<HTMLDivElement>(this.root, '.shade-arrow');
    this.boardOverlay = must<HTMLDivElement>(this.root, '.board-overlay');
    this.proofOverlay = must<HTMLDivElement>(this.root, '.proof-overlay');
    this.keymapList = must<HTMLDivElement>(this.root, '.keymap');
    this.reduceMotion = must<HTMLInputElement>(this.root, '.reduce-motion');
    this.largeText = must<HTMLInputElement>(this.root, '.large-text');
    this.scoreEntry = must<HTMLDivElement>(this.root, '.score-entry');
    this.nameInput = must<HTMLInputElement>(this.root, '.name-input');

    must<HTMLButtonElement>(this.root, '.settings .close').addEventListener('click', handlers.onCloseSettings);
    this.volume.addEventListener('input', () => handlers.onVolume(Number(this.volume.value)));
    this.sensitivity.addEventListener('input', () => handlers.onSensitivity(Number(this.sensitivity.value)));
    this.colorblind.addEventListener('change', () => handlers.onColorblind(this.colorblind.checked));
    this.reduceMotion.addEventListener('change', () => handlers.onReduceMotion(this.reduceMotion.checked));
    this.largeText.addEventListener('change', () => handlers.onLargeText(this.largeText.checked));
    must<HTMLButtonElement>(this.root, '.reset-keys').addEventListener('click', () => handlers.onResetKeys());
    must<HTMLButtonElement>(this.root, '.board-close').addEventListener('click', () =>
      this.boardOverlay.classList.add('hidden'),
    );
    must<HTMLButtonElement>(this.root, '.proof-close').addEventListener('click', () =>
      this.proofOverlay.classList.add('hidden'),
    );
    must<HTMLButtonElement>(this.root, '.skip-score').addEventListener('click', () => {
      this.scoreEntry.classList.add('hidden');
      handlers.onSkipScore();
    });
    must<HTMLButtonElement>(this.root, '.save-score').addEventListener('click', () => {
      const name = this.nameInput.value.trim();
      const error = must<HTMLParagraphElement>(this.root, '.name-error');
      if (!NAME_RE.test(name)) {
        error.textContent = 'Tên phải 3–12 ký tự chữ, số hoặc dấu _';
        return;
      }
      error.textContent = '';
      handlers.onSubmitScore(name);
    });

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

  /** Short visual caption (accessibility): shade spawn, wind, countdown, fuel. */
  toast(text: string): void {
    const line = document.createElement('div');
    line.className = 'toast';
    line.textContent = text;
    this.toasts.appendChild(line);
    while (this.toasts.children.length > 4) this.toasts.removeChild(this.toasts.firstElementChild!);
    window.setTimeout(() => line.remove(), 3200);
  }

  /** Red edge arrow pointing at a shade that just spawned, for 2.5 s. */
  flashShadeArrow(angleDeg: number): void {
    must<HTMLSpanElement>(this.shadeArrow, 'span').style.transform = `rotate(${angleDeg}deg)`;
    this.shadeArrow.classList.add('visible');
    window.setTimeout(() => this.shadeArrow.classList.remove('visible'), 2500);
  }

  showLeaderboard(entries: Entry[]): void {
    const list = must<HTMLOListElement>(this.root, '.board-list');
    list.innerHTML = '';
    if (entries.length === 0) {
      const empty = document.createElement('li');
      empty.textContent = 'Chưa có ai. Hãy là người đầu tiên!';
      list.appendChild(empty);
    }
    for (const entry of entries) {
      const item = document.createElement('li');
      const when = entry.achieved_at.replace('T', ' ').slice(0, 16);
      item.innerHTML = `<span class="board-name"></span><span class="board-score"></span><span class="board-meta"></span>`;
      must<HTMLSpanElement>(item, '.board-name').textContent = entry.name;
      must<HTMLSpanElement>(item, '.board-score').textContent = String(entry.score);
      must<HTMLSpanElement>(item, '.board-meta').textContent = `${entry.nights_won}/3 đêm · ${when}`;
      list.appendChild(item);
    }
    this.boardOverlay.classList.remove('hidden');
  }

  showProof(text: string): void {
    must<HTMLPreElement>(this.root, '.proof-body').textContent = text;
    this.proofOverlay.classList.remove('hidden');
  }

  showScoreEntry(): void {
    this.scoreEntry.classList.remove('hidden');
    this.nameInput.focus();
  }

  hideScoreEntry(): void {
    this.scoreEntry.classList.add('hidden');
  }

  getScoreName(): string {
    return this.nameInput.value.trim();
  }

  renderKeyMap(keys: KeyMap, conflict: string | null): void {
    this.keymapList.innerHTML = '';
    for (const action of Object.keys(keys) as Action[]) {
      const row = document.createElement('div');
      row.className = 'keymap-row';
      const label = document.createElement('span');
      label.textContent = ACTION_LABELS[action];
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'key-button';
      button.dataset.action = action;
      button.textContent = keyLabel(keys[action]);
      row.append(label, button);
      this.keymapList.appendChild(row);
    }
    must<HTMLParagraphElement>(this.root, '.keymap-error').textContent = conflict ?? '';
  }

  setKeyCapture(action: Action | null): void {
    for (const button of this.keymapList.querySelectorAll<HTMLButtonElement>('.key-button')) {
      button.classList.toggle('capturing', button.dataset.action === action);
      if (button.dataset.action === action) button.textContent = '…';
    }
  }

  setMotionPreferences(reduceMotion: boolean, largeText: boolean): void {
    this.reduceMotion.checked = reduceMotion;
    this.largeText.checked = largeText;
    this.root.classList.toggle('reduce-motion', reduceMotion);
    this.root.classList.toggle('large-text', largeText);
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

    if (this.moteSlotCount !== world.player.capacity) {
      this.moteBar.innerHTML = '';
      for (let i = 0; i < world.player.capacity; i += 1) {
        const slot = document.createElement('span');
        slot.className = 'mote-slot';
        this.moteBar.appendChild(slot);
      }
      this.moteSlotCount = world.player.capacity;
    }
    const slots = this.moteBar.children;
    for (let i = 0; i < slots.length; i += 1) slots[i].classList.toggle('full', i < world.player.carried);
    this.meterLabel.textContent = `${world.player.carried}/${world.player.capacity}`;

    // A lit lantern under the low-fuel threshold loses its safe zone: warn the player.
    const weak = world.lanterns.filter((l) => l.lit && l.fuelUnits < LOW_FUEL_UNITS);
    this.warning.classList.toggle('visible', weak.length > 0);
    if (weak.length > 0) {
      must<HTMLSpanElement>(this.root, '.warning-text').textContent =
        `${weak.map((l) => l.id).join(', ')} sắp cạn dầu`;
    }

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
    this.boardOverlay.classList.add('hidden');
    this.proofOverlay.classList.add('hidden');
    this.hideScoreEntry();
    this.title.textContent = 'Đảo Đèn Lồng';
    this.subtitle.textContent = 'Ba hòn đảo — ba đêm';
    this.story.textContent =
      'Sương đen đã nuốt hết ánh sáng của đảo. Mây phải gom đom đóm, mang về thắp lại từng Đèn Lồng Lớn trước khi trời sáng, qua Đảo Bến, Đảo Cau và Đảo Chuông.';
    this.stats.textContent = `Điểm cao nhất: ${bestScore}  ·  WASD/Phím đã đổi · Space nhảy · Shift lướt · E nạp đèn · F tỏa sáng · Esc tạm dừng`;
    this.clearButtons();
    const handlers = (this.root as unknown as { __handlers: HudHandlers }).__handlers;
    this.button('Bắt đầu', handlers.onPlay);
    this.button('Bảng xếp hạng', handlers.onLeaderboard);
    this.button('Bằng chứng', handlers.onProof);
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

  showSettings(volume: number, sensitivity: number, colorblind: boolean): void {
    this.settingsPanel.classList.remove('hidden');
    this.volume.value = String(volume);
    this.sensitivity.value = String(sensitivity);
    this.colorblind.checked = colorblind;
  }

  setColorblind(enabled: boolean): void {
    this.root.classList.toggle('colorblind', enabled);
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
