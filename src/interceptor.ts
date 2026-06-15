import * as vscode from 'vscode';
import { getConfig } from './config';
import { CommandValidator } from './validator';
import { executeShellCommand } from './executor';

export class CommandInterceptor {
	constructor(private context: vscode.ExtensionContext) {}

	public register() {
		console.log('Command Interceptor registered.');
		
		const disposable = vscode.commands.registerCommand('antiyolo.runCommand', async (commandLine: string, cwd?: string) => {
			if (!commandLine) {
				vscode.window.showErrorMessage('AntiYolo: No command provided.');
				return 'Error: No command provided.';
			}

			const config = getConfig();
			const validation = CommandValidator.validate(commandLine, config);

			if (!validation.execute && !validation.promptRequired) {
				return `Error: Execution blocked. ${validation.reason || ''}`;
			}

			if (validation.promptRequired) {
				const choice = await vscode.window.showWarningMessage(
					`AntiYolo Alert\n\nAgent requested to run:\n${commandLine}\n\nReason: ${validation.reason || 'Manual confirmation required.'}`,
					{ modal: true },
					'Execute', 'Cancel'
				);

				if (choice !== 'Execute') {
					return 'Error: Execution cancelled by user.';
				}
			}

			return await executeShellCommand(commandLine, cwd);
		});

		this.context.subscriptions.push(disposable);
	}
}
