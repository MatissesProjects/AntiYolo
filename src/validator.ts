import { AntiYoloConfig, YoloLevel } from './types';
import * as path from 'path';
import * as fs from 'fs';

export interface ValidationResult {
	execute: boolean;
	promptRequired: boolean;
	reason?: string;
}

const BLACKLIST = ['rm', 'mkfs', 'dd', 'shutdown', 'reboot', 'mv'];
const LEVEL1_WHITELIST = ['cat', 'ls', 'pwd', 'grep', 'git status', 'git diff', 'echo'];

export class CommandValidator {
	private static parseEnvArgs(args: string[]): { cmd: string | null, args: string[] } {
		let idx = 0;
		while (idx < args.length) {
			const arg = args[idx];
			if (arg === '--') {
				idx++;
				break;
			}
			if (arg.startsWith('-')) {
				if (arg.startsWith('--')) {
					if (arg === '--ignore-environment' || arg === '--help' || arg === '--version' || arg === '--null') {
						idx++;
					} else if (arg.startsWith('--unset=') || arg.startsWith('--chdir=')) {
						idx++;
					} else if (arg === '--unset' || arg === '--chdir') {
						idx += 2;
					} else {
						return { cmd: null, args: [] }; // fail closed
					}
				} else {
					let consumedNext = false;
					for (let i = 1; i < arg.length; i++) {
						const char = arg[i];
						if (char === 'u' || char === 'C' || char === 'S') {
							if (i === arg.length - 1) {
								consumedNext = true;
							}
							break;
						}
					}
					if (consumedNext) {
						idx += 2;
					} else {
						idx += 1;
					}
				}
			} else if (arg.includes('=')) {
				idx++;
			} else {
				break;
			}
		}
		if (idx >= args.length) {
			return { cmd: null, args: [] };
		}
		return { cmd: args[idx], args: args.slice(idx + 1) };
	}

	private static parseSudoArgs(args: string[]): { cmd: string | null, args: string[] } {
		let idx = 0;
		while (idx < args.length) {
			const arg = args[idx];
			if (arg === '--') {
				idx++;
				break;
			}
			if (arg.startsWith('-')) {
				if (arg.startsWith('--')) {
					const equalsIdx = arg.indexOf('=');
					const optName = equalsIdx !== -1 ? arg.substring(0, equalsIdx) : arg;
					const needsVal = ['--close-from', '--chdir', '--group', '--host', '--prompt', '--chroot', '--role', '--type', '--other-user', '--user'].includes(optName);
					if (needsVal) {
						if (equalsIdx !== -1) {
							idx++;
						} else {
							idx += 2;
						}
					} else {
						const isKnownBool = ['--help', '--version', '--list', '--validate', '--invalidate', '--reset-timestamp', '--stdin', '--shell', '--login', '--preserve-env'].includes(optName);
						if (isKnownBool) {
							idx++;
						} else {
							return { cmd: null, args: [] }; // fail closed
						}
					}
				} else {
					let consumedNext = false;
					for (let i = 1; i < arg.length; i++) {
						const char = arg[i];
						if (['C', 'g', 'h', 'p', 'R', 'r', 't', 'U', 'u', 'D', 'c', 'a'].includes(char)) {
							if (i === arg.length - 1) {
								consumedNext = true;
							}
							break;
						}
					}
					if (consumedNext) {
						idx += 2;
					} else {
						idx += 1;
					}
				}
			} else {
				break;
			}
		}
		if (idx >= args.length) {
			return { cmd: null, args: [] };
		}
		return { cmd: args[idx], args: args.slice(idx + 1) };
	}

	private static parseNpxArgs(args: string[]): { cmd: string | null, args: string[] } {
		let idx = 0;
		while (idx < args.length) {
			const arg = args[idx];
			if (arg === '--') {
				idx++;
				break;
			}
			if (arg.startsWith('-')) {
				if (arg.startsWith('--')) {
					const equalsIdx = arg.indexOf('=');
					const optName = equalsIdx !== -1 ? arg.substring(0, equalsIdx) : arg;
					const needsVal = ['--package', '--call', '--node-arg', '--workspace'].includes(optName);
					if (needsVal) {
						if (equalsIdx !== -1) {
							idx++;
						} else {
							idx += 2;
						}
					} else {
						idx++;
					}
				} else {
					let consumedNext = false;
					for (let i = 1; i < arg.length; i++) {
						const char = arg[i];
						if (['p', 'c', 'n', 'w'].includes(char)) {
							if (i === arg.length - 1) {
								consumedNext = true;
							}
							break;
						}
					}
					if (consumedNext) {
						idx += 2;
					} else {
						idx += 1;
					}
				}
			} else {
				break;
			}
		}
		if (idx >= args.length) {
			return { cmd: null, args: [] };
		}
		return { cmd: args[idx], args: args.slice(idx + 1) };
	}

	private static parseYarnDlxArgs(args: string[]): { cmd: string | null, args: string[] } {
		let idx = 0;
		while (idx < args.length) {
			const arg = args[idx];
			if (arg === '--') {
				idx++;
				break;
			}
			if (arg.startsWith('-')) {
				if (arg.startsWith('--')) {
					const equalsIdx = arg.indexOf('=');
					const optName = equalsIdx !== -1 ? arg.substring(0, equalsIdx) : arg;
					const needsVal = ['--package'].includes(optName);
					if (needsVal) {
						if (equalsIdx !== -1) {
							idx++;
						} else {
							idx += 2;
						}
					} else {
						idx++;
					}
				} else {
					let consumedNext = false;
					for (let i = 1; i < arg.length; i++) {
						const char = arg[i];
						if (char === 'p') {
							if (i === arg.length - 1) {
								consumedNext = true;
							}
							break;
						}
					}
					if (consumedNext) {
						idx += 2;
					} else {
						idx += 1;
					}
				}
			} else {
				break;
			}
		}
		if (idx >= args.length) {
			return { cmd: null, args: [] };
		}
		return { cmd: args[idx], args: args.slice(idx + 1) };
	}

	private static unwrap(command: string, args: string[]): { cmd: string | null, args: string[] } {
		let currentCmd = command;
		let currentArgs = [...args];
		
		while (true) {
			if (currentCmd.includes('=')) {
				if (currentArgs.length === 0) {
					return { cmd: null, args: [] };
				}
				currentCmd = currentArgs.shift()!;
				continue;
			}

			const baseCmd = path.basename(currentCmd);
			if (baseCmd === 'env') {
				const res = this.parseEnvArgs(currentArgs);
				if (!res.cmd) return { cmd: null, args: [] };
				currentCmd = res.cmd;
				currentArgs = res.args;
			} else if (baseCmd === 'sudo') {
				const res = this.parseSudoArgs(currentArgs);
				if (!res.cmd) return { cmd: null, args: [] };
				currentCmd = res.cmd;
				currentArgs = res.args;
			} else if (baseCmd === 'npx') {
				const res = this.parseNpxArgs(currentArgs);
				if (!res.cmd) return { cmd: null, args: [] };
				currentCmd = res.cmd;
				currentArgs = res.args;
			} else if (baseCmd === 'bundle' && currentArgs[0] === 'exec') {
				currentArgs.shift(); // remove exec
				while (currentArgs.length > 0 && currentArgs[0].startsWith('-')) {
					currentArgs.shift();
				}
				if (currentArgs.length === 0) return { cmd: null, args: [] };
				currentCmd = currentArgs.shift()!;
			} else if (baseCmd === 'npm' && (currentArgs[0] === 'exec' || currentArgs[0] === 'x')) {
				currentArgs.shift(); // remove exec/x
				const res = this.parseNpxArgs(currentArgs);
				if (!res.cmd) return { cmd: null, args: [] };
				currentCmd = res.cmd;
				currentArgs = res.args;
			} else if (baseCmd === 'yarn' && currentArgs[0] === 'dlx') {
				currentArgs.shift(); // remove dlx
				const res = this.parseYarnDlxArgs(currentArgs);
				if (!res.cmd) return { cmd: null, args: [] };
				currentCmd = res.cmd;
				currentArgs = res.args;
			} else {
				break;
			}
		}
		return { cmd: currentCmd, args: currentArgs };
	}

	private static getPackageAction(cmd: string, args: string[]): string | null {
		const base = path.basename(cmd);
		if (['npm', 'yarn', 'pnpm', 'bun'].includes(base)) {
			const sub = args[0];
			if (!sub) return null;
			if (['install', 'i', 'add'].includes(sub)) return 'install';
			if (sub === 'ci') return 'ci';
			if (['update', 'upgrade'].includes(sub)) return 'update';
			if (['uninstall', 'remove'].includes(sub)) return 'uninstall';
		}
		if (['pip', 'pip3'].includes(base)) {
			const sub = args[0];
			if (sub === 'install') {
				if (args.includes('--upgrade') || args.includes('-U')) return 'update';
				return 'install';
			}
			if (sub === 'uninstall') return 'uninstall';
		}
		if (base === 'cargo') {
			const sub = args[0];
			if (['install', 'add'].includes(sub)) return 'install';
			if (sub === 'update') return 'update';
			if (['uninstall', 'rm'].includes(sub)) return 'uninstall';
		}
		if (base === 'go') {
			const sub = args[0];
			if (['get', 'install'].includes(sub)) return 'install';
		}
		return null;
	}

	private static matchCategory(cmd: string, args: string[], config: AntiYoloConfig): boolean {
		const baseExecutable = path.basename(cmd);

		// 1. Package Operations
		if (config.allowPackageOps) {
			const pkgAction = this.getPackageAction(cmd, args);
			if (pkgAction && config.allowedPackageActions.includes(pkgAction)) {
				return true;
			}
		}

		// 2. Git Operations
		if (config.allowGitOps && baseExecutable === 'git') {
			const gitAction = args[0] || '';
			if (gitAction && config.allowedGitActions.includes(gitAction)) {
				return true;
			}
		}

		// 3. Build Operations
		if (config.allowBuildOps) {
			let buildAction: string | null = null;
			if (['tsc', 'make', 'webpack', 'vite', 'gulp', 'grunt'].includes(baseExecutable)) {
				buildAction = baseExecutable;
			} else if (['npm', 'yarn', 'pnpm', 'bun'].includes(baseExecutable)) {
				if (args[0] === 'build' || (args[0] === 'run' && args[1] === 'build')) {
					buildAction = 'build';
				}
			} else if (baseExecutable === 'cargo' && args[0] === 'build') {
				buildAction = 'build';
			} else if (baseExecutable === 'go' && args[0] === 'build') {
				buildAction = 'build';
			} else if (['gradle', 'gradlew'].includes(baseExecutable) || baseExecutable.endsWith('gradlew')) {
				if (args.includes('build') || args.includes('assemble')) {
					buildAction = 'gradle';
				}
			} else if (['mvn', 'mvnw'].includes(baseExecutable) || baseExecutable.endsWith('mvnw')) {
				if (args.includes('package') || args.includes('compile') || args.includes('install')) {
					buildAction = 'maven';
				}
			}

			if (buildAction && config.allowedBuildActions.includes(buildAction)) {
				return true;
			}
		}

		// 4. Test Operations
		if (config.allowTestOps) {
			let testAction: string | null = null;
			if (['pytest', 'jest', 'mocha', 'vitest', 'playwright', 'cypress'].includes(baseExecutable)) {
				testAction = baseExecutable;
			} else if (['npm', 'yarn', 'pnpm', 'bun'].includes(baseExecutable)) {
				if (args[0] === 'test' || args[0] === 't' || (args[0] === 'run' && args[1] === 'test')) {
					testAction = 'test';
				}
			} else if (baseExecutable === 'cargo' && args[0] === 'test') {
				testAction = 'test';
			} else if (baseExecutable === 'go' && args[0] === 'test') {
				testAction = 'test';
			}

			if (testAction && config.allowedTestActions.includes(testAction)) {
				return true;
			}
		}

		// 5. File Operations
		if (config.allowFileOps) {
			if (['mkdir', 'touch', 'cp', 'chmod', 'chown'].includes(baseExecutable)) {
				if (config.allowedFileActions.includes(baseExecutable)) {
					return true;
				}
			}
		}

		return false;
	}

	private static splitShellCommands(cmdStr: string): string[] {
		const commands: string[] = [];
		let current = '';
		let inSingleQuote = false;
		let inDoubleQuote = false;
		let escaped = false;

		for (let i = 0; i < cmdStr.length; i++) {
			const char = cmdStr[i];

			if (escaped) {
				current += char;
				escaped = false;
				continue;
			}

			if (char === '\\' && !inSingleQuote) {
				escaped = true;
				current += char;
				continue;
			}

			if (char === "'" && !inDoubleQuote) {
				inSingleQuote = !inSingleQuote;
				current += char;
				continue;
			}

			if (char === '"' && !inSingleQuote) {
				inDoubleQuote = !inDoubleQuote;
				current += char;
				continue;
			}

			if (!inSingleQuote && !inDoubleQuote) {
				if (char === ';') {
					if (current.trim()) {
						commands.push(current.trim());
					}
					current = '';
					continue;
				}
				if (char === '\n') {
					if (current.trim()) {
						commands.push(current.trim());
					}
					current = '';
					continue;
				}
				if (char === '&') {
					if (cmdStr[i + 1] === '&') {
						if (current.trim()) {
							commands.push(current.trim());
						}
						current = '';
						i++;
					} else {
						if (current.trim()) {
							commands.push(current.trim());
						}
						current = '';
					}
					continue;
				}
				if (char === '|' && cmdStr[i + 1] === '|') {
					if (current.trim()) {
						commands.push(current.trim());
					}
					current = '';
					i++;
					continue;
				}
				if (char === '|') {
					if (current.trim()) {
						commands.push(current.trim());
					}
					current = '';
					continue;
				}
			}

			current += char;
		}

		if (current.trim()) {
			commands.push(current.trim());
		}

		return commands;
	}

	private static tokenizeShellCommand(cmdStr: string): { command: string, args: string[] } | null {
		const tokens: string[] = [];
		let current = '';
		let inSingleQuote = false;
		let inDoubleQuote = false;
		let escaped = false;
		let hasChar = false;

		for (let i = 0; i < cmdStr.length; i++) {
			const char = cmdStr[i];

			if (escaped) {
				current += char;
				escaped = false;
				hasChar = true;
				continue;
			}

			if (char === '\\' && !inSingleQuote) {
				escaped = true;
				continue;
			}

			if (char === "'" && !inDoubleQuote) {
				inSingleQuote = !inSingleQuote;
				hasChar = true;
				continue;
			}

			if (char === '"' && !inSingleQuote) {
				inDoubleQuote = !inDoubleQuote;
				hasChar = true;
				continue;
			}

			if (!inSingleQuote && !inDoubleQuote && (char === ' ' || char === '\t')) {
				if (hasChar || current) {
					tokens.push(current);
					current = '';
					hasChar = false;
				}
				continue;
			}

			current += char;
			hasChar = true;
		}

		if (hasChar || current) {
			tokens.push(current);
		}

		if (tokens.length === 0) {
			return null;
		}

		return {
			command: tokens[0],
			args: tokens.slice(1)
		};
	}

	private static isPathOutsideWorkspace(arg: string, workspaceFolders: string[]): boolean {
		if (!workspaceFolders || workspaceFolders.length === 0) {
			return false;
		}

		let target = arg;
		if (arg.includes('=')) {
			const parts = arg.split('=');
			target = parts.slice(1).join('=');
		}

		target = target.replace(/^['"]|['"]$/g, '');

		// Detect environment variable references in the path to fail closed
		const unixEnvRegex = /\$[a-zA-Z_][a-zA-Z0-9_]*|\$\{[a-zA-Z_][a-zA-Z0-9_]*\}/;
		const winEnvRegex = /%[a-zA-Z0-9_]+%/;
		if (unixEnvRegex.test(target) || winEnvRegex.test(target)) {
			return true;
		}

		const checkAbsolutePath = (absPath: string): boolean => {
			let resolvedPath = absPath;
			try {
				if (fs.existsSync(absPath)) {
					resolvedPath = fs.realpathSync(absPath);
				}
			} catch (e) {}
			const normalized = path.normalize(resolvedPath).toLowerCase();
			for (const folder of workspaceFolders) {
				const normalizedFolder = path.normalize(folder).toLowerCase();
				const relative = path.relative(normalizedFolder, normalized);
				if (!relative.startsWith('..') && !path.isAbsolute(relative)) {
					return false;
				}
			}
			return true;
		};

		const hasSeparators = target.includes('/') || target.includes('\\');
		const hasTraversal = target.includes('..');
		const isAbsolute = path.isAbsolute(target) || /^[a-zA-Z]:[/\\]/.test(target);

		if (isAbsolute) {
			return checkAbsolutePath(target);
		}

		if (hasTraversal || hasSeparators) {
			for (const folder of workspaceFolders) {
				const resolved = path.resolve(folder, target);
				let resolvedPath = resolved;
				try {
					if (fs.existsSync(resolved)) {
						resolvedPath = fs.realpathSync(resolved);
					}
				} catch (e) {}
				const normalized = path.normalize(resolvedPath).toLowerCase();
				const normalizedFolder = path.normalize(folder).toLowerCase();
				const relative = path.relative(normalizedFolder, normalized);
				if (!relative.startsWith('..') && !path.isAbsolute(relative)) {
					return false;
				}
			}
			return true;
		}

		return false;
	}

	public static validate(command: string, args: string[], config: AntiYoloConfig): ValidationResult {
		return this.validateInternal(command, args, config, 0);
	}

	private static validateInternal(command: string, args: string[], config: AntiYoloConfig, depth: number): ValidationResult {
		if (depth > 10) {
			return { execute: false, promptRequired: true, reason: 'Command recursion limit exceeded.' };
		}

		const unwrapped = this.unwrap(command, args);
		if (unwrapped.cmd === null) {
			return { execute: false, promptRequired: true, reason: 'Command structure is too complex or ambiguous to validate.' };
		}

		const baseExecutable = path.basename(unwrapped.cmd);

		if (BLACKLIST.includes(baseExecutable)) {
			return { execute: false, promptRequired: true, reason: `Command contains blacklisted executable '${baseExecutable}'.` };
		}

		// Check shell command execution
		let shellCmdStr: string | null = null;
		if (['sh', 'bash', 'zsh', 'dash', 'ksh'].includes(baseExecutable)) {
			for (let i = 0; i < unwrapped.args.length; i++) {
				const arg = unwrapped.args[i];
				if (arg === '--') break;
				if (arg.startsWith('-')) {
					if (arg === '-c') {
						shellCmdStr = unwrapped.args[i + 1] || null;
						break;
					}
					if (arg.startsWith('-') && !arg.startsWith('--') && arg.endsWith('c')) {
						shellCmdStr = unwrapped.args[i + 1] || null;
						break;
					}
				}
			}
		} else if (['cmd.exe', 'cmd'].includes(baseExecutable.toLowerCase())) {
			for (let i = 0; i < unwrapped.args.length; i++) {
				const arg = unwrapped.args[i];
				const lowerArg = arg.toLowerCase();
				if (lowerArg === '/c' || lowerArg === '/k' || lowerArg === '-c' || lowerArg === '-k') {
					shellCmdStr = unwrapped.args.slice(i + 1).join(' ');
					break;
				}
			}
		} else if (['powershell', 'pwsh', 'powershell.exe', 'pwsh.exe'].includes(baseExecutable.toLowerCase())) {
			for (let i = 0; i < unwrapped.args.length; i++) {
				const arg = unwrapped.args[i];
				const lowerArg = arg.toLowerCase();
				if (lowerArg === '-command' || lowerArg === '-c' || lowerArg === '/command' || lowerArg === '/c') {
					shellCmdStr = unwrapped.args.slice(i + 1).join(' ');
					break;
				}
			}
		}

		if (shellCmdStr !== null) {
			// Check for command substitution in the shell command string
			const hasSubshell = shellCmdStr.includes('$(') || shellCmdStr.includes('`');
			if (hasSubshell) {
				for (const word of BLACKLIST) {
					const regex = new RegExp(`\\b${word}\\b`);
					if (regex.test(shellCmdStr)) {
						return {
							execute: false,
							promptRequired: true,
							reason: `Shell command contains command substitution with blacklisted word '${word}'.`
						};
					}
				}
				if (config.yoloLevel !== YoloLevel.Full) {
					return {
						execute: false,
						promptRequired: true,
						reason: 'Shell command contains command substitution, which requires manual approval.'
					};
				}
			}

			const subStatements = this.splitShellCommands(shellCmdStr);
			for (const subStmt of subStatements) {
				const tokenized = this.tokenizeShellCommand(subStmt);
				if (!tokenized) continue;
				const subResult = this.validateInternal(tokenized.command, tokenized.args, config, depth + 1);
				if (subResult.promptRequired || !subResult.execute) {
					return {
						execute: false,
						promptRequired: true,
						reason: `Shell command contains invalid sub-command: ${subResult.reason || ''}`
					};
				}
			}
			return { execute: true, promptRequired: false };
		}

		// Check inline script interpreter execution
		let inlineScript: string | null = null;
		if (['python', 'python3'].includes(baseExecutable)) {
			const cIdx = unwrapped.args.indexOf('-c');
			if (cIdx !== -1 && cIdx + 1 < unwrapped.args.length) {
				inlineScript = unwrapped.args[cIdx + 1];
			}
		} else if (baseExecutable === 'node') {
			const eIdx = unwrapped.args.indexOf('-e');
			const evalIdx = unwrapped.args.indexOf('--eval');
			const idx = eIdx !== -1 ? eIdx : evalIdx;
			if (idx !== -1 && idx + 1 < unwrapped.args.length) {
				inlineScript = unwrapped.args[idx + 1];
			}
		} else if (['perl', 'ruby'].includes(baseExecutable)) {
			const eIdx = unwrapped.args.indexOf('-e');
			if (eIdx !== -1 && eIdx + 1 < unwrapped.args.length) {
				inlineScript = unwrapped.args[eIdx + 1];
			}
		}

		if (inlineScript) {
			const blacklistWords = ['rm', 'mkfs', 'dd', 'shutdown', 'reboot', 'mv'];
			for (const word of blacklistWords) {
				const regex = new RegExp(`\\b${word}\\b`);
				if (regex.test(inlineScript)) {
					return { execute: false, promptRequired: true, reason: `Inline script contains blacklisted command word '${word}'.` };
				}
			}
		}

		// Check script file execution
		let scriptPath: string | null = null;
		if (['bash', 'sh', 'zsh', 'dash', 'ksh', 'python', 'python3', 'node', 'perl', 'ruby'].includes(baseExecutable)) {
			for (const arg of unwrapped.args) {
				if (arg === '--') continue;
				if (arg.startsWith('-')) continue;
				// If it's a file that exists, we treat it as a script file
				const resolved = path.isAbsolute(arg) ? arg : (config.workspaceFolders?.[0] ? path.resolve(config.workspaceFolders[0], arg) : null);
				if (resolved && fs.existsSync(resolved)) {
					try {
						if (fs.statSync(resolved).isFile()) {
							scriptPath = resolved;
							break;
						}
					} catch (e) {}
				}
			}
		}

		if (scriptPath !== null) {
			if (['sh', 'bash', 'zsh', 'dash', 'ksh'].includes(baseExecutable)) {
				try {
					const content = fs.readFileSync(scriptPath, 'utf8');
					const lines = content.split(/\r?\n/);
					let currentLine = '';
					for (let line of lines) {
						line = line.trim();
						if (!line || line.startsWith('#')) continue;
						if (line.endsWith('\\')) {
							currentLine += line.slice(0, -1) + ' ';
							continue;
						}
						currentLine += line;
						
						const subStatements = this.splitShellCommands(currentLine);
						for (const subStmt of subStatements) {
							// Check for command substitution in the shell script file line
							if (subStmt.includes('$(') || subStmt.includes('`')) {
								for (const word of BLACKLIST) {
									const regex = new RegExp(`\\b${word}\\b`);
									if (regex.test(subStmt)) {
										return {
											execute: false,
											promptRequired: true,
											reason: `Script file '${path.basename(scriptPath)}' contains command substitution with blacklisted word '${word}'.`
										};
									}
								}
								if (config.yoloLevel !== YoloLevel.Full) {
									return {
										execute: false,
										promptRequired: true,
										reason: `Script file '${path.basename(scriptPath)}' contains command substitution, which requires manual approval.`
									};
								}
							}

							const tokenized = this.tokenizeShellCommand(subStmt);
							if (!tokenized) continue;
							const subResult = this.validateInternal(tokenized.command, tokenized.args, config, depth + 1);
							if (subResult.promptRequired || !subResult.execute) {
								return {
									execute: false,
									promptRequired: true,
									reason: `Script file '${path.basename(scriptPath)}' contains invalid command: ${subResult.reason || ''}`
								};
							}
						}
						currentLine = '';
					}
					// ALL sub-commands in the shell script were validated and allowed!
					return { execute: true, promptRequired: false };
				} catch (e) {
					return {
						execute: false,
						promptRequired: true,
						reason: `Failed to read or parse script file '${path.basename(scriptPath)}': ${(e as Error).message}`
					};
				}
			} else if (['python', 'python3', 'node', 'perl', 'ruby'].includes(baseExecutable)) {
				try {
					const content = fs.readFileSync(scriptPath, 'utf8');
					const scriptBlacklist = ['rm', 'mkfs', 'dd', 'shutdown', 'reboot', 'mv'];
					for (const word of scriptBlacklist) {
						const regex = new RegExp(`\\b${word}\\b`);
						if (regex.test(content)) {
							return {
								execute: false,
								promptRequired: true,
								reason: `Script file '${path.basename(scriptPath)}' contains blacklisted word '${word}'.`
							};
						}
					}
					if (config.yoloLevel !== YoloLevel.Full) {
						const execApis = [
							'os.system', 'subprocess', 'child_process', 'fs.rmSync', 'fs.unlinkSync', 'fs.rmdirSync'
						];
						for (const api of execApis) {
							if (content.includes(api)) {
								return {
									execute: false,
									promptRequired: true,
									reason: `Script file '${path.basename(scriptPath)}' uses restricted API '${api}'.`
								};
							}
						}
					}
				} catch (e) {
					return {
						execute: false,
						promptRequired: true,
						reason: `Failed to read script file '${path.basename(scriptPath)}': ${(e as Error).message}`
					};
				}
			}
		}

		if (config.yoloLevel === YoloLevel.Interactive) {
			return { execute: false, promptRequired: true, reason: 'Interactive Level (0) requires prompt.' };
		}

		if (config.yoloLevel === YoloLevel.Full) {
			return { execute: true, promptRequired: false };
		}

		const isLevel2 = config.yoloLevel === YoloLevel.Scoped;
		const customWhitelist = config.whitelist || [];
		
		const fullCommandStr = [unwrapped.cmd, ...unwrapped.args].join(' ');

		let inL1 = LEVEL1_WHITELIST.includes(baseExecutable);
		if (baseExecutable === 'git' && unwrapped.args.length > 0) {
			inL1 = inL1 || LEVEL1_WHITELIST.includes(`git ${unwrapped.args[0]}`);
		}

		let inL2 = false;
		if (isLevel2) {
			for (const allowed of customWhitelist) {
				if (fullCommandStr === allowed || fullCommandStr.startsWith(allowed + ' ')) {
					inL2 = true;
					break;
				}
			}
		}

		let allowed = false;
		if (config.yoloLevel === YoloLevel.ReadOnly) {
			allowed = inL1;
		} else if (config.yoloLevel === YoloLevel.Scoped) {
			allowed = inL1 || inL2 || this.matchCategory(unwrapped.cmd, unwrapped.args, config);
		}

		if (!allowed) {
			return { execute: false, promptRequired: true, reason: `Command '${fullCommandStr}' is not whitelisted for Level ${config.yoloLevel}.` };
		}

		if (config.restrictToWorkspace && config.workspaceFolders && config.workspaceFolders.length > 0) {
			for (const arg of unwrapped.args) {
				if (this.isPathOutsideWorkspace(arg, config.workspaceFolders)) {
					return {
						execute: false,
						promptRequired: true,
						reason: `Command references a path outside the workspace: '${arg}'`
					};
				}
			}
		}

		return { execute: true, promptRequired: false };
	}
}
