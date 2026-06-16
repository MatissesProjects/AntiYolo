import * as vscode from 'vscode';
import { CommandInterceptor } from './interceptor';
import { AntiYoloDashboard } from './dashboard';

export function activate(context: vscode.ExtensionContext) {
	console.log('AntiYolo extension is now active!');
	
	const interceptor = new CommandInterceptor(context);
	interceptor.register();

	const dashboardDisposable = vscode.commands.registerCommand('antiyolo.showDashboard', () => {
		AntiYoloDashboard.show(context);
	});
	context.subscriptions.push(dashboardDisposable);
}

export function deactivate() {}
