import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';

interface HookInput {
  session_id: string;
  cwd: string;
  hook_event_name: string;
  tool_name: string;
  tool_input: {
    command?: string;
  };
}

function main() {
  const input: HookInput = JSON.parse(readFileSync(0, 'utf-8'));
  const command = (input.tool_input?.command || '').trim();

  // Only guard git push and gh pr create
  const isPush = /^\s*git push/.test(command);
  const isPrCreate = /^\s*gh pr create/.test(command);
  if (!isPush && !isPrCreate) {
    process.exit(0);
  }

  const projectDir = process.env.CLAUDE_PROJECT_DIR || input.cwd;
  const markerPath = join(projectDir, '.claude', '.pre-push-approved');

  if (!existsSync(markerPath)) {
    process.stderr.write(
      '❌ BLOCKED: Pre-push checklist not completed.\n\n' +
      'Before pushing or creating a PR, you MUST run:\n' +
      '  1. /simplify — review changed code for reuse, quality, efficiency\n' +
      '  2. /requesting-code-review — run code review (CodeRabbit or manual)\n\n' +
      'After both pass, create the approval marker:\n' +
      '  git rev-parse HEAD > .claude/.pre-push-approved\n'
    );
    process.exit(2);
  }

  // Marker exists — check if it matches current HEAD
  const approvedSha = readFileSync(markerPath, 'utf-8').trim();
  let currentSha = 'unknown';
  try {
    currentSha = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    // If git fails, allow push (don't block on edge cases)
    process.exit(0);
  }

  if (approvedSha !== currentSha) {
    process.stderr.write(
      `❌ BLOCKED: Pre-push approval is stale (approved: ${approvedSha.slice(0, 8)}, HEAD: ${currentSha.slice(0, 8)}).\n\n` +
      'New commits were made after the review. Run again:\n' +
      '  1. /simplify\n' +
      '  2. /requesting-code-review\n\n' +
      'Then update the marker:\n' +
      '  git rev-parse HEAD > .claude/.pre-push-approved\n'
    );
    process.exit(2);
  }

  // All good — approved SHA matches HEAD
  process.exit(0);
}

main();
