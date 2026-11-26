import type { WeaponId } from './types';

export class TacticalAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private masterCompressor: DynamicsCompressorNode | null = null;
  private ambienceGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private sfxDryBus: WaveShaperNode | null = null;
  private valleyReverb: ConvolverNode | null = null;
  private reverbReturnGain: GainNode | null = null;
  private voiceGain: GainNode | null = null;
  private captureDest: MediaStreamAudioDestinationNode | null = null;

  private pinkBedBuffer: AudioBuffer | null = null;
  private whiteCrackBuffer: AudioBuffer | null = null;
  private rainDropBuffer: AudioBuffer | null = null;

  private windLowFilter: BiquadFilterNode | null = null;
  private windLowGain: GainNode | null = null;
  private windCanopyFilter: BiquadFilterNode | null = null;
  private windCanopyGain: GainNode | null = null;
  private cicadaGain: GainNode | null = null;
  private rainSheetFilter: BiquadFilterNode | null = null;
  private rainSheetGain: GainNode | null = null;
  private rainDropGain: GainNode | null = null;
  private ambienceRunning = false;

  private birdCooldown = 2.0;
  private frogCooldown = 1.2;
  private windPhase = 0;
  private cicadaPhase = 0;

  private muted = false;
  private ambienceVolume = 0.78;
  private sfxVolume = 0.85;
  private proximityVoiceEnabled = true;
  private activeSpatialVoices: {
    sourceId: string;
    panner: PannerNode;
    expiresAt: number;
  }[] = [];

  public isMuted(): boolean {
    return this.muted;
  }

  public getAmbienceVolume(): number {
    return this.ambienceVolume;
  }

  public getSfxVolume(): number {
    return this.sfxVolume;
  }

  public isProximityVoiceEnabled(): boolean {
    return this.proximityVoiceEnabled;
  }

  public setProximityVoiceEnabled(enabled: boolean): void {
    this.proximityVoiceEnabled = enabled;
    if (this.voiceGain && this.ctx) {
      this.voiceGain.gain.setTargetAtTime(enabled ? 0.95 : 0, this.ctx.currentTime, 0.04);
    }
  }

  public toggleProximityVoice(): boolean {
    this.setProximityVoiceEnabled(!this.proximityVoiceEnabled);
    return this.proximityVoiceEnabled;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.86, this.ctx.currentTime, 0.04);
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  public setAmbienceVolume(vol: number): void {
    this.ambienceVolume = Math.max(0, Math.min(1, vol));
    if (this.ambienceGain && this.ctx) {
      this.ambienceGain.gain.setTargetAtTime(this.ambienceVolume, this.ctx.currentTime, 0.04);
    }
  }

  public setSfxVolume(vol: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, vol));
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setTargetAtTime(this.sfxVolume, this.ctx.currentTime, 0.04);
    }
  }

  public getCaptureStream(): MediaStream | null {
    this.unlock();
    if (!this.ctx || !this.masterGain) return null;
    if (typeof this.ctx.createMediaStreamDestination !== 'function') return null;
    if (!this.captureDest) {
      this.captureDest = this.ctx.createMediaStreamDestination();
      this.masterGain.connect(this.captureDest);
    }
    return this.captureDest.stream;
  }

  public playCameraShutter(): void {
    this.unlock();
    if (!this.ctx || !this.sfxGain || this.muted) return;
    const t = this.ctx.currentTime;

    const clickOsc = this.ctx.createOscillator();
    const clickGain = this.ctx.createGain();
    clickOsc.type = 'triangle';
    clickOsc.frequency.setValueAtTime(1900, t);
    clickOsc.frequency.exponentialRampToValueAtTime(340, t + 0.032);
    clickGain.gain.setValueAtTime(0.22, t);
    clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.038);
    clickOsc.connect(clickGain);
    clickGain.connect(this.sfxGain);
    clickOsc.start(t);
    clickOsc.stop(t + 0.04);

    if (this.whiteCrackBuffer) {
      const burst = this.ctx.createBufferSource();
      burst.buffer = this.whiteCrackBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 3200;
      filter.Q.value = 1.4;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.18, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.065);
      burst.connect(filter);
      filter.connect(g);
      g.connect(this.sfxGain);
      burst.start(t + 0.015);
      burst.stop(t + 0.07);
    }
  }

  public unlock(): void {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      this.masterCompressor = this.ctx.createDynamicsCompressor();
      this.masterCompressor.threshold.value = -14;
      this.masterCompressor.knee.value = 12;
      this.masterCompressor.ratio.value = 5.5;
      this.masterCompressor.attack.value = 0.002;
      this.masterCompressor.release.value = 0.22;

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.86;
      this.masterCompressor.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
      if (this.captureDest) {
        this.masterGain.connect(this.captureDest);
      }

      this.ambienceGain = this.ctx.createGain();
      this.ambienceGain.gain.value = this.ambienceVolume;
      this.ambienceGain.connect(this.masterCompressor);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxVolume;
      this.sfxGain.connect(this.masterCompressor);

      // Warm analog saturation curve on SFX bus
      this.sfxDryBus = this.ctx.createWaveShaper();
      this.sfxDryBus.curve = this.makeSaturationCurve(1.85);
      this.sfxDryBus.oversample = '2x';
      this.sfxDryBus.connect(this.sfxGain);

      // Natural Mekong Valley Jungle & Hilltop Slapback Impulse Response
      this.valleyReverb = this.ctx.createConvolver();
      this.valleyReverb.buffer = this.createValleyImpulse(1.85);
      this.reverbReturnGain = this.ctx.createGain();
      this.reverbReturnGain.gain.value = 0.42;
      this.valleyReverb.connect(this.reverbReturnGain);
      this.reverbReturnGain.connect(this.sfxGain);

      this.voiceGain = this.ctx.createGain();
      this.voiceGain.gain.value = this.proximityVoiceEnabled ? 0.95 : 0;
      this.voiceGain.connect(this.sfxGain);

      this.pinkBedBuffer = this.createPinkBedBuffer(4.0);
      this.whiteCrackBuffer = this.createWhiteCrackBuffer(1.5);
      this.rainDropBuffer = this.createRainDropBuffer(3.0);
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    if (!this.ambienceRunning && this.ctx) {
      this.startJungleBed();
    }
  }

  private makeSaturationCurve(drive: number): Float32Array<ArrayBuffer> {
    const n = 256;
    const buffer = new ArrayBuffer(n * 4);
    const curve = new Float32Array(buffer);
    const norm = Math.tanh(drive);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / (n - 1) - 1;
      curve[i] = Math.tanh(x * drive) / norm;
    }
    return curve;
  }

  private createValleyImpulse(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / ctx.sampleRate;
        // Early foliage reflection cluster + late distant ridge slapback
        const early = t < 0.08 ? Math.exp(-t * 28) * 0.65 : 0;
        const ridgeEcho =
          t > 0.14 && t < 0.34 ? Math.exp(-Math.abs(t - 0.22) * 24) * 0.48 : 0;
        const tail = Math.exp(-t * 2.75) * 0.52;
        const raw = (Math.random() * 2 - 1) * (early + ridgeEcho + tail);
        // Air absorption lowpass progression
        const alpha = Math.max(0.06, 0.35 - t * 0.16);
        lp = lp + alpha * (raw - lp);
        data[i] = lp;
      }
    }
    return buffer;
  }

  private createPinkBedBuffer(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      const pink = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
      data[i] = Math.max(-1, Math.min(1, pink));
    }
    return buffer;
  }

  private createWhiteCrackBuffer(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      // Slightly textured broadband impulse noise
      const w = Math.random() * 2 - 1;
      const spike = Math.random() < 0.008 ? (Math.random() > 0.5 ? 1.0 : -1.0) : 0;
      data[i] = Math.max(-1, Math.min(1, w * 0.85 + spike * 0.45));
    }
    return buffer;
  }

  private createRainDropBuffer(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let env = 0;
    for (let i = 0; i < length; i++) {
      if (Math.random() < 0.0032) {
        env = 0.5 + Math.random() * 0.5;
      }
      env *= 0.945;
      data[i] = (Math.random() * 2 - 1) * env;
    }
    return buffer;
  }

  private createPanner(pan: number, dest: AudioNode): AudioNode {
    if (this.ctx?.createStereoPanner) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      p.connect(dest);
      return p;
    }
    return dest;
  }

  private startJungleBed(): void {
    if (!this.ctx || !this.ambienceGain || !this.pinkBedBuffer || !this.rainDropBuffer || this.ambienceRunning) return;
    this.ambienceRunning = true;

    // 1. Low valley breeze across grass & hills
    const windLowSrc = this.ctx.createBufferSource();
    windLowSrc.buffer = this.pinkBedBuffer;
    windLowSrc.loop = true;

    this.windLowFilter = this.ctx.createBiquadFilter();
    this.windLowFilter.type = 'lowpass';
    this.windLowFilter.frequency.value = 260;

    this.windLowGain = this.ctx.createGain();
    this.windLowGain.gain.value = 0.14;
    windLowSrc.connect(this.windLowFilter);
    this.windLowFilter.connect(this.windLowGain);
    this.windLowGain.connect(this.ambienceGain);
    windLowSrc.start(0, 0);

    // 2. High canopy palm frond rustle
    const windCanopySrc = this.ctx.createBufferSource();
    windCanopySrc.buffer = this.pinkBedBuffer;
    windCanopySrc.loop = true;

    this.windCanopyFilter = this.ctx.createBiquadFilter();
    this.windCanopyFilter.type = 'bandpass';
    this.windCanopyFilter.frequency.value = 2150;
    this.windCanopyFilter.Q.value = 0.75;

    this.windCanopyGain = this.ctx.createGain();
    this.windCanopyGain.gain.value = 0.04;
    windCanopySrc.connect(this.windCanopyFilter);
    this.windCanopyFilter.connect(this.windCanopyGain);
    this.windCanopyGain.connect(this.ambienceGain);
    windCanopySrc.start(0, 1.3);

    // 3. Dual-band tropical cicada chorus
    const cicadaSrc = this.ctx.createBufferSource();
    cicadaSrc.buffer = this.whiteCrackBuffer!;
    cicadaSrc.loop = true;

    const cicadaFilterA = this.ctx.createBiquadFilter();
    cicadaFilterA.type = 'bandpass';
    cicadaFilterA.frequency.value = 4380;
    cicadaFilterA.Q.value = 7.5;

    const cicadaFilterB = this.ctx.createBiquadFilter();
    cicadaFilterB.type = 'bandpass';
    cicadaFilterB.frequency.value = 6720;
    cicadaFilterB.Q.value = 9.0;

    const cicadaLfo = this.ctx.createOscillator();
    cicadaLfo.type = 'sine';
    cicadaLfo.frequency.value = 14.5;
    const cicadaLfoDepth = this.ctx.createGain();
    cicadaLfoDepth.gain.value = 0.008;

    this.cicadaGain = this.ctx.createGain();
    this.cicadaGain.gain.value = 0.022;

    cicadaLfo.connect(cicadaLfoDepth);
    cicadaLfoDepth.connect(this.cicadaGain.gain);

    cicadaSrc.connect(cicadaFilterA);
    cicadaSrc.connect(cicadaFilterB);
    cicadaFilterA.connect(this.cicadaGain);
    cicadaFilterB.connect(this.cicadaGain);
    this.cicadaGain.connect(this.ambienceGain);
    cicadaSrc.start(0, 0.2);
    cicadaLfo.start();

    // 4. Monsoon rain sheet + canopy leaf patter droplets
    const rainSheetSrc = this.ctx.createBufferSource();
    rainSheetSrc.buffer = this.pinkBedBuffer;
    rainSheetSrc.loop = true;

    this.rainSheetFilter = this.ctx.createBiquadFilter();
    this.rainSheetFilter.type = 'bandpass';
    this.rainSheetFilter.frequency.value = 1150;
    this.rainSheetFilter.Q.value = 0.42;

    this.rainSheetGain = this.ctx.createGain();
    this.rainSheetGain.gain.value = 0.0001;
    rainSheetSrc.connect(this.rainSheetFilter);
    this.rainSheetFilter.connect(this.rainSheetGain);
    this.rainSheetGain.connect(this.ambienceGain);
    rainSheetSrc.start(0, 2.1);

    const dropSrc = this.ctx.createBufferSource();
    dropSrc.buffer = this.rainDropBuffer;
    dropSrc.loop = true;
    const dropFilter = this.ctx.createBiquadFilter();
    dropFilter.type = 'highpass';
    dropFilter.frequency.value = 2400;
    this.rainDropGain = this.ctx.createGain();
    this.rainDropGain.gain.value = 0.0001;
    dropSrc.connect(dropFilter);
    dropFilter.connect(this.rainDropGain);
    this.rainDropGain.connect(this.ambienceGain);
    dropSrc.start(0, 0.4);
  }

  public updateAmbience(
    dt: number,
    playerAltitude: number,
    distToWater: number,
    rainIntensity = 0,
    isNight = false,
  ): void {
    if (!this.ctx || !this.ambienceRunning || this.muted || this.ambienceVolume <= 0.001) return;

    this.windPhase += dt * 0.34;
    this.cicadaPhase += dt * 0.24;
    const now = this.ctx.currentTime;

    const altFactor = Math.max(0, Math.min(1, (playerAltitude + 1.5) / 10));
    const gust = 0.5 + 0.5 * Math.sin(this.windPhase) * Math.cos(this.windPhase * 0.41);

    if (this.windLowFilter && this.windLowGain && this.windCanopyFilter && this.windCanopyGain) {
      this.windLowFilter.frequency.setTargetAtTime(210 + altFactor * 220 + gust * 140, now, 0.3);
      this.windLowGain.gain.setTargetAtTime(0.09 + altFactor * 0.08 + gust * 0.07 + rainIntensity * 0.05, now, 0.3);
      this.windCanopyFilter.frequency.setTargetAtTime(1850 + gust * 750, now, 0.25);
      this.windCanopyGain.gain.setTargetAtTime(0.025 + gust * 0.042 + rainIntensity * 0.03, now, 0.25);
    }

    if (this.rainSheetGain && this.rainSheetFilter && this.rainDropGain) {
      const sheetGain = rainIntensity > 0.02 ? 0.05 + rainIntensity * 0.24 : 0.0001;
      const dropGain = rainIntensity > 0.02 ? 0.04 + rainIntensity * 0.16 : 0.0001;
      this.rainSheetGain.gain.setTargetAtTime(sheetGain, now, 0.35);
      this.rainSheetFilter.frequency.setTargetAtTime(920 + rainIntensity * 950, now, 0.35);
      this.rainDropGain.gain.setTargetAtTime(dropGain, now, 0.35);
    }

    if (this.cicadaGain) {
      const nightBoost = isNight ? 1.4 : 1.0;
      const rainDamp = Math.max(0.18, 1 - rainIntensity * 0.78);
      const swell = (0.015 + (0.5 + 0.5 * Math.sin(this.cicadaPhase)) * 0.02) * nightBoost * rainDamp;
      this.cicadaGain.gain.setTargetAtTime(swell, now, 0.4);
    }

    this.birdCooldown -= dt * (isNight || rainIntensity > 0.5 ? 0.3 : 1.0);
    if (this.birdCooldown <= 0) {
      this.birdCooldown = 3.6 + Math.random() * 5.8;
      this.playBirdCall();
    }

    if (distToWater < 32 || rainIntensity > 0.35) {
      const proximity = Math.max(rainIntensity * 0.45, Math.max(0.1, 1 - Math.max(0, distToWater) / 32));
      this.frogCooldown -= dt * (0.65 + proximity * 1.45 + (isNight ? 0.65 : 0));
      if (this.frogCooldown <= 0) {
        this.frogCooldown = 1.0 + Math.random() * 2.2;
        this.playFrogCroak(proximity);
      }
    }
  }

  private playBirdCall(): void {
    if (!this.ctx || !this.ambienceGain || this.muted) return;
    const now = this.ctx.currentTime;
    const pan = (Math.random() - 0.5) * 1.7;
    const dest = this.createPanner(pan, this.ambienceGain);

    // FM-modulated organic bird syrinx chirp
    const phrases = Math.random() > 0.45 ? 3 : 2;
    const baseFreq = 1950 + Math.random() * 1300;
    for (let i = 0; i < phrases; i++) {
      const t = now + i * (0.14 + Math.random() * 0.08);
      const carrier = this.ctx.createOscillator();
      const mod = this.ctx.createOscillator();
      const modGain = this.ctx.createGain();
      const env = this.ctx.createGain();

      carrier.type = 'sine';
      const f0 = baseFreq * (i === 1 ? 1.16 : i === 2 ? 0.94 : 1.0);
      carrier.frequency.setValueAtTime(f0, t);
      carrier.frequency.exponentialRampToValueAtTime(f0 * 1.28, t + 0.045);
      carrier.frequency.exponentialRampToValueAtTime(f0 * 0.86, t + 0.11);

      mod.type = 'sine';
      mod.frequency.value = 34 + Math.random() * 22;
      modGain.gain.value = 95;

      env.gain.setValueAtTime(0.0001, t);
      env.gain.linearRampToValueAtTime(0.024, t + 0.016);
      env.gain.exponentialRampToValueAtTime(0.0001, t + 0.125);

      mod.connect(modGain);
      modGain.connect(carrier.frequency);
      carrier.connect(env);
      env.connect(dest);
      if (this.valleyReverb) {
        const send = this.ctx.createGain();
        send.gain.value = 0.25;
        env.connect(send);
        send.connect(this.valleyReverb);
      }
      carrier.start(t);
      mod.start(t);
      carrier.stop(t + 0.13);
      mod.stop(t + 0.13);
    }
  }

  private playFrogCroak(proximity: number): void {
    if (!this.ctx || !this.ambienceGain || !this.whiteCrackBuffer || this.muted) return;
    const now = this.ctx.currentTime;
    const pan = (Math.random() - 0.5) * 1.4;
    const dest = this.createPanner(pan, this.ambienceGain);

    // Dual-pulse resonant vocal sac ribbit
    const pulses = Math.random() > 0.35 ? 2 : 3;
    const fBase = 210 + Math.random() * 95;
    for (let i = 0; i < pulses; i++) {
      const t = now + i * 0.16;
      const src = this.ctx.createBufferSource();
      src.buffer = this.whiteCrackBuffer;

      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(fBase * 2.1, t);
      bp.frequency.exponentialRampToValueAtTime(fBase * 3.1, t + 0.045);
      bp.Q.value = 7.5;

      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.075 * proximity, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.085);

      src.connect(bp);
      bp.connect(g);
      g.connect(dest);
      src.start(t, Math.random() * 0.3, 0.095);
    }
  }

  public playDistantArtillery(pan: number, rangeMeters: number): void {
    if (!this.ctx || !this.ambienceGain || !this.pinkBedBuffer || this.muted) return;
    const now = this.ctx.currentTime;
    const atten = Math.max(0.28, Math.min(0.92, 1 - (rangeMeters - 420) / 1800));
    const dest = this.createPanner(pan, this.ambienceGain);

    // 1. Air-pressure shock arrival
    const sub = this.ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(64, now);
    sub.frequency.exponentialRampToValueAtTime(20, now + 0.7);
    const sg = this.ctx.createGain();
    sg.gain.setValueAtTime(0.42 * atten, now);
    sg.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
    sub.connect(sg);
    sg.connect(dest);
    sub.start(now);
    sub.stop(now + 0.78);

    // 2. Distant rolling ridge rumble
    const rumble = this.ctx.createBufferSource();
    rumble.buffer = this.pinkBedBuffer;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(240, now);
    lp.frequency.exponentialRampToValueAtTime(68, now + 1.8);

    const rg = this.ctx.createGain();
    rg.gain.setValueAtTime(0.001, now);
    rg.gain.linearRampToValueAtTime(0.46 * atten, now + 0.06);
    rg.gain.exponentialRampToValueAtTime(0.001, now + 1.9);

    rumble.connect(lp);
    lp.connect(rg);
    rg.connect(dest);
    rumble.start(now, Math.random() * 1.2, 1.95);
  }

  public playHowitzerFire(distanceToGun: number, pan: number): void {
    if (!this.ctx || !this.sfxDryBus || !this.whiteCrackBuffer || !this.pinkBedBuffer || this.muted) return;
    const now = this.ctx.currentTime;
    const atten = Math.max(0.2, 1 / (1 + distanceToGun * 0.013));
    const dest = this.createPanner(pan, this.sfxDryBus);

    // 1. High-energy propellant crack transient
    const crack = this.ctx.createBufferSource();
    crack.buffer = this.whiteCrackBuffer;
    const crackBp = this.ctx.createBiquadFilter();
    crackBp.type = 'bandpass';
    crackBp.frequency.value = 1100;
    crackBp.Q.value = 0.7;
    const cg = this.ctx.createGain();
    cg.gain.setValueAtTime(0.95 * atten, now);
    cg.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    crack.connect(crackBp);
    crackBp.connect(cg);
    cg.connect(dest);
    crack.start(now, 0, 0.16);

    // 2. Massive 155mm cannon concussion wave
    const sub = this.ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(116, now);
    sub.frequency.exponentialRampToValueAtTime(19, now + 0.72);
    const sg = this.ctx.createGain();
    sg.gain.setValueAtTime(1.1 * atten, now);
    sg.gain.exponentialRampToValueAtTime(0.001, now + 0.78);
    sub.connect(sg);
    sg.connect(dest);
    sub.start(now);
    sub.stop(now + 0.8);

    // 3. Long booming blast tail + valley echo
    const roar = this.ctx.createBufferSource();
    roar.buffer = this.pinkBedBuffer;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1250, now);
    lp.frequency.exponentialRampToValueAtTime(85, now + 1.4);
    const rg = this.ctx.createGain();
    rg.gain.setValueAtTime(0.82 * atten, now);
    rg.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
    roar.connect(lp);
    lp.connect(rg);
    rg.connect(dest);
    if (this.valleyReverb) {
      const revSend = this.ctx.createGain();
      revSend.gain.value = 0.75 * atten;
      rg.connect(revSend);
      revSend.connect(this.valleyReverb);
    }
    roar.start(now, Math.random() * 0.6, 1.55);

    // 4. Outgoing 155mm shell air-whistle receding into sky
    const whistle = this.ctx.createBufferSource();
    whistle.buffer = this.pinkBedBuffer;
    const wBp = this.ctx.createBiquadFilter();
    wBp.type = 'bandpass';
    wBp.frequency.setValueAtTime(920, now + 0.08);
    wBp.frequency.exponentialRampToValueAtTime(340, now + 1.15);
    wBp.Q.value = 5.5;
    const wg = this.ctx.createGain();
    wg.gain.setValueAtTime(0.0001, now + 0.06);
    wg.gain.linearRampToValueAtTime(0.18 * atten, now + 0.16);
    wg.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    whistle.connect(wBp);
    wBp.connect(wg);
    wg.connect(dest);
    whistle.start(now + 0.06, 0.4, 1.25);
  }

  public playCounterBatteryOutgoing(): void {
    if (!this.ctx || !this.sfxDryBus || !this.pinkBedBuffer || this.muted) return;
    for (let i = 0; i < 3; i++) {
      this.scheduleDistantVolleyShot(this.ctx.currentTime + i * 0.25);
    }
  }

  private scheduleDistantVolleyShot(t: number): void {
    if (!this.ctx || !this.sfxDryBus || !this.pinkBedBuffer) return;
    const sub = this.ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(98, t);
    sub.frequency.exponentialRampToValueAtTime(24, t + 0.42);
    const sg = this.ctx.createGain();
    sg.gain.setValueAtTime(0.5, t);
    sg.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    sub.connect(sg);
    sg.connect(this.sfxDryBus);
    sub.start(t);
    sub.stop(t + 0.46);

    const blast = this.ctx.createBufferSource();
    blast.buffer = this.pinkBedBuffer;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(640, t);
    lp.frequency.exponentialRampToValueAtTime(110, t + 0.55);
    const bg = this.ctx.createGain();
    bg.gain.setValueAtTime(0.38, t);
    bg.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    blast.connect(lp);
    lp.connect(bg);
    bg.connect(this.sfxDryBus);
    if (this.valleyReverb) bg.connect(this.valleyReverb);
    blast.start(t, Math.random() * 0.8, 0.65);
  }

  public playCounterBatteryImpact(pan: number): void {
    if (!this.ctx || !this.sfxDryBus || !this.pinkBedBuffer || this.muted) return;
    const dest = this.createPanner(pan, this.sfxDryBus);
    for (let i = 0; i < 3; i++) {
      const t = this.ctx.currentTime + i * 0.28;
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.pinkBedBuffer;

      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(480, t);
      lp.frequency.exponentialRampToValueAtTime(75, t + 1.05);

      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(0.65, t);
      ng.gain.exponentialRampToValueAtTime(0.001, t + 1.15);

      noise.connect(lp);
      lp.connect(ng);
      ng.connect(dest);
      if (this.valleyReverb) ng.connect(this.valleyReverb);
      noise.start(t, Math.random() * 0.6, 1.2);
    }
  }

  public playGunshot(weapon: WeaponId, distance = 0, suppressed = false): void {
    if (!this.ctx || !this.sfxDryBus || !this.whiteCrackBuffer || !this.pinkBedBuffer || this.muted) return;
    const now = this.ctx.currentTime;
    const atten = Math.max(0.06, 1 / (1 + distance * 0.042));

    if (suppressed) {
      // Pressurized baffle gas snap ("pffft-thwip") + sharp bolt carrier clack
      const air = this.ctx.createBufferSource();
      air.buffer = this.whiteCrackBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1650, now);
      bp.frequency.exponentialRampToValueAtTime(480, now + 0.065);
      bp.Q.value = 1.2;

      const ag = this.ctx.createGain();
      ag.gain.setValueAtTime(0.36 * atten, now);
      ag.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
      air.connect(bp);
      bp.connect(ag);
      ag.connect(this.sfxDryBus);
      air.start(now, Math.random() * 0.4, 0.09);

      // Dry mechanical bolt snap 16ms later
      this.playMechanicalClick(now + 0.016, 2250, 0.22 * atten);
      return;
    }

    // Layer 1: Supersonic muzzle crack transient (absent on subsonic .45 ACP M1911)
    const crack = this.ctx.createBufferSource();
    crack.buffer = this.whiteCrackBuffer;
    const crackFilter = this.ctx.createBiquadFilter();
    crackFilter.type = weapon === 'm1911' ? 'bandpass' : 'highpass';
    crackFilter.frequency.value = weapon === 'm60' ? 1250 : weapon === 'm1911' ? 1050 : 1950;
    const crackGain = this.ctx.createGain();
    const crackAmp = (weapon === 'm16a1' ? 0.92 : weapon === 'm60' ? 0.88 : 0.62) * atten;
    crackGain.gain.setValueAtTime(crackAmp, now);
    crackGain.gain.exponentialRampToValueAtTime(0.001, now + (weapon === 'm1911' ? 0.045 : 0.065));
    crack.connect(crackFilter);
    crackFilter.connect(crackGain);
    crackGain.connect(this.sfxDryBus);
    crack.start(now, Math.random() * 0.5, 0.08);

    // Layer 2: Barrel muzzle gas blast & low-mid chest thump
    const blast = this.ctx.createBufferSource();
    blast.buffer = this.pinkBedBuffer;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    const startCut = weapon === 'm60' ? 1900 : weapon === 'm1911' ? 1350 : 2500;
    lp.frequency.setValueAtTime(Math.max(420, startCut - distance * 14), now);
    lp.frequency.exponentialRampToValueAtTime(190, now + 0.16);

    const bg = this.ctx.createGain();
    const blastAmp = (weapon === 'm60' ? 0.85 : weapon === 'm1911' ? 0.68 : 0.72) * atten;
    bg.gain.setValueAtTime(blastAmp, now);
    bg.gain.exponentialRampToValueAtTime(0.001, now + (weapon === 'm60' ? 0.21 : 0.15));
    blast.connect(lp);
    lp.connect(bg);
    bg.connect(this.sfxDryBus);
    if (this.valleyReverb) {
      const revSend = this.ctx.createGain();
      revSend.gain.value = 0.55 * atten;
      bg.connect(revSend);
      revSend.connect(this.valleyReverb);
    }
    blast.start(now, Math.random() * 0.9, 0.24);

    // Layer 3: Concussive low barrel resonance
    const body = this.ctx.createOscillator();
    body.type = 'sine';
    body.frequency.setValueAtTime(weapon === 'm60' ? 148 : weapon === 'm1911' ? 180 : 215, now);
    body.frequency.exponentialRampToValueAtTime(42, now + 0.065);
    const bodyGain = this.ctx.createGain();
    bodyGain.gain.setValueAtTime((weapon === 'm60' ? 0.56 : 0.42) * atten, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
    body.connect(bodyGain);
    bodyGain.connect(this.sfxDryBus);
    body.start(now);
    body.stop(now + 0.08);

    // Layer 4: Subtle bolt/slide mechanical cycle clack
    this.playMechanicalClick(
      now + (weapon === 'm60' ? 0.028 : 0.02),
      weapon === 'm60' ? 1650 : 2450,
      0.16 * atten,
    );
  }

  public playEnemyAk47(distance: number, pan = 0): void {
    if (!this.ctx || !this.sfxDryBus || !this.whiteCrackBuffer || !this.pinkBedBuffer || this.muted) return;
    if (distance > 125) return;
    const now = this.ctx.currentTime;
    const atten = Math.max(0.04, 1 / (1 + distance * 0.045));
    const dest = this.createPanner(pan, this.sfxDryBus);

    // Distant air-absorbed 7.62x39mm bark
    const crack = this.ctx.createBufferSource();
    crack.buffer = this.whiteCrackBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = Math.max(580, 2100 - distance * 14);
    bp.Q.value = 0.85;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.55 * atten, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    crack.connect(bp);
    bp.connect(g);
    g.connect(dest);
    if (this.valleyReverb) {
      const send = this.ctx.createGain();
      send.gain.value = 0.65 * atten;
      g.connect(send);
      send.connect(this.valleyReverb);
    }
    crack.start(now, Math.random() * 0.6, 0.16);
  }

  public playBulletCrack(pan = 0): void {
    if (!this.ctx || !this.sfxDryBus || !this.whiteCrackBuffer || this.muted) return;
    const now = this.ctx.currentTime;
    const dest = this.createPanner(pan, this.sfxDryBus);

    // Supersonic ballistic N-wave snap + air-rip whiz
    const snap = this.ctx.createBufferSource();
    snap.buffer = this.whiteCrackBuffer;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2600;
    const sg = this.ctx.createGain();
    sg.gain.setValueAtTime(0.45, now);
    sg.gain.exponentialRampToValueAtTime(0.001, now + 0.024);
    snap.connect(hp);
    hp.connect(sg);
    sg.connect(dest);
    snap.start(now, Math.random() * 0.4, 0.03);

    const whiz = this.ctx.createBufferSource();
    whiz.buffer = this.whiteCrackBuffer;
    const wBp = this.ctx.createBiquadFilter();
    wBp.type = 'bandpass';
    wBp.frequency.setValueAtTime(3400, now + 0.008);
    wBp.frequency.exponentialRampToValueAtTime(880, now + 0.085);
    wBp.Q.value = 3.8;
    const wg = this.ctx.createGain();
    wg.gain.setValueAtTime(0.18, now + 0.008);
    wg.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    whiz.connect(wBp);
    wBp.connect(wg);
    wg.connect(dest);
    whiz.start(now + 0.008, 0.1, 0.095);
  }

  private playMechanicalClick(when: number, centerHz: number, gain: number): void {
    if (!this.ctx || !this.sfxDryBus || !this.whiteCrackBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.whiteCrackBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = centerHz;
    bp.Q.value = 3.2;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.022);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.sfxDryBus);
    src.start(when, Math.random() * 0.7, 0.028);
  }

  private playMechanicalSlide(when: number, startHz: number, endHz: number, dur: number, gain: number): void {
    if (!this.ctx || !this.sfxDryBus || !this.whiteCrackBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.whiteCrackBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(startHz, when);
    bp.frequency.linearRampToValueAtTime(endHz, when + dur);
    bp.Q.value = 2.4;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, when);
    g.gain.linearRampToValueAtTime(gain, when + dur * 0.25);
    g.gain.exponentialRampToValueAtTime(0.001, when + dur);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.sfxDryBus);
    src.start(when, Math.random() * 0.6, dur + 0.02);
  }

  public playReload(): void {
    if (!this.ctx || !this.sfxDryBus || !this.whiteCrackBuffer || this.muted) return;
    const now = this.ctx.currentTime;
    // Stage 1: Mag release button click & empty mag sliding out of magwell
    this.playMechanicalClick(now, 2400, 0.26);
    this.playMechanicalSlide(now + 0.03, 1400, 950, 0.14, 0.18);

    // Stage 2: Fresh magazine sliding in + firm seat thunk & catch snap
    this.playMechanicalSlide(now + 0.48, 850, 1550, 0.12, 0.18);
    this.playMechanicalClick(now + 0.61, 680, 0.34);
    this.playMechanicalClick(now + 0.63, 2900, 0.24);

    // Stage 3: Charging handle pull back & spring-driven bolt slam forward
    this.playMechanicalSlide(now + 0.96, 1750, 2350, 0.09, 0.22);
    this.playMechanicalClick(now + 1.09, 1950, 0.36);
    this.playMechanicalClick(now + 1.13, 3200, 0.22);
  }

  public playEmptyClick(): void {
    if (!this.ctx || !this.sfxDryBus || !this.whiteCrackBuffer || this.muted) return;
    const now = this.ctx.currentTime;
    this.playMechanicalClick(now, 2750, 0.32);
    this.playMechanicalClick(now + 0.008, 1150, 0.18);
  }

  public playHitConfirm(kill: boolean): void {
    if (!this.ctx || !this.sfxDryBus || !this.whiteCrackBuffer || !this.pinkBedBuffer || this.muted) return;
    const now = this.ctx.currentTime;
    // Realistic muffled ballistic body impact thump + subtle tactical gear snap on kill
    const thud = this.ctx.createBufferSource();
    thud.buffer = this.pinkBedBuffer;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 340;
    const tg = this.ctx.createGain();
    tg.gain.setValueAtTime(kill ? 0.32 : 0.22, now);
    tg.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
    thud.connect(lp);
    lp.connect(tg);
    tg.connect(this.sfxDryBus);
    thud.start(now, Math.random() * 0.4, 0.09);

    if (kill) {
      this.playMechanicalClick(now + 0.01, 1850, 0.2);
    }
  }

  public playExplosion(distance: number, pan = 0, heavy = false): void {
    if (!this.ctx || !this.sfxDryBus || !this.whiteCrackBuffer || !this.pinkBedBuffer || this.muted) return;
    const now = this.ctx.currentTime;
    const rangeScale = heavy ? 0.012 : 0.02;
    const atten = Math.max(heavy ? 0.14 : 0.08, 1 / (1 + distance * rangeScale));
    const dest = this.createPanner(pan, this.sfxDryBus);

    // 1. High-explosive shockwave snap (double blast peak for heavy 155mm shells)
    const crack = this.ctx.createBufferSource();
    crack.buffer = this.whiteCrackBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = heavy ? 740 : 920;
    bp.Q.value = heavy ? 0.45 : 0.55;
    const cg = this.ctx.createGain();
    cg.gain.setValueAtTime((heavy ? 1.25 : 0.95) * atten, now);
    cg.gain.exponentialRampToValueAtTime(0.001, now + (heavy ? 0.28 : 0.16));
    crack.connect(bp);
    bp.connect(cg);
    cg.connect(dest);
    crack.start(now, 0, heavy ? 0.3 : 0.18);

    // 2. Concussive sub-bass pressure drop
    const sub = this.ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(heavy ? 82 : 98, now);
    sub.frequency.exponentialRampToValueAtTime(heavy ? 14 : 18, now + (heavy ? 1.05 : 0.68));
    const sg = this.ctx.createGain();
    sg.gain.setValueAtTime((heavy ? 1.35 : 1.05) * atten, now);
    sg.gain.exponentialRampToValueAtTime(0.001, now + (heavy ? 1.1 : 0.72));
    sub.connect(sg);
    sg.connect(dest);
    sub.start(now);
    sub.stop(now + (heavy ? 1.15 : 0.75));

    // 3. Roaring fireball + valley reverb
    const roarDur = heavy ? 2.15 : 1.35;
    const roar = this.ctx.createBufferSource();
    roar.buffer = this.pinkBedBuffer;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(heavy ? 980 : 840, now);
    lp.frequency.exponentialRampToValueAtTime(58, now + roarDur * 0.92);
    const rg = this.ctx.createGain();
    rg.gain.setValueAtTime((heavy ? 1.15 : 0.92) * atten, now);
    rg.gain.exponentialRampToValueAtTime(0.001, now + roarDur);
    roar.connect(lp);
    lp.connect(rg);
    rg.connect(dest);
    if (this.valleyReverb) {
      const send = this.ctx.createGain();
      send.gain.value = (heavy ? 0.95 : 0.7) * atten;
      rg.connect(send);
      send.connect(this.valleyReverb);
    }
    roar.start(now, Math.random() * 0.5, roarDur + 0.05);

    // 4. Torn earth, mud clods & jungle debris fallout
    if (distance < (heavy ? 85 : 55) && this.rainDropBuffer) {
      const debris = this.ctx.createBufferSource();
      debris.buffer = this.rainDropBuffer;
      const dbp = this.ctx.createBiquadFilter();
      dbp.type = 'bandpass';
      dbp.frequency.value = heavy ? 1050 : 1450;
      dbp.Q.value = 0.85;
      const dg = this.ctx.createGain();
      const fallEnd = heavy ? 1.85 : 1.05;
      dg.gain.setValueAtTime(0.001, now + 0.16);
      dg.gain.linearRampToValueAtTime((heavy ? 0.46 : 0.32) * atten, now + 0.36);
      dg.gain.exponentialRampToValueAtTime(0.001, now + fallEnd);
      debris.connect(dbp);
      dbp.connect(dg);
      dg.connect(dest);
      debris.start(now + 0.16, Math.random() * 0.3, fallEnd - 0.12);
    }
  }

  public playIncomingShellWhistle(pan = 0): void {
    if (!this.ctx || !this.sfxDryBus || !this.whiteCrackBuffer || this.muted) return;
    const now = this.ctx.currentTime;
    const dur = 0.62;
    const dest = this.createPanner(pan, this.sfxDryBus);

    // Aerodynamic descending air shear
    const air = this.ctx.createBufferSource();
    air.buffer = this.whiteCrackBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1950, now);
    bp.frequency.exponentialRampToValueAtTime(340, now + dur);
    bp.Q.value = 5.5;
    const ag = this.ctx.createGain();
    ag.gain.setValueAtTime(0.002, now);
    ag.gain.exponentialRampToValueAtTime(0.28, now + dur * 0.85);
    ag.gain.exponentialRampToValueAtTime(0.001, now + dur);
    air.connect(bp);
    bp.connect(ag);
    ag.connect(dest);
    air.start(now, Math.random() * 0.3, dur + 0.03);

    // Subtle hollow fin-stabilized shell shriek
    const shriek = this.ctx.createOscillator();
    shriek.type = 'sine';
    shriek.frequency.setValueAtTime(1320, now);
    shriek.frequency.exponentialRampToValueAtTime(280, now + dur);
    const sg = this.ctx.createGain();
    sg.gain.setValueAtTime(0.001, now);
    sg.gain.exponentialRampToValueAtTime(0.11, now + dur * 0.82);
    sg.gain.exponentialRampToValueAtTime(0.001, now + dur);
    shriek.connect(sg);
    sg.connect(dest);
    shriek.start(now);
    shriek.stop(now + dur + 0.02);
  }

  public playShrapnelHiss(distance: number, pan = 0, count = 8): void {
    if (!this.ctx || !this.sfxDryBus || !this.whiteCrackBuffer || !this.pinkBedBuffer || this.muted) return;
    if (distance > 58) return;

    const now = this.ctx.currentTime;
    const prox = Math.max(0.15, 1 - distance / 58);
    const fragmentCount = Math.min(count, Math.max(3, Math.round(3 + prox * (count - 3))));

    for (let i = 0; i < fragmentCount; i++) {
      const delay = 0.025 + i * 0.048 + Math.random() * 0.11;
      const t0 = now + delay;
      const fragDur = 0.14 + Math.random() * 0.18;
      const fragPan = Math.max(-1, Math.min(1, pan + (Math.random() - 0.5) * (0.95 + prox * 0.8)));
      const dest = this.createPanner(fragPan, this.sfxDryBus);
      const gainScale = prox * (0.28 + Math.random() * 0.24);

      // 1. Razor-sharp high-frequency aerodynamic hiss tearing through jungle air
      const hiss = this.ctx.createBufferSource();
      hiss.buffer = this.whiteCrackBuffer;
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.setValueAtTime(2600 + Math.random() * 1100, t0);
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      const startFreq = 3600 + Math.random() * 1900;
      bp.frequency.setValueAtTime(startFreq, t0);
      bp.frequency.exponentialRampToValueAtTime(750 + Math.random() * 450, t0 + fragDur);
      bp.Q.value = 3.8 + Math.random() * 2.5;
      const hg = this.ctx.createGain();
      hg.gain.setValueAtTime(0.001, t0);
      hg.gain.linearRampToValueAtTime(gainScale * 0.95, t0 + fragDur * 0.28);
      hg.gain.exponentialRampToValueAtTime(0.001, t0 + fragDur);
      hiss.connect(hp);
      hp.connect(bp);
      bp.connect(hg);
      hg.connect(dest);
      hiss.start(t0, Math.random() * 0.4, fragDur + 0.02);

      // 2. Tumbling jagged metal Doppler zing/flutter
      const zing = this.ctx.createOscillator();
      zing.type = Math.random() < 0.5 ? 'triangle' : 'sine';
      const fStart = 1850 + Math.random() * 1400;
      zing.frequency.setValueAtTime(fStart, t0);
      zing.frequency.exponentialRampToValueAtTime(340 + Math.random() * 220, t0 + fragDur);
      const zg = this.ctx.createGain();
      zg.gain.setValueAtTime(0.001, t0);
      zg.gain.linearRampToValueAtTime(gainScale * 0.14, t0 + fragDur * 0.22);
      zg.gain.exponentialRampToValueAtTime(0.001, t0 + fragDur);
      zing.connect(zg);
      zg.connect(dest);
      zing.start(t0);
      zing.stop(t0 + fragDur + 0.02);

      // 3. Occasional bark/earth fragment slap impact at end of trajectory
      if (distance < 32 && Math.random() < 0.48) {
        const hitTime = t0 + fragDur * (0.7 + Math.random() * 0.35);
        this.playMechanicalClick(hitTime, 650 + Math.random() * 900, gainScale * 0.45);
      }
    }
  }

  public playFootstep(inWater: boolean): void {
    if (!this.ctx || !this.sfxDryBus || !this.whiteCrackBuffer || !this.pinkBedBuffer || this.muted) return;
    const now = this.ctx.currentTime;

    if (inWater) {
      // River splash: low displacement slosh + high droplet spray
      const slosh = this.ctx.createBufferSource();
      slosh.buffer = this.pinkBedBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(520, now);
      bp.frequency.exponentialRampToValueAtTime(980, now + 0.08);
      bp.Q.value = 1.4;
      const sg = this.ctx.createGain();
      sg.gain.setValueAtTime(0.16, now);
      sg.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      slosh.connect(bp);
      bp.connect(sg);
      sg.connect(this.sfxDryBus);
      slosh.start(now, Math.random() * 0.8, 0.18);

      const spray = this.ctx.createBufferSource();
      spray.buffer = this.whiteCrackBuffer;
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 2100;
      const spg = this.ctx.createGain();
      spg.gain.setValueAtTime(0.08, now + 0.02);
      spg.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      spray.connect(hp);
      hp.connect(spg);
      spg.connect(this.sfxDryBus);
      spray.start(now + 0.02, Math.random() * 0.5, 0.14);
      return;
    }

    // Jungle soil heel thump + dry foliage/gravel scuff 42ms later
    const heel = this.ctx.createBufferSource();
    heel.buffer = this.pinkBedBuffer;
    const hLp = this.ctx.createBiquadFilter();
    hLp.type = 'lowpass';
    hLp.frequency.value = 260 + Math.random() * 60;
    const hg = this.ctx.createGain();
    hg.gain.setValueAtTime(0.14, now);
    hg.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
    heel.connect(hLp);
    hLp.connect(hg);
    hg.connect(this.sfxDryBus);
    heel.start(now, Math.random() * 0.9, 0.07);

    const crunch = this.ctx.createBufferSource();
    crunch.buffer = this.whiteCrackBuffer;
    const cBp = this.ctx.createBiquadFilter();
    cBp.type = 'bandpass';
    cBp.frequency.value = 1850 + Math.random() * 550;
    cBp.Q.value = 1.6;
    const cg = this.ctx.createGain();
    cg.gain.setValueAtTime(0.065, now + 0.038);
    cg.gain.exponentialRampToValueAtTime(0.001, now + 0.095);
    crunch.connect(cBp);
    cBp.connect(cg);
    cg.connect(this.sfxDryBus);
    crunch.start(now + 0.038, Math.random() * 0.6, 0.07);
  }

  public playBandage(): void {
    if (!this.ctx || !this.sfxDryBus || !this.whiteCrackBuffer || this.muted) return;
    const now = this.ctx.currentTime;
    // Linen/gauze wrapper tear + two cloth wrap rustles
    for (let i = 0; i < 3; i++) {
      const t = now + i * 0.14;
      const cloth = this.ctx.createBufferSource();
      cloth.buffer = this.whiteCrackBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(i === 0 ? 2400 : 1550, t);
      bp.frequency.linearRampToValueAtTime(i === 0 ? 1200 : 2100, t + 0.1);
      bp.Q.value = 1.8;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(i === 0 ? 0.14 : 0.1, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
      cloth.connect(bp);
      bp.connect(g);
      g.connect(this.sfxDryBus);
      cloth.start(t, Math.random() * 0.5, 0.12);
    }
  }

  private playPrC25RadioBurst(pips: number[]): void {
    if (!this.ctx || !this.sfxDryBus || !this.whiteCrackBuffer) return;
    const now = this.ctx.currentTime;

    // VHF squelch-open static hiss + PTT handset click
    this.playMechanicalClick(now, 2400, 0.18);
    const squelchIn = this.ctx.createBufferSource();
    squelchIn.buffer = this.whiteCrackBuffer;
    const sBp = this.ctx.createBiquadFilter();
    sBp.type = 'bandpass';
    sBp.frequency.value = 2100;
    sBp.Q.value = 1.2;
    const sg = this.ctx.createGain();
    sg.gain.setValueAtTime(0.09, now);
    sg.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
    squelchIn.connect(sBp);
    sBp.connect(sg);
    sg.connect(this.sfxDryBus);
    squelchIn.start(now, 0.1, 0.09);

    // Filtered tactical radio tone pips
    pips.forEach((freq, idx) => {
      const t = now + 0.055 + idx * 0.1;
      const osc = this.ctx!.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      const bp = this.ctx!.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1400;
      bp.Q.value = 1.6;

      const g = this.ctx!.createGain();
      g.gain.setValueAtTime(0.09, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      osc.connect(bp);
      bp.connect(g);
      g.connect(this.sfxDryBus!);
      osc.start(t);
      osc.stop(t + 0.085);
    });

    // Squelch tail close ("-kshht")
    const endT = now + 0.08 + pips.length * 0.1;
    const squelchOut = this.ctx.createBufferSource();
    squelchOut.buffer = this.whiteCrackBuffer;
    const oBp = this.ctx.createBiquadFilter();
    oBp.type = 'bandpass';
    oBp.frequency.value = 2400;
    oBp.Q.value = 1.4;
    const og = this.ctx.createGain();
    og.gain.setValueAtTime(0.08, endT);
    og.gain.exponentialRampToValueAtTime(0.001, endT + 0.07);
    squelchOut.connect(oBp);
    oBp.connect(og);
    og.connect(this.sfxDryBus);
    squelchOut.start(endT, 0.3, 0.08);
    this.playMechanicalClick(endT + 0.06, 2200, 0.16);
  }

  public playObjectiveChime(): void {
    if (!this.ctx || !this.sfxDryBus || this.muted) return;
    this.playPrC25RadioBurst([1120, 1480]);
  }

  public playThunder(intensity = 0.8): void {
    if (!this.ctx || !this.ambienceGain || !this.whiteCrackBuffer || !this.pinkBedBuffer || this.muted) return;
    const now = this.ctx.currentTime;

    // Sharp cloud-to-ground initial crack
    const crack = this.ctx.createBufferSource();
    crack.buffer = this.whiteCrackBuffer;
    const cBp = this.ctx.createBiquadFilter();
    cBp.type = 'bandpass';
    cBp.frequency.value = 680;
    cBp.Q.value = 0.6;
    const cg = this.ctx.createGain();
    cg.gain.setValueAtTime(0.45 * intensity, now);
    cg.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    crack.connect(cBp);
    cBp.connect(cg);
    cg.connect(this.ambienceGain);
    crack.start(now, Math.random() * 0.4, 0.28);

    // Multi-stage rolling valley thunder
    const rumble = this.ctx.createBufferSource();
    rumble.buffer = this.pinkBedBuffer;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(320, now);
    lp.frequency.exponentialRampToValueAtTime(52, now + 2.6);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.01, now);
    g.gain.linearRampToValueAtTime(0.68 * intensity, now + 0.12);
    g.gain.linearRampToValueAtTime(0.32 * intensity, now + 0.85);
    g.gain.linearRampToValueAtTime(0.44 * intensity, now + 1.15);
    g.gain.exponentialRampToValueAtTime(0.001, now + 2.75);

    rumble.connect(lp);
    lp.connect(g);
    g.connect(this.ambienceGain);
    rumble.start(now, Math.random() * 0.8, 2.8);
  }

  public playRankUpChime(): void {
    if (!this.ctx || !this.sfxDryBus || this.muted) return;
    this.playPrC25RadioBurst([980, 1280, 1680]);
  }

  public updateListenerPose(
    px: number,
    py: number,
    pz: number,
    fx: number,
    fy: number,
    fz: number,
    ux: number,
    uy: number,
    uz: number,
  ): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const listener = this.ctx.listener;

    if (listener.positionX) {
      listener.positionX.setValueAtTime(px, now);
      listener.positionY.setValueAtTime(py, now);
      listener.positionZ.setValueAtTime(pz, now);
      listener.forwardX.setValueAtTime(fx, now);
      listener.forwardY.setValueAtTime(fy, now);
      listener.forwardZ.setValueAtTime(fz, now);
      listener.upX.setValueAtTime(ux, now);
      listener.upY.setValueAtTime(uy, now);
      listener.upZ.setValueAtTime(uz, now);
    } else if (listener.setPosition) {
      listener.setPosition(px, py, pz);
      listener.setOrientation(fx, fy, fz, ux, uy, uz);
    }

    if (this.activeSpatialVoices.length > 0) {
      for (let i = this.activeSpatialVoices.length - 1; i >= 0; i--) {
        if (this.activeSpatialVoices[i].expiresAt <= now) {
          this.activeSpatialVoices.splice(i, 1);
        }
      }
    }
  }

  public updateSpatialSource(sourceId: string, x: number, y: number, z: number): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (const v of this.activeSpatialVoices) {
      if (v.sourceId !== sourceId || v.expiresAt <= now) continue;
      if (v.panner.positionX) {
        v.panner.positionX.setTargetAtTime(x, now, 0.04);
        v.panner.positionY.setTargetAtTime(y, now, 0.04);
        v.panner.positionZ.setTargetAtTime(z, now, 0.04);
      } else if (v.panner.setPosition) {
        v.panner.setPosition(x, y, z);
      }
    }
  }

  private createSpatialPannerNode(
    sourceId: string,
    x: number,
    y: number,
    z: number,
    refDistance: number,
    maxDistance: number,
    rolloffFactor: number,
    durationSec: number,
    dest: AudioNode,
  ): PannerNode {
    const ctx = this.ctx!;
    const panner = ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = refDistance;
    panner.maxDistance = maxDistance;
    panner.rolloffFactor = rolloffFactor;
    panner.coneInnerAngle = 360;
    panner.coneOuterAngle = 360;
    panner.coneOuterGain = 0;

    const now = ctx.currentTime;
    if (panner.positionX) {
      panner.positionX.setValueAtTime(x, now);
      panner.positionY.setValueAtTime(y, now);
      panner.positionZ.setValueAtTime(z, now);
    } else if (panner.setPosition) {
      panner.setPosition(x, y, z);
    }

    panner.connect(dest);
    this.activeSpatialVoices.push({
      sourceId,
      panner,
      expiresAt: now + durationSec + 0.35,
    });
    return panner;
  }

  private scheduleSyllableFormants(
    startTime: number,
    basePitchHz: number,
    vowel: 'a' | 'e' | 'i' | 'o' | 'u' | 'er',
    tone: 'ngang' | 'huyen' | 'sac' | 'hoi' | 'nga' | 'nang',
    durSec: number,
    onset: 'none' | 'stop' | 'fric' | 'nasal',
    coda: 'none' | 'stop' | 'fric' | 'nasal',
    dest: AudioNode,
    gainScale: number,
  ): void {
    if (!this.ctx || !this.whiteCrackBuffer) return;
    const ctx = this.ctx;

    const formantMap: Record<'a' | 'e' | 'i' | 'o' | 'u' | 'er', [number, number, number]> = {
      a: [730, 1180, 2480],
      e: [500, 1850, 2550],
      i: [315, 2200, 2880],
      o: [495, 885, 2400],
      u: [325, 795, 2280],
      er: [480, 1340, 2420],
    };
    const [f1, f2, f3] = formantMap[vowel];

    // Consonant onset transient (plosive puff / fricative hiss / nasal murmur)
    if (onset === 'fric') {
      const n = ctx.createBufferSource();
      n.buffer = this.whiteCrackBuffer;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 3400 + Math.random() * 700;
      bp.Q.value = 1.8;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.001, startTime);
      ng.gain.linearRampToValueAtTime(0.18 * gainScale, startTime + 0.01);
      ng.gain.exponentialRampToValueAtTime(0.001, startTime + 0.036);
      n.connect(bp);
      bp.connect(ng);
      ng.connect(dest);
      n.start(startTime, Math.random() * 0.4, 0.042);
    } else if (onset === 'stop') {
      const n = ctx.createBufferSource();
      n.buffer = this.whiteCrackBuffer;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1450 + Math.random() * 550;
      bp.Q.value = 2.0;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.22 * gainScale, startTime);
      ng.gain.exponentialRampToValueAtTime(0.001, startTime + 0.018);
      n.connect(bp);
      bp.connect(ng);
      ng.connect(dest);
      n.start(startTime, Math.random() * 0.5, 0.022);
    }

    const vStart = startTime + (onset === 'fric' ? 0.024 : onset === 'stop' ? 0.012 : 0);
    const vDur = Math.max(0.06, durSec - (coda !== 'none' ? 0.018 : 0));

    // Glottal pulse train (sawtooth + soft chest triangle)
    const glottal = ctx.createOscillator();
    glottal.type = 'sawtooth';
    const subChest = ctx.createOscillator();
    subChest.type = 'triangle';

    // Pitch contour shaping (supports 6 Vietnamese tones + English stress)
    const setPitchContour = (osc: OscillatorNode, mult: number) => {
      const f0 = basePitchHz * mult;
      if (tone === 'huyen') {
        osc.frequency.setValueAtTime(f0 * 0.9, vStart);
        osc.frequency.exponentialRampToValueAtTime(f0 * 0.72, vStart + vDur);
      } else if (tone === 'sac') {
        osc.frequency.setValueAtTime(f0 * 0.94, vStart);
        osc.frequency.exponentialRampToValueAtTime(f0 * 1.33, vStart + vDur);
      } else if (tone === 'hoi') {
        osc.frequency.setValueAtTime(f0 * 0.88, vStart);
        osc.frequency.exponentialRampToValueAtTime(f0 * 0.69, vStart + vDur * 0.52);
        osc.frequency.exponentialRampToValueAtTime(f0 * 1.07, vStart + vDur);
      } else if (tone === 'nga') {
        osc.frequency.setValueAtTime(f0 * 0.94, vStart);
        osc.frequency.exponentialRampToValueAtTime(f0 * 0.81, vStart + vDur * 0.42);
        osc.frequency.exponentialRampToValueAtTime(f0 * 1.3, vStart + vDur);
      } else if (tone === 'nang') {
        osc.frequency.setValueAtTime(f0 * 0.84, vStart);
        osc.frequency.exponentialRampToValueAtTime(f0 * 0.59, vStart + vDur * 0.85);
      } else {
        osc.frequency.setValueAtTime(f0 * 1.01, vStart);
        osc.frequency.linearRampToValueAtTime(f0 * 0.97, vStart + vDur);
      }
    };
    setPitchContour(glottal, 1.0);
    setPitchContour(subChest, 0.5);

    const chestGain = ctx.createGain();
    chestGain.gain.value = 0.22;
    subChest.connect(chestGain);

    // Three parallel vocal-tract formant resonators
    const formantEnv = ctx.createGain();
    formantEnv.gain.setValueAtTime(0.001, vStart);
    formantEnv.gain.linearRampToValueAtTime(0.32 * gainScale, vStart + Math.min(0.025, vDur * 0.22));
    if (tone === 'nga') {
      // Mid-syllable glottalization dip characteristic of northern ngã tone
      formantEnv.gain.linearRampToValueAtTime(0.11 * gainScale, vStart + vDur * 0.44);
      formantEnv.gain.linearRampToValueAtTime(0.31 * gainScale, vStart + vDur * 0.6);
    }
    const endAmp = tone === 'nang' ? 0.001 : 0.24 * gainScale;
    formantEnv.gain.linearRampToValueAtTime(endAmp, vStart + vDur * 0.78);
    formantEnv.gain.exponentialRampToValueAtTime(0.001, vStart + vDur);

    const freqs = [f1, f2, f3];
    const gains = [1.0, 0.56, 0.22];
    const qs = [6.5, 8.2, 9.5];
    for (let i = 0; i < 3; i++) {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(freqs[i] * (0.94 + Math.random() * 0.12), vStart);
      bp.frequency.linearRampToValueAtTime(freqs[i], vStart + vDur * 0.45);
      bp.Q.value = qs[i];

      const fg = ctx.createGain();
      fg.gain.value = gains[i];

      glottal.connect(bp);
      chestGain.connect(bp);
      bp.connect(fg);
      fg.connect(formantEnv);
    }

    formantEnv.connect(dest);
    glottal.start(vStart);
    subChest.start(vStart);
    glottal.stop(vStart + vDur + 0.015);
    subChest.stop(vStart + vDur + 0.015);

    if (coda === 'stop' || coda === 'fric') {
      const tEnd = vStart + vDur * 0.85;
      const cn = ctx.createBufferSource();
      cn.buffer = this.whiteCrackBuffer;
      const cbp = ctx.createBiquadFilter();
      cbp.type = 'bandpass';
      cbp.frequency.value = coda === 'fric' ? 3200 : 1650;
      cbp.Q.value = coda === 'fric' ? 1.8 : 2.1;
      const cg = ctx.createGain();
      cg.gain.setValueAtTime(0.12 * gainScale, tEnd);
      cg.gain.exponentialRampToValueAtTime(0.001, tEnd + (coda === 'fric' ? 0.032 : 0.018));
      cn.connect(cbp);
      cbp.connect(cg);
      cg.connect(dest);
      cn.start(tEnd, Math.random() * 0.3, coda === 'fric' ? 0.038 : 0.024);
    }
  }

  public playSquadProximityVoice(
    sourceId: string,
    speakerKind: 'pointman' | 'rto' | 'howitzer' | 'fdc' | 'huey' | 'sentry',
    worldX: number,
    worldY: number,
    worldZ: number,
    panFallback: number,
  ): void {
    if (!this.ctx || !this.voiceGain || !this.whiteCrackBuffer || this.muted || !this.proximityVoiceEnabled) {
      return;
    }

    type Syl = {
      v: 'a' | 'e' | 'i' | 'o' | 'u' | 'er';
      t: 'ngang' | 'huyen' | 'sac' | 'hoi' | 'nga' | 'nang';
      d: number;
      o: 'none' | 'stop' | 'fric' | 'nasal';
      c: 'none' | 'stop' | 'fric' | 'nasal';
      g?: number;
    };

    const phrasesByRole: Record<typeof speakerKind, Syl[][]> = {
      pointman: [
        [
          { v: 'e', t: 'sac', d: 0.14, o: 'fric', c: 'stop' }, // Check
          { v: 'a', t: 'ngang', d: 0.14, o: 'none', c: 'nasal' }, // flank
          { v: 'o', t: 'huyen', d: 0.18, o: 'stop', c: 'stop', g: 0.05 }, // low
          { v: 'u', t: 'sac', d: 0.16, o: 'nasal', c: 'nasal' }, // move
          { v: 'a', t: 'huyen', d: 0.17, o: 'stop', c: 'stop' }, // fast
        ],
        [
          { v: 'o', t: 'ngang', d: 0.15, o: 'stop', c: 'nasal' }, // On
          { v: 'o', t: 'sac', d: 0.13, o: 'none', c: 'none' }, // your
          { v: 'i', t: 'sac', d: 0.21, o: 'fric', c: 'stop', g: 0.06 }, // six
          { v: 'e', t: 'ngang', d: 0.15, o: 'stop', c: 'stop' }, // stay
          { v: 'er', t: 'huyen', d: 0.2, o: 'stop', c: 'stop' }, // sharp
        ],
        [
          { v: 'a', t: 'sac', d: 0.15, o: 'stop', c: 'nasal' }, // Watch
          { v: 'e', t: 'ngang', d: 0.13, o: 'fric', c: 'none' }, // the
          { v: 'i', t: 'sac', d: 0.19, o: 'stop', c: 'none' }, // tree
          { v: 'a', t: 'huyen', d: 0.22, o: 'nasal', c: 'nasal' }, // line
        ],
      ],
      rto: [
        [
          { v: 'a', t: 'sac', d: 0.15, o: 'stop', c: 'none' }, // Bra-
          { v: 'o', t: 'huyen', d: 0.16, o: 'none', c: 'none', g: 0.04 }, // vo
          { v: 'a', t: 'sac', d: 0.15, o: 'stop', c: 'stop' }, // Ac-
          { v: 'u', t: 'huyen', d: 0.17, o: 'stop', c: 'none', g: 0.05 }, // tual
          { v: 'o', t: 'ngang', d: 0.16, o: 'none', c: 'stop' }, // cop-
          { v: 'i', t: 'huyen', d: 0.18, o: 'stop', c: 'none' }, // y
        ],
        [
          { v: 'a', t: 'ngang', d: 0.14, o: 'stop', c: 'nasal' }, // Comms
          { v: 'i', t: 'sac', d: 0.17, o: 'stop', c: 'none', g: 0.05 }, // clear
          { v: 'o', t: 'huyen', d: 0.15, o: 'stop', c: 'none' }, // push
          { v: 'o', t: 'sac', d: 0.18, o: 'fric', c: 'stop' }, // north
        ],
      ],
      howitzer: [
        [
          { v: 'er', t: 'sac', d: 0.16, o: 'fric', c: 'nasal' }, // Thun-
          { v: 'er', t: 'huyen', d: 0.14, o: 'stop', c: 'none', g: 0.04 }, // der
          { v: 'a', t: 'ngang', d: 0.17, o: 'none', c: 'nasal' }, // one
          { v: 'e', t: 'sac', d: 0.16, o: 'none', c: 'none' }, // read-
          { v: 'i', t: 'huyen', d: 0.18, o: 'stop', c: 'none' }, // y
        ],
        [
          { v: 'e', t: 'sac', d: 0.15, o: 'stop', c: 'stop' }, // Check
          { v: 'a', t: 'ngang', d: 0.16, o: 'none', c: 'nasal' }, // lan-
          { v: 'er', t: 'huyen', d: 0.19, o: 'none', c: 'stop' }, // yard
        ],
      ],
      fdc: [
        [
          { v: 'o', t: 'sac', d: 0.15, o: 'fric', c: 'none' }, // Fire
          { v: 'i', t: 'ngang', d: 0.14, o: 'nasal', c: 'fric' }, // mis-
          { v: 'er', t: 'huyen', d: 0.16, o: 'fric', c: 'nasal', g: 0.05 }, // sion
          { v: 'o', t: 'sac', d: 0.15, o: 'stop', c: 'stop' }, // plot-
          { v: 'e', t: 'huyen', d: 0.18, o: 'stop', c: 'stop' }, // ted
        ],
      ],
      huey: [
        [
          { v: 'u', t: 'sac', d: 0.15, o: 'stop', c: 'fric' }, // Dust-
          { v: 'o', t: 'huyen', d: 0.15, o: 'none', c: 'fric', g: 0.04 }, // off
          { v: 'i', t: 'sac', d: 0.19, o: 'fric', c: 'stop', g: 0.05 }, // six
          { v: 'o', t: 'ngang', d: 0.15, o: 'none', c: 'nasal' }, // on
          { v: 'a', t: 'huyen', d: 0.19, o: 'stop', c: 'stop' }, // pad
        ],
      ],
      sentry: [
        [
          { v: 'o', t: 'ngang', d: 0.16, o: 'fric', c: 'stop' }, // Sec-
          { v: 'er', t: 'huyen', d: 0.15, o: 'stop', c: 'none', g: 0.04 }, // tor
          { v: 'i', t: 'sac', d: 0.19, o: 'stop', c: 'none' }, // clear
        ],
      ],
    };

    const options = phrasesByRole[speakerKind];
    const phrase = options[Math.floor(Math.random() * options.length)];
    const totalDur = phrase.reduce((acc, s) => acc + s.d + (s.g ?? 0.03), 0) + 0.25;

    const now = this.ctx.currentTime;
    const basePitchByRole: Record<typeof speakerKind, number> = {
      pointman: 118,
      rto: 132,
      howitzer: 104,
      fdc: 124,
      huey: 136,
      sentry: 112,
    };
    const voicePitch = basePitchByRole[speakerKind] + (Math.random() - 0.5) * 10;

    // 3D HRTF Spatial Panner anchored to squad speaker's world position
    const destNode = typeof this.ctx.createPanner === 'function'
      ? this.createSpatialPannerNode(
          sourceId,
          worldX,
          worldY,
          worldZ,
          4.5,
          48,
          1.45,
          totalDur,
          this.voiceGain,
        )
      : this.createPanner(panFallback, this.voiceGain);

    // Subtle close-talk / jungle air tone shaping
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 155;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 4400;

    hp.connect(lp);
    lp.connect(destNode);
    if (this.valleyReverb) {
      const revSend = this.ctx.createGain();
      revSend.gain.value = 0.16;
      lp.connect(revSend);
      revSend.connect(this.valleyReverb);
    }

    let cursor = now + 0.03;
    for (const s of phrase) {
      this.scheduleSyllableFormants(
        cursor,
        voicePitch,
        s.v,
        s.t,
        s.d,
        s.o,
        s.c,
        hp,
        0.92,
      );
      cursor += s.d + (s.g ?? 0.032);
    }
  }

  public playEnemyVietnameseRadio(
    sourceId: string,
    situation: 'patrol' | 'contact' | 'flank' | 'suppress' | 'wounded' | 'commander',
    worldX: number,
    worldY: number,
    worldZ: number,
    distance: number,
    panFallback: number,
  ): void {
    if (!this.ctx || !this.sfxDryBus || !this.whiteCrackBuffer || this.muted) return;
    if (distance > 92) return;

    type Syl = {
      v: 'a' | 'e' | 'i' | 'o' | 'u' | 'er';
      t: 'ngang' | 'huyen' | 'sac' | 'hoi' | 'nga' | 'nang';
      d: number;
      o: 'none' | 'stop' | 'fric' | 'nasal';
      c: 'none' | 'stop' | 'nasal';
      g?: number;
    };

    // Authentic 6-tone Vietnamese tactical radio callouts
    const vietnameseBank: Record<typeof situation, Syl[][]> = {
      patrol: [
        // "Báo cáo, tuần tra bình thường"
        [
          { v: 'a', t: 'sac', d: 0.14, o: 'stop', c: 'none' },
          { v: 'a', t: 'sac', d: 0.15, o: 'stop', c: 'none', g: 0.06 },
          { v: 'u', t: 'huyen', d: 0.15, o: 'stop', c: 'nasal' },
          { v: 'a', t: 'ngang', d: 0.15, o: 'stop', c: 'none', g: 0.04 },
          { v: 'i', t: 'huyen', d: 0.14, o: 'stop', c: 'nasal' },
          { v: 'er', t: 'huyen', d: 0.18, o: 'stop', c: 'nasal' },
        ],
        // "Chú ý quan sát phía sông"
        [
          { v: 'u', t: 'sac', d: 0.13, o: 'stop', c: 'none' },
          { v: 'i', t: 'sac', d: 0.14, o: 'none', c: 'none', g: 0.04 },
          { v: 'a', t: 'ngang', d: 0.14, o: 'stop', c: 'nasal' },
          { v: 'a', t: 'sac', d: 0.15, o: 'fric', c: 'stop', g: 0.04 },
          { v: 'i', t: 'sac', d: 0.14, o: 'fric', c: 'none' },
          { v: 'o', t: 'ngang', d: 0.17, o: 'fric', c: 'nasal' },
        ],
      ],
      contact: [
        // "Phát hiện địch phía trước!"
        [
          { v: 'a', t: 'sac', d: 0.13, o: 'fric', c: 'stop' },
          { v: 'e', t: 'nang', d: 0.13, o: 'fric', c: 'stop', g: 0.03 },
          { v: 'i', t: 'nang', d: 0.16, o: 'stop', c: 'stop', g: 0.05 },
          { v: 'i', t: 'sac', d: 0.14, o: 'fric', c: 'none' },
          { v: 'er', t: 'sac', d: 0.19, o: 'stop', c: 'stop' },
        ],
        // "Địch đang tiến gần!"
        [
          { v: 'i', t: 'nang', d: 0.14, o: 'stop', c: 'stop' },
          { v: 'a', t: 'ngang', d: 0.13, o: 'stop', c: 'nasal' },
          { v: 'e', t: 'sac', d: 0.15, o: 'stop', c: 'nasal' },
          { v: 'er', t: 'huyen', d: 0.18, o: 'stop', c: 'nasal' },
        ],
      ],
      flank: [
        // "Bao vây bên sườn!"
        [
          { v: 'a', t: 'ngang', d: 0.13, o: 'stop', c: 'none' },
          { v: 'er', t: 'ngang', d: 0.15, o: 'fric', c: 'none', g: 0.04 },
          { v: 'e', t: 'ngang', d: 0.13, o: 'stop', c: 'nasal' },
          { v: 'er', t: 'huyen', d: 0.19, o: 'fric', c: 'nasal' },
        ],
      ],
      suppress: [
        // "Bắn yểm trợ ngay!"
        [
          { v: 'a', t: 'sac', d: 0.14, o: 'stop', c: 'nasal' },
          { v: 'e', t: 'hoi', d: 0.16, o: 'none', c: 'nasal' },
          { v: 'er', t: 'nang', d: 0.14, o: 'stop', c: 'none', g: 0.04 },
          { v: 'a', t: 'ngang', d: 0.17, o: 'nasal', c: 'none' },
        ],
      ],
      wounded: [
        // "Tôi bị thương, lùi lại!"
        [
          { v: 'o', t: 'ngang', d: 0.12, o: 'stop', c: 'none' },
          { v: 'i', t: 'nang', d: 0.12, o: 'stop', c: 'none' },
          { v: 'er', t: 'ngang', d: 0.17, o: 'stop', c: 'nasal', g: 0.06 },
          { v: 'u', t: 'huyen', d: 0.15, o: 'none', c: 'none' },
          { v: 'a', t: 'nang', d: 0.16, o: 'none', c: 'none' },
        ],
      ],
      commander: [
        // "Trung đội giữ vững vị trí!"
        [
          { v: 'u', t: 'ngang', d: 0.13, o: 'stop', c: 'nasal' },
          { v: 'o', t: 'nang', d: 0.14, o: 'stop', c: 'none', g: 0.04 },
          { v: 'u', t: 'nga', d: 0.17, o: 'stop', c: 'none' },
          { v: 'er', t: 'nga', d: 0.17, o: 'fric', c: 'nasal', g: 0.04 },
          { v: 'i', t: 'nang', d: 0.13, o: 'fric', c: 'none' },
          { v: 'i', t: 'sac', d: 0.18, o: 'stop', c: 'none' },
        ],
        // "Tất cả tiến công!"
        [
          { v: 'er', t: 'sac', d: 0.13, o: 'stop', c: 'stop' },
          { v: 'a', t: 'hoi', d: 0.15, o: 'stop', c: 'none', g: 0.05 },
          { v: 'e', t: 'sac', d: 0.15, o: 'stop', c: 'nasal' },
          { v: 'o', t: 'ngang', d: 0.19, o: 'stop', c: 'nasal' },
        ],
      ],
    };

    const options = vietnameseBank[situation];
    const phrase = options[Math.floor(Math.random() * options.length)];
    const speechDur = phrase.reduce((acc, s) => acc + s.d + (s.g ?? 0.025), 0);
    const totalDur = speechDur + 0.28;
    const now = this.ctx.currentTime;
    const basePitch = 132 + (Math.random() - 0.5) * 26;

    // Spatialized in 3D via HRTF PannerNode when Proximity Voice is ON, or stereo pan fallback when OFF
    let destNode: AudioNode;
    if (this.proximityVoiceEnabled && typeof this.ctx.createPanner === 'function') {
      destNode = this.createSpatialPannerNode(
        sourceId,
        worldX,
        worldY,
        worldZ,
        5.5,
        88,
        1.25,
        totalDur,
        this.sfxDryBus,
      );
    } else {
      const distGain = this.ctx.createGain();
      distGain.gain.value = Math.max(0.14, 1 / (1 + distance * 0.038));
      distGain.connect(this.sfxDryBus);
      destNode = this.createPanner(panFallback, distGain);
    }

    // Military VHF radio filter chain (340 Hz - 2550 Hz bandpass + slight transistor crunch)
    const radioHp = this.ctx.createBiquadFilter();
    radioHp.type = 'highpass';
    radioHp.frequency.value = 360;

    const radioBp = this.ctx.createBiquadFilter();
    radioBp.type = 'bandpass';
    radioBp.frequency.value = 1420;
    radioBp.Q.value = 1.05;

    const radioLp = this.ctx.createBiquadFilter();
    radioLp.type = 'lowpass';
    radioLp.frequency.value = 2650;

    const radioGain = this.ctx.createGain();
    radioGain.gain.value = 0.72;

    radioHp.connect(radioBp);
    radioBp.connect(radioLp);
    radioLp.connect(radioGain);
    radioGain.connect(destNode);

    // 1. Radio PTT squelch-open static hiss
    const openHiss = this.ctx.createBufferSource();
    openHiss.buffer = this.whiteCrackBuffer;
    const openG = this.ctx.createGain();
    openG.gain.setValueAtTime(0.16, now);
    openG.gain.exponentialRampToValueAtTime(0.022, now + 0.075);
    openG.gain.setValueAtTime(0.022, now + speechDur + 0.07);
    openG.gain.linearRampToValueAtTime(0.14, now + speechDur + 0.11);
    openG.gain.exponentialRampToValueAtTime(0.001, now + speechDur + 0.21);
    openHiss.connect(openG);
    openG.connect(radioHp);
    openHiss.start(now, Math.random() * 0.4, speechDur + 0.24);

    // 2. Crisp 6-tone Vietnamese syllables
    let cursor = now + 0.065;
    for (const s of phrase) {
      this.scheduleSyllableFormants(
        cursor,
        basePitch,
        s.v,
        s.t,
        s.d,
        s.o,
        s.c,
        radioHp,
        0.95,
      );
      cursor += s.d + (s.g ?? 0.026);
    }
  }

  public dispose(): void {
    this.activeSpatialVoices = [];
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
      this.masterGain = null;
      this.masterCompressor = null;
      this.ambienceGain = null;
      this.sfxGain = null;
      this.sfxDryBus = null;
      this.valleyReverb = null;
      this.reverbReturnGain = null;
      this.voiceGain = null;
      this.windLowFilter = null;
      this.windLowGain = null;
      this.windCanopyFilter = null;
      this.windCanopyGain = null;
      this.cicadaGain = null;
      this.rainSheetFilter = null;
      this.rainSheetGain = null;
      this.rainDropGain = null;
      this.ambienceRunning = false;
    }
  }
}
