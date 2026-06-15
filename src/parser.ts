const parse = require('bash-parser');

export interface CommandData {
	tokens: string[];
}

export function parseCommand(commandLine: string): CommandData[] {
	let ast;
	try {
		ast = parse(commandLine);
	} catch (err) {
		// Fail safe if parsing fails
		return [{ tokens: ['__parse_error__'] }];
	}

	const commands: CommandData[] = [];

	function walk(node: any) {
		if (!node) return;

		if (node.type === 'Command') {
			const tokens: string[] = [];
			
			if (node.name && node.name.text) {
				tokens.push(node.name.text);
			}

			if (node.suffix) {
				for (const suf of node.suffix) {
					if (suf.text) tokens.push(suf.text);
					
					// Subshells inside suffixes like $(rm -rf /)
					if (suf.expansion) {
						for (const exp of suf.expansion) {
							if (exp.type === 'CommandExpansion' && exp.commandAST) {
								walk(exp.commandAST);
							}
						}
					}
				}
			}

			// Subshells in name
			if (node.name && node.name.expansion) {
				for (const exp of node.name.expansion) {
					if (exp.type === 'CommandExpansion' && exp.commandAST) {
						walk(exp.commandAST);
					}
				}
			}

			if (tokens.length > 0) {
				commands.push({ tokens });
			}
		} else if (node.type === 'Script' || node.type === 'LogicalExpression' || node.type === 'Pipeline') {
			if (node.commands) {
				for (const c of node.commands) walk(c);
			}
			if (node.left) walk(node.left);
			if (node.right) walk(node.right);
		} else if (node.type === 'Subshell') {
			if (node.list) walk(node.list);
		} else if (node.type === 'If') {
			if (node.clause) walk(node.clause);
			if (node.then) walk(node.then);
			if (node.else) walk(node.else);
		} else if (node.type === 'For' || node.type === 'While' || node.type === 'Until') {
			if (node.do) walk(node.do);
		}
	}

	walk(ast);

	return commands;
}
