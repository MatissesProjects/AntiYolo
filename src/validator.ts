import { AntiYoloConfig, YoloLevel } from './types';
import * as path from 'path';

export interface ValidationResult {
	execute: boolean;
	promptRequired: boolean;
	reason?: string;
}

const BLACKLIST = ['rm', 'mkfs', 'dd', 'shutdown', 'reboot', 'mv'];
const LEVEL1_WHITELIST = ['cat', 'ls', 'pwd', 'grep', 'git status', 'git diff', 'echo'];

export class CommandValidator {
	private static unwrap(command: string, args: string[]): { cmd: string, args: string[] } {
		let currentCmd = command;
		let currentArgs = [...args];
		
		while (true) {
			const baseCmd = path.basename(currentCmd);
			if (['sudo', 'npx', 'env'].includes(baseCmd)) {
				if (currentArgs.length === 0) break;
				currentCmd = currentArgs.shift()!;
			} else if (baseCmd === 'bundle' && currentArgs[0] === 'exec') {
				if (currentArgs.length < 2) break;
				currentArgs.shift(); // remove exec
				currentCmd = currentArgs.shift()!;
			} else if (baseCmd === 'npm' && (currentArgs[0] === 'exec' || currentArgs[0] === 'x')) {
				if (currentArgs.length < 2) break;
				currentArgs.shift();
				currentCmd = currentArgs.shift()!;
			} else if (baseCmd === 'yarn' && currentArgs[0] === 'dlx') {
				if (currentArgs.length < 2) break;
				currentArgs.shift();
				currentCmd = currentArgs.shift()!;
			} else {
				break;
			}
		}
		return { cmd: currentCmd, args: currentArgs };
	}

	private static getPackageAction(cmd: string, args: string[]): string | null {
		const base = path.basename(cmd);
		if (['npm', 'yarn', 'pnpm', 'bun'].includes(base)) {
			const sub = args[0];
			if (!sub) return null;
			if (['install', 'i', 'add'].includes(sub)) return 'install';
			if (sub === 'ci') return 'ci';
			if (['update', 'upgrade'].includes(sub)) return 'update';
			if (['uninstall', 'remove'].includes(sub)) return 'uninstall';
		}
		if (['pip', 'pip3'].includes(base)) {
			const sub = args[0];
			if (sub === 'install') {
				if (args.includes('--upgrade') || args.includes('-U')) return 'update';
				return 'install';
			}
			if (sub === 'uninstall') return 'uninstall';
		}
		if (base === 'cargo') {
			const sub = args[0];
			if (['install', 'add'].includes(sub)) return 'install';
			if (sub === 'update') return 'update';
			if (['uninstall', 'rm'].includes(sub)) return 'uninstall';
		}
		if (base === 'go') {
			const sub = args[0];
			if (['get', 'install'].includes(sub)) return 'install';
		}
		return null;
	}

	private static matchCategory(cmd: string, args: string[], config: AntiYoloConfig): boolean {
		const baseExecutable = path.basename(cmd);

		// 1. Package Operations
		if (config.allowPackageOps) {
			const pkgAction = this.getPackageAction(cmd, args);
			if (pkgAction && config.allowedPackageActions.includes(pkgAction)) {
				return true;
			}
		}

		// 2. Git Operations
		if (config.allowGitOps && baseExecutable === 'git') {
			const gitAction = args[0] || '';
			if (gitAction && config.allowedGitActions.includes(gitAction)) {
				return true;
			}
		}

		// 3. Build Operations
		if (config.allowBuildOps) {
			let buildAction: string | null = null;
			if (['tsc', 'make', 'webpack', 'vite', 'gulp', 'grunt'].includes(baseExecutable)) {
				buildAction = baseExecutable;
			} else if (['npm', 'yarn', 'pnpm', 'bun'].includes(baseExecutable)) {
				if (args[0] === 'build' || (args[0] === 'run' && args[1] === 'build')) {
					buildAction = 'build';
				}
			} else if (baseExecutable === 'cargo' && args[0] === 'build') {
				buildAction = 'build';
			} else if (baseExecutable === 'go' && args[0] === 'build') {
				buildAction = 'build';
			} else if (['gradle', 'gradlew'].includes(baseExecutable) || baseExecutable.endsWith('gradlew')) {
				if (args.includes('build') || args.includes('assemble')) {
					buildAction = 'gradle';
				}
			} else if (['mvn', 'mvnw'].includes(baseExecutable) || baseExecutable.endsWith('mvnw')) {
				if (args.includes('package') || args.includes('compile') || args.includes('install')) {
					buildAction = 'maven';
				}
			}

			if (buildAction && config.allowedBuildActions.includes(buildAction)) {
				return true;
			}
		}

		// 4. Test Operations
		if (config.allowTestOps) {
			let testAction: string | null = null;
			if (['pytest', 'jest', 'mocha', 'vitest', 'playwright', 'cypress'].includes(baseExecutable)) {
				testAction = baseExecutable;
			} else if (['npm', 'yarn', 'pnpm', 'bun'].includes(baseExecutable)) {
				if (args[0] === 'test' || args[0] === 't' || (args[0] === 'run' && args[1] === 'test')) {
					testAction = 'test';
				}
			} else if (baseExecutable === 'cargo' && args[0] === 'test') {
				testAction = 'test';
			} else if (baseExecutable === 'go' && args[0] === 'test') {
				testAction = 'test';
			}

			if (testAction && config.allowedTestActions.includes(testAction)) {
				return true;
			}
		}

		// 5. File Operations
		if (config.allowFileOps) {
			if (['mkdir', 'touch', 'cp', 'chmod', 'chown'].includes(baseExecutable)) {
				if (config.allowedFileActions.includes(baseExecutable)) {
					return true;
				}
			}
		}

		return false;
	}

	public static validate(command: string, args: string[], config: AntiYoloConfig): ValidationResult {
		const unwrapped = this.unwrap(command, args);
		const baseExecutable = path.basename(unwrapped.cmd);

		if (BLACKLIST.includes(baseExecutable)) {
			return { execute: false, promptRequired: true, reason: `Command contains blacklisted executable '${baseExecutable}'.` };
		}

		if (config.yoloLevel === YoloLevel.Interactive) {
			return { execute: false, promptRequired: true, reason: 'Interactive Level (0) requires prompt.' };
		}

		if (config.yoloLevel === YoloLevel.Full) {
			return { execute: true, promptRequired: false };
		}

		const isLevel2 = config.yoloLevel === YoloLevel.Scoped;
		const customWhitelist = config.whitelist || [];
		
		const fullCommandStr = [unwrapped.cmd, ...unwrapped.args].join(' ');

		let inL1 = LEVEL1_WHITELIST.includes(baseExecutable);
		if (baseExecutable === 'git' && unwrapped.args.length > 0) {
			inL1 = inL1 || LEVEL1_WHITELIST.includes(`git ${unwrapped.args[0]}`);
		}

		let inL2 = false;
		if (isLevel2) {
			for (const allowed of customWhitelist) {
				if (fullCommandStr === allowed || fullCommandStr.startsWith(allowed + ' ')) {
					inL2 = true;
					break;
				}
			}
		}

		let allowed = false;
		if (config.yoloLevel === YoloLevel.ReadOnly) {
			allowed = inL1;
		} else if (config.yoloLevel === YoloLevel.Scoped) {
			allowed = inL1 || inL2 || this.matchCategory(unwrapped.cmd, unwrapped.args, config);
		}

		if (!allowed) {
			return { execute: false, promptRequired: true, reason: `Command '${fullCommandStr}' is not whitelisted for Level ${config.yoloLevel}.` };
		}

		return { execute: true, promptRequired: false };
	}
}
