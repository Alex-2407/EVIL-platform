// ==================== JOI VALIDATION SCHEMAS ====================
// Input validation and sanitization for all API endpoints
// Prevents: XSS, injection, malformed requests

const Joi = require('joi');

// ==================== REUSABLE SCHEMA COMPONENTS ====================
const DOMAIN_PATTERN = /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
const URI_PATTERN = /^https?:\/\/[^\s]+$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ==================== API ENDPOINT SCHEMAS ====================

/**
 * /api/scan - URL scan validation
 */
const scanSchema = Joi.object({
  url: Joi.string()
    .required()
    .max(2048)
    .pattern(URI_PATTERN)
    .messages({
      'string.pattern.base': 'Invalid URL format',
      'string.max': 'URL too long (max 2048 chars)',
      'any.required': 'URL is required'
    }),
  scanType: Joi.string()
    .optional()
    .valid('quick', 'full', 'security')
    .default('quick'),
  includeAdvanced: Joi.boolean().optional().default(false)
}).unknown(false).messages({
  'object.unknown': 'Unknown field in request'
});

/**
 * /api/osint-search - OSINT search validation
 */
const osintSearchSchema = Joi.object({
  query: Joi.string()
    .required()
    .max(255)
    .trim()
    .messages({
      'string.max': 'Query too long (max 255 chars)',
      'any.required': 'Search query is required'
    }),
  type: Joi.string()
    .optional()
    .valid('email', 'domain', 'person', 'general')
    .default('general')
}).unknown(false);

/**
 * /api/dns-enum - DNS enumeration validation
 */
const dnsEnumSchema = Joi.object({
  domain: Joi.string()
    .required()
    .max(253)
    .pattern(DOMAIN_PATTERN)
    .messages({
      'string.pattern.base': 'Invalid domain format',
      'any.required': 'Domain is required'
    }),
  recordTypes: Joi.array()
    .items(Joi.string().valid('A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SOA'))
    .optional()
    .default(['A', 'MX', 'CNAME'])
}).unknown(false);

/**
 * /api/subdomain-finder - Subdomain finding validation
 */
const subdomainFinderSchema = Joi.object({
  domain: Joi.string()
    .required()
    .max(253)
    .pattern(DOMAIN_PATTERN)
    .messages({
      'string.pattern.base': 'Invalid domain format'
    }),
  passive: Joi.boolean().optional().default(true)
}).unknown(false);

/**
 * /api/ssl-analyzer - SSL certificate analysis validation
 */
const sslAnalyzerSchema = Joi.object({
  host: Joi.string()
    .required()
    .max(253)
    .messages({
      'any.required': 'Host is required'
    }),
  port: Joi.number()
    .optional()
    .default(443)
    .min(1)
    .max(65535)
    .messages({
      'number.min': 'Invalid port (min 1)',
      'number.max': 'Invalid port (max 65535)'
    })
}).unknown(false);

/**
 * /api/vulnerability-scan - Vulnerability scanning validation
 */
const vulnerabilityScanSchema = Joi.object({
  target: Joi.string()
    .required()
    .max(2048)
    .messages({
      'any.required': 'Target is required',
      'string.max': 'Target too long'
    }),
  severity: Joi.string()
    .optional()
    .valid('critical', 'high', 'medium', 'low')
    .default('all')
}).unknown(false);

/**
 * /api/social-profile - Social profile lookup validation
 */
const socialProfileSchema = Joi.object({
  username: Joi.string()
    .required()
    .max(100)
    .pattern(/^[a-zA-Z0-9_.-]+$/)
    .messages({
      'string.pattern.base': 'Invalid username format',
      'any.required': 'Username is required'
    }),
  platforms: Joi.array()
    .items(Joi.string())
    .optional()
    .default(['twitter', 'github', 'linkedin'])
}).unknown(false);

/**
 * /api/auth/register - Registration validation
 */
const registerSchema = Joi.object({
  name: Joi.string()
    .required()
    .min(2)
    .max(100)
    .pattern(/^[a-zA-Z\s'-]+$/)
    .messages({
      'string.pattern.base': 'Name contains invalid characters',
      'string.min': 'Name too short',
      'any.required': 'Name is required'
    }),
  email: Joi.string()
    .required()
    .email()
    .max(255)
    .lowercase()
    .messages({
      'string.email': 'Invalid email format',
      'any.required': 'Email is required'
    }),
  password: Joi.string()
    .required()
    .min(12)
    .pattern(/^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
    .messages({
      'string.pattern.base': 'Password must include uppercase, number, and special char',
      'string.min': 'Password must be at least 12 characters',
      'any.required': 'Password is required'
    }),
  confirmPassword: Joi.string()
    .required()
    .valid(Joi.ref('password'))
    .messages({
      'any.only': 'Passwords do not match'
    })
}).unknown(false);

/**
 * /api/auth/login - Login validation
 */
const loginSchema = Joi.object({
  email: Joi.string()
    .required()
    .email()
    .lowercase()
    .messages({
      'string.email': 'Invalid email format',
      'any.required': 'Email is required'
    }),
  password: Joi.string()
    .required()
    .messages({
      'any.required': 'Password is required'
    })
}).unknown(false);

/**
 * File upload validation
 */
const fileUploadSchema = Joi.object({
  filename: Joi.string()
    .required()
    .max(255)
    .pattern(/^[a-zA-Z0-9._-]+$/)
    .messages({
      'string.pattern.base': 'Invalid filename',
      'any.required': 'Filename is required'
    }),
  size: Joi.number()
    .optional()
    .max(10 * 1024 * 1024) // 10MB max
    .messages({
      'number.max': 'File too large (max 10MB)'
    }),
  mimetype: Joi.string()
    .required()
    .valid(
      'application/pdf',
      'text/plain',
      'text/csv',
      'application/json',
      'image/png',
      'image/jpeg'
    )
    .messages({
      'any.only': 'File type not allowed'
    })
}).unknown(false);

// ==================== VALIDATION MIDDLEWARE FACTORY ====================

/**
 * Generic schema validator middleware
 * Uses: Joi schema, collects all errors, strips unknown fields
 */
function validateSchema(schema) {
  return async (req, res, next) => {
    try {
      // Validate against schema
      const { error, value } = schema.validate(req.body, {
        abortEarly: false,         // collect ALL errors, not just first
        stripUnknown: true,        // remove unknown fields (XSS prevention)
        convert: true              // convert types (e.g., string -> number)
      });

      if (error) {
        // Format validation errors for response
        const details = error.details.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          type: err.type
        }));

        return res.status(400).json({
          error: 'Validation failed',
          details,
          code: 'VALIDATION_ERROR'
        });
      }

      // Replace request body with validated data
      req.body = value;
      next();
    } catch (err) {
      console.error('Schema validation error:', err.message);
      res.status(500).json({
        error: 'Internal validation error',
        code: 'INTERNAL_ERROR'
      });
    }
  };
}

// ==================== EXPORTS ====================
module.exports = {
  validateSchema,
  // API Schemas
  scanSchema,
  osintSearchSchema,
  dnsEnumSchema,
  subdomainFinderSchema,
  sslAnalyzerSchema,
  vulnerabilityScanSchema,
  socialProfileSchema,
  // Auth Schemas
  registerSchema,
  loginSchema,
  // File Upload
  fileUploadSchema
};
