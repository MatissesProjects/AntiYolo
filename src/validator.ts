import { AntiYoloConfig, YoloLevel } from './config';

export interface ValidationResult {
	execute: boolean;
	promptRequired: boolean;
	reason?: string;
}

export class CommandValidator {
	public static validate(commandLine: string, config: AntiYoloConfig): ValidationResult {
		// Placeholder logic: Level 0 always prompts
		if (config.yoloLevel === YoloLevel.Interactive) {
			return {
				execute: false,
				promptRequired: true,
				reason: 'Interactive Level (0) requires prompt'
			};
		}

		// Placeholder for Level 1, 2, 3
		return {
			execute: true,
			promptRequired: false
		};
	}
}
