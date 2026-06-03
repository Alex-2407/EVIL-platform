/**
 * EVIL Trophy Audio — fanfare per rarità (Web Audio API)
 * bronze → silver → gold | Collezionista Supremo = unico leggendario (~15 s)
 */
(function (global) {
  const SUPREME_AUDIO_SEC = 15;
  const SUPREME_CEREMONY_MS = 16200;
  let audioCtx = null;

  function isEnabled() {
    return localStorage.getItem('evil_trophy_sound') !== '0';
  }

  function setEnabled(on) {
    localStorage.setItem('evil_trophy_sound', on ? '1' : '0');
  }

  function getContext() {
    if (!isEnabled()) return null;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    if (!audioCtx) audioCtx = new Ctx();
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    return audioCtx;
  }

  function tone(ctx, opts) {
    const {
      freq,
      start,
      duration,
      type = 'sine',
      gain = 0.12,
      detune = 0,
      freqEnd,
      attack = 0.02,
      release = 0.05
    } = opts;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (freqEnd != null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), start + duration);
    }
    if (detune) osc.detune.setValueAtTime(detune, start);
    const peak = Math.max(gain, 0.0001);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(peak, start + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, start + duration + release);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + release + 0.02);
  }

  function chord(ctx, freqs, start, duration, opts = {}) {
    freqs.forEach((freq, i) => {
      tone(ctx, {
        freq,
        start,
        duration,
        type: opts.type || (i === 0 ? 'triangle' : 'sine'),
        gain: (opts.gain || 0.08) * (i === 0 ? 1.15 : 0.85 - i * 0.08),
        detune: i * (opts.detuneSpread || 4),
        ...opts
      });
    });
  }

  function noiseBurst(ctx, start, duration, gain = 0.04, filterHz = 2200) {
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterHz;
    filter.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    src.connect(filter);
    filter.connect(g);
    g.connect(ctx.destination);
    src.start(start);
    src.stop(start + duration);
  }

  function kick(ctx, start, gain = 0.35) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, start);
    osc.frequency.exponentialRampToValueAtTime(42, start + 0.12);
    g.gain.setValueAtTime(gain, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.4);
  }

  function timpani(ctx, start, gain = 0.2) {
    kick(ctx, start, gain * 0.7);
    noiseBurst(ctx, start, 0.2, gain * 0.25, 180);
  }

  function cymbal(ctx, start, duration = 1.4, gain = 0.07) {
    noiseBurst(ctx, start, duration, gain, 6000);
    noiseBurst(ctx, start + 0.02, duration * 0.6, gain * 0.5, 3200);
  }

  function arpeggio(ctx, notes, start, step, opts = {}) {
    notes.forEach((freq, i) => {
      tone(ctx, {
        freq,
        start: start + i * step,
        duration: opts.noteDuration || 0.22,
        type: opts.type || 'triangle',
        gain: opts.gain || 0.1,
        attack: opts.attack || 0.008
      });
    });
  }

  /** Bronzo — campanella calda, breve */
  function playBronzeUnlock() {
    const ctx = getContext();
    if (!ctx) return;
    const t = ctx.currentTime + 0.02;

    tone(ctx, { freq: 196, start: t, duration: 0.2, type: 'triangle', gain: 0.09 });
    tone(ctx, { freq: 246.94, start: t + 0.08, duration: 0.22, type: 'triangle', gain: 0.1 });
    tone(ctx, { freq: 293.66, start: t + 0.16, duration: 0.35, type: 'sine', gain: 0.11 });
    noiseBurst(ctx, t + 0.12, 0.06, 0.02, 1800);
  }

  /** Argento — arpeggio ascendente, più brillante */
  function playSilverUnlock() {
    const ctx = getContext();
    if (!ctx) return;
    const t = ctx.currentTime + 0.02;

    arpeggio(ctx, [329.63, 392, 493.88, 587.33], t, 0.09, { type: 'sine', gain: 0.09, noteDuration: 0.2 });
    chord(ctx, [523.25, 659.25], t + 0.38, 0.4, { type: 'triangle', gain: 0.07 });
    tone(ctx, { freq: 783.99, start: t + 0.42, duration: 0.45, type: 'sine', gain: 0.08 });
    noiseBurst(ctx, t + 0.35, 0.1, 0.035, 3500);
  }

  /** Oro — fanfara trionfale */
  function playGoldUnlock() {
    const ctx = getContext();
    if (!ctx) return;
    const t = ctx.currentTime + 0.02;

    tone(ctx, { freq: 392, start: t, duration: 0.15, type: 'square', gain: 0.045 });
    tone(ctx, { freq: 523.25, start: t + 0.12, duration: 0.18, type: 'square', gain: 0.05 });
    tone(ctx, { freq: 659.25, start: t + 0.24, duration: 0.22, type: 'square', gain: 0.055 });

    chord(ctx, [523.25, 659.25, 783.99], t + 0.38, 0.55, { type: 'sine', gain: 0.09 });
    tone(ctx, { freq: 1046.5, start: t + 0.45, duration: 0.7, type: 'sine', gain: 0.12 });
    tone(ctx, { freq: 1318.5, start: t + 0.52, duration: 0.5, type: 'triangle', gain: 0.06 });

    noiseBurst(ctx, t + 0.4, 0.12, 0.045, 2800);
    noiseBurst(ctx, t + 0.55, 0.08, 0.03, 4500);
  }

  /** Collezionista Supremo — unico leggendario, suite ~15 s */
  function playSupremeCollectorUnlock() {
    const ctx = getContext();
    if (!ctx) return;
    const t = ctx.currentTime + 0.02;
    const end = SUPREME_AUDIO_SEC;

    tone(ctx, { freq: 36.71, start: t, duration: end, type: 'sine', gain: 0.065, attack: 1.2 });
    tone(ctx, { freq: 41.2, start: t + 0.2, duration: end - 0.5, type: 'sine', gain: 0.055, attack: 1 });
    tone(ctx, { freq: 55, start: t + 0.5, duration: end - 1, type: 'triangle', gain: 0.045, attack: 0.8 });
    tone(ctx, { freq: 65.41, start: t + 0.8, duration: end - 1.5, type: 'sine', gain: 0.035, attack: 0.6 });

    noiseBurst(ctx, t, 2.5, 0.035, 350);
    noiseBurst(ctx, t + 2, 1.5, 0.025, 600);

    [0.6, 1.0, 1.4, 1.8, 2.2, 2.6, 3.0, 3.4].forEach((off, i) => {
      timpani(ctx, t + off, 0.2 + i * 0.03);
    });

    chord(ctx, [196, 246.94, 293.66], t + 1.2, 1.4, { type: 'sawtooth', gain: 0.038, detuneSpread: 10 });
    chord(ctx, [220, 277.18, 329.63], t + 2.4, 1.3, { type: 'sawtooth', gain: 0.042, detuneSpread: 12 });
    chord(ctx, [246.94, 311.13, 369.99], t + 3.6, 1.2, { type: 'sawtooth', gain: 0.044, detuneSpread: 14 });

    arpeggio(ctx, [261.63, 329.63, 392, 493.88, 587.33], t + 4.2, 0.22, {
      type: 'sine',
      gain: 0.09,
      noteDuration: 0.4,
      attack: 0.02
    });

    [4.8, 5.1, 5.4, 5.7, 6.0, 6.3].forEach((off, i) => {
      timpani(ctx, t + off, 0.28 + i * 0.04);
    });

    chord(ctx, [392, 493.88, 587.33, 659.25], t + 5.5, 1.5, { type: 'sine', gain: 0.1, detuneSpread: 16 });

    arpeggio(ctx, [523.25, 659.25, 783.99, 987.77, 1174.66], t + 6.8, 0.18, {
      type: 'square',
      gain: 0.045,
      noteDuration: 0.32
    });

    tone(ctx, { freq: 523.25, start: t + 7.6, duration: 0.22, type: 'square', gain: 0.05 });
    tone(ctx, { freq: 659.25, start: t + 7.85, duration: 0.24, type: 'square', gain: 0.055 });
    tone(ctx, { freq: 783.99, start: t + 8.1, duration: 0.28, type: 'square', gain: 0.06 });
    tone(ctx, { freq: 1046.5, start: t + 8.35, duration: 0.35, type: 'square', gain: 0.065 });

    chord(ctx, [523.25, 659.25, 783.99, 1046.5], t + 8.6, 2.2, { type: 'sine', gain: 0.11, detuneSpread: 18 });

    [8.4, 8.7, 9.0, 9.3, 9.6, 9.9, 10.2].forEach((off, i) => {
      kick(ctx, t + off, 0.38 + i * 0.04);
    });

    cymbal(ctx, t + 8.5, 2.8, 0.1);
    cymbal(ctx, t + 10.5, 2.2, 0.085);

    arpeggio(ctx, [1046.5, 1318.5, 1567.98, 1975.53, 2349.32, 2793.83], t + 9.2, 0.2, {
      type: 'sine',
      gain: 0.12,
      noteDuration: 0.5,
      attack: 0.03
    });

    chord(ctx, [659.25, 783.99, 987.77, 1174.66, 1567.98], t + 10.8, 2.5, {
      type: 'sine',
      gain: 0.12,
      detuneSpread: 20
    });

    tone(ctx, { freq: 2093, start: t + 11.2, duration: 2.5, type: 'sine', gain: 0.14, attack: 0.06 });
    tone(ctx, { freq: 2637, start: t + 11.5, duration: 2.2, type: 'triangle', gain: 0.1 });
    tone(ctx, { freq: 3135.96, start: t + 11.8, duration: 2, type: 'sine', gain: 0.12 });
    tone(ctx, { freq: 3520, start: t + 12.1, duration: 1.8, type: 'sine', gain: 0.09 });

    chord(ctx, [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98], t + 12.4, 2.8, {
      type: 'sine',
      gain: 0.13,
      detuneSpread: 22
    });

    kick(ctx, t + 12.2, 0.5);
    kick(ctx, t + 12.55, 0.52);
    kick(ctx, t + 12.9, 0.55);
    cymbal(ctx, t + 12.3, 2.5, 0.11);

    arpeggio(ctx, [1567.98, 1975.53, 2349.32, 2793.83, 3135.96], t + 13.0, 0.22, {
      type: 'sine',
      gain: 0.11,
      noteDuration: 0.55
    });

    chord(ctx, [392, 493.88, 587.33, 783.99, 1046.5], t + 13.6, 1.4, { type: 'sine', gain: 0.1, detuneSpread: 18 });
    noiseBurst(ctx, t + 14.0, 0.6, 0.09, 900);
    noiseBurst(ctx, t + 14.35, 0.5, 0.07, 5500);
    cymbal(ctx, t + 14.1, 1.8, 0.09);
  }

  const RARITY_PLAYERS = {
    bronze: playBronzeUnlock,
    silver: playSilverUnlock,
    gold: playGoldUnlock
  };

  function playByRarity(rarity) {
    const fn = RARITY_PLAYERS[rarity] || playBronzeUnlock;
    fn();
  }

  function playForAchievement(achievement) {
    if (!achievement) return;
    if (achievement.id === 'master_collector') {
      playSupremeCollectorUnlock();
      return;
    }
    playByRarity(achievement.rarity || 'bronze');
  }

  function getCeremonyDurationMs(achievement) {
    if (!achievement) return 5500;
    if (achievement.id === 'master_collector') return SUPREME_CEREMONY_MS;
    const map = { bronze: 5200, silver: 5800, gold: 6500 };
    return map[achievement.rarity] || 5500;
  }

  function prime() {
    const ctx = getContext();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  global.TrophyAudio = {
    playForAchievement,
    playSupremeCollectorUnlock,
    getCeremonyDurationMs,
    isEnabled,
    setEnabled,
    prime
  };

  if (typeof document !== 'undefined') {
    const primeOnce = () => {
      prime();
      document.removeEventListener('click', primeOnce);
      document.removeEventListener('keydown', primeOnce);
    };
    document.addEventListener('click', primeOnce, { once: true, passive: true });
    document.addEventListener('keydown', primeOnce, { once: true, passive: true });
  }
})(typeof window !== 'undefined' ? window : global);
