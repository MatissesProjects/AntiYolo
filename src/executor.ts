import { spawn } from 'child_process';
import * as vscode from 'vscode';

export function executeStructuredCommand(command: string, args: string[], cwd?: string, timeoutMs: number = 15000): Promise<string> {
	return new Promise((resolve) => {
		const workingDir = cwd || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
		
		const child = spawn(command, args, { cwd: workingDir, shell: false });
		let output = '';

		child.stdout?.on('data', (data) => {
			output += `[stdout]\n${data.toString()}`;
		});

		child.stderr?.on('data', (data) => {
			output += `[stderr]\n${data.toString()}`;
		});

		let isTimeout = false;
		const timer = setTimeout(() => {
			isTimeout = true;
			child.kill('SIGKILL');
			resolve(`[error]\nExecution timed out after ${timeoutMs}ms.\n${output}`);
		}, timeoutMs);

		child.on('error', (error) => {
			clearTimeout(timer);
			output += `[error]\n${error.message}\n`;
			resolve(output);
		});

		child.on('close', (code) => {
			if (isTimeout) return;
			clearTimeout(timer);
			if (code !== 0 && code !== null) {
				output += `[exit]\nProcess exited with code ${code}\n`;
			}
			if (!output.trim()) {
				output = 'Command executed with no output.';
			}
			resolve(output);
		});
	});
}
