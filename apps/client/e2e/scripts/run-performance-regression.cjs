#!/usr/bin/env node

/**
 * Performance Regression Testing Script
 * 
 * This script orchestrates performance regression testing that works both locally and in CI.
 * It handles the alternating measurement pattern and comparison logic.
 * 
 * Usage:
 *   node run-performance-regression.js [options]
 * 
 * Options:
 *   --base <commit/branch>     Base commit/branch to compare against (default: main)
 *   --iterations <number>      Number of iterations per branch (default: 5)
 *   --quick                   Run quick test (fewer scenarios, fewer iterations)
 *   --scenarios <list>        Comma-separated list of scenarios to test
 *   --ci                      Run in CI mode (expects base and current builds)
 *   --help                    Show this help message
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const DEFAULT_BASE = 'main';
const DEFAULT_ITERATIONS = 5;
const QUICK_ITERATIONS = 3;

const SCENARIOS = [
    'homepage',
    'dashboard',
    'upload',
    'docs',
    'pricing'
];

const QUICK_SCENARIOS = [
    'homepage',
    'dashboard'
];

class PerformanceRegressionRunner {
    constructor(options = {}) {
        this.options = {
            base: options.base || DEFAULT_BASE,
            iterations: options.iterations || (options.quick ? QUICK_ITERATIONS : DEFAULT_ITERATIONS),
            quick: options.quick || false,
            scenarios: options.scenarios || (options.quick ? QUICK_SCENARIOS : SCENARIOS),
            ci: options.ci || false,
            ...options
        };

        this.tempDir = path.join(os.tmpdir(), `perf-regression-${Date.now()}`);
        this.currentDir = process.cwd();
        this.clientDir = path.resolve('apps/client');
    }

    async run() {
        console.log('🚀 Starting Performance Regression Testing');
        console.log(`📊 Configuration:`);
        console.log(`   Base: ${this.options.base}`);
        console.log(`   Iterations: ${this.options.iterations}`);
        console.log(`   Scenarios: ${this.options.scenarios.join(', ')}`);
        console.log(`   Mode: ${this.options.ci ? 'CI' : 'Local'}`);
        console.log('');

        try {
            if (this.options.ci) {
                await this.runCIMode();
            } else {
                await this.runLocalMode();
            }
        } catch (error) {
            console.error('❌ Performance regression testing failed:', error.message);
            process.exit(1);
        } finally {
            this.cleanup();
        }
    }

    async runCIMode() {
        console.log('🏗️ Running in CI mode (expecting pre-built base and current versions)');

        // In CI mode, we expect the environment to have both builds available
        // This delegates to the existing Playwright test
        await this.runPlaywrightTest({
            env: {
                PERFORMANCE_TEST: 'true',
                PERFORMANCE_ITERATIONS: this.options.iterations.toString(),
                PERFORMANCE_SCENARIOS: this.options.scenarios.join(','),
                CI: 'true'
            },
            grep: 'CI Performance Comparison'
        });
    }

    async runLocalMode() {
        console.log('🏗️ Running in local mode');

        // Check if we're in a git repository
        try {
            execSync('git rev-parse --git-dir', { stdio: 'ignore' });
        } catch {
            throw new Error('Not in a git repository. Performance regression testing requires git.');
        }

        // Stash current changes if any
        const hasChanges = this.hasUncommittedChanges();
        if (hasChanges) {
            console.log('💾 Stashing uncommitted changes...');
            execSync('git stash push -m "Performance regression test stash"', { stdio: 'inherit' });
        }

        try {
            // Get current branch/commit
            const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
            const currentCommit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();

            console.log(`📍 Current: ${currentBranch} (${currentCommit.substring(0, 8)})`);

            // Check if base exists
            try {
                execSync(`git rev-parse ${this.options.base}`, { stdio: 'ignore' });
            } catch {
                throw new Error(`Base branch/commit '${this.options.base}' not found`);
            }

            // Create results directory
            const resultsDir = path.join(this.clientDir, 'e2e/results');
            if (!fs.existsSync(resultsDir)) {
                fs.mkdirSync(resultsDir, { recursive: true });
            }

            // Prepare base build
            console.log(`🔄 Switching to base: ${this.options.base}`);
            execSync(`git checkout ${this.options.base}`, { stdio: 'inherit' });

            console.log('📦 Installing dependencies for base...');
            execSync('yarn install --frozen-lockfile', { stdio: 'inherit' });

            console.log('🏗️ Building base version...');
            execSync('yarn nx build client', { stdio: 'inherit' });

            // Copy base build
            const baseBuildDir = path.join(this.tempDir, 'base');
            fs.mkdirSync(baseBuildDir, { recursive: true });
            execSync(`cp -r ${path.join(this.clientDir, 'dist')} ${baseBuildDir}/`, { stdio: 'inherit' });

            // Return to current branch and build
            console.log(`🔄 Switching back to current version...`);
            execSync(`git checkout ${currentBranch}`, { stdio: 'inherit' });

            console.log('📦 Installing dependencies for current...');
            execSync('yarn install --frozen-lockfile', { stdio: 'inherit' });

            console.log('🏗️ Building current version...');
            execSync('yarn nx build client', { stdio: 'inherit' });

            // Copy current build
            const currentBuildDir = path.join(this.tempDir, 'current');
            fs.mkdirSync(currentBuildDir, { recursive: true });
            execSync(`cp -r ${path.join(this.clientDir, 'dist')} ${currentBuildDir}/`, { stdio: 'inherit' });

            // Run performance comparison
            console.log('⚡ Running performance regression tests...');
            await this.runPlaywrightTest({
                env: {
                    PERFORMANCE_TEST: 'true',
                    PERFORMANCE_ITERATIONS: this.options.iterations.toString(),
                    PERFORMANCE_SCENARIOS: this.options.scenarios.join(','),
                    PERFORMANCE_BASE_BUILD: path.join(baseBuildDir, 'dist'),
                    PERFORMANCE_CURRENT_BUILD: path.join(currentBuildDir, 'dist'),
                    LOCAL_MODE: 'true'
                },
                grep: 'Local Performance Comparison'
            });

        } finally {
            // Restore stashed changes if any
            if (hasChanges) {
                console.log('🔄 Restoring stashed changes...');
                try {
                    execSync('git stash pop', { stdio: 'inherit' });
                } catch {
                    console.warn('⚠️ Could not restore stash automatically. Check git stash list.');
                }
            }
        }
    }

    hasUncommittedChanges() {
        try {
            execSync('git diff-index --quiet HEAD --', { stdio: 'ignore' });
            return false;
        } catch {
            return true;
        }
    }

    async runPlaywrightTest(options = {}) {
        return new Promise((resolve, reject) => {
            const args = ['test', 'e2e/specs/performance-regression.spec.ts'];

            if (options.grep) {
                args.push('--grep', options.grep);
            }

            const child = spawn('npx', ['playwright', ...args], {
                cwd: this.clientDir,
                stdio: 'inherit',
                env: {
                    ...process.env,
                    ...options.env
                }
            });

            child.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`Playwright test failed with code ${code}`));
                }
            });

            child.on('error', reject);
        });
    }

    cleanup() {
        if (fs.existsSync(this.tempDir)) {
            console.log('🧹 Cleaning up temporary files...');
            fs.rmSync(this.tempDir, { recursive: true, force: true });
        }
    }
}

// Parse command line arguments
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {};

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        if (arg === '--help') {
            console.log(`
Performance Regression Testing Script

Usage: node run-performance-regression.js [options]

Options:
  --base <commit/branch>     Base commit/branch to compare against (default: main)
  --iterations <number>      Number of iterations per branch (default: 5)
  --quick                   Run quick test (fewer scenarios, fewer iterations)
  --scenarios <list>        Comma-separated list of scenarios to test
  --ci                      Run in CI mode (expects base and current builds)
  --help                    Show this help message

Examples:
  node run-performance-regression.js                    # Compare current branch against main
  node run-performance-regression.js --base develop     # Compare against develop branch
  node run-performance-regression.js --quick            # Quick test with fewer iterations
  node run-performance-regression.js --ci               # Run in CI mode
  node run-performance-regression.js --scenarios homepage,dashboard  # Test specific scenarios
      `);
            process.exit(0);
        } else if (arg === '--base' && i + 1 < args.length) {
            options.base = args[++i];
        } else if (arg === '--iterations' && i + 1 < args.length) {
            options.iterations = parseInt(args[++i], 10);
        } else if (arg === '--scenarios' && i + 1 < args.length) {
            options.scenarios = args[++i].split(',').map(s => s.trim());
        } else if (arg === '--quick') {
            options.quick = true;
        } else if (arg === '--ci') {
            options.ci = true;
        }
    }

    return options;
}

// Main execution
if (require.main === module) {
    const options = parseArgs();
    const runner = new PerformanceRegressionRunner(options);
    runner.run().catch((error) => {
        console.error('💥 Unexpected error:', error);
        process.exit(1);
    });
}

module.exports = { PerformanceRegressionRunner }; 