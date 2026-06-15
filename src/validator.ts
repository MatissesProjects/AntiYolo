import { AntiYoloConfig, YoloLevel } from './types';
import { parseCommand } from './parser';
import * as path from 'path';

export interface ValidationResult {
	execute: boolean;
	promptRequired: boolean;
	reason?: string;
}

const BLACKLIST = ['rm', 'mkfs', 'dd', 'shutdown', 'reboot', 'mv'];
const LEVEL1_WHITELIST = ['cat', 'ls', 'pwd', 'grep', 'git status', 'git diff', 'echo'];

export class CommandValidator {
	private static unwrap(tokens: string[]): string[] {
		let currentTokens = [...tokens];
		while (currentTokens.length > 0) {
			const baseCmd = path.basename(currentTokens[0]);
			if (['sudo', 'npx', 'env'].includes(baseCmd) || currentTokens[0].includes('=')) {
				currentTokens.shift();
			} else if (baseCmd === 'bundle' && currentTokens[1] === 'exec') {
				currentTokens.shift(); currentTokens.shift();
			} else if (baseCmd === 'npm' && (currentTokens[1] === 'exec' || currentTokens[1] === 'x')) {
				currentTokens.shift(); currentTokens.shift();
			} else if (baseCmd === 'yarn' && currentTokens[1] === 'dlx') {
				currentTokens.shift(); currentTokens.shift();
			} else {
				break;
			}
		}
		return currentTokens;
	}

	public static validate(commandLine: string, config: AntiYoloConfig): ValidationResult {
		const commands = parseCommand(commandLine);

		for (const cmd of commands) {
			if (cmd.tokens[0] === '__parse_error__') {
				return { execute: false, promptRequired: true, reason: 'Failed to safely parse the shell command.' };
			}

			const unwrappedTokens = this.unwrap(cmd.tokens);
			if (unwrappedTokens.length === 0) continue;

			const baseExecutable = path.basename(unwrappedTokens[0]);
			if (BLACKLIST.includes(baseExecutable)) {
				return { execute: false, promptRequired: true, reason: `Command contains blacklisted executable '${baseExecutable}'.` };
			}
		}

		if (config.yoloLevel === YoloLevel.Interactive) {
			return { execute: false, promptRequired: true, reason: 'Interactive Level (0) requires prompt.' };
		}

		if (config.yoloLevel === YoloLevel.Full) {
			return { execute: true, promptRequired: false };
		}

		const isLevel2 = config.yoloLevel === YoloLevel.Scoped;
		const customWhitelist = config.whitelist || [];

		for (const cmd of commands) {
			// For whitelist matching, we check the exact unwrapped tokens
			// But wait, what if the user whitelisted `sudo apt-get`? Our unwrap stripped `sudo`. 
			// We should match against the original tokens for whitelist!
			const fullCommandStr = cmd.tokens.join(' ');
			const baseExecutable = path.basename(cmd.tokens[0]);

			let inL1 = LEVEL1_WHITELIST.includes(baseExecutable);
			if (baseExecutable === 'git' && cmd.tokens.length > 1) {
				inL1 = inL1 || LEVEL1_WHITELIST.includes(`git ${cmd.tokens[1]}`);
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
		}

		return { execute: true, promptRequired: false };
	}
}
