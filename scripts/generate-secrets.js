#!/usr/bin/env node

/**
 * Generate Secure Secrets for TOTAL EVIL
 * 
 * This script generates cryptographically secure random values for:
 * - JWT_SECRET (Access Token)
 * - JWT_SECRET_REFRESH (Refresh Token)
 * 
 * Run: node scripts/generate-secrets.js
 * Then copy outputs to .env file
 */

const crypto = require('crypto');

console.log('🔐 TOTAL EVIL Security Secret Generator\n');
console.log('=' .repeat(60));

// Generate JWT secrets
const jwtSecret = crypto.randomBytes(32).toString('hex');
const jwtSecretRefresh = crypto.randomBytes(32).toString('hex');

console.log('\n✅ JWT_SECRET (Access Token - 1 hour expiry):\n');
console.log(jwtSecret);

console.log('\n✅ JWT_SECRET_REFRESH (Refresh Token - 7 day expiry):\n');
console.log(jwtSecretRefresh);

console.log('\n' + '=' .repeat(60));
console.log('\n📋 Instructions:\n');
console.log('1. Open .env file');
console.log('2. Replace JWT_SECRET with the first value above');
console.log('3. Replace JWT_SECRET_REFRESH with the second value above');
console.log('4. Save file (DO NOT commit .env to git)');
console.log('5. Restart server\n');

// Show optional additional secrets
console.log('(' .repeat(60));
console.log('\n🔒 Additional Optional Secrets:\n');

const redisPassword = crypto.randomBytes(16).toString('hex');
const sessionSecret = crypto.randomBytes(32).toString('hex');

console.log('Redis Password (if needed):');
console.log(redisPassword);

console.log('\nSession Secret (for session middleware):');
console.log(sessionSecret);

console.log('\n' + '='.repeat(60));
console.log('\n✨ Secrets generated successfully!');
console.log('⚠️  Keep these values secure - never share or commit them\n');
