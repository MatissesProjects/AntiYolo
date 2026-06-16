import * as vscode from 'vscode';
import { getConfig } from './config';
import { CommandValidator } from './validator';
import { executeStructuredCommand } from './executor';
import { CommandLogger } from './logger';
import { LocalApprovalServer } from './server';
import * as crypto from 'crypto';
import * as https from 'https';
import * as url from 'url';

interface ToolPayload {
	command: string;
	args?: string[];
}

export class CommandInterceptor {
	private pendingApprovals = new Map<string, {
		token: string;
		resolve: (choice: string) => void;
	}>();

	constructor(
		private context: vscode.ExtensionContext,
		private approvalServer: LocalApprovalServer
	) {}

	public register() {
		console.log('Command Interceptor registered.');

		// Register local HTTP server action handler
		this.approvalServer.setOnAction((logId, token, action) => {
			const pending = this.pendingApprovals.get(logId);
			if (pending && pending.token === token) {
				pending.resolve(action);
				return true;
			}
			return false;
		});
		
		const disposable = vscode.commands.registerCommand('antiyolo.runCommand', async (payloadString: string, cwd?: string) => {
			if (!payloadString) {
				vscode.window.showErrorMessage('AntiYolo: No payload provided.');
				return 'Error: No payload provided.';
			}

			let payload: ToolPayload;
			try {
				payload = JSON.parse(payloadString);
			} catch (e) {
				return 'Error: Payload must be a valid JSON string mapping to { command: string, args: string[] }.';
			}

			if (!payload.command || typeof payload.command !== 'string') {
				return 'Error: Payload must contain a valid "command" string.';
			}

			const command = payload.command;
			const args = Array.isArray(payload.args) ? payload.args : [];
			const fullCmd = [command, ...args].join(' ');

			const config = getConfig();
			const levelName = ['Interactive (0)', 'Read-Only (1)', 'Scoped (2)', 'Full (3)'][config.yoloLevel];
			
			const logger = CommandLogger.getInstance();
			let logId = '';

			if (!config.enabled) {
				logId = logger.addLog({
					commandLine: fullCmd,
					level: 'Bypassed',
					status: 'Allowed'
				});
			} else {
				const validation = CommandValidator.validate(command, args, config);

				if (!validation.execute && !validation.promptRequired) {
					logger.addLog({
						commandLine: fullCmd,
						level: levelName,
						status: 'Blocked',
						output: validation.reason || 'Blocked by security policy.'
					});
					return `Error: Execution blocked. ${validation.reason || ''}`;
				}

				if (validation.promptRequired) {
					logId = logger.addLog({
						commandLine: fullCmd,
						level: levelName,
						status: 'Running'
					});

					const token = crypto.randomBytes(8).toString('hex');
					
					let resolvePromise!: (value: string) => void;
					const remotePromise = new Promise<string>((resolve) => {
						resolvePromise = resolve;
					});

					this.pendingApprovals.set(logId, { token, resolve: resolvePromise });

					if (config.enableDiscord && config.discordWebhookUrl) {
						const localPort = config.localServerPort;
						const payload = {
							embeds: [{
								title: "🛡️ AntiYolo: Command Approval Request",
								description: "An autonomous agent is requesting permission to execute a command.",
								color: 5809407,
								fields: [
									{
										name: "💻 Command",
										value: `\`\`\`bash\n${fullCmd.length > 950 ? fullCmd.substring(0, 950) + '...' : fullCmd}\n\`\`\``
									},
									{
										name: "⚠️ Reason / Context",
										value: validation.reason || 'Manual confirmation required.'
									},
									{
										name: "🔒 Security Level",
										value: levelName,
										inline: true
									},
									{
										name: "⏱️ Timeout Limit",
										value: `${config.timeoutSeconds} seconds`,
										inline: true
									},
									{
										name: "⚡ Actions",
										value: `🔗 [Approve Once](http://localhost:${localPort}/respond?id=${logId}&token=${token}&action=Execute)\n🛡️ [Whitelist & Approve](http://localhost:${localPort}/respond?id=${logId}&token=${token}&action=AlwaysExecute)\n❌ [Deny Request](http://localhost:${localPort}/respond?id=${logId}&token=${token}&action=Cancel)`
									}
								],
								timestamp: new Date().toISOString()
							}]
						};

						this.sendDiscordWebhook(config.discordWebhookUrl, payload).catch(err => {
							console.error('Failed to send Discord webhook:', err);
							vscode.window.showWarningMessage(`AntiYolo: Failed to send Discord notification: ${err.message}`);
						});
					}

					const choice = await Promise.race([
						vscode.window.showWarningMessage(
							`AntiYolo Alert\n\nAgent requested to run:\n${fullCmd}\n\nReason: ${validation.reason || 'Manual confirmation required.'}`,
							{ modal: true },
							'Execute', 'Always Execute', 'Cancel'
						).then(c => c || 'Cancel'),
						remotePromise
					]);

					this.pendingApprovals.delete(logId);

					if (choice !== 'Execute' && choice !== 'Always Execute') {
						logger.updateLog(logId, { status: 'Denied', output: 'Cancelled by user.' });
						return 'Error: Execution cancelled by user.';
					}

					if (choice === 'Always Execute') {
						const configObj = vscode.workspace.getConfiguration('antiyolo');
						const currentWhitelist = configObj.get<string[]>('whitelist', []);
						if (!currentWhitelist.includes(fullCmd)) {
							currentWhitelist.push(fullCmd);
							await configObj.update('whitelist', currentWhitelist, vscode.ConfigurationTarget.Global);
						}
					}

					logger.updateLog(logId, { status: 'Approved' });
				} else {
					logId = logger.addLog({
						commandLine: fullCmd,
						level: levelName,
						status: 'Allowed'
					});
				}
			}

			const startTime = Date.now();
			const result = await executeStructuredCommand(command, args, cwd, config.timeoutSeconds * 1000);
			const durationMs = Date.now() - startTime;

			let finalStatus: 'Completed' | 'Timed Out' | 'Failed' = 'Completed';
			if (result.startsWith('[error]\nExecution timed out')) {
				finalStatus = 'Timed Out';
			} else if (result.includes('[exit]\nProcess exited with code') || result.includes('[error]\n')) {
				finalStatus = 'Failed';
			}

			logger.updateLog(logId, {
				status: finalStatus,
				durationMs,
				output: result
			});

			return result;
		});

		this.context.subscriptions.push(disposable);
	}

	public sendDiscordWebhook(webhookUrl: string, payload: any): Promise<void> {
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

