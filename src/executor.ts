import { exec } from 'child_process';
import * as vscode from 'vscode';

export function executeShellCommand(commandLine: string, cwd?: string): Promise<string> {
	return new Promise((resolve) => {
		const workingDir = cwd || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
		
		exec(commandLine, { cwd: workingDir }, (error, stdout, stderr) => {
			let output = '';
			if (stdout) {
				output += `[stdout]\n${stdout}\n`;
			}
			if (stderr) {
				output += `[stderr]\n${stderr}\n`;
			}
			if (error) {
				output += `[error]\n${error.message}\n`;
			}
			
			if (!output) {
				output = 'Command executed with no output.';
			}
			
			resolve(output);
		});
	});
}
