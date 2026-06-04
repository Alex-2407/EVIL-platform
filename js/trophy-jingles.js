/**
 * EVIL — 50 musichette di sblocco trofeo (Web Audio)
 * Anteprima e assegnazione: html/jingle-preview-local.html
 */
(function (global) {
  const STORAGE_RARITY = 'evil_jingle_by_rarity';
  const STORAGE_ACH = 'evil_jingle_by_achievement';

  const DEFAULT_RARITY = {
    bronze: 'j01',
    silver: 'j22',
    gold: 'j41',
    legendary: 'j50'
  };

  const COMPLEXITY_LABEL = { simple: 'Semplice', medium: 'Media', complex: 'Complessa' };

  function engine() {
    return global.TrophyAudio?.engine || null;
  }

  function getContext() {
    global.TrophyAudio?.prime?.();
    const eng = engine();
    return eng?.getContext?.() || null;
  }

  function playEvents(ctx, t0, events) {
    const eng = engine();
    if (!eng || !ctx) return;
    events.forEach((ev) => {
      const t = t0 + (ev.at || 0);
      switch (ev.type) {
        case 'tone':
          eng.tone(ctx, {
            freq: ev.freq,
            start: t,
            duration: ev.dur ?? 0.2,
            type: ev.wave || 'sine',
            gain: ev.gain ?? 0.1,
            detune: ev.detune || 0,
            freqEnd: ev.freqEnd,
            attack: ev.attack ?? 0.015,
            release: ev.release ?? 0.04
          });
          break;
        case 'chord':
          eng.chord(ctx, ev.freqs, t, ev.dur ?? 0.35, {
            type: ev.wave || 'sine',
            gain: ev.gain ?? 0.08,
            detuneSpread: ev.spread ?? 6
          });
          break;
        case 'arp':
          eng.arpeggio(ctx, ev.freqs, t, ev.step ?? 0.08, {
            type: ev.wave || 'triangle',
            gain: ev.gain ?? 0.09,
            noteDuration: ev.noteDur ?? 0.18,
            attack: ev.attack ?? 0.008
          });
          break;
        case 'noise':
          eng.noiseBurst(ctx, t, ev.dur ?? 0.08, ev.gain ?? 0.03, ev.hz ?? 2200);
          break;
        case 'kick':
          eng.kick(ctx, t, ev.gain ?? 0.3);
          break;
        case 'timp':
          eng.timpani(ctx, t, ev.gain ?? 0.18);
          break;
        case 'cym':
          eng.cymbal(ctx, t, ev.dur ?? 0.9, ev.gain ?? 0.06);
          break;
        default:
          break;
      }
    });
  }

  const N = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

  const SCALES = {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
    pent: [0, 2, 4, 7, 9]
  };

  function scaleFreqs(rootHz, scale, count, startIdx = 0) {
    const out = [];
    for (let i = 0; i < count; i++) {
      const deg = scale[(startIdx + i) % scale.length];
      const oct = Math.floor((startIdx + i) / scale.length);
      out.push(rootHz * Math.pow(2, (deg + oct * 12) / 12));
    }
    return out;
  }

  /** Genera 50 musichette distinte */
  function buildCatalog() {
    const names = [
      'Ping morbido', 'Duetto breve', 'Campana cyber', 'Beep console', 'Tick positivo',
      'Eco digitale', 'Nota solitaria', 'Coppia ascendente', 'Flash verde', 'Chip retro',
      'Suono OK', 'Ping argentato', 'Onda triangolare', 'Pluck corto', 'Salto di quinta',
      'Marimba soft', 'Click maestoso', 'Twinkle mini', 'Sfera sonora', 'Segnale EVIL',
      'Arpeggio emerald', 'Tris brillante', 'Fanfara corta', 'Cascata digitale', 'Accordo cyber',
      'Percussione dati', 'Synth wave', 'Radar sweep', 'Matrix rain', 'Firewall clang',
      'Cipher unlock', 'Vault open', 'Scan complete', 'Packet burst', 'Hex harmony',
      'Glitch stutter', 'Pulse triplo', 'Neon chord', 'Silver fanfare', 'Golden hint',
      'Trionfo breve', 'Orchestra hit', 'Epic riser', 'Leggenda minore', 'Cerimonia d\'oro',
      'Catena armonica', 'Timpani march', 'Synth cathedral', 'Cyber symphony', 'Suprema (mini)'
    ];

    const list = [];

    for (let i = 0; i < 50; i++) {
      const id = `j${String(i + 1).padStart(2, '0')}`;
      const complexity = i < 20 ? 'simple' : i < 40 ? 'medium' : 'complex';
      const root = N(48 + (i % 12));
      const events = [];
      let durationSec = 0.8;

      if (complexity === 'simple') {
        const wave = ['sine', 'triangle', 'square'][i % 3];
        if (i % 4 === 0) {
          events.push({ type: 'tone', freq: root, dur: 0.25, wave, gain: 0.11 });
        } else if (i % 4 === 1) {
          events.push(
            { type: 'tone', freq: root, dur: 0.12, wave, gain: 0.09 },
            { type: 'tone', at: 0.1, freq: root * 1.25, dur: 0.28, wave: 'sine', gain: 0.1 }
          );
          durationSec = 0.5;
        } else if (i % 4 === 2) {
          events.push(
            { type: 'tone', freq: root * 1.5, dur: 0.08, wave: 'square', gain: 0.045 },
            { type: 'tone', at: 0.06, freq: root, dur: 0.22, wave, gain: 0.1 },
            { type: 'noise', at: 0.05, dur: 0.05, gain: 0.02, hz: 1800 + i * 40 }
          );
          durationSec = 0.45;
        } else {
          const freqs = scaleFreqs(root, SCALES.pent, 2, i % 3);
          events.push(
            { type: 'tone', freq: freqs[0], dur: 0.15, wave: 'triangle', gain: 0.09 },
            { type: 'tone', at: 0.08, freq: freqs[1], dur: 0.3, wave: 'sine', gain: 0.11 }
          );
          durationSec = 0.55;
        }
      } else if (complexity === 'medium') {
        const idx = i - 20;
        const arp = scaleFreqs(root, SCALES.major, 5, idx % 4);
        if (idx % 5 === 0) {
          events.push({ type: 'arp', freqs: arp, step: 0.07, wave: 'sine', gain: 0.085, noteDur: 0.16 });
          events.push({ type: 'chord', at: 0.45, freqs: arp.slice(0, 3), dur: 0.4, gain: 0.07 });
          durationSec = 1.1;
        } else if (idx % 5 === 1) {
          events.push(
            { type: 'tone', freq: root, dur: 0.12, wave: 'square', gain: 0.05 },
            { type: 'tone', at: 0.1, freq: root * 1.33, dur: 0.14, wave: 'square', gain: 0.055 },
            { type: 'tone', at: 0.22, freq: root * 1.66, dur: 0.2, wave: 'square', gain: 0.06 },
            { type: 'chord', at: 0.38, freqs: [root * 2, root * 2.5, root * 3], dur: 0.45, wave: 'sine', gain: 0.08 }
          );
          durationSec = 1.0;
        } else if (idx % 5 === 2) {
          events.push({ type: 'kick', gain: 0.28 });
          events.push({ type: 'arp', at: 0.05, freqs: arp, step: 0.06, wave: 'triangle', gain: 0.09 });
          events.push({ type: 'noise', at: 0.35, dur: 0.12, gain: 0.035, hz: 3200 });
          durationSec = 1.0;
        } else if (idx % 5 === 3) {
          for (let k = 0; k < 4; k++) {
            events.push({
              type: 'tone',
              at: k * 0.07,
              freq: root * (1 + k * 0.15),
              dur: 0.1,
              wave: 'sine',
              gain: 0.08 - k * 0.01
            });
          }
          events.push({ type: 'chord', at: 0.32, freqs: [root * 2, root * 2.52, root * 3.02], dur: 0.5, spread: 10 });
          durationSec = 1.0;
        } else {
          events.push({ type: 'noise', dur: 0.04, gain: 0.04, hz: 800 });
          events.push({ type: 'tone', at: 0.03, freq: root * 2, dur: 0.08, wave: 'square', gain: 0.04 });
          events.push({ type: 'arp', at: 0.08, freqs: arp.slice().reverse(), step: 0.05, wave: 'triangle', gain: 0.08, noteDur: 0.12 });
          events.push({ type: 'cym', at: 0.55, dur: 0.6, gain: 0.045 });
          durationSec = 1.3;
        }
      } else {
        const idx = i - 40;
        const arpUp = scaleFreqs(root, SCALES.major, 6, idx);
        const arpMin = scaleFreqs(root * 0.94, SCALES.minor, 5, idx);

        if (idx === 0) {
          events.push(
            { type: 'tone', freq: root, dur: 0.15, wave: 'square', gain: 0.05 },
            { type: 'tone', at: 0.12, freq: root * 1.25, dur: 0.18, wave: 'square', gain: 0.055 },
            { type: 'chord', at: 0.32, freqs: [root * 2, root * 2.5, root * 3], dur: 0.55, gain: 0.09 },
            { type: 'cym', at: 0.35, dur: 0.8, gain: 0.05 }
          );
          durationSec = 1.2;
        } else if (idx === 1) {
          events.push({ type: 'timp', gain: 0.22 });
          events.push({ type: 'chord', at: 0.15, freqs: [root, root * 1.26, root * 1.5, root * 2], dur: 0.7, gain: 0.1, spread: 14 });
          events.push({ type: 'cym', at: 0.2, dur: 1.2, gain: 0.07 });
          durationSec = 1.5;
        } else if (idx === 2) {
          events.push({ type: 'tone', freq: root * 0.5, dur: 1.2, wave: 'sine', gain: 0.06, attack: 0.3 });
          events.push({ type: 'arp', at: 0.5, freqs: arpUp, step: 0.1, gain: 0.1, noteDur: 0.25 });
          events.push({ type: 'kick', at: 0.9, gain: 0.35 });
          durationSec = 1.8;
        } else if (idx === 3) {
          events.push({ type: 'chord', freqs: arpMin.slice(0, 4), dur: 0.8, wave: 'sawtooth', gain: 0.045, spread: 12 });
          events.push({ type: 'arp', at: 0.5, freqs: arpMin, step: 0.12, wave: 'sine', gain: 0.08 });
          durationSec = 1.6;
        } else if (idx === 4) {
          [0, 0.12, 0.24].forEach((at, k) => {
            events.push({ type: 'tone', at, freq: root * (1 + k * 0.2), dur: 0.18, wave: 'square', gain: 0.05 });
          });
          events.push({ type: 'chord', at: 0.38, freqs: [root * 2, root * 2.52, root * 3, root * 4], dur: 0.65, gain: 0.1 });
          events.push({ type: 'noise', at: 0.4, dur: 0.15, gain: 0.04, hz: 4000 });
          durationSec = 1.3;
        } else if (idx === 5) {
          events.push({ type: 'arp', freqs: arpUp, step: 0.08, gain: 0.085 });
          events.push({ type: 'arp', at: 0.5, freqs: arpUp.map((f) => f * 1.5), step: 0.07, gain: 0.075, noteDur: 0.2 });
          events.push({ type: 'chord', at: 0.95, freqs: [root * 3, root * 3.78, root * 4.5], dur: 0.6, gain: 0.09 });
          durationSec = 1.8;
        } else if (idx === 6) {
          [0, 0.35, 0.7, 1.05].forEach((at) => events.push({ type: 'timp', at, gain: 0.2 + at * 0.05 }));
          events.push({ type: 'chord', at: 0.4, freqs: [root * 1.5, root * 2, root * 2.5], dur: 0.9, gain: 0.08 });
          durationSec = 1.6;
        } else if (idx === 7) {
          events.push({ type: 'tone', freq: root * 0.5, dur: 2, wave: 'sine', gain: 0.05, attack: 0.4 });
          events.push({ type: 'chord', at: 0.6, freqs: [root * 2, root * 2.5, root * 3, root * 4, root * 5], dur: 1.2, gain: 0.09, spread: 18 });
          events.push({ type: 'cym', at: 0.65, dur: 1.5, gain: 0.08 });
          durationSec = 2.2;
        } else if (idx === 8) {
          events.push({ type: 'kick' });
          events.push({ type: 'arp', at: 0.05, freqs: arpUp, step: 0.06, gain: 0.09 });
          events.push({ type: 'chord', at: 0.45, freqs: [root * 2, root * 2.52, root * 3.02, root * 4], dur: 0.5, gain: 0.085 });
          events.push({ type: 'arp', at: 0.7, freqs: arpUp.map((f) => f * 2), step: 0.05, gain: 0.07, noteDur: 0.14 });
          events.push({ type: 'cym', at: 0.75, dur: 1, gain: 0.065 });
          events.push({ type: 'kick', at: 1.0, gain: 0.4 });
          durationSec = 2.0;
        } else {
          /* j50 — mini suprema ~4s */
          events.push({ type: 'tone', freq: root * 0.5, dur: 3.5, wave: 'sine', gain: 0.055, attack: 0.5 });
          [0.3, 0.55, 0.8, 1.05].forEach((at) => events.push({ type: 'timp', at, gain: 0.22 }));
          events.push({ type: 'arp', at: 0.9, freqs: arpUp, step: 0.1, gain: 0.1, noteDur: 0.28 });
          events.push({ type: 'chord', at: 1.5, freqs: [root * 2, root * 2.5, root * 3, root * 4], dur: 0.8, gain: 0.1, spread: 16 });
          events.push({ type: 'chord', at: 2.2, freqs: [root * 3, root * 3.78, root * 4.5, root * 5.5], dur: 1, gain: 0.11, spread: 20 });
          events.push({ type: 'cym', at: 2.3, dur: 1.4, gain: 0.08 });
          events.push({ type: 'kick', at: 2.5, gain: 0.45 });
          events.push({ type: 'noise', at: 3.2, dur: 0.5, gain: 0.07, hz: 1200 });
          durationSec = 4.2;
        }
      }

      list.push({
        id,
        name: names[i],
        complexity,
        durationSec,
        events,
        play(ctx) {
          playEvents(ctx, ctx.currentTime + 0.02, events);
        }
      });
    }

    return list;
  }

  const CATALOG = buildCatalog();
  const byId = Object.fromEntries(CATALOG.map((j) => [j.id, j]));

  function loadRarityMap() {
    try {
      const raw = localStorage.getItem(STORAGE_RARITY);
      const parsed = raw ? JSON.parse(raw) : {};
      return { ...DEFAULT_RARITY, ...parsed };
    } catch {
      return { ...DEFAULT_RARITY };
    }
  }

  function saveRarityMap(map) {
    localStorage.setItem(STORAGE_RARITY, JSON.stringify(map));
  }

  function loadAchievementMap() {
    try {
      const raw = localStorage.getItem(STORAGE_ACH);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function saveAchievementMap(map) {
    localStorage.setItem(STORAGE_ACH, JSON.stringify(map));
  }

  function getJingle(id) {
    return byId[id] || byId[DEFAULT_RARITY.bronze];
  }

  function resolveJingleId(achievement) {
    if (!achievement) return DEFAULT_RARITY.bronze;
    const achMap = loadAchievementMap();
    if (achMap[achievement.id]) return achMap[achievement.id];
    const rarityMap = loadRarityMap();
    if (achievement.id === 'master_collector') {
      return rarityMap.legendary || DEFAULT_RARITY.legendary;
    }
    return rarityMap[achievement.rarity] || DEFAULT_RARITY[achievement.rarity] || DEFAULT_RARITY.bronze;
  }

  function playJingle(id) {
    const ctx = getContext();
    if (!ctx) return false;
    const j = getJingle(id);
    j.play(ctx);
    return true;
  }

  function playForAchievement(achievement) {
    playJingle(resolveJingleId(achievement));
  }

  function getCeremonyDurationMs(achievement) {
    const j = getJingle(resolveJingleId(achievement));
    const audioMs = Math.ceil((j.durationSec || 1) * 1000);
    return Math.max(4800, audioMs + 2200);
  }

  function exportConfig() {
    return JSON.stringify(
      {
        byRarity: loadRarityMap(),
        byAchievement: loadAchievementMap(),
        exportedAt: new Date().toISOString()
      },
      null,
      2
    );
  }

  function importConfig(json) {
    const data = typeof json === 'string' ? JSON.parse(json) : json;
    if (data.byRarity) saveRarityMap({ ...DEFAULT_RARITY, ...data.byRarity });
    if (data.byAchievement) saveAchievementMap(data.byAchievement);
  }

  function resetConfig() {
    localStorage.removeItem(STORAGE_RARITY);
    localStorage.removeItem(STORAGE_ACH);
  }

  global.TrophyJingles = {
    CATALOG,
    COMPLEXITY_LABEL,
    DEFAULT_RARITY,
    getJingle,
    resolveJingleId,
    playJingle,
    playForAchievement,
    getCeremonyDurationMs,
    loadRarityMap,
    saveRarityMap,
    loadAchievementMap,
    saveAchievementMap,
    exportConfig,
    importConfig,
    resetConfig
  };
})(typeof window !== 'undefined' ? window : global);
