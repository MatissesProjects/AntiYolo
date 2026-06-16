import Module = require('module');

// Simple mock structure for vscode APIs used in our files
export const vscodeMock = {
	workspace: {
		workspaceFolders: [
			{
				uri: {
					fsPath: process.cwd()
				}
			}
		]
	}
};

// Intercept module require calls for 'vscode'
const originalRequire = Module.prototype.require;
Module.prototype.require = function (this: any, id: string) {
	if (id === 'vscode') {
		return vscodeMock;
	}
	return originalRequire.apply(this, arguments as any);
};
