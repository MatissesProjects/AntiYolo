export interface LogEntry {
	id: string;
	timestamp: string;
	commandLine: string;
	level: string;
	status: 'Allowed' | 'Approved' | 'Denied' | 'Blocked' | 'Timed Out' | 'Failed' | 'Running' | 'Completed';
	durationMs?: number;
	output?: string;
}

type LogListener = (logs: LogEntry[]) => void;

export class CommandLogger {
	private static instance: CommandLogger;
	private logs: LogEntry[] = [];
	private listeners: Set<LogListener> = new Set();
	private maxLogs = 50;

	private constructor() {}

	public static getInstance(): CommandLogger {
		if (!CommandLogger.instance) {
			CommandLogger.instance = new CommandLogger();
		}
		return CommandLogger.instance;
	}

	public addLog(entry: Omit<LogEntry, 'id' | 'timestamp'>): string {
		const id = Math.random().toString(36).substring(2, 9);
		const timestamp = new Date().toLocaleTimeString();
		const fullEntry: LogEntry = {
			...entry,
			id,
			timestamp
		};
		this.logs.unshift(fullEntry);
		if (this.logs.length > this.maxLogs) {
			this.logs.pop();
		}
		this.notify();
		return id;
	}

	public updateLog(id: string, updates: Partial<Omit<LogEntry, 'id' | 'timestamp'>>) {
		const index = this.logs.findIndex(log => log.id === id);
		if (index !== -1) {
			this.logs[index] = {
				...this.logs[index],
				...updates
			};
			this.notify();
		}
	}

	public getLogs(): LogEntry[] {
		return [...this.logs];
	}

	public clear() {
		this.logs = [];
		this.notify();
	}

	public addListener(listener: LogListener) {
		this.listeners.add(listener);
	}

	public removeListener(listener: LogListener) {
		this.listeners.delete(listener);
	}

	private notify() {
		const currentLogs = this.getLogs();
		for (const listener of this.listeners) {
			try {
				listener(currentLogs);
			} catch (e) {
				console.error('Error executing log listener:', e);
			}
		}
	}
}
