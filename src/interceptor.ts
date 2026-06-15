import * as vscode from 'vscode';
import { AntiYoloConfig } from './config';
import { CommandValidator } from './validator';

export class CommandInterceptor {
	constructor(private context: vscode.ExtensionContext) {}

	public register() {
		console.log('Command Interceptor registered.');
		// TODO: Register VS Code execution interception hooks here
	}
}
