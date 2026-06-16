import * as vscode from 'vscode';
import * as path from 'path';
import { getConfig } from './config';
import { CommandLogger, LogEntry } from './logger';
import * as https from 'https';
import * as url from 'url';

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
				case 'testDiscordWebhook': {
					const extConfig = getConfig();
					if (!extConfig.discordWebhookUrl) {
						vscode.window.showErrorMessage('AntiYolo: Discord Webhook URL is not configured.');
						break;
					}
					const payload = {
						embeds: [{
							title: "🛡️ AntiYolo: Test Webhook Alert",
							description: "Your Discord webhook configuration is working perfectly!",
							color: 26214, // clean blue/cyan
							fields: [
								{ name: "Local Server Port", value: String(extConfig.localServerPort), inline: true },
								{ name: "Active YOLO Level", value: ['Interactive', 'Read-Only YOLO', 'Scoped YOLO', 'Full YOLO'][extConfig.yoloLevel], inline: true }
							],
							timestamp: new Date().toISOString()
						}]
					};

					try {
						await this.sendWebhook(extConfig.discordWebhookUrl, payload);
						vscode.window.showInformationMessage('AntiYolo: Test notification sent successfully!');
					} catch (err) {
						vscode.window.showErrorMessage(`AntiYolo: Failed to send test notification: ${(err as Error).message}`);
					}
					break;
				}
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

	private static sendWebhook(webhookUrl: string, payload: any): Promise<void> {
		return new Promise((resolve, reject) => {
			try {
				const parsedUrl = url.parse(webhookUrl);
				const options: https.RequestOptions = {
					hostname: parsedUrl.hostname,
					path: parsedUrl.path,
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					}
				};

				const req = https.request(options, (res) => {
					let body = '';
					res.on('data', (chunk) => body += chunk);
					res.on('end', () => {
						if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
							resolve();
						} else {
							reject(new Error(`Discord webhook returned status ${res.statusCode}: ${body}`));
						}
					});
				});

				req.on('error', (err) => {
					reject(err);
				});

				req.write(JSON.stringify(payload));
				req.end();
			} catch (err) {
				reject(err);
			}
		});
	}
}
