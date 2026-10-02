/**
 * EVIL — Generatore di report (report-generator.html)
 * Anteprima nella pagina, stampa, esportazione JSON (locale) e PDF (generato dal server).
 * I testi inseriti finiscono sempre in textContent: niente HTML interpretato.
 */
(function () {
  'use strict';

  const { t, fmtDate } = window.EVIL_I18N;

  const FIELDS = {
    title: 'reportTitle',
    date: 'reportDate',
    severity: 'reportSeverity',
    target: 'reportOrg',
    author: 'reportAuthor',
    summary: 'summary',
    scope: 'scope',
    timeline: 'timeline',
    evidence: 'evidence',
    findings: 'impact',
    systems: 'systemsAffected',
    usersAffected: 'usersAffected',
    recommendations: 'recommendations',
  };

  const SEVERITY = {
    critical: () => t('Critica'),
    high: () => t('Alta'),
    medium: () => t('Media'),
    low: () => t('Bassa'),
  };

  const INCIDENT_TYPES = {
    malware: () => t('Malware'),
    phishing: () => t('Phishing'),
    ransomware: () => t('Ransomware'),
    dataBreach: () => t('Violazione di dati'),
    ddos: () => t('DDoS'),
  };

  const $ = (id) => document.getElementById(id);

  function value(key) {
    const el = $(FIELDS[key]);
    return el ? String(el.value || '').trim() : '';
  }

  function incidentTypes() {
    return Array.from(document.querySelectorAll('input[name="incident"]:checked')).map((el) => el.value);
  }

  function incidentTypeLabels() {
    return incidentTypes().map((v) => (INCIDENT_TYPES[v] ? INCIDENT_TYPES[v]() : v)).join(', ');
  }

  function formatIncidentDate(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
    return fmtDate(`${iso}T12:00:00Z`, { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function setText(id, text, fallback) {
    const el = $(id);
    if (el) el.textContent = text || fallback;
  }

  function showError(message) {
    const box = $('reportError');
    if (!box) return;
    box.textContent = message;
    box.hidden = !message;
  }

  function generateReport() {
    const notGiven = t('Non indicato');
    showError('');
    setText('previewTitle', value('title'), t('Report di sicurezza'));
    setText('previewDate', fmtDate(new Date(), { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }), '');
    setText('previewAuthor', value('author'), t('Team di sicurezza'));
    setText('previewOrg', value('target'), notGiven);
    setText('previewIncidentDate', formatIncidentDate(value('date')), notGiven);
    setText('previewSeverityLabel', SEVERITY[value('severity')] ? SEVERITY[value('severity')]() : '', notGiven);
    setText('previewTypes', incidentTypeLabels(), notGiven);
    setText('previewSystems', value('systems'), notGiven);
    setText('previewUsers', value('usersAffected'), notGiven);
    setText('previewSummary', value('summary'), t('Sezione non compilata.'));
    setText('previewScope', value('scope'), t('Sezione non compilata: indica sempre chi ha autorizzato l\'attività.'));
    setText('previewTimeline', value('timeline'), t('Sezione non compilata.'));
    setText('previewEvidence', value('evidence'), t('Sezione non compilata.'));
    setText('previewImpact', value('findings'), t('Sezione non compilata.'));

    const recEl = $('previewRecommendations');
    if (recEl) {
      const lines = value('recommendations').split('\n').map((r) => r.trim()).filter(Boolean);
      const items = (lines.length ? lines : [t('Sezione non compilata.')]).map((r) => {
        const li = document.createElement('li');
        li.textContent = r;
        return li;
      });
      recEl.replaceChildren(...items);
    }

    const preview = $('reportPreview');
    preview.classList.add('active');
    preview.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function resetForm() {
    Object.values(FIELDS).forEach((id) => {
      const el = $(id);
      if (!el) return;
      if (el.tagName === 'SELECT') el.value = 'medium';
      else el.value = '';
    });
    document.querySelectorAll('input[name="incident"]').forEach((el) => { el.checked = el.value === 'malware'; });
    $('reportPreview').classList.remove('active');
    showError('');
  }

  function collect() {
    const data = {};
    Object.keys(FIELDS).forEach((key) => { data[key] = value(key); });
    return data;
  }

  function exportJSON() {
    const data = collect();
    const payload = {
      generatedAt: new Date().toISOString(),
      title: data.title,
      incidentDate: data.date,
      organization: data.target,
      author: data.author,
      severity: data.severity,
      incidentTypes: incidentTypes(),
      summary: data.summary,
      scopeAndAuthorisation: data.scope,
      timeline: data.timeline,
      evidenceAndIoc: data.evidence,
      impact: data.findings,
      systems: data.systems,
      affectedUsers: data.usersAffected,
      recommendations: data.recommendations.split('\n').map((r) => r.trim()).filter(Boolean),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `evil-report-${Date.now()}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  }

  function exportPDF() {
    showError('');
    const data = collect();
    const incident = { ...data, incidentTypes: incidentTypeLabels() };
    if (!window.EvilTools?.downloadToolPdf) {
      showError(t('Esportazione PDF non disponibile: ricarica la pagina e riprova.'));
      return;
    }
    window.EvilTools.downloadToolPdf('/api/report-generator', { incident }, `evil-report-${Date.now()}.pdf`)
      .then(() => window.progressManager?.logActivity?.('report_generated', { source: 'report-generator' }))
      .catch((err) => showError(t('Generazione del PDF non riuscita: {error}', { error: err.message })));
  }

  function init() {
    $('generateReportBtn')?.addEventListener('click', generateReport);
    $('resetReportBtn')?.addEventListener('click', resetForm);
    $('exportPdfBtn')?.addEventListener('click', exportPDF);
    $('exportJsonBtn')?.addEventListener('click', exportJSON);
    $('printReportBtn')?.addEventListener('click', () => window.print());
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
