import * as assert from 'assert';
import { CommandLogger, LogEntry } from '../../logger';

describe('CommandLogger Unit Tests', () => {
	beforeEach(() => {
		CommandLogger.getInstance().clear();
	});

	it('should return the same instance (singleton pattern)', () => {
		const logger1 = CommandLogger.getInstance();
		const logger2 = CommandLogger.getInstance();
		assert.strictEqual(logger1, logger2);
	});

	it('should add log entries with a generated ID and timestamp', () => {
		const logger = CommandLogger.getInstance();
		const entryData = {
			commandLine: 'echo "hello"',
			level: 'Level 1',
			status: 'Allowed' as const
		};

		const id = logger.addLog(entryData);
		assert.ok(id);
		assert.strictEqual(typeof id, 'string');

		const logs = logger.getLogs();
		assert.strictEqual(logs.length, 1);
		assert.strictEqual(logs[0].id, id);
		assert.strictEqual(logs[0].commandLine, 'echo "hello"');
		assert.strictEqual(logs[0].status, 'Allowed');
		assert.ok(logs[0].timestamp);
	});

	it('should update existing log entries', () => {
		const logger = CommandLogger.getInstance();
		const id = logger.addLog({
			commandLine: 'npm install',
			level: 'Level 2',
			status: 'Running' as const
		});

		logger.updateLog(id, {
			status: 'Completed' as const,
			durationMs: 120,
			output: 'Added packages'
		});

		const logs = logger.getLogs();
		assert.strictEqual(logs.length, 1);
		assert.strictEqual(logs[0].id, id);
		assert.strictEqual(logs[0].status, 'Completed');
		assert.strictEqual(logs[0].durationMs, 120);
		assert.strictEqual(logs[0].output, 'Added packages');
	});

	it('should not update logs that do not exist', () => {
		const logger = CommandLogger.getInstance();
		logger.addLog({
			commandLine: 'ls',
			level: 'Level 1',
			status: 'Allowed' as const
		});

		logger.updateLog('non-existent-id', {
			status: 'Failed' as const
		});

		const logs = logger.getLogs();
		assert.strictEqual(logs.length, 1);
		assert.notStrictEqual(logs[0].status, 'Failed');
	});

	it('should clear all log entries', () => {
		const logger = CommandLogger.getInstance();
		logger.addLog({
			commandLine: 'ls',
			level: 'Level 1',
			status: 'Allowed' as const
		});
		assert.strictEqual(logger.getLogs().length, 1);

		logger.clear();
		assert.strictEqual(logger.getLogs().length, 0);
	});

	it('should rotate logs to not exceed maxLogs (50)', () => {
		const logger = CommandLogger.getInstance();
		// Add 55 logs
		for (let i = 0; i < 55; i++) {
			logger.addLog({
				commandLine: `cmd ${i}`,
				level: 'Level 1',
				status: 'Allowed' as const
			});
		}

		const logs = logger.getLogs();
		assert.strictEqual(logs.length, 50);
		// Check that the newest logs are kept (unshifted)
		assert.strictEqual(logs[0].commandLine, 'cmd 54'); // newest
		assert.strictEqual(logs[49].commandLine, 'cmd 5'); // oldest retained (0-4 were popped)
	});

	it('should notify listeners when logs are added, updated, or cleared', () => {
		const logger = CommandLogger.getInstance();
		let callCount = 0;
		let lastLogs: LogEntry[] = [];

		const listener = (logs: LogEntry[]) => {
			callCount++;
			lastLogs = logs;
		};

		logger.addListener(listener);

		// 1. Trigger by adding a log
		const id = logger.addLog({
			commandLine: 'git status',
			level: 'Level 1',
			status: 'Allowed' as const
		});
		assert.strictEqual(callCount, 1);
		assert.strictEqual(lastLogs.length, 1);
		assert.strictEqual(lastLogs[0].id, id);

		// 2. Trigger by updating log
		logger.updateLog(id, { status: 'Completed' as const });
		assert.strictEqual(callCount, 2);
		assert.strictEqual(lastLogs[0].status, 'Completed');

		// 3. Trigger by clearing logs
		logger.clear();
		assert.strictEqual(callCount, 3);
		assert.strictEqual(lastLogs.length, 0);

		// 4. Remove listener and check no further calls
		logger.removeListener(listener);
		logger.addLog({
			commandLine: 'git diff',
			level: 'Level 1',
			status: 'Allowed' as const
		});
		assert.strictEqual(callCount, 3); // Still 3
	});

	it('should handle listener exceptions gracefully without stopping other notifications', () => {
		const logger = CommandLogger.getInstance();
		let callbackSuccess = false;

		const badListener = () => {
			throw new Error('Bad listener');
		};
		const goodListener = () => {
			callbackSuccess = true;
		};

		logger.addListener(badListener);
		logger.addListener(goodListener);

		assert.doesNotThrow(() => {
			logger.addLog({
				commandLine: 'ping localhost',
				level: 'Level 1',
				status: 'Allowed' as const
			});
		});

		assert.strictEqual(callbackSuccess, true);
	});
});
