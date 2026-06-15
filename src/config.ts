import * as vscode from 'vscode';

export enum YoloLevel {
	Interactive = 0,
	ReadOnly = 1,
	Scoped = 2,
	Full = 3
}

export interface AntiYoloConfig {
	yoloLevel: YoloLevel;
	whitelist: string[];
}

export function getConfig(): AntiYoloConfig {
	const config = vscode.workspace.getConfiguration('antiyolo');
	const levelVal = config.get<number>('yoloLevel', 0);
	
	let yoloLevel = YoloLevel.Interactive;
	if (levelVal >= 0 && levelVal <= 3) {
		yoloLevel = levelVal as YoloLevel;
	}

	const whitelist = config.get<string[]>('whitelist', []);

	return {
		yoloLevel,
		whitelist
	};
}
