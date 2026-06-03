/**
 * Upload in RAM per File Scanner — nessun salvataggio su disco
 */
const multer = require('multer');
const path = require('path');

const MAX_BYTES = parseInt(process.env.FILE_SCAN_MAX_BYTES || String(32 * 1024 * 1024), 10);

const ALLOWED_EXT = new Set(
  (process.env.FILE_SCAN_EXTENSIONS ||
    '.exe,.dll,.sys,.scr,.msi,.bat,.cmd,.ps1,.vbs,.js,.jar,.apk,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.7z,.iso,.img,.bin,.dat,.html,.htm,.txt,.log,.elf,.so,.dmg,.pkg'
  )
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
);

const BLOCKED_NAME = /(\.\.|\/|\\|\x00|%00|^\s|\.$|<|>|:|"|\||\?|\*)/;

function fileFilter(req, file, cb) {
  const name = file.originalname || '';
  if (name.length > 240) {
    return cb(new Error('Nome file troppo lungo'));
  }
  if (BLOCKED_NAME.test(name)) {
    return cb(new Error('Nome file non consentito'));
  }
  const ext = path.extname(name).toLowerCase();
  if (!ext || !ALLOWED_EXT.has(ext)) {
    return cb(
      new Error(`Estensione non consentita per la scansione. Consentite: ${[...ALLOWED_EXT].slice(0, 12).join(', ')}…`)
    );
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
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: `File troppo grande. Massimo ${Math.round(MAX_BYTES / 1024 / 1024)} MB per scansione.`
      });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err) return res.status(400).json({ error: err.message });
  next();
}

module.exports = { scanUpload, handleScanUploadError, MAX_BYTES, ALLOWED_EXT };
