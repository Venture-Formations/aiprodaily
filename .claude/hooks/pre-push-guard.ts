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

/**
 * File patterns that trigger agent gates.
 * Each gate defines which changed files require which agent to have been run.
 */
interface AgentGate {
  name: string;
  markerFile: string;
  filePatterns: RegExp[];
  agent: string;
  description: string;
}

const AGENT_GATES: AgentGate[] = [
  {
    name: 'security-auditor',
    markerFile: '.security-auditor-approved',
    filePatterns: [
      /src\/app\/api\/(?:account|webhooks|stripe|cron)\//,
      /src\/app\/api\/.*route\.ts$/,
      /src\/lib\/(?:auth|env-guard|bot-detection)\//,
      /src\/lib\/api-handler\.ts$/,
      /src\/lib\/auth-tiers\.ts$/,
      /middleware\.ts$/,
      /\.env/,
    ],
    agent: 'security-auditor',
    description: 'auth, payment, API route, or security-related files',
  },
  {
    name: 'database-optimizer',
    markerFile: '.database-optimizer-approved',
    filePatterns: [
      /db\/migrations\//,
      /src\/lib\/dal\//,
      /\.sql$/,
    ],
    agent: 'database-optimizer',
    description: 'database migrations, DAL files, or SQL files',
  },
];

function getChangedFiles(projectDir: string): string[] {
  try {
    // Get the merge-base with master to find all files changed in this branch
    const mergeBase = execSync('git merge-base HEAD master', {
      encoding: 'utf-8',
      cwd: projectDir,
    }).trim();

    const diff = execSync(`git diff --name-only ${mergeBase}...HEAD`, {
      encoding: 'utf-8',
      cwd: projectDir,
    }).trim();

    if (!diff) return [];
    return diff.split('\n').filter(Boolean);
  } catch {
    // If merge-base fails (e.g., on master itself), check staged + unstaged
    try {
      const diff = execSync('git diff --name-only HEAD~1', {
        encoding: 'utf-8',
        cwd: projectDir,
      }).trim();
      if (!diff) return [];
      return diff.split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }
}

function checkAgentGates(projectDir: string, currentSha: string): string[] {
  const changedFiles = getChangedFiles(projectDir);
  if (changedFiles.length === 0) return [];

  const blockers: string[] = [];

  for (const gate of AGENT_GATES) {
    // Check if any changed files match this gate's patterns
    const matchingFiles = changedFiles.filter((f) =>
      gate.filePatterns.some((pattern) => pattern.test(f))
    );

    if (matchingFiles.length === 0) continue;

    // Check if the agent marker exists and matches current HEAD
    const markerPath = join(projectDir, '.claude', gate.markerFile);
    let approved = false;

    try {
      const markerSha = readFileSync(markerPath, 'utf-8').trim();
      approved = markerSha === currentSha;
    } catch {
      // Marker doesn't exist
    }

    if (!approved) {
      const fileList = matchingFiles.slice(0, 5).map((f) => `    - ${f}`).join('\n');
      const moreCount = matchingFiles.length > 5 ? `\n    ... and ${matchingFiles.length - 5} more` : '';

      blockers.push(
        `  ${gate.name}: You changed ${gate.description}:\n` +
        `${fileList}${moreCount}\n\n` +
        `  Run the ${gate.agent} agent, then create the marker:\n` +
        `    git rev-parse HEAD > .claude/${gate.markerFile}\n`
      );
    }
  }

  return blockers;
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

  // --- Check 1: Code review approval (existing gate) ---
  const reviewMarkerPath = join(projectDir, '.claude', '.pre-push-approved');

  let approvedSha: string;
  try {
    approvedSha = readFileSync(reviewMarkerPath, 'utf-8').trim();
  } catch {
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

  // --- Check 2: Review gate (persona-based review) ---
  const reviewGateMarkerPath = join(projectDir, '.claude', '.review-gate-approved');

  let reviewGateApproved = false;
  try {
    const reviewGateSha = readFileSync(reviewGateMarkerPath, 'utf-8').trim();
    reviewGateApproved = reviewGateSha === currentSha;
  } catch {
    // Marker doesn't exist
  }

  if (!reviewGateApproved) {
    process.stderr.write(
      '❌ BLOCKED: Review gate not passed.\n\n' +
      'Before pushing, run the pre-push review gate:\n' +
      '  /review-pre-push\n\n' +
      'This runs security, junior-dev, dba, ops, layout, usability, and qa\n' +
      'reviewers against your changes. Push is blocked if Critical issues are found.\n\n' +
      'After the gate passes, the marker is created automatically.\n'
    );
    process.exit(2);
  }

  // --- Check 3: Agent gates based on changed files ---
  const agentBlockers = checkAgentGates(projectDir, currentSha);

  if (agentBlockers.length > 0) {
    process.stderr.write(
      '❌ BLOCKED: Agent review required for sensitive file changes.\n\n' +
      agentBlockers.join('\n') +
      '\nRun the required agents before pushing.\n'
    );
    process.exit(2);
  }

  // All good — approved SHA matches HEAD and all gates passed
  process.exit(0);
}

main();
