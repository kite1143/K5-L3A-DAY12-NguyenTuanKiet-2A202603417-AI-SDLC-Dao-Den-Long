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
  onStart: () => void;
  onRestart: () => void;
}

/**
 * DOM heads-up display: flames, carried fireflies, score, night clock, lantern
 * count, plus the intro and end-of-night overlays.
 */
export class Hud {
  private readonly root: HTMLDivElement;
  private readonly flames: HTMLSpanElement;
  private readonly carry: HTMLSpanElement;
  private readonly score: HTMLSpanElement;
  private readonly time: HTMLSpanElement;
  private readonly lit: HTMLSpanElement;
  private readonly hint: HTMLDivElement;
  private readonly overlay: HTMLDivElement;
  private readonly title: HTMLHeadingElement;
  private readonly subtitle: HTMLParagraphElement;
  private readonly stats: HTMLParagraphElement;
  private readonly button: HTMLButtonElement;
  private readonly story: HTMLParagraphElement;
  private lastHint = '';

  constructor(handlers: HudHandlers) {
    this.root = document.createElement('div');
    this.root.className = 'hud';
    this.root.innerHTML = `
      <div class="panel panel-left">
        <div class="row"><span class="label">Ngọn lửa</span><span class="flames value"></span></div>
        <div class="row"><span class="label">Đom đóm</span><span class="carry value"></span></div>
        <div class="row"><span class="label">Điểm</span><span class="score value"></span></div>
      </div>
      <div class="panel panel-right">
        <div class="row"><span class="label">Đêm còn</span><span class="time value"></span></div>
        <div class="row"><span class="label">Đèn</span><span class="lit value"></span></div>
      </div>
      <div class="hint"></div>
      <div class="overlay">
        <div class="card">
          <h1></h1>
          <p class="subtitle"></p>
          <p class="story"></p>
          <p class="stats"></p>
          <button type="button"></button>
        </div>
      </div>
    `;
    document.body.appendChild(this.root);

    this.flames = must<HTMLSpanElement>(this.root, '.flames');
    this.carry = must<HTMLSpanElement>(this.root, '.carry');
    this.score = must<HTMLSpanElement>(this.root, '.score');
    this.time = must<HTMLSpanElement>(this.root, '.time');
    this.lit = must<HTMLSpanElement>(this.root, '.lit');
    this.hint = must<HTMLDivElement>(this.root, '.hint');
    this.overlay = must<HTMLDivElement>(this.root, '.overlay');
    this.title = must<HTMLHeadingElement>(this.root, '.card h1');
    this.subtitle = must<HTMLParagraphElement>(this.root, '.subtitle');
    this.story = must<HTMLParagraphElement>(this.root, '.story');
    this.stats = must<HTMLParagraphElement>(this.root, '.stats');
    this.button = must<HTMLButtonElement>(this.root, '.card button');

    this.button.addEventListener('click', () => {
      if (this.overlay.dataset.mode === 'intro') handlers.onStart();
      else handlers.onRestart();
    });
  }

  update(world: World): void {
    this.flames.textContent = `${'●'.repeat(Math.max(0, world.player.flames))}${'○'.repeat(
      Math.max(0, TUNING.flames - world.player.flames),
    )}`;
    this.carry.textContent = `${world.player.carried} / ${TUNING.carry_capacity}`;
    this.score.textContent = `${world.score}`;
    const seconds = Math.ceil(world.timeLeftTicks / 60);
    this.time.textContent = `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;
    const litCount = world.lanterns.filter((l) => l.lit).length;
    this.lit.textContent = `${'●'.repeat(litCount)}${'○'.repeat(world.lanterns.length - litCount)}`;
  }

  setHint(text: string): void {
    if (text === this.lastHint) return;
    this.lastHint = text;
    this.hint.textContent = text;
    this.hint.classList.toggle('visible', text.length > 0);
  }

  showIntro(): void {
    this.overlay.dataset.mode = 'intro';
    this.overlay.classList.remove('hidden');
    this.title.textContent = 'Đảo Đèn Lồng';
    this.subtitle.textContent = 'Đêm 1 — Đảo Bến';
    this.story.textContent =
      'Sương đen đã nuốt hết ánh sáng của đảo. Mây phải gom đom đóm, mang về thắp lại năm Đèn Lồng Lớn trước khi trời sáng. Bóng Mực sợ ánh sáng: nhấn F để tỏa sáng xua chúng đi.';
    this.stats.textContent =
      'WASD di chuyển · Space nhảy · E nạp đèn · F tỏa sáng · kéo chuột để xoay camera';
    this.button.textContent = 'Bắt đầu (Enter)';
  }

  showEnd(world: World): void {
    this.overlay.dataset.mode = 'end';
    this.overlay.classList.remove('hidden');
    const litCount = world.lanterns.filter((l) => l.lit).length;
    if (world.state === 'won') {
      this.title.textContent = 'Đảo đã sáng trở lại';
      this.subtitle.textContent = 'Thắng — cả năm Đèn Lồng Lớn đã cháy';
      this.story.textContent = `Bạn thắp lại được ${litCount}/${world.lanterns.length} ngọn đèn trước khi trời sáng.`;
    } else {
      const dawn = world.timeLeftTicks <= 0;
      this.title.textContent = dawn ? 'Trời đã sáng' : 'Mây đã tắt lịm';
      this.subtitle.textContent = dawn ? 'Thua — hết đêm mà đèn chưa đủ' : 'Thua — ngọn lửa cuối cùng đã tắt';
      this.story.textContent = `Bạn thắp lại được ${litCount}/${world.lanterns.length} ngọn đèn.`;
    }
    this.stats.textContent = `Điểm: ${world.score}`;
    this.button.textContent = 'Chơi lại (R)';
  }

  hideOverlay(): void {
    this.overlay.classList.add('hidden');
  }

  destroy(): void {
    this.root.remove();
  }
}
