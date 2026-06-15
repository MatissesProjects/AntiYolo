import { AntiYoloConfig, YoloLevel } from './types';
import { parseCommand } from './parser';

export interface ValidationResult {
	execute: boolean;
	promptRequired: boolean;
	reason?: string;
}

const BLACKLIST = ['rm', 'mkfs', 'dd', 'shutdown', 'reboot', 'mv'];
const LEVEL1_WHITELIST = ['cat', 'ls', 'pwd', 'grep', 'git status', 'git diff', 'echo'];

export class CommandValidator {
	public static validate(commandLine: string, config: AntiYoloConfig): ValidationResult {
		const commands = parseCommand(commandLine);

		// Check for blacklisted commands (Level 3 protection)
		for (const cmd of commands) {
			const tokens = cmd.split(/\s+/);
			const baseCmd = tokens[0];
			
			if (BLACKLIST.includes(baseCmd)) {
				return { execute: false, promptRequired: true, reason: `Command '${cmd}' contains blacklisted executable '${baseCmd}'.` };
			}
		}

		if (config.yoloLevel === YoloLevel.Interactive) {
			return { execute: false, promptRequired: true, reason: 'Interactive Level (0) requires prompt.' };
		}

		if (config.yoloLevel === YoloLevel.Full) {
			return { execute: true, promptRequired: false };
		}

		// Level 1 or 2 logic
		const isLevel2 = config.yoloLevel === YoloLevel.Scoped;
		const customWhitelist = config.whitelist || [];

		for (const cmd of commands) {
			const tokens = cmd.split(/\s+/);
			const baseCmd = tokens[0];

			let inL1 = LEVEL1_WHITELIST.includes(baseCmd);
			if (baseCmd === 'git' && tokens.length > 1) {
				inL1 = inL1 || LEVEL1_WHITELIST.includes(`git ${tokens[1]}`);
			}

			let inL2 = false;
			if (isLevel2) {
				for (const allowed of customWhitelist) {
					// Add a space to ensure we match full words (e.g., 'npm install' matches 'npm install', 'npm install x', but not 'npm install-x')
					if (cmd === allowed || cmd.startsWith(allowed + ' ')) {
						inL2 = true;
						break;
					}
				}
			}

			if (!inL1 && !inL2) {
				return { execute: false, promptRequired: true, reason: `Command '${cmd}' is not whitelisted for Level ${config.yoloLevel}.` };
			}
		}

		return { execute: true, promptRequired: false };
	}
}
