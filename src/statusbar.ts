import * as vscode from 'vscode';
import { getConfig } from './config';
import { YoloLevel } from './types';

export class AntiYoloStatusBar {
	private statusBarItem: vscode.StatusBarItem;
	private configDisposable: vscode.Disposable;

	constructor(private context: vscode.ExtensionContext) {
		// Create status bar item aligned to the right side
		this.statusBarItem = vscode.window.createStatusBarItem(
			vscode.StatusBarAlignment.Right,
			100
		);
		this.statusBarItem.command = 'antiyolo.showMenu';
		context.subscriptions.push(this.statusBarItem);

		// Watch configuration changes
		this.configDisposable = vscode.workspace.onDidChangeConfiguration((e) => {
			if (e.affectsConfiguration('antiyolo')) {
				this.update();
			}
		});
		context.subscriptions.push(this.configDisposable);

		this.update();
		this.statusBarItem.show();
	}

	public update() {
		const config = getConfig();
		
		if (!config.enabled) {
			this.statusBarItem.text = '🔓 AntiYolo: Bypassed';
			this.statusBarItem.tooltip = 'AntiYolo is currently disabled. Agent commands are executed immediately without validation.';
			this.statusBarItem.color = new vscode.ThemeColor('statusBarItem.warningBackground');
		} else {
			const levels = ['Interactive', 'Read-Only', 'Scoped', 'Full'];
			const levelText = levels[config.yoloLevel] || 'Interactive';
			this.statusBarItem.text = `🛡️ AntiYolo: ${levelText}`;
			this.statusBarItem.tooltip = `AntiYolo is active (Level: ${levelText}). Click to configure settings.`;
			this.statusBarItem.color = undefined; // standard text color
		}
	}

	public async showMenu() {
		const configObj = vscode.workspace.getConfiguration('antiyolo');
		const config = getConfig();

		interface MenuQuickPickItem extends vscode.QuickPickItem {
			action: () => Promise<void> | void;
		}

		const items: MenuQuickPickItem[] = [];

		// Enablement Option
		if (config.enabled) {
			items.push({
				label: '$(play) Bypass AntiYolo Command Safety',
				description: 'Temporarily allow all command executions without validation',
				action: async () => {
					await configObj.update('enabled', false, vscode.ConfigurationTarget.Global);
					vscode.window.showInformationMessage('AntiYolo Command Safety has been bypassed.');
				}
			});
		} else {
			items.push({
				label: '$(shield) Enable AntiYolo Command Safety',
				description: 'Resume safety check validations on commands',
				action: async () => {
					await configObj.update('enabled', true, vscode.ConfigurationTarget.Global);
					vscode.window.showInformationMessage('AntiYolo Command Safety has been enabled.');
				}
			});
		}

		// Workspace restriction toggle
		const restrictLabel = config.restrictToWorkspace ? '$(lock) Disable Workspace Boundary' : '$(unlock) Enable Workspace Boundary';
		const restrictDesc = config.restrictToWorkspace 
			? 'Allow agent commands to access/reference paths outside the workspace folder' 
			: 'Restrict agent commands to paths inside the workspace folder';
		items.push({
			label: restrictLabel,
			description: restrictDesc,
			action: async () => {
				await configObj.update('restrictToWorkspace', !config.restrictToWorkspace, vscode.ConfigurationTarget.Global);
				vscode.window.showInformationMessage(
					`Workspace Safety Boundary is now ${!config.restrictToWorkspace ? 'Enabled' : 'Disabled'}.`
				);
			}
		});

		// Change Level submenu options
		const levels = ['Interactive (Level 0)', 'Read-Only YOLO (Level 1)', 'Scoped YOLO (Level 2)', 'Full YOLO (Level 3)'];
		const currentLevelText = levels[config.yoloLevel] || 'Interactive';
		items.push({
			label: '$(list-unordered) Change YOLO Security Level',
			description: `Current: ${currentLevelText}`,
			action: async () => {
				const levelOptions = [
					{ label: 'Interactive (Level 0)', description: 'Always prompt for manual approval on every command', value: YoloLevel.Interactive },
					{ label: 'Read-Only YOLO (Level 1)', description: 'Auto-run cat, ls, grep, git status, git diff, etc.', value: YoloLevel.ReadOnly },
					{ label: 'Scoped YOLO (Level 2)', description: 'Auto-run selected categories (package, git, build, etc.)', value: YoloLevel.Scoped },
					{ label: 'Full YOLO (Level 3)', description: 'Auto-run all commands except critical destructive ones', value: YoloLevel.Full }
				];

				const selected = await vscode.window.showQuickPick(levelOptions, {
					placeHolder: 'Select active YOLO Level for the command interceptor'
				});

				if (selected !== undefined) {
					await configObj.update('yoloLevel', selected.value, vscode.ConfigurationTarget.Global);
					vscode.window.showInformationMessage(`AntiYolo level changed to: ${selected.label}`);
				}
			}
		});

		// Dashboard shortcut
		items.push({
			label: '$(dashboard) Open settings & audit log dashboard',
			action: () => {
				vscode.commands.executeCommand('antiyolo.showDashboard');
			}
		});

		const selection = await vscode.window.showQuickPick(items, {
			placeHolder: 'Configure AntiYolo Command Safety'
		});

		if (selection) {
			await selection.action();
		}
	}
}
