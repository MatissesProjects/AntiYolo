import * as vscode from 'vscode';
import { CommandInterceptor } from './interceptor';
import { AntiYoloDashboard } from './dashboard';
import { AntiYoloStatusBar } from './statusbar';
import { LocalApprovalServer } from './server';
import { getConfig } from './config';

let approvalServer: LocalApprovalServer | undefined;

export function activate(context: vscode.ExtensionContext) {
	console.log('AntiYolo extension is now active!');
	
	approvalServer = new LocalApprovalServer();
	const config = getConfig();
	approvalServer.start(config.localServerPort).catch(err => {
		vscode.window.showErrorMessage(`Failed to start AntiYolo Local Approval Server: ${err.message}`);
	});

	const interceptor = new CommandInterceptor(context, approvalServer);
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

	const configChangeDisposable = vscode.workspace.onDidChangeConfiguration(async (e) => {
		if (e.affectsConfiguration('antiyolo.localServerPort') && approvalServer) {
			const newConfig = getConfig();
			await approvalServer.stop();
			try {
				await approvalServer.start(newConfig.localServerPort);
				vscode.window.showInformationMessage(`AntiYolo Local Server started on port ${newConfig.localServerPort}`);
			} catch (err) {
				vscode.window.showErrorMessage(`Failed to restart AntiYolo Local Server on port ${newConfig.localServerPort}: ${(err as Error).message}`);
			}
		}
	});
	context.subscriptions.push(configChangeDisposable);
}

export async function deactivate() {
	if (approvalServer) {
		await approvalServer.stop();
	}
}
