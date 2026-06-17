import * as assert from 'assert';
import { CommandValidator } from '../../validator';
import { YoloLevel, AntiYoloConfig } from '../../types';

const BASE_CONFIG: AntiYoloConfig = {
	yoloLevel: YoloLevel.Full,
	whitelist: [],
	timeoutSeconds: 15,
	allowPackageOps: false,
	allowedPackageActions: [],
	allowTestOps: false,
	allowedTestActions: [],
	allowBuildOps: false,
	allowedBuildActions: [],
	allowGitOps: false,
	allowedGitActions: [],
	allowFileOps: false,
	allowedFileActions: [],
	restrictToWorkspace: false,
	workspaceFolders: [],
	enableDiscord: false,
	discordWebhookUrl: '',
	localServerPort: 7788,
	enabled: true
};

describe('CommandValidator Security & Features', () => {
	it('should block blacklisted commands at all levels', () => {
		const config = { ...BASE_CONFIG, yoloLevel: YoloLevel.Full };
		const result = CommandValidator.validate('rm', ['-rf', '/'], config);
		assert.strictEqual(result.execute, false);
		assert.strictEqual(result.promptRequired, true);
	});

	it('should prevent path traversal bypasses', () => {
		const config = { ...BASE_CONFIG, yoloLevel: YoloLevel.Full };
		const result1 = CommandValidator.validate('/bin/rm', ['-rf', '/'], config);
		const result2 = CommandValidator.validate('../usr/bin/rm', ['-rf', '/'], config);
		assert.strictEqual(result1.promptRequired, true);
		assert.strictEqual(result2.promptRequired, true);
	});

	it('should strip wrappers and block underlying malicious commands', () => {
		const config = { ...BASE_CONFIG, yoloLevel: YoloLevel.Full };
		const result1 = CommandValidator.validate('sudo', ['rm', '-rf', '/'], config);
		const result2 = CommandValidator.validate('npx', ['rm', '-rf', '/'], config);
		const result4 = CommandValidator.validate('npm', ['exec', 'rm'], config);

		assert.strictEqual(result1.promptRequired, true, 'sudo rm failed');
		assert.strictEqual(result2.promptRequired, true, 'npx rm failed');
		assert.strictEqual(result4.promptRequired, true, 'npm exec rm failed');
	});

	it('should allow custom whitelisted commands at Level 2', () => {
		const config = { ...BASE_CONFIG, yoloLevel: YoloLevel.Scoped, whitelist: ['npm install'] };
		const result = CommandValidator.validate('npm', ['install', 'express'], config);
		assert.strictEqual(result.execute, true);
		assert.strictEqual(result.promptRequired, false);
	});

	it('should block non-whitelisted commands at Level 2', () => {
		const config = { ...BASE_CONFIG, yoloLevel: YoloLevel.Scoped, whitelist: ['npm install'] };
		const result = CommandValidator.validate('pip', ['install'], config);
		assert.strictEqual(result.execute, false);
		assert.strictEqual(result.promptRequired, true);
	});

	it('should validate package operations categories and actions', () => {
		const configAllowed: AntiYoloConfig = {
			...BASE_CONFIG,
			yoloLevel: YoloLevel.Scoped,
			allowPackageOps: true,
			allowedPackageActions: ['install']
		};
		const configBlocked: AntiYoloConfig = {
			...BASE_CONFIG,
			yoloLevel: YoloLevel.Scoped,
			allowPackageOps: false,
			allowedPackageActions: ['install']
		};
		const configActionBlocked: AntiYoloConfig = {
			...BASE_CONFIG,
			yoloLevel: YoloLevel.Scoped,
			allowPackageOps: true,
			allowedPackageActions: ['uninstall'] // only allow uninstall
		};

		// 1. Allowed action
		const res1 = CommandValidator.validate('npm', ['install', 'lodash'], configAllowed);
		assert.strictEqual(res1.execute, true);

		// 2. Disabled category
		const res2 = CommandValidator.validate('npm', ['install', 'lodash'], configBlocked);
		assert.strictEqual(res2.execute, false);
		assert.strictEqual(res2.promptRequired, true);

		// 3. Disabled action
		const res3 = CommandValidator.validate('npm', ['install', 'lodash'], configActionBlocked);
		assert.strictEqual(res3.execute, false);
		assert.strictEqual(res3.promptRequired, true);
	});

	it('should validate git operations categories and actions', () => {
		const config: AntiYoloConfig = {
			...BASE_CONFIG,
			yoloLevel: YoloLevel.Scoped,
			allowGitOps: true,
			allowedGitActions: ['commit', 'push']
		};

		const resCommit = CommandValidator.validate('git', ['commit', '-m', 'test'], config);
		assert.strictEqual(resCommit.execute, true);

		const resPush = CommandValidator.validate('git', ['push', 'origin', 'main'], config);
		assert.strictEqual(resPush.execute, true);

		const resCheckout = CommandValidator.validate('git', ['checkout', 'main'], config);
		assert.strictEqual(resCheckout.execute, false);
		assert.strictEqual(resCheckout.promptRequired, true);
	});

	it('should validate file operations categories and actions', () => {
		const config: AntiYoloConfig = {
			...BASE_CONFIG,
			yoloLevel: YoloLevel.Scoped,
			allowFileOps: true,
			allowedFileActions: ['touch']
		};

		const resTouch = CommandValidator.validate('touch', ['file.txt'], config);
		assert.strictEqual(resTouch.execute, true);

		const resMkdir = CommandValidator.validate('mkdir', ['dir'], config);
		assert.strictEqual(resMkdir.execute, false);
		assert.strictEqual(resMkdir.promptRequired, true);
	});

	describe('Wrapper & Option Parsing Bypasses', () => {
		it('should block sudo with options that execute blacklisted commands', () => {
			const config = { ...BASE_CONFIG, yoloLevel: YoloLevel.Full };
			const result = CommandValidator.validate('sudo', ['-u', 'root', 'rm', '-rf', '/'], config);
			assert.strictEqual(result.execute, false);
			assert.strictEqual(result.promptRequired, true);
		});

		it('should block env with assignments and options that execute blacklisted commands', () => {
			const config = { ...BASE_CONFIG, yoloLevel: YoloLevel.Full };
			const result1 = CommandValidator.validate('env', ['-i', 'MY_VAR=value', 'rm', '-rf', '/'], config);
			const result2 = CommandValidator.validate('env', ['MY_VAR=value', 'rm', '-rf', '/'], config);
			assert.strictEqual(result1.execute, false);
			assert.strictEqual(result1.promptRequired, true);
			assert.strictEqual(result2.execute, false);
			assert.strictEqual(result2.promptRequired, true);
		});

		it('should block npx and npm exec with options executing blacklisted commands', () => {
			const config = { ...BASE_CONFIG, yoloLevel: YoloLevel.Full };
			const result1 = CommandValidator.validate('npx', ['--yes', 'rm', '-rf', '/'], config);
			const result2 = CommandValidator.validate('npm', ['exec', '--yes', '--', 'rm', '-rf', '/'], config);
			assert.strictEqual(result1.execute, false);
			assert.strictEqual(result1.promptRequired, true);
			assert.strictEqual(result2.execute, false);
			assert.strictEqual(result2.promptRequired, true);
		});

		it('should fail closed on ambiguous/unrecognized options on wrappers', () => {
			const config = { ...BASE_CONFIG, yoloLevel: YoloLevel.Full };
			const result = CommandValidator.validate('env', ['--unknown-option-flag', 'ls'], config);
			assert.strictEqual(result.execute, false);
			assert.strictEqual(result.promptRequired, true);
		});
	});

	describe('Recursive Shell Execution Bypasses', () => {
		it('should block nested shell commands containing blacklisted items', () => {
			const config = { ...BASE_CONFIG, yoloLevel: YoloLevel.Full };
			const result1 = CommandValidator.validate('bash', ['-c', 'echo "hello" && rm -rf /'], config);
			const result2 = CommandValidator.validate('cmd.exe', ['/c', 'echo hello & rm -rf'], config);
			const result3 = CommandValidator.validate('powershell', ['-Command', 'echo hello; rm -rf'], config);

			assert.strictEqual(result1.execute, false);
			assert.strictEqual(result1.promptRequired, true);
			assert.strictEqual(result2.execute, false);
			assert.strictEqual(result2.promptRequired, true);
			assert.strictEqual(result3.execute, false);
			assert.strictEqual(result3.promptRequired, true);
		});

		it('should allow nested shell commands with only whitelisted/safe items at Level 1/2', () => {
			const config: AntiYoloConfig = {
				...BASE_CONFIG,
				yoloLevel: YoloLevel.ReadOnly
			};
			const result = CommandValidator.validate('bash', ['-c', 'ls && cat file.txt'], config);
			assert.strictEqual(result.execute, true);
			assert.strictEqual(result.promptRequired, false);
		});

		it('should respect quotes in shell operators', () => {
			const config: AntiYoloConfig = {
				...BASE_CONFIG,
				yoloLevel: YoloLevel.ReadOnly
			};
			const result = CommandValidator.validate('bash', ['-c', "echo 'hello && world'"], config);
			assert.strictEqual(result.execute, true);
		});
	});

	describe('Inline Script Interpreter Bypasses', () => {
		it('should block inline scripts containing blacklisted words', () => {
			const config = { ...BASE_CONFIG, yoloLevel: YoloLevel.Full };
			const result1 = CommandValidator.validate('python', ['-c', "import os; os.system('rm -rf /')"], config);
			const result2 = CommandValidator.validate('node', ['-e', "const exec = require('child_process').exec; exec('rm -rf /')"], config);

			assert.strictEqual(result1.execute, false);
			assert.strictEqual(result1.promptRequired, true);
			assert.strictEqual(result2.execute, false);
			assert.strictEqual(result2.promptRequired, true);
		});

		it('should allow inline scripts without blacklisted words', () => {
			const config = { ...BASE_CONFIG, yoloLevel: YoloLevel.Full };
			const result1 = CommandValidator.validate('python', ['-c', "print('hello')"], config);
			const result2 = CommandValidator.validate('node', ['-e', "console.log('hello')"], config);

			assert.strictEqual(result1.execute, true);
			assert.strictEqual(result2.execute, true);
		});
	});

	describe('Workspace Safety Boundary (restrictToWorkspace)', () => {
		const path = require('path');
		const workspace = path.resolve('test-workspace');
		const insidePath = path.join(workspace, 'src', 'main.ts');
		const outsidePath = path.resolve(path.join(workspace, '..', 'outside-file.txt'));
		const relativeOutside = path.join('..', 'outside-file.txt');

		const CONFIG_WITH_RESTRICT: AntiYoloConfig = {
			...BASE_CONFIG,
			yoloLevel: YoloLevel.ReadOnly,
			restrictToWorkspace: true,
			workspaceFolders: [workspace]
		};

		it('should allow reading files inside the workspace', () => {
			const result = CommandValidator.validate('cat', [insidePath], CONFIG_WITH_RESTRICT);
			assert.strictEqual(result.execute, true);
			assert.strictEqual(result.promptRequired, false);
		});

		it('should block absolute paths outside the workspace', () => {
			const result = CommandValidator.validate('cat', [outsidePath], CONFIG_WITH_RESTRICT);
			assert.strictEqual(result.execute, false);
			assert.strictEqual(result.promptRequired, true);
			assert.ok(result.reason?.includes('references a path outside the workspace'));
		});

		it('should block relative paths escaping the workspace via traversal', () => {
			const result = CommandValidator.validate('cat', [relativeOutside], CONFIG_WITH_RESTRICT);
			assert.strictEqual(result.execute, false);
			assert.strictEqual(result.promptRequired, true);
			assert.ok(result.reason?.includes('references a path outside the workspace'));
		});

		it('should allow paths when restrictToWorkspace is false', () => {
			const configDisabled = { ...CONFIG_WITH_RESTRICT, restrictToWorkspace: false };
			const result = CommandValidator.validate('cat', [outsidePath], configDisabled);
			assert.strictEqual(result.execute, true);
			assert.strictEqual(result.promptRequired, false);
		});

		it('should block nested shell commands pointing outside workspace', () => {
			const result = CommandValidator.validate('bash', ['-c', `cat ${relativeOutside}`], CONFIG_WITH_RESTRICT);
			assert.strictEqual(result.execute, false);
			assert.strictEqual(result.promptRequired, true);
		});

		it('should allow options with values pointing inside workspace and block those pointing outside', () => {
			const resultInside = CommandValidator.validate('touch', [`--file=${insidePath}`], {
				...CONFIG_WITH_RESTRICT,
				yoloLevel: YoloLevel.Scoped,
				allowFileOps: true,
				allowedFileActions: ['touch']
			});
			assert.strictEqual(resultInside.execute, true);

			const resultOutside = CommandValidator.validate('touch', [`--file=${outsidePath}`], {
				...CONFIG_WITH_RESTRICT,
				yoloLevel: YoloLevel.Scoped,
				allowFileOps: true,
				allowedFileActions: ['touch']
			});
			assert.strictEqual(resultOutside.execute, false);
			assert.strictEqual(resultOutside.promptRequired, true);
		});
	});

	describe('New Security Enhancements', () => {
		const fs = require('fs');
		const path = require('path');
		const os = require('os');

		let tempWorkspace: string;
		let outsideFile: string;
		let insideSymlink: string;
		let safeShellScript: string;
		let unsafeShellScript: string;
		let subshellShellScript: string;
		let safePythonScript: string;
		let unsafePythonScript: string;
		let blacklistPythonScript: string;

		before(() => {
			tempWorkspace = path.resolve('temp-test-workspace');
			if (!fs.existsSync(tempWorkspace)) {
				fs.mkdirSync(tempWorkspace);
			}

			// Create outside file and a symlink pointing to it inside workspace
			const tempDir = os.tmpdir();
			outsideFile = path.join(tempDir, `outside-${Date.now()}.txt`);
			fs.writeFileSync(outsideFile, 'secret data');

			insideSymlink = path.join(tempWorkspace, 'link-to-outside.txt');
			try {
				try {
					if (fs.lstatSync(insideSymlink)) {
						fs.unlinkSync(insideSymlink);
					}
				} catch (err) {}
				fs.symlinkSync(outsideFile, insideSymlink);
			} catch (e) {
				// Fallback if symlink creation is not permitted (e.g. Windows without admin privileges)
				// We can still test with a direct file if symlink fails
				console.warn('Symlink creation failed, skipping symlink specific test: ' + e);
			}

			// Safe shell script
			safeShellScript = path.join(tempWorkspace, 'safe.sh');
			fs.writeFileSync(safeShellScript, 'ls\ncat file.txt\n');

			// Unsafe shell script (contains rm)
			unsafeShellScript = path.join(tempWorkspace, 'unsafe.sh');
			fs.writeFileSync(unsafeShellScript, 'echo hello\nrm -rf /\n');

			// Subshell shell script
			subshellShellScript = path.join(tempWorkspace, 'subshell.sh');
			fs.writeFileSync(subshellShellScript, 'git commit -m "$(git log -1)"\n');

			// Safe Python script
			safePythonScript = path.join(tempWorkspace, 'safe.py');
			fs.writeFileSync(safePythonScript, 'print("Hello, world!")\n');

			// Unsafe Python script (uses os.system)
			unsafePythonScript = path.join(tempWorkspace, 'unsafe.py');
			fs.writeFileSync(unsafePythonScript, 'import os\nos.system("ls")\n');

			// Blacklist Python script (contains rm word)
			blacklistPythonScript = path.join(tempWorkspace, 'blacklist.py');
			fs.writeFileSync(blacklistPythonScript, '# this script deletes things using rm\nprint("warning")\n');
		});

		after(() => {
			const clean = (file: string) => {
				try { fs.unlinkSync(file); } catch (e) {}
			};
			clean(outsideFile);
			clean(insideSymlink);
			clean(safeShellScript);
			clean(unsafeShellScript);
			clean(subshellShellScript);
			clean(safePythonScript);
			clean(unsafePythonScript);
			clean(blacklistPythonScript);
			try { fs.rmdirSync(tempWorkspace); } catch (e) {}
		});

		it('should block command substitution in shellCmdStr at lower YOLO levels and failsafe blacklist in Full YOLO', () => {
			const configReadOnly = { ...BASE_CONFIG, yoloLevel: YoloLevel.ReadOnly };
			const configFull = { ...BASE_CONFIG, yoloLevel: YoloLevel.Full };

			// Should block in ReadOnly because it contains command substitution
			const res1 = CommandValidator.validate('bash', ['-c', 'echo $(pwd)'], configReadOnly);
			assert.strictEqual(res1.execute, false);
			assert.strictEqual(res1.promptRequired, true);

			// Should allow in Full YOLO if safe
			const res2 = CommandValidator.validate('bash', ['-c', 'echo $(pwd)'], configFull);
			assert.strictEqual(res2.execute, true);

			// Should block/prompt in Full YOLO if contains blacklist
			const res3 = CommandValidator.validate('bash', ['-c', 'echo $(rm -rf /)'], configFull);
			assert.strictEqual(res3.execute, false);
			assert.strictEqual(res3.promptRequired, true);
		});

		it('should block env variables in paths when restrictToWorkspace is true', () => {
			const configRestrict = {
				...BASE_CONFIG,
				yoloLevel: YoloLevel.ReadOnly,
				restrictToWorkspace: true,
				workspaceFolders: [tempWorkspace]
			};

			const resUnix = CommandValidator.validate('cat', ['$HOME/keys.txt'], configRestrict);
			assert.strictEqual(resUnix.execute, false);
			assert.strictEqual(resUnix.promptRequired, true);

			const resWin = CommandValidator.validate('cat', ['%USERPROFILE%/keys.txt'], configRestrict);
			assert.strictEqual(resWin.execute, false);
			assert.strictEqual(resWin.promptRequired, true);
		});

		it('should resolve symlinks and block them if they point outside workspace', () => {
			if (!fs.existsSync(insideSymlink)) {
				return; // Skip if symlink couldn't be created
			}
			const configRestrict = {
				...BASE_CONFIG,
				yoloLevel: YoloLevel.ReadOnly,
				restrictToWorkspace: true,
				workspaceFolders: [tempWorkspace]
			};

			const res = CommandValidator.validate('cat', [insideSymlink], configRestrict);
			assert.strictEqual(res.execute, false, 'Symlink pointing outside should be blocked');
			assert.strictEqual(res.promptRequired, true);
		});

		it('should recursively validate commands in shell script files', () => {
			const configReadOnly = { ...BASE_CONFIG, yoloLevel: YoloLevel.ReadOnly, workspaceFolders: [tempWorkspace] };
			const configFull = { ...BASE_CONFIG, yoloLevel: YoloLevel.Full, workspaceFolders: [tempWorkspace] };

			// Safe script should pass
			const resSafe = CommandValidator.validate('bash', [safeShellScript], configReadOnly);
			assert.strictEqual(resSafe.execute, true);

			// Script with blacklisted rm should block even in Full YOLO
			const resUnsafe = CommandValidator.validate('bash', [unsafeShellScript], configFull);
			assert.strictEqual(resUnsafe.execute, false);
			assert.strictEqual(resUnsafe.promptRequired, true);

			// Script with command substitution should prompt in ReadOnly
			const resSub = CommandValidator.validate('bash', [subshellShellScript], configReadOnly);
			assert.strictEqual(resSub.execute, false);
			assert.strictEqual(resSub.promptRequired, true);
		});

		it('should inspect python scripts and block restricted APIs or blacklist words', () => {
			const configScoped: AntiYoloConfig = {
				...BASE_CONFIG,
				yoloLevel: YoloLevel.Scoped,
				whitelist: ['python3'],
				workspaceFolders: [tempWorkspace]
			};
			const configFull = { ...BASE_CONFIG, yoloLevel: YoloLevel.Full, workspaceFolders: [tempWorkspace] };

			// Safe Python script should pass (whitelisted interpreter, safe content)
			const resSafe = CommandValidator.validate('python3', [safePythonScript], configScoped);
			assert.strictEqual(resSafe.execute, true);

			// Python script using os.system should prompt in Scoped YOLO
			const resUnsafe = CommandValidator.validate('python3', [unsafePythonScript], configScoped);
			assert.strictEqual(resUnsafe.execute, false);
			assert.strictEqual(resUnsafe.promptRequired, true);

			// Python script containing blacklisted word should block even in Full YOLO
			const resBlacklist = CommandValidator.validate('python3', [blacklistPythonScript], configFull);
			assert.strictEqual(resBlacklist.execute, false);
			assert.strictEqual(resBlacklist.promptRequired, true);
		});
	});
});
