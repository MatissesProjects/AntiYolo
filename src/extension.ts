import * as vscode from 'vscode';
import { CommandInterceptor } from './interceptor';

export function activate(context: vscode.ExtensionContext) {
	console.log('AntiYolo extension is now active!');
	
	const interceptor = new CommandInterceptor(context);
	interceptor.register();
}

export function deactivate() {}
