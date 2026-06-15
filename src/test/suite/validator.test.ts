import * as assert from 'assert';
import { CommandValidator } from '../../validator';
import { YoloLevel } from '../../types';

describe('CommandValidator', () => {
	it('should block blacklisted commands at all levels', () => {
		const config = { yoloLevel: YoloLevel.Full, whitelist: [] };
		const result = CommandValidator.validate('rm -rf /', config);
		assert.strictEqual(result.execute, false);
		assert.strictEqual(result.promptRequired, true);
		assert.ok(result.reason?.includes('blacklisted'));
	});

	it('should prompt for everything at Level 0', () => {
		const config = { yoloLevel: YoloLevel.Interactive, whitelist: [] };
		const result = CommandValidator.validate('ls', config);
		assert.strictEqual(result.execute, false);
		assert.strictEqual(result.promptRequired, true);
	});

	it('should allow whitelisted commands at Level 1', () => {
		const config = { yoloLevel: YoloLevel.ReadOnly, whitelist: [] };
		const result = CommandValidator.validate('git status', config);
		assert.strictEqual(result.execute, true);
		assert.strictEqual(result.promptRequired, false);
	});

	it('should block non-whitelisted commands at Level 1', () => {
		const config = { yoloLevel: YoloLevel.ReadOnly, whitelist: [] };
		const result = CommandValidator.validate('npm install', config);
		assert.strictEqual(result.execute, false);
		assert.strictEqual(result.promptRequired, true);
	});

	it('should allow custom whitelisted commands at Level 2', () => {
		const config = { yoloLevel: YoloLevel.Scoped, whitelist: ['npm install'] };
		const result = CommandValidator.validate('npm install', config);
		assert.strictEqual(result.execute, true);
		assert.strictEqual(result.promptRequired, false);
	});

	it('should block non-whitelisted commands at Level 2', () => {
		const config = { yoloLevel: YoloLevel.Scoped, whitelist: ['npm install'] };
		const result = CommandValidator.validate('pip install', config);
		assert.strictEqual(result.execute, false);
		assert.strictEqual(result.promptRequired, true);
	});

	it('should handle chained commands safely', () => {
		const config = { yoloLevel: YoloLevel.ReadOnly, whitelist: [] };
		const result = CommandValidator.validate('ls && rm -rf /', config);
		assert.strictEqual(result.execute, false);
		assert.strictEqual(result.promptRequired, true);
	});
});
