import * as vscode from 'vscode';
import { getConfig } from './config';
import { CommandValidator } from './validator';
import { executeStructuredCommand } from './executor';
import { CommandLogger } from './logger';

interface ToolPayload {
	command: string;
	args?: string[];
}

export class CommandInterceptor {
	constructor(private context: vscode.ExtensionContext) {}

	public register() {
		console.log('Command Interceptor registered.');
		
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

				const choice = await vscode.window.showWarningMessage(
					`AntiYolo Alert\n\nAgent requested to run:\n${fullCmd}\n\nReason: ${validation.reason || 'Manual confirmation required.'}`,
					{ modal: true },
					'Execute', 'Cancel'
				);

				if (choice !== 'Execute') {
					logger.updateLog(logId, { status: 'Denied', output: 'Cancelled by user.' });
					return 'Error: Execution cancelled by user.';
				}

				logger.updateLog(logId, { status: 'Approved' });
			} else {
				logId = logger.addLog({
					commandLine: fullCmd,
					level: levelName,
					status: 'Allowed'
				});
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
}
