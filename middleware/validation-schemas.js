// ==================== VALIDATION SCHEMAS WITH JOI ====================
// Secure input validation using Joi schema validation
// Prevents injection attacks, XSS, command injection, and format attacks

const Joi = require('joi');

// ✅ Schema: URL Scan
const scanSchema = Joi.object({
  url: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .max(2048)
    .required()
    .messages({
      'string.uri': 'URL must be valid (http/https)',
      'string.max': 'URL too long (max 2048 characters)',
      'any.required': 'URL is required',
      'string.empty': 'URL cannot be empty'
    }),
  timeout: Joi.number()
    .integer()
    .min(5)
    .max(60)
    .optional()
    .messages({
      'number.min': 'Timeout must be at least 5 seconds',
      'number.max': 'Timeout cannot exceed 60 seconds'
    }),
  followRedirects: Joi.boolean().optional()
});

// ✅ Schema: OSINT Search (domain/person)
const osintSearchSchema = Joi.object({
  target: Joi.string()
    .trim()
    .min(2)
    .max(255)
    .required()
    .messages({
      'string.min': 'Target must be at least 2 characters',
      'string.max': 'Target cannot exceed 255 characters',
      'any.required': 'Target is required'
    }),
  type: Joi.string()
    .valid('domain', 'person', 'ip', 'email')
    .required()
    .messages({
      'any.only': 'Type must be: domain, person, ip, or email',
      'any.required': 'Type is required'
    })
});

// ✅ Schema: DNS Enumeration
const dnsEnumSchema = Joi.object({
  domain: Joi.string()
    .domain({ tlds: { allow: false } })
    .required()
    .messages({
      'string.domain': 'Invalid domain format',
      'any.required': 'Domain is required'
    })
});

// ✅ Schema: Subdomain Finder
const subdomainFinderSchema = Joi.object({
  domain: Joi.string()
    .domain({ tlds: { allow: false } })
    .required()
    .messages({
      'string.domain': 'Invalid domain format',
      'any.required': 'Domain is required'
    })
});

// ✅ Schema: SSL Analyzer
const sslAnalyzerSchema = Joi.object({
  domain: Joi.string()
    .domain({ tlds: { allow: false } })
    .required()
    .messages({
      'string.domain': 'Invalid domain format',
      'any.required': 'Domain is required'
    })
});

// ✅ Schema: Vulnerability Scanner
const vulnerabilityScanSchema = Joi.object({
  url: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .max(2048)
    .required()
    .messages({
      'string.uri': 'URL must be valid (http/https)',
      'string.max': 'URL too long',
      'any.required': 'URL is required'
    })
});

// ✅ Schema: Social Profile Search
const socialProfileSchema = Joi.object({
  username: Joi.string()
    .alphanum()
    .min(2)
    .max(50)
    .required()
    .messages({
      'string.alphanum': 'Username must contain only alphanumeric characters',
      'string.min': 'Username must be at least 2 characters',
      'string.max': 'Username cannot exceed 50 characters',
      'any.required': 'Username is required'
    })
});

// ✅ Schema: User Registration
const registerSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .required()
    .pattern(/^[a-zA-Z\s'-]+$/)
    .messages({
      'string.pattern.base': 'Name can only contain letters, spaces, hyphens, and apostrophes',
      'string.min': 'Name must be at least 2 characters',
      'string.max': 'Name cannot exceed 100 characters',
      'any.required': 'Name is required'
    }),
  email: Joi.string()
    .email()
    .lowercase()
    .required()
    .messages({
      'string.email': 'Invalid email format',
      'any.required': 'Email is required'
    }),
  password: Joi.string()
    .min(12)
    .required()
    .pattern(/^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/)
    .messages({
      'string.pattern.base': 'Password must contain uppercase, number, and special character (@$!%*?&)',
      'string.min': 'Password must be at least 12 characters',
      'any.required': 'Password is required'
    }),
  confirmPassword: Joi.string()
    .required()
    .valid(Joi.ref('password'))
    .messages({
      'any.only': 'Passwords do not match',
      'any.required': 'Password confirmation is required'
    })
});

// ✅ Schema: User Login
const loginSchema = Joi.object({
  email: Joi.string()
    .email()
    .lowercase()
    .required()
    .messages({
      'string.email': 'Invalid email format',
      'any.required': 'Email is required'
    }),
  password: Joi.string()
    .required()
    .messages({
      'any.required': 'Password is required'
    })
});

// ✅ Schema: File Upload
const fileUploadSchema = Joi.object({
  filename: Joi.string()
    .max(255)
    .optional()
    .messages({
      'string.max': 'Filename cannot exceed 255 characters'
    })
});

// Middleware factory for validation
const validateSchema = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(
    {
      ...req.body,
      ...req.query,
      ...req.params
    },
    {
      abortEarly: false,  // Collect all errors, not just the first
      stripUnknown: true,  // Remove unknown fields (XSS prevention)
      convert: true        // Coerce types where appropriate
    }
  );

  if (error) {
    const errors = error.details.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      type: err.type
    }));

    return res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: errors
    });
  }

  req.validatedData = value;
  next();
};

module.exports = {
  scanSchema,
  osintSearchSchema,
  dnsEnumSchema,
  subdomainFinderSchema,
  sslAnalyzerSchema,
  vulnerabilityScanSchema,
  socialProfileSchema,
  registerSchema,
  loginSchema,
  fileUploadSchema,
  validateSchema
};
