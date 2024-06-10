import * as vscode from "vscode";
import { parseReplacementString } from "../../utils";
export type Rules = {
	[name: string]: {
		regex: RegExp;
		replacement: string;
	};
};

export const LINE_BY_LINE_RULES: Rules = {
	CORRECTLY_FORMATTED_SET_UNSET: {
		regex: /<<\s*(set|unset)\s*(\$\w*|_\w*)\s*(=|\+=|-=|%=|\*=|\/=)\s*(.*)>>/gm,
		replacement: "<<{[1]} {[2]} {[3]} {[4]}>>",
	},
	FORMAT_UNASSIGNED_SET_UNSET: {
		regex: /<<\s*(set|unset)\s*(\$\w*|_\w*)\s*>>/gm,
		replacement: "<<{[1]} {[2]}>>",
	},
	// FORMAT_CLOSING_SINGLE_MACROS: {
	// 	regex: /([\w.\]}>])<<\//m,
	// 	replacement: "{[1]}\n<</",
	// },
	// CORRECT_UNSET_FORMATTING: {
	// 	regex: /<<\s*(set|unset)\s*(\$\w*|_\w*)\s*>>/gm,
	// 	replacement: "<<{[1]} {[2]}>>",
	// },
	CORRECT_PRINT_FORMATTING: {
		regex: /<<\s*(print|=|-)\s*(.*)\s*>>/gm,
		replacement: "<<{[1]}({[2]}? {[2]}:)>>",
	},
};
export function handleLineByLineRules(
	line: vscode.TextLine,
	modifications: vscode.TextEdit[]
) {
	for (const rule in LINE_BY_LINE_RULES) {
		if (Object.prototype.hasOwnProperty.call(LINE_BY_LINE_RULES, rule)) {
			const currentRule = LINE_BY_LINE_RULES[rule];
			let replacement: string = currentRule.replacement;
			const exec: RegExpExecArray | null = currentRule.regex.exec(line.text);

			// console.log(exec);

			if (exec) {
				replacement = parseReplacementString(currentRule.replacement, exec);

				modifications.push(
					vscode.TextEdit.replace(
						line.range,
						line.text.replace(currentRule.regex, replacement)
					)
				);
			}
		}
	}

	// vscode.commands.executeCommand(
	// 	"cyrusfirheir.twee3-language-tools.formatDocument"
	// );
}
