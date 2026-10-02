/**
 * Upload in memoria per l'Analisi file: il file non viene mai scritto su disco.
 */
const multer = require('multer');
const path = require('path');
const { t } = require('../server/i18n');

const MAX_BYTES = parseInt(process.env.FILE_SCAN_MAX_BYTES || String(32 * 1024 * 1024), 10);

const ALLOWED_EXT = new Set(
  (process.env.FILE_SCAN_EXTENSIONS ||
    '.exe,.dll,.sys,.scr,.msi,.bat,.cmd,.ps1,.vbs,.js,.jar,.apk,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.7z,.iso,.img,.bin,.dat,.html,.htm,.txt,.log,.elf,.so,.dmg,.pkg'
  )
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
);

// eslint-disable-next-line no-control-regex -- il byte nullo nei nomi di file va bloccato
const BLOCKED_NAME = /(\.\.|\/|\\|\x00|%00|^\s|\.$|<|>|:|"|\||\?|\*)/;

/** Errore di validazione dell'upload, già scritto per l'utente nella sua lingua. */
function uploadError(message) {
  const err = new Error(message);
  err.userFacing = true;
  return err;
}

function fileFilter(req, file, cb) {
  const lang = req.lang;
  const name = file.originalname || '';
  if (name.length > 240) {
    return cb(uploadError(t(lang, 'Il nome del file è troppo lungo (massimo 240 caratteri).')));
  }
  if (BLOCKED_NAME.test(name)) {
    return cb(uploadError(t(lang, 'Il nome del file contiene caratteri non consentiti.')));
  }
  const ext = path.extname(name).toLowerCase();
  if (!ext || !ALLOWED_EXT.has(ext)) {
    return cb(uploadError(t(lang, 'Tipo di file non accettato. Estensioni consentite: {list}.', { list: [...ALLOWED_EXT].join(', ') })));
  }
  cb(null, true);
}

const scanUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_BYTES,
    files: 1,
    parts: 5,
    fields: 5
  },
  fileFilter
});

function handleScanUploadError(err, req, res, next) {
  const lang = req.lang;
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: t(lang, 'File troppo grande: il massimo è {mb} MB.', { mb: Math.round(MAX_BYTES / 1024 / 1024) }),
        status: 'error',
      });
    }
    return res.status(400).json({ error: t(lang, 'Caricamento non valido: invia un solo file nel campo «file».'), status: 'error' });
  }
  if (err) {
    const message = err.userFacing ? err.message : t(lang, 'Caricamento del file non riuscito.');
    return res.status(400).json({ error: message, status: 'error' });
  }
  next();
}

module.exports = { scanUpload, handleScanUploadError, MAX_BYTES, ALLOWED_EXT };
