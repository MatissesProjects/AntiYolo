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
}
