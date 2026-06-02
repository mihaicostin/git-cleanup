#!/usr/bin/env node

const { execSync } = require('child_process');
const readline = require('readline');

// Colors for output
const colors = {
  red: '\x1b[0;31m',
  green: '\x1b[0;32m',
  yellow: '\x1b[1;33m',
  reset: '\x1b[0m'
};

function exec(command) {
  try {
    return execSync(command, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (error) {
    return null;
  }
}

function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  console.log('🧹 Git Branch Cleanup Tool');
  console.log('==========================');
  console.log('');

  // Check if we're in a git repository
  if (!exec('git rev-parse --git-dir')) {
    console.log(`${colors.red}Error: Not a git repository${colors.reset}`);
    process.exit(1);
  }

  // Fetch latest from remote
  console.log('Fetching latest from remote...');
  execSync('git fetch --prune', { stdio: 'inherit' });

  // Determine main branch (main or master)
  let mainBranch = '';
  if (exec('git rev-parse --verify main')) {
    mainBranch = 'main';
  } else if (exec('git rev-parse --verify master')) {
    mainBranch = 'master';
  } else {
    console.log(`${colors.red}Error: Could not find 'main' or 'master' branch${colors.reset}`);
    process.exit(1);
  }

  console.log(`Using '${mainBranch}' as the main branch`);
  console.log('');

  // Get current branch to avoid deleting it
  const currentBranch = exec('git rev-parse --abbrev-ref HEAD');

  // Get list of local branches
  const localBranches = exec('git branch')
    .split('\n')
    .map(b => b.replace(/^[* ]*/, '').trim())
    .filter(b => b);

  let deletedCount = 0;
  let skippedCount = 0;

  for (const branch of localBranches) {
    // Skip main/master and current branch
    if (branch === mainBranch || branch === currentBranch) {
      continue;
    }

    // Check if branch exists on remote
    const remoteExists = exec(`git show-ref --verify refs/remotes/origin/${branch}`);

    if (!remoteExists) {
      console.log(`${colors.yellow}Branch '${branch}' not found on remote${colors.reset}`);

      // Check if branch is merged into main
      const isMerged = exec(`git merge-base --is-ancestor ${branch} ${mainBranch}`);

      if (isMerged !== null && isMerged.trim().length > 0) {
        // Branch is merged, delete without asking
        console.log(`${colors.green}✓ Branch is merged into ${mainBranch} - deleting${colors.reset}`);
        exec(`git branch -d ${branch}`);
        deletedCount++;
      } else {
        // Branch is not merged, ask user
        console.log(`${colors.red}⚠ Branch is NOT merged into ${mainBranch}${colors.reset}`);
        const answer = await prompt(`Delete '${branch}'? [y/N] `);

        if (answer.toLowerCase() === 'y') {
          exec(`git branch -D ${branch}`);
          console.log(`${colors.green}✓ Deleted${colors.reset}`);
          deletedCount++;
        } else {
          console.log('Skipped');
          skippedCount++;
        }
      }
      console.log('');
    }
  }

  console.log('==========================');
  console.log(`${colors.green}Deleted: ${deletedCount}${colors.reset}`);
  console.log(`Skipped: ${skippedCount}`);
  console.log('Done!');
}

main().catch((error) => {
  console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
  process.exit(1);
});
