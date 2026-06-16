import * as vscode from 'vscode';
import * as path from 'path';
import { getConfig } from './config';
import { CommandLogger, LogEntry } from './logger';

export class AntiYoloDashboard {
	private static currentPanel: vscode.WebviewPanel | undefined;

	public static async show(context: vscode.ExtensionContext) {
		const column = vscode.window.activeTextEditor
			? vscode.window.activeTextEditor.viewColumn
			: undefined;

		if (AntiYoloDashboard.currentPanel) {
			AntiYoloDashboard.currentPanel.reveal(column);
			this.sendState();
			return;
		}

		const panel = vscode.window.createWebviewPanel(
			'antiyoloDashboard',
			'AntiYolo Dashboard',
			column || vscode.ViewColumn.One,
			{
				enableScripts: true,
				localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'src'))],
				retainContextWhenHidden: true
			}
		);

		AntiYoloDashboard.currentPanel = panel;

		// Read HTML template
		try {
			const htmlUri = vscode.Uri.file(path.join(context.extensionPath, 'src', 'media', 'dashboard.html'));
			const htmlDoc = await vscode.workspace.fs.readFile(htmlUri);
			panel.webview.html = htmlDoc.toString();
		} catch (e) {
			panel.webview.html = `<h3>Error loading dashboard: ${(e as Error).message}</h3>`;
		}

		// Handle messages from the webview
		const messageDisposable = panel.webview.onDidReceiveMessage(async (message) => {
			const config = vscode.workspace.getConfiguration('antiyolo');
			switch (message.type) {
				case 'ready':
					this.sendState();
					break;
				case 'updateConfig':
					await config.update(message.key, message.value, vscode.ConfigurationTarget.Global);
					break;
				case 'addWhitelist': {
					const list = config.get<string[]>('whitelist', []);
					if (message.command && !list.includes(message.command)) {
						list.push(message.command);
						await config.update('whitelist', list, vscode.ConfigurationTarget.Global);
					}
					break;
				}
				case 'removeWhitelist': {
					let list = config.get<string[]>('whitelist', []);
					list = list.filter(item => item !== message.command);
					await config.update('whitelist', list, vscode.ConfigurationTarget.Global);
					break;
				}
				case 'clearLogs':
					CommandLogger.getInstance().clear();
					break;
				case 'triggerMockCommand':
					// Trigger a mock run for testing the audit log in dev mode
					vscode.commands.executeCommand('antiyolo.runCommand', JSON.stringify({
						command: message.command,
						args: message.args || []
					}));
					break;
			}
		});

		// Subscribe to logs updates
		const logListener = (logs: LogEntry[]) => {
			panel.webview.postMessage({ type: 'logs', logs });
		};
		CommandLogger.getInstance().addListener(logListener);

		// Subscribe to vscode config changes
		const configDisposable = vscode.workspace.onDidChangeConfiguration((e) => {
			if (e.affectsConfiguration('antiyolo')) {
				this.sendState();
			}
		});

		panel.onDidDispose(() => {
			messageDisposable.dispose();
			configDisposable.dispose();
			CommandLogger.getInstance().removeListener(logListener);
			AntiYoloDashboard.currentPanel = undefined;
		});
	}

	private static sendState() {
		if (!AntiYoloDashboard.currentPanel) return;
		const config = getConfig();
		const logs = CommandLogger.getInstance().getLogs();
		AntiYoloDashboard.currentPanel.webview.postMessage({
			type: 'state',
			config,
			logs
		});
	}
}
