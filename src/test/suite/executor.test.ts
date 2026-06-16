// Load the mock first using require to ensure CommonJS execution and avoid ESM path resolution errors
require('./vscode-mock');

import * as assert from 'assert';
import { executeStructuredCommand } from '../../executor';

describe('CommandExecutor (executeStructuredCommand) Unit Tests', () => {
	it('should successfully execute a valid command and capture stdout', async () => {
		const result = await executeStructuredCommand('echo', ['hello world']);
		assert.ok(result.includes('[stdout]'));
		assert.ok(result.includes('hello world'));
	});

	it('should capture stderr when a command prints to it', async () => {
		// Run node script to output to stderr
		const result = await executeStructuredCommand('node', ['-e', 'console.error("test-error-output")']);
		assert.ok(result.includes('[stderr]'));
		assert.ok(result.includes('test-error-output'));
	});

	it('should capture non-zero exit codes', async () => {
		const result = await executeStructuredCommand('node', ['-e', 'process.exit(42)']);
		assert.ok(result.includes('[exit]'));
		assert.ok(result.includes('Process exited with code 42'));
	});

	it('should handle process spawn failures gracefully', async () => {
		const result = await executeStructuredCommand('non-existent-executable-xyz', []);
		assert.ok(result.includes('[error]'));
		assert.ok(result.includes('ENOENT'));
	});

	it('should terminate the process and return a timeout error on execution timeout', async () => {
		// Run a sleep command that takes 5 seconds, but set the timeout to 100ms
		const startTime = Date.now();
		const result = await executeStructuredCommand('sleep', ['5'], undefined, 100);
		const duration = Date.now() - startTime;

		assert.ok(result.includes('[error]'));
		assert.ok(result.includes('Execution timed out after 100ms.'));
		// Check that it actually resolved quickly (around 100ms instead of 5000ms)
		assert.ok(duration < 1000, `Expected duration to be less than 1s, got ${duration}ms`);
	});

	it('should fallback to default workspace dir if cwd is not specified', async () => {
		// In our mock, process.cwd() is used as the default workspace folder
		const result = await executeStructuredCommand('pwd', []);
		assert.ok(result.includes('[stdout]'));
		assert.ok(result.includes(process.cwd()));
	});
});
