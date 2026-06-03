(function () {
  'use strict';

  const data = window.INCIDENT_TIMELINE;
  if (!data?.SCENARIOS) return;

  const els = {
    scenario: document.getElementById('ir-scenario'),
    play: document.getElementById('ir-play'),
    reset: document.getElementById('ir-reset'),
    speed: document.getElementById('ir-speed'),
    seek: document.getElementById('ir-seek'),
    seekLabel: document.getElementById('ir-seek-label'),
    events: document.getElementById('ir-events'),
    panel: document.getElementById('ir-panel'),
    panelClose: document.getElementById('ir-panel-close'),
    phases: document.getElementById('ir-phases'),
    statusSystem: document.getElementById('ir-status-system'),
    statusSeverity: document.getElementById('ir-status-severity'),
    statusDuration: document.getElementById('ir-status-duration'),
    statusData: document.getElementById('ir-status-data'),
    scenarioTitle: document.getElementById('ir-scenario-title'),
    scenarioLead: document.getElementById('ir-scenario-lead'),
    detailTitle: document.getElementById('ir-detail-title'),
    detailTime: document.getElementById('ir-detail-time'),
    detailSeverity: document.getElementById('ir-detail-severity'),
    detailDesc: document.getElementById('ir-detail-desc'),
    detailSoc: document.getElementById('ir-detail-soc'),
    detailMit: document.getElementById('ir-detail-mit'),
    detailMitre: document.getElementById('ir-detail-mitre'),
  };

  let state = {
    key: 'web-attack',
    index: 0,
    playing: false,
    speed: 1,
    timer: null,
    selected: null,
  };

  function scenario() {
    return data.SCENARIOS[state.key];
  }

  function events() {
    return scenario()?.events || [];
  }

  function clearTimer() {
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }
  }

  function severityClass(s) {
    return `ir-sev ir-sev--${s}`;
  }

  function formatDuration(start, end) {
    const base = '2026-01-14T';
    const a = new Date(base + start);
    const b = new Date(base + end);
    const diff = Math.max(0, b - a);
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `${h}h ${m}m`;
  }

  function renderPhases() {
    if (!els.phases) return;
    const current = events()[state.index]?.phase;
    els.phases.innerHTML = data.PHASES.map((p) =>
      `<div class="ir-phase${p.id === current ? ' is-active' : ''}" data-phase="${p.id}">
        <span class="ir-phase__dot"></span>
        <span class="ir-phase__label">${p.label}</span>
      </div>`
    ).join('');
  }

  function renderEvents() {
    if (!els.events) return;
    const list = events();
    els.events.innerHTML = list.map((ev, i) => {
      const active = i <= state.index;
      const selected = state.selected === i;
      return `
        <article class="ir-event ir-event--${ev.severity}${active ? ' is-active' : ''}${selected ? ' is-selected' : ''}"
          data-index="${i}" tabindex="0" role="button" aria-pressed="${selected}">
          <span class="ir-event__rail" aria-hidden="true"></span>
          <span class="ir-event__dot" aria-hidden="true"></span>
          <div class="ir-event__body">
            <time class="ir-event__time">${ev.time}</time>
            <h3 class="ir-event__title">${ev.title}</h3>
            <span class="${severityClass(ev.severity)}">${ev.severity}</span>
          </div>
        </article>`;
    }).join('');

    els.events.querySelectorAll('.ir-event').forEach((node) => {
      const idx = Number(node.dataset.index);
      node.addEventListener('click', () => selectEvent(idx, true));
      node.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectEvent(idx, true);
        }
      });
    });

    const activeNode = els.events.querySelector('.ir-event.is-active:last-of-type');
    if (activeNode && state.playing) {
      activeNode.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function showPanel(ev) {
    if (!els.panel || !ev) return;
    els.panel.hidden = false;
    els.detailTitle.textContent = ev.title;
    els.detailTime.textContent = ev.time;
    els.detailSeverity.textContent = ev.severity;
    els.detailSeverity.className = severityClass(ev.severity);
    els.detailDesc.textContent = ev.description;
    els.detailSoc.textContent = ev.soc;
    els.detailMit.innerHTML = ev.mitigations.map((m) => `<li>${m}</li>`).join('');
    els.detailMitre.textContent = ev.mitre;
  }

  function selectEvent(index, openPanel) {
    state.selected = index;
    state.index = index;
    if (els.seek) els.seek.value = String(index);
    updateSeekLabel();
    renderPhases();
    renderEvents();
    updateStatus();
    if (openPanel) showPanel(events()[index]);
  }

  function updateSeekLabel() {
    const total = events().length;
    if (els.seekLabel) {
      els.seekLabel.textContent = total
        ? `Evento ${state.index + 1} / ${total}`
        : '—';
    }
    if (els.seek) {
      els.seek.max = String(Math.max(0, total - 1));
    }
  }

  function updateStatus() {
    const list = events();
    const processed = list.slice(0, state.index + 1);
    const crit = processed.filter((e) => e.severity === 'critical').length;
    const alert = processed.filter((e) => e.severity === 'alert').length;
    const breach = processed.some((e) => e.dataBreach);
    const sc = scenario();

    let system = 'PULITO';
    let systemClass = 'ir-stat--ok';
    if (state.index >= list.length - 1 && list.length) {
      system = 'RIPRISTINATO';
      systemClass = 'ir-stat--ok';
    } else if (crit > 0) {
      system = 'COMPROMESSO';
      systemClass = 'ir-stat--bad';
    } else if (alert > 0) {
      system = 'A RISCHIO';
      systemClass = 'ir-stat--warn';
    }

    let sev = 'NORMALE';
    let sevClass = 'ir-stat--ok';
    if (crit > 0) {
      sev = 'CRITICA';
      sevClass = 'ir-stat--bad';
    } else if (alert > 0) {
      sev = 'ALTA';
      sevClass = 'ir-stat--warn';
    }

    if (els.statusSystem) {
      els.statusSystem.textContent = system;
      els.statusSystem.className = `ir-stat__value ${systemClass}`;
    }
    if (els.statusSeverity) {
      els.statusSeverity.textContent = sev;
      els.statusSeverity.className = `ir-stat__value ${sevClass}`;
    }
    if (els.statusDuration && list.length) {
      els.statusDuration.textContent = formatDuration(list[0].time, list[state.index].time);
    }
    if (els.statusData) {
      els.statusData.textContent = breach ? sc.recordsAtRisk : 'Nessuna confermata';
      els.statusData.className = `ir-stat__value ${breach ? 'ir-stat--bad' : 'ir-stat--ok'}`;
    }
  }

  function setPlaying(on) {
    state.playing = on;
    if (els.play) {
      els.play.textContent = on ? 'Pausa' : 'Play';
      els.play.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    if (!on) clearTimer();
  }

  function tick() {
    clearTimer();
    if (!state.playing) return;
    const list = events();
    if (state.index >= list.length - 1) {
      setPlaying(false);
      logComplete();
      return;
    }
    state.index += 1;
    state.selected = state.index;
    if (els.seek) els.seek.value = String(state.index);
    updateSeekLabel();
    renderPhases();
    renderEvents();
    updateStatus();
    showPanel(list[state.index]);
    state.timer = setTimeout(tick, 2000 / state.speed);
  }

  function logComplete() {
    const pm = window.progressManager;
    if (pm?.logActivity) {
      pm.logActivity('incident_timeline_completed', { scenario: state.key });
    }
  }

  function loadScenario(key) {
    if (!data.SCENARIOS[key]) return;
    clearTimer();
    setPlaying(false);
    state.key = key;
    state.index = 0;
    state.selected = null;
    const sc = scenario();
    if (els.scenarioTitle) els.scenarioTitle.textContent = sc.name;
    if (els.scenarioLead) els.scenarioLead.textContent = sc.tagline;
    if (els.panel) els.panel.hidden = true;
    updateSeekLabel();
    renderPhases();
    renderEvents();
    updateStatus();
    if (els.panel) els.panel.hidden = true;
    state.selected = null;
  }

  function bind() {
    els.scenario?.addEventListener('change', (e) => loadScenario(e.target.value));
    els.play?.addEventListener('click', () => {
      setPlaying(!state.playing);
      if (state.playing) tick();
    });
    els.reset?.addEventListener('click', () => loadScenario(state.key));
    els.speed?.addEventListener('change', (e) => {
      state.speed = parseFloat(e.target.value) || 1;
    });
    els.seek?.addEventListener('input', (e) => {
      selectEvent(Number(e.target.value), false);
    });
    els.panelClose?.addEventListener('click', () => {
      if (els.panel) els.panel.hidden = true;
      state.selected = null;
      renderEvents();
    });
    document.addEventListener('keydown', (e) => {
      if (e.target.matches('input, select, textarea')) return;
      if (e.key === 'ArrowRight' && state.index < events().length - 1) {
        selectEvent(state.index + 1, true);
      }
      if (e.key === 'ArrowLeft' && state.index > 0) {
        selectEvent(state.index - 1, true);
      }
      if (e.key === ' ') {
        e.preventDefault();
        els.play?.click();
      }
    });
  }

  function boot() {
    bind();
    loadScenario(els.scenario?.value || 'web-attack');
    const params = new URLSearchParams(location.search);
    const s = params.get('scenario');
    if (s && data.SCENARIOS[s]) {
      if (els.scenario) els.scenario.value = s;
      loadScenario(s);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
