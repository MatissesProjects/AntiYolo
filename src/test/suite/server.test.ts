require('./vscode-mock');

import * as assert from 'assert';
import { LocalApprovalServer } from '../../server';
import * as http from 'http';

describe('LocalApprovalServer Unit Tests', () => {
	let server: LocalApprovalServer;
	const port = 8999;

	beforeEach(() => {
		server = new LocalApprovalServer();
	});

	afterEach(async () => {
		await server.stop();
	});

	it('should start and stop the server', async () => {
		await server.start(port);
		assert.strictEqual(server.getPort(), port);
		await server.stop();
	});

	it('should invoke callback on valid /respond request', async () => {
		let callbackInvoked = false;
		let receivedId = '';
		let receivedToken = '';
		let receivedAction = '';

		server.setOnAction((id, token, action) => {
			callbackInvoked = true;
			receivedId = id;
			receivedToken = token;
			receivedAction = action;
			return true;
		});

		await server.start(port);

		// Make HTTP request to /respond
		const res = await new Promise<http.IncomingMessage>((resolve, reject) => {
			http.get(`http://localhost:${port}/respond?id=log123&token=secret123&action=AlwaysExecute`, resolve).on('error', reject);
		});

		assert.strictEqual(res.statusCode, 200);
		assert.strictEqual(callbackInvoked, true);
		assert.strictEqual(receivedId, 'log123');
		assert.strictEqual(receivedToken, 'secret123');
		assert.strictEqual(receivedAction, 'Always Execute');
	});

	it('should return 403 when callback returns false', async () => {
		server.setOnAction(() => {
			return false;
		});

		await server.start(port);

		const res = await new Promise<http.IncomingMessage>((resolve, reject) => {
			http.get(`http://localhost:${port}/respond?id=log123&token=wrong&action=Execute`, resolve).on('error', reject);
		});

		assert.strictEqual(res.statusCode, 403);
	});

	it('should return 400 when query parameters are missing', async () => {
		server.setOnAction(() => true);
		await server.start(port);

		const res = await new Promise<http.IncomingMessage>((resolve, reject) => {
			http.get(`http://localhost:${port}/respond?id=log123`, resolve).on('error', reject);
		});

		assert.strictEqual(res.statusCode, 400);
	});
});
