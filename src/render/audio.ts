/**
 * Procedural audio: night music and every effect from Ticket-02, synthesised
 * with WebAudio. No audio files, so nothing needs licensing.
 */
export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGainValue = 0.06;
  private musicOscillators: OscillatorNode[] = [];
  private volume = 0.3;

  /** Must be called from a user gesture (browser autoplay policy). */
  resume(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
      this.startMusic();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setVolume(value01: number): void {
    this.volume = Math.max(0, Math.min(1, value01));
    if (this.master) this.master.gain.value = this.volume;
  }

  private startMusic(): void {
    if (!this.ctx || !this.master || this.musicOscillators.length > 0) return;
    const gain = this.ctx.createGain();
    gain.gain.value = this.musicGainValue;
    gain.connect(this.master);
    // A slow, warm drone built from detuned sines plus a soft fifth.
    for (const [freq, type, amp] of [
      [110, 'sine', 0.5],
      [164.81, 'sine', 0.28],
      [220, 'triangle', 0.12],
    ] as Array<[number, OscillatorType, number]>) {
      const osc = this.ctx.createOscillator();
      const env = this.ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      env.gain.value = amp;
      osc.connect(env).connect(gain);
      osc.start();
      this.musicOscillators.push(osc);
    }
    // Gentle amplitude breathing so the drone never sounds static.
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.value = 0.07;
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain).connect(gain.gain);
    lfo.start();
    this.musicOscillators.push(lfo);
  }

  private tone(type: OscillatorType, from: number, to: number, duration: number, gain: number, delay = 0): void {
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), now + duration);
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(gain, now + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(env).connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.05);
  }

  private noise(duration: number, gain: number, filterHz: number): void {
    if (!this.ctx || !this.master) return;
    const frames = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / frames) ** 2;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterHz;
    const env = this.ctx.createGain();
    env.gain.value = gain;
    source.connect(filter).connect(env).connect(this.master);
    source.start();
  }

  pickup(): void {
    this.tone('triangle', 880, 1320, 0.16, 0.14);
  }

  deposit(): void {
    this.tone('square', 430, 300, 0.14, 0.08);
  }

  lantern(): void {
    this.tone('sine', 660, 660, 1.1, 0.14);
    this.tone('sine', 990, 990, 1.3, 0.09, 0.04);
    this.tone('sine', 1320, 1320, 1.5, 0.05, 0.08);
  }

  pulse(): void {
    this.tone('sine', 700, 90, 0.42, 0.16);
    this.noise(0.3, 0.08, 900);
  }

  jump(): void {
    this.tone('triangle', 420, 620, 0.12, 0.08);
  }

  dash(): void {
    this.noise(0.18, 0.1, 1500);
    this.tone('sawtooth', 520, 180, 0.16, 0.06);
  }

  hit(): void {
    this.tone('sine', 150, 60, 0.3, 0.2);
    this.noise(0.22, 0.14, 420);
  }

  drifter(): void {
    this.tone('sine', 900, 1500, 0.5, 0.05);
    this.tone('sine', 1200, 700, 0.6, 0.04, 0.1);
  }

  charm(): void {
    [660, 880, 1100].forEach((freq, i) => this.tone('sine', freq, freq, 0.5, 0.08, i * 0.07));
  }

  countdown(): void {
    this.tone('sine', 880, 880, 0.12, 0.12);
  }

  win(): void {
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => this.tone('sine', freq, freq, 0.7, 0.13, i * 0.13));
  }

  lose(): void {
    [392, 329.63, 261.63].forEach((freq, i) => this.tone('sine', freq, freq, 0.8, 0.12, i * 0.16));
  }
}
