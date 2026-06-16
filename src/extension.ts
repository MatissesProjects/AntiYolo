import * as vscode from 'vscode';
import { CommandInterceptor } from './interceptor';
import { AntiYoloDashboard } from './dashboard';
import { AntiYoloStatusBar } from './statusbar';

export function activate(context: vscode.ExtensionContext) {
	console.log('AntiYolo extension is now active!');
	
	const interceptor = new CommandInterceptor(context);
	interceptor.register();

	const statusBar = new AntiYoloStatusBar(context);

	const dashboardDisposable = vscode.commands.registerCommand('antiyolo.showDashboard', () => {
		AntiYoloDashboard.show(context);
	});
	context.subscriptions.push(dashboardDisposable);

	const showMenuDisposable = vscode.commands.registerCommand('antiyolo.showMenu', () => {
		statusBar.showMenu();
	});
	context.subscriptions.push(showMenuDisposable);

	const toggleEnabledDisposable = vscode.commands.registerCommand('antiyolo.toggleEnabled', async () => {
		const configObj = vscode.workspace.getConfiguration('antiyolo');
		const current = configObj.get<boolean>('enabled', true);
		await configObj.update('enabled', !current, vscode.ConfigurationTarget.Global);
		vscode.window.showInformationMessage(`AntiYolo command safety is now ${!current ? 'Enabled' : 'Bypassed'}.`);
	});
	context.subscriptions.push(toggleEnabledDisposable);

	const toggleRestrictDisposable = vscode.commands.registerCommand('antiyolo.toggleRestrictToWorkspace', async () => {
		const configObj = vscode.workspace.getConfiguration('antiyolo');
		const current = configObj.get<boolean>('restrictToWorkspace', true);
		await configObj.update('restrictToWorkspace', !current, vscode.ConfigurationTarget.Global);
		vscode.window.showInformationMessage(`Workspace Safety Boundary is now ${!current ? 'Enabled' : 'Disabled'}.`);
	});
	context.subscriptions.push(toggleRestrictDisposable);
}

export function deactivate() {}
