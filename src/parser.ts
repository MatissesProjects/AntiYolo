export function parseCommand(commandLine: string): string[] {
	// Split by logical operators and pipes: ;, &&, ||, |
	const segments = commandLine.split(/(?:&&|\|\||\||;)/g);
	const commands: string[] = [];

	for (const segment of segments) {
		const trimmed = segment.trim();
		if (trimmed) {
			commands.push(trimmed);
		}
	}

	return commands;
}
