import * as vscode from 'vscode';
import { YoloLevel, AntiYoloConfig } from './types';

export function getConfig(): AntiYoloConfig {
	const config = vscode.workspace.getConfiguration('antiyolo');
	const levelVal = config.get<number>('yoloLevel', 0);
	
	let yoloLevel = YoloLevel.Interactive;
	if (levelVal >= 0 && levelVal <= 3) {
		yoloLevel = levelVal as YoloLevel;
	}

	const whitelist = config.get<string[]>('whitelist', []);
	const timeoutSeconds = config.get<number>('timeoutSeconds', 15);

	const allowPackageOps = config.get<boolean>('allowPackageOps', false);
	const allowedPackageActions = config.get<string[]>('allowedPackageActions', ["install", "ci", "update"]);
	const allowTestOps = config.get<boolean>('allowTestOps', false);
	const allowedTestActions = config.get<string[]>('allowedTestActions', ["test", "pytest", "jest", "vitest"]);
	const allowBuildOps = config.get<boolean>('allowBuildOps', false);
	const allowedBuildActions = config.get<string[]>('allowedBuildActions', ["tsc", "build", "make"]);
	const allowGitOps = config.get<boolean>('allowGitOps', false);
	const allowedGitActions = config.get<string[]>('allowedGitActions', ["add", "commit", "push", "checkout", "branch", "status", "diff"]);
	const allowFileOps = config.get<boolean>('allowFileOps', false);
	const allowedFileActions = config.get<string[]>('allowedFileActions', ["mkdir", "touch"]);
	const restrictToWorkspace = config.get<boolean>('restrictToWorkspace', true);
	const workspaceFolders = vscode.workspace.workspaceFolders?.map(f => f.uri.fsPath) || [];

	return {
		yoloLevel,
		whitelist,
		timeoutSeconds,
		allowPackageOps,
		allowedPackageActions,
		allowTestOps,
		allowedTestActions,
		allowBuildOps,
		allowedBuildActions,
		allowGitOps,
		allowedGitActions,
		allowFileOps,
		allowedFileActions,
		restrictToWorkspace,
		workspaceFolders
	};
}
