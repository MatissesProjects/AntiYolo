import * as http from 'http';
import * as url from 'url';

export type ActionType = 'Execute' | 'Always Execute' | 'Cancel';

export class LocalApprovalServer {
	private server: http.Server | null = null;
	private port: number = 7788;
	private onActionCallback: ((logId: string, token: string, action: ActionType) => boolean | Promise<boolean>) | null = null;

	constructor() {}

	public setOnAction(callback: (logId: string, token: string, action: ActionType) => boolean | Promise<boolean>) {
		this.onActionCallback = callback;
	}

	public start(port: number): Promise<void> {
		this.port = port;
		if (this.server) {
			return Promise.resolve();
		}

		return new Promise((resolve, reject) => {
			this.server = http.createServer(async (req, res) => {
				const parsedUrl = url.parse(req.url || '', true);
				
				if (parsedUrl.pathname === '/respond') {
					const id = parsedUrl.query.id as string;
					const token = parsedUrl.query.token as string;
					const rawAction = parsedUrl.query.action as string;

					let action: ActionType | null = null;
					if (rawAction === 'Execute') {
						action = 'Execute';
					} else if (rawAction === 'AlwaysExecute' || rawAction === 'Always Execute') {
						action = 'Always Execute';
					} else if (rawAction === 'Cancel') {
						action = 'Cancel';
					}

					if (!id || !token || !action || !this.onActionCallback) {
						this.sendResponse(res, 400, 'Invalid Request', 'Missing required query parameters or server not fully initialized.', 'error', 'Error');
						return;
					}

					try {
						const success = await this.onActionCallback(id, token, action);
						if (success) {
							let badgeClass: 'success' | 'warning' | 'error' = 'success';
							let statusText = 'Approved';
							let titleText = 'Command Authorized';
							let msgText = 'The command was successfully approved and sent for execution.';

							if (action === 'Always Execute') {
								badgeClass = 'success';
								statusText = 'Whitelisted & Approved';
								titleText = 'Command Whitelisted';
								msgText = 'The command was successfully whitelisted and approved for execution.';
							} else if (action === 'Cancel') {
								badgeClass = 'error';
								statusText = 'Denied';
								titleText = 'Command Execution Cancelled';
								msgText = 'The command execution request was successfully denied and cancelled.';
							}

							this.sendResponse(res, 200, titleText, msgText, badgeClass, statusText);
						} else {
							this.sendResponse(res, 403, 'Request Expired or Invalid', 'This authorization request is either expired, has already been processed, or the security token did not match.', 'warning', 'Expired');
						}
					} catch (err) {
						this.sendResponse(res, 500, 'Server Error', `An internal error occurred: ${(err as Error).message}`, 'error', 'Error');
					}
				} else {
					res.writeHead(404, { 'Content-Type': 'text/plain' });
					res.end('Not Found');
				}
			});

			this.server.on('error', (err) => {
				console.error('AntiYolo Local Server error:', err);
				reject(err);
			});

			this.server.listen(this.port, () => {
				console.log(`AntiYolo Local Approval Server listening on port ${this.port}`);
				resolve();
			});
		});
	}

	public stop(): Promise<void> {
		return new Promise((resolve) => {
			if (!this.server) {
				resolve();
				return;
			}

			this.server.close((err) => {
				if (err) {
					console.error('Error closing AntiYolo Local Server:', err);
				}
				this.server = null;
				console.log('AntiYolo Local Approval Server stopped');
				resolve();
			});
		});
	}

	public getPort(): number {
		return this.port;
	}

	private sendResponse(
		res: http.ServerResponse,
		statusCode: number,
		title: string,
		message: string,
		badgeClass: 'success' | 'warning' | 'error',
		statusText: string
	) {
		res.writeHead(statusCode, { 'Content-Type': 'text/html' });
		res.end(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AntiYolo Approval: ${statusText}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
        body {
            font-family: 'Inter', -apple-system, sans-serif;
            background-color: #0b0e14;
            color: #e6edf3;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
        }
        .card {
            background: rgba(20, 24, 33, 0.75);
            border: 1px solid rgba(48, 54, 61, 0.5);
            border-radius: 12px;
            padding: 40px;
            text-align: center;
            max-width: 480px;
            width: 100%;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), 0 0 15px rgba(88, 166, 255, 0.1);
            backdrop-filter: blur(12px);
        }
        h1 {
            font-size: 1.6rem;
            font-weight: 700;
            margin-top: 0;
            margin-bottom: 16px;
            background: linear-gradient(135deg, #fff 40%, #58a6ff 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        p {
            color: #8b949e;
            font-size: 0.95rem;
            line-height: 1.6;
            margin-bottom: 32px;
        }
        .badge {
            display: inline-block;
            padding: 6px 14px;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 24px;
        }
        .success {
            background: rgba(63, 185, 80, 0.15);
            color: #3fb950;
            border: 1px solid rgba(63, 185, 80, 0.3);
            box-shadow: 0 0 10px rgba(63, 185, 80, 0.15);
        }
        .warning {
            background: rgba(210, 153, 34, 0.15);
            color: #d29922;
            border: 1px solid rgba(210, 153, 34, 0.3);
            box-shadow: 0 0 10px rgba(210, 153, 34, 0.15);
        }
        .error {
            background: rgba(248, 81, 73, 0.15);
            color: #f85149;
            border: 1px solid rgba(248, 81, 73, 0.3);
            box-shadow: 0 0 10px rgba(248, 81, 73, 0.15);
        }
        .close-hint {
            font-size: 0.8rem;
            color: #8b949e;
            border-top: 1px solid rgba(48, 54, 61, 0.5);
            padding-top: 20px;
        }
    </style>
</head>
<body>
    <div class="card">
        <div class="badge ${badgeClass}">${statusText}</div>
        <h1>${title}</h1>
        <p>${message}</p>
        <div class="close-hint">You can safely close this browser window.</div>
    </div>
</body>
</html>`);
	}
}
