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

		if (!inL1 && !inL2) {
			return { execute: false, promptRequired: true, reason: `Command '${fullCommandStr}' is not whitelisted for Level ${config.yoloLevel}.` };
		}

		return { execute: true, promptRequired: false };
	}
}
