'use strict';
/**
 * Modello dei progressi utente (trofei, attività, scansioni).
 *
 * Prima esistevano due forme incompatibili: il server scriveva { scans, activities }
 * e il browser salvava { totalScans, totalActivities, ... } sovrascrivendo tutto.
 * Qui c'è una sola forma, con validazione e limiti di dimensione.
 */
const Joi = require('joi');

const MAX_LOG = 500;
const MAX_ACTIVITY_NAME = 64;

function defaultProgress() {
  return {
    totalScans: 0,
    totalActivities: 0,
    unlockedAchievements: [],
    achievementMeta: {},
    completedActivities: [],
    activityLog: [],
    lastUnlockedAchievement: null,
  };
}

/** Converte anche i record vecchi ({ scans, activities } o trofei come oggetti). */
function normalizeProgress(raw) {
  const p = raw && typeof raw === 'object' ? raw : {};
  const base = defaultProgress();
  base.totalScans = Math.max(Number(p.totalScans) || 0, Number(p.scans) || 0);
  base.totalActivities = Math.max(Number(p.totalActivities) || 0, Number(p.activities) || 0);
  const ids = Array.isArray(p.unlockedAchievements) ? p.unlockedAchievements : [];
  base.unlockedAchievements = [...new Set(ids.map((x) => (typeof x === 'string' ? x : x?.id)).filter((x) => typeof x === 'string'))];
  base.achievementMeta = p.achievementMeta && typeof p.achievementMeta === 'object' ? p.achievementMeta : {};
  base.completedActivities = Array.isArray(p.completedActivities)
    ? [...new Set(p.completedActivities.filter((x) => typeof x === 'string'))]
    : [];
  base.activityLog = Array.isArray(p.activityLog) ? p.activityLog.slice(-MAX_LOG) : [];
  base.lastUnlockedAchievement = typeof p.lastUnlockedAchievement === 'string' ? p.lastUnlockedAchievement : null;
  return base;
}

const idPattern = /^[a-z0-9_-]{1,64}$/i;

const saveSchema = Joi.object({
  totalScans: Joi.number().integer().min(0).max(1e6).default(0),
  totalActivities: Joi.number().integer().min(0).max(1e6).default(0),
  unlockedAchievements: Joi.array()
    .items(Joi.alternatives(Joi.string().pattern(idPattern), Joi.object({ id: Joi.string().pattern(idPattern).required() }).unknown(true)))
    .max(200)
    .default([]),
  achievementMeta: Joi.object()
    .pattern(Joi.string().pattern(idPattern), Joi.object({ unlockedAt: Joi.string().isoDate().allow(null) }).unknown(false))
    .max(200)
    .default({}),
  completedActivities: Joi.array().items(Joi.string().pattern(idPattern)).max(200).default([]),
  activityLog: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().max(MAX_ACTIVITY_NAME).pattern(idPattern).required(),
        timestamp: Joi.string().isoDate().required(),
      }).unknown(true)
    )
    .max(1000)
    .default([]),
  lastUnlockedAchievement: Joi.string().pattern(idPattern).allow(null).default(null),
}).unknown(false);

/** Tiene nel log solo campi semplici e brevi (niente oggetti annidati o testi lunghi). */
function sanitizeLogEntry(entry) {
  const out = { name: entry.name, timestamp: entry.timestamp };
  for (const [k, v] of Object.entries(entry)) {
    if (k === 'name' || k === 'timestamp') continue;
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,31}$/.test(k)) continue;
    if (typeof v === 'number' || typeof v === 'boolean') out[k] = v;
    else if (typeof v === 'string') out[k] = v.slice(0, 120);
    if (Object.keys(out).length >= 8) break;
  }
  return out;
}

/** Unione dei due registri (server e browser) senza duplicati, in ordine cronologico. */
function mergeLogs(serverLog, clientLog) {
  const seen = new Map();
  for (const entry of [...serverLog, ...clientLog]) {
    if (!entry || typeof entry.name !== 'string' || typeof entry.timestamp !== 'string') continue;
    seen.set(`${entry.name}|${entry.timestamp}`, entry);
  }
  return [...seen.values()].sort((a, b) => a.timestamp.localeCompare(b.timestamp)).slice(-MAX_LOG);
}

/**
 * Valida il salvataggio inviato dal browser e lo fonde con quello del server.
 * I trofei sconosciuti al catalogo vengono scartati; i contatori non possono scendere.
 */
function mergeClientProgress(current, payload, catalogIds) {
  const { value, error } = saveSchema.validate(payload, { stripUnknown: false, abortEarly: true });
  if (error) {
    const e = new Error(`Progressi non validi: ${error.message}`);
    e.status = 400;
    throw e;
  }
  const server = normalizeProgress(current);
  const client = normalizeProgress(value);
  const known = (id) => !catalogIds || catalogIds.has(id);

  const unlocked = [...new Set([...server.unlockedAchievements, ...client.unlockedAchievements.filter(known)])];
  const meta = { ...client.achievementMeta, ...server.achievementMeta };
  for (const id of Object.keys(meta)) if (!unlocked.includes(id)) delete meta[id];

  return {
    totalScans: Math.max(server.totalScans, client.totalScans),
    totalActivities: Math.max(server.totalActivities, client.totalActivities),
    unlockedAchievements: unlocked,
    achievementMeta: meta,
    completedActivities: [...new Set([...server.completedActivities, ...client.completedActivities])].slice(-200),
    activityLog: mergeLogs(server.activityLog, client.activityLog.map(sanitizeLogEntry)),
    lastUnlockedAchievement:
      client.lastUnlockedAchievement && unlocked.includes(client.lastUnlockedAchievement)
        ? client.lastUnlockedAchievement
        : server.lastUnlockedAchievement,
  };
}

/** Registra lato server una scansione completata (non dipende dal browser). */
function recordScan(user, name = 'scan', details = {}) {
  const p = normalizeProgress(user.progress);
  p.totalScans += 1;
  p.totalActivities += 1;
  p.activityLog.push(sanitizeLogEntry({ name, timestamp: new Date().toISOString(), ...details }));
  p.activityLog = p.activityLog.slice(-MAX_LOG);
  user.progress = p;
  return p;
}

module.exports = { defaultProgress, normalizeProgress, mergeClientProgress, recordScan, saveSchema };
