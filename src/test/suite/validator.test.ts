import * as assert from 'assert';
import { CommandValidator } from '../../validator';
import { YoloLevel } from '../../types';

describe('CommandValidator Security & Features', () => {
	it('should block blacklisted commands at all levels', () => {
		const config = { yoloLevel: YoloLevel.Full, whitelist: [] };
		const result = CommandValidator.validate('rm -rf /', config);
		assert.strictEqual(result.execute, false);
		assert.strictEqual(result.promptRequired, true);
	});

	it('should prevent path traversal bypasses', () => {
		const config = { yoloLevel: YoloLevel.Full, whitelist: [] };
		const result1 = CommandValidator.validate('/bin/rm -rf /', config);
		const result2 = CommandValidator.validate('../usr/bin/rm -rf /', config);
		assert.strictEqual(result1.promptRequired, true);
		assert.strictEqual(result2.promptRequired, true);
	});

	it('should strip wrappers and block underlying malicious commands', () => {
		const config = { yoloLevel: YoloLevel.Full, whitelist: [] };
		const result1 = CommandValidator.validate('sudo rm -rf /', config);
		const result2 = CommandValidator.validate('npx rm -rf /', config);
		const result3 = CommandValidator.validate('env FOO=bar /bin/rm', config);
		const result4 = CommandValidator.validate('npm exec rm', config);

		assert.strictEqual(result1.promptRequired, true, 'sudo rm failed');
		assert.strictEqual(result2.promptRequired, true, 'npx rm failed');
		assert.strictEqual(result3.promptRequired, true, 'env rm failed');
		assert.strictEqual(result4.promptRequired, true, 'npm exec rm failed');
	});

	it('should traverse AST and catch nested subshell injections', () => {
		const config = { yoloLevel: YoloLevel.Full, whitelist: [] };
		const result1 = CommandValidator.validate('echo $(rm -rf /)', config);
		const result2 = CommandValidator.validate('echo `sudo rm -rf /`', config); // backticks are parsed as CommandSubstitution too

		assert.strictEqual(result1.promptRequired, true, 'subshell $() failed');
		assert.strictEqual(result2.promptRequired, true, 'backtick subshell failed');
	});

	it('should not improperly split valid string literals', () => {
		const config = { yoloLevel: YoloLevel.ReadOnly, whitelist: [] };
		// This should be parsed as [echo, "rm -rf / && hello"] and should PASS because echo is whitelisted!
		const result = CommandValidator.validate('echo "rm -rf / && hello"', config);
		assert.strictEqual(result.execute, true);
		assert.strictEqual(result.promptRequired, false);
	});

	it('should allow custom whitelisted commands at Level 2', () => {
		const config = { yoloLevel: YoloLevel.Scoped, whitelist: ['npm install'] };
		const result = CommandValidator.validate('npm install express', config);
		assert.strictEqual(result.execute, true);
		assert.strictEqual(result.promptRequired, false);
	});

	it('should block non-whitelisted commands at Level 2', () => {
		const config = { yoloLevel: YoloLevel.Scoped, whitelist: ['npm install'] };
		const result = CommandValidator.validate('pip install', config);
		assert.strictEqual(result.execute, false);
		assert.strictEqual(result.promptRequired, true);
	});
});
