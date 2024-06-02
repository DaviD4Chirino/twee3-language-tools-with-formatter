import * as vscode from "vscode";
import { parseReplacementString } from "../../utils";
import { MacroRegexType, macroNamePattern, macroRegexFactory } from "../macros";
export type Rules = {
	[name: string]: {
		regex: RegExp;
		replacement: string;
	};
};

/** you can use {[index]} in the replacement to reference a group of the regex, by number.
 *
 * Also, you can use a ternary like so
 * ({[index]}? {[index]}:{[index2]})
 * in this case it will look into the first index to check if it exist, if it does, it replaces it with anything after ? stopping at : , if not, it replaces anything after the : stopping at )
 */
export const LINE_BY_LINE_RULES: Rules = {
	CORRECTLY_FORMATTED_SET_UNSET: {
		regex: /<<\s*(set|unset)\s*(\$\w*|_\w*)\s*(=|\+=|-=|%=|\*=|\/=)\s*(.*)>>/gm,
		replacement: "<<{[1]} {[2]} {[3]} {[4]}>>",
	},
	FORMAT_UNASSIGNED_SET_UNSET: {
		regex: /<<\s*(set|unset)\s*(\$\w*|_\w*)\s*>>/gm,
		replacement: "<<{[1]} {[2]}>>",
	},
	// SYMBOL_FORMAT_STUCK_START: {
	// 	regex: /(=|\+=|-=|%=|\*=|\/=)(?=[\S])/gm,
	// 	replacement: "{[1]} ",
	// },
	// CORRECT_UNSET_FORMATTING: {
	// 	regex: /<<\s*(set|unset)\s*(\$\w*|_\w*)\s*>>/gm,
	// 	replacement: "<<{[1]} {[2]}>>",
	// },
	// CORRECT_PRINT_FORMATTING: {
	// 	regex: /<<\s*(print|=|-)\s*(.*)\s*>>/gm,
	// 	replacement: "<<{[1]}({[2]}? {[2]}:)>>",
	// },
	// CORRECT_PRINT_MACROS: {
	// 	regex: /<<(print|=|-)\s*(.*)>>/gm,
	// 	replacement: "<<{[1]}({[2]}? {[2]}:)>>",
	// },
	// CORRECT_MACRO_FORMAT_START: {
	// 	regex: macroRegexFactory(macroNamePattern, MacroRegexType.Start),
	// 	replacement: "<<{[1]}({[2]}? {[2]}:)>>",
	// },

	// STICKY_SET_UNSET: {
	// 	regex: /<<\s*(set|unset)(?=[^a-zA-Z0-9 ])/gm,
	// 	replacement: "<<{[1]} ",
	// },
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
}
