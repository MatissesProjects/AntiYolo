export enum YoloLevel {
	Interactive = 0,
	ReadOnly = 1,
	Scoped = 2,
	Full = 3
}

export interface AntiYoloConfig {
	yoloLevel: YoloLevel;
	whitelist: string[];
	timeoutSeconds: number;
	allowPackageOps: boolean;
	allowedPackageActions: string[];
	allowTestOps: boolean;
	allowedTestActions: string[];
	allowBuildOps: boolean;
	allowedBuildActions: string[];
	allowGitOps: boolean;
	allowedGitActions: string[];
	allowFileOps: boolean;
	allowedFileActions: string[];
	restrictToWorkspace: boolean;
	workspaceFolders: string[];
	enableDiscord: boolean;
	discordWebhookUrl: string;
	localServerPort: number;
	enabled: boolean;
}
