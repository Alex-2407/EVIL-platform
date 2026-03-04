// ==================== FILE UPLOAD MIDDLEWARE ====================
// Secure file upload with whitelist, size limits, and UUID naming

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Create uploads directory if doesn't exist
const uploadsDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Allowed MIME types (whitelist)
const ALLOWED_MIME_TYPES = (process.env.ALLOWED_MIME_TYPES || 'image/png,image/jpeg,application/pdf').split(',').map(m => m.trim());
const ALLOWED_EXTENSIONS = (process.env.ALLOWED_EXTENSIONS || '.png,.jpg,.jpeg,.pdf').split(',').map(m => m.trim().toLowerCase());

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Store files in user-specific folder for isolation
    let uploadPath = uploadsDir;
    
    if (process.env.UPLOAD_USER_ISOLATION === 'true' && req.user) {
      uploadPath = path.join(uploadsDir, req.user.id);
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }
    }
    
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Use UUID to prevent filename enumeration and path traversal
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `${uuidv4()}${ext}`;
    cb(null, filename);
  }
});

// File filter function
const fileFilter = (req, file, cb) => {
  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(new Error(`File type not allowed: ${file.mimetype}. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`));
  }

  // Check extension
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(new Error(`File extension not allowed: ${ext}. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`));
  }

  // Check original filename for suspicious patterns
  if (/\.\.|\/|\\|\.exe|\.sh|\.bat|\.cmd|\.com|\.pif|\.scr|\.js|\.vbs|\.jar|\.zip/i.test(file.originalname)) {
    return cb(new Error('Suspicious filename detected'));
  }

  cb(null, true);
};

// Configure multer with limits and filters
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || 52428800), // 50MB default
    files: 1
  }
});

/**
 * Error handling middleware for multer
 */
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        error: `File too large. Maximum size: ${process.env.MAX_FILE_SIZE / 1024 / 1024}MB`
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ 
        error: 'Only one file allowed per upload'
      });
    }
    return res.status(400).json({ error: err.message });
  } else if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
};

module.exports = {
  upload,
  handleUploadError
};
