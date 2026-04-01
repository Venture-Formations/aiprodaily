#!/usr/bin/env node
/**
 * Safety Guards Hook (UserPromptSubmit)
 *
 * Lightweight checks that run on every prompt:
 * 1. Env Safety — warns if prompt references production resources while on staging branch
 * 2. Multi-tenant Reminder — nudges when prompt involves DB queries or new API routes
 */

const { execSync } = require('child_process');
const fs = require('fs');

function readInput() {
  try {
    return JSON.parse(fs.readFileSync(0, 'utf-8'));
  } catch {
    return {};
  }
}

function getCurrentBranch(cwd) {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', {
      encoding: 'utf-8',
      timeout: 3000,
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return '';
  }
}

const PROD_INDICATORS = [
  'vsbdfrqfokoltgjyiivq',           // production Supabase project ID
  'aiprodaily.supabase.co',          // production Supabase URL
  'aiprodaily.com',                  // production domain
  'SUPABASE_SERVICE_ROLE_KEY',       // could be prod key usage
];

const STAGING_BRANCHES = ['staging', 'staging-test'];

function checkEnvSafety(prompt, cwd) {
  const branch = getCurrentBranch(cwd);
  if (!STAGING_BRANCHES.includes(branch)) return null;

  const lower = prompt.toLowerCase();
  const hits = PROD_INDICATORS.filter(ind => lower.includes(ind.toLowerCase()));

  if (hits.length > 0) {
    return `\u26a0\ufe0f ENV SAFETY: You're on the "${branch}" branch but your prompt references production resources (${hits.join(', ')}). Make sure you're targeting staging (cbnecpswmjonbdatxzwv).`;
  }
  return null;
}

const DB_KEYWORDS = [
  'supabase', 'query', 'select', 'insert', 'update', 'delete',
  'migration', 'schema', 'table', 'rpc', 'from(',
  'api route', 'api endpoint', 'new route', 'create route',
  'dal', 'database',
];

function checkMultiTenant(prompt) {
  const lower = prompt.toLowerCase();
  const hasDbWork = DB_KEYWORDS.some(kw => lower.includes(kw));

  if (hasDbWork) {
    return '\ud83d\udd12 MULTI-TENANT: This looks like DB/API work. Every query must filter by publication_id. No SELECT *.';
  }
  return null;
}

function main() {
  const input = readInput();
  const prompt = input.user_message || input.prompt || '';
  if (!prompt || prompt.length < 5) return;

  const cwd = input.cwd || process.cwd();
  const warnings = [];

  const envWarning = checkEnvSafety(prompt, cwd);
  if (envWarning) warnings.push(envWarning);

  const tenantWarning = checkMultiTenant(prompt);
  if (tenantWarning) warnings.push(tenantWarning);

  if (warnings.length > 0) {
    console.log(warnings.join('\n'));
  }
}

main();
