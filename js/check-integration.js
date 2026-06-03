#!/usr/bin/env node

/**
 * 📋 INTEGRATION CHECKLIST
 * 
 * Questo file mostra lo stato dell'integrazione del sistema di progressi
 * in tutte le pagine HTML della piattaforma EVIL.
 */

const fs = require('fs');
const path = require('path');

const htmlDir = path.join(__dirname, 'html');
const pmScript = '../js/progress-manager.js';

const files = [
  // Autenticazione
  { name: 'login.html', category: 'Auth' },
  { name: 'account.html', category: 'Auth' },
  { name: 'profile.html', category: 'Auth' },
  
  // Strumenti (Tools)
  { name: 'security-check.html', category: 'Tools', trigger: 'scan' },
  { name: 'domain-recon.html', category: 'Tools' },
  { name: 'dns-enumerator.html', category: 'Tools', trigger: 'dns_enumeration' },
  { name: 'subdomain-finder.html', category: 'Tools', trigger: 'subdomain_search' },
  { name: 'ssl-analyzer.html', category: 'Tools', trigger: 'ssl_analysis' },
  { name: 'vulnerability-scanner.html', category: 'Tools', trigger: 'vulnerability_found' },
  { name: 'file-analysis.html', category: 'Tools', trigger: 'file_analysis' },
  { name: 'report-generator.html', category: 'Tools', trigger: 'report_generated' },
  { name: 'osint-hub.html', category: 'OSINT' },
  
  // Database
  { name: 'malware-db.html', category: 'Database', trigger: 'malware_viewed' },
  { name: 'malware-classification.html', category: 'Database', trigger: 'malware_identified' },
  { name: 'manipulation-techniques.html', category: 'Database' },
  { name: 'historic-attacks.html', category: 'Database' },
  
  // Attacchi (Attacks)
  { name: 'attacks-map.html', category: 'Attacks', trigger: 'attacks_map_viewed' },
  { name: 'web-simulator.html', category: 'Attacks', trigger: 'attack_simulated' },
  { name: 'hacked-timeline.html', category: 'Education', trigger: 'incident_timeline_completed' },
  
  // Educazione (Education)
  { name: 'quiz-hub.html', category: 'Education', trigger: 'phishing_quiz_completed / social_engineering_completed' },
  { name: 'crypto-studio.html', category: 'Education', trigger: 'crypto_study_completed' },
  { name: 'virtual-lab.html', category: 'Education', trigger: 'lab_completed' },

  // OSINT
  { name: 'social-profiling.html', category: 'OSINT', trigger: 'osint_collection' },
  { name: 'public-info.html', category: 'OSINT', trigger: 'public_info_collected' },
];

console.log('\n' + '═'.repeat(100));
console.log('📊 SYSTEM PROGRESS - ACHIEVEMENT INTEGRATION STATUS');
console.log('═'.repeat(100) + '\n');

let totalFiles = files.length;
let integrated = 0;
let withTrigger = 0;

const byCategory = {};

files.forEach(file => {
  const filePath = path.join(htmlDir, file.name);
  const exists = fs.existsSync(filePath);
  
  if (!exists) {
    console.log(`❌ ${file.name} - NOT FOUND`);
    return;
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  const hasProgressManager = content.includes('../js/progress-manager.js');
  
  if (!byCategory[file.category]) {
    byCategory[file.category] = { total: 0, integrated: 0, withTrigger: 0 };
  }
  byCategory[file.category].total++;
  
  if (hasProgressManager) {
    integrated++;
    byCategory[file.category].integrated++;
    
    const trigger = file.trigger ? ' (trigger: ' + file.trigger + ')' : '';
    console.log(`✅ ${file.name}${trigger}`);
    
    if (file.trigger) {
      withTrigger++;
      byCategory[file.category].withTrigger++;
    }
  } else {
    console.log(`⚠️  ${file.name} - progress-manager.js NOT INTEGRATED`);
  }
});

console.log('\n' + '─'.repeat(100));
console.log('\n📈 SUMMARY BY CATEGORY:\n');

Object.entries(byCategory).forEach(([category, stats]) => {
  const percentage = Math.round((stats.integrated / stats.total) * 100);
  const triggerCount = stats.withTrigger ? ` (${stats.withTrigger} with triggers)` : '';
  const bar = '█'.repeat(Math.round(percentage / 5)) + '░'.repeat(20 - Math.round(percentage / 5));
  console.log(`${category.padEnd(15)} ${bar} ${percentage}% (${stats.integrated}/${stats.total})${triggerCount}`);
});

console.log('\n' + '─'.repeat(100));
console.log('\n📊 OVERALL STATISTICS:\n');
console.log(`Total files: ${totalFiles}`);
console.log(`Files with progress-manager.js: ${integrated} (${Math.round((integrated / totalFiles) * 100)}%)`);
console.log(`Files with activity triggers: ${withTrigger} (${Math.round((withTrigger / totalFiles) * 100)}%)`);

console.log('\n' + '═'.repeat(100) + '\n');

if (integrated === totalFiles) {
  console.log('✅ INTEGRATION COMPLETE! All files have progress-manager.js\n');
} else {
  console.log(`⚠️  ${totalFiles - integrated} files still need progress-manager.js integration\n`);
}

console.log('═'.repeat(100) + '\n');

// Mostra i file che mancano
const missingIntegration = files.filter(file => {
  const filePath = path.join(htmlDir, file.name);
  if (!fs.existsSync(filePath)) return false;
  const content = fs.readFileSync(filePath, 'utf8');
  return !content.includes('../js/progress-manager.js');
});

if (missingIntegration.length > 0) {
  console.log('\n⚠️  FILES NEEDING INTEGRATION:\n');
  missingIntegration.forEach(file => {
    console.log(`  - ${file.name}`);
  });
  console.log('\n');
}

// Mostra i file con trigger disponibili ma non implementati
const noTrigger = files.filter(f => f.trigger && f.name !== 'security-check.html' && f.name !== 'quiz-hub.html');

if (noTrigger.length > 0) {
  console.log('\n💡 FILES WITH RECOMMENDED TRIGGERS:\n');
  noTrigger.forEach(file => {
    console.log(`  - ${file.name.padEnd(35)} → await logActivity('${file.trigger}', { /* details */ });`);
  });
  console.log('\n');
}
