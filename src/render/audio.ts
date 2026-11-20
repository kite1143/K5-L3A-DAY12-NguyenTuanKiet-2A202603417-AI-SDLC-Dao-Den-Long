/**
 * Tiny procedural sound layer: no audio files, everything is synthesised with
 * WebAudio, so nothing has to be licensed or downloaded.
 */
export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;

  /** Must be called from a user gesture (browser autoplay policy). */
  resume(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.28;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.28;
    return this.muted;
  }

  private tone(
    type: OscillatorType,
    from: number,
    to: number,
    duration: number,
    gain: number,
    delay = 0,
  ): void {
    if (!this.ctx || !this.master || this.muted) return;
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
    if (!this.ctx || !this.master || this.muted) return;
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
    this.tone('triangle', 880, 1320, 0.16, 0.18);
  }

  deposit(): void {
    this.tone('square', 430, 300, 0.14, 0.09);
  }

  lantern(): void {
    this.tone('sine', 660, 660, 1.1, 0.16);
    this.tone('sine', 990, 990, 1.3, 0.1, 0.04);
    this.tone('sine', 1320, 1320, 1.5, 0.06, 0.08);
  }

  pulse(): void {
    this.tone('sine', 700, 90, 0.42, 0.2);
    this.noise(0.3, 0.1, 900);
  }

  hit(): void {
    this.tone('sine', 150, 60, 0.3, 0.24);
    this.noise(0.22, 0.16, 420);
  }

  win(): void {
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => this.tone('sine', freq, freq, 0.7, 0.14, i * 0.13));
  }

  lose(): void {
    [392, 329.63, 261.63].forEach((freq, i) => this.tone('sine', freq, freq, 0.8, 0.13, i * 0.16));
  }
}
