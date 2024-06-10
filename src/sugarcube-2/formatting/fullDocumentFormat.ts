import * as vscode from "vscode";
import { Rules } from "./handleLineByLineRules";
export const FULL_DOCUMENT_RULES: Rules = {
	NO_SPACE_BETWEEN_START_TOKEN_AND_PASSAGE_NAME: {
		regex: /::(?=\S)/gm,
		replacement: ":: ",
	},

	// SPACE_BELOW_MACRO: {
	// 	regex: /.\n(?=::)/gm,
	// 	replacement: "\n\n",
	// },
	// SINGLE_LINE_MACROS: {
	// 	regex: />>(?=\S)/gm,
	// 	replacement: ">>\n",
	// },
	EMPTY_PASSAGES: {
		regex: /::\s*$/gm,
		replacement: "",
	},
	SPACE_INSIDE_ON_START_OF_OPEN_MACRO: {
		regex: /<<\s+/gm,
		replacement: "<<",
	},
	SPACE_INSIDE_ON_END_OF_MACRO: {
		regex: /\s+>>/gm,
		replacement: ">>",
	},
	SPACE_INSIDE_ON_START_OF_CLOSED_MACRO: {
		regex: /<<\/\s+/gm,
		replacement: "<</",
	},
	// SINGLE_LINE_MACROS: {
	// 	regex: />>(?=.+)/gm,
	// 	replacement: ">>\n",
	// },
	SINGLE_LINE_PASSAGES: {
		regex: /\]\](?=<<|<<\/)/gm,
		replacement: "]]\n",
	},
	// NOT_MUCH_SPACE: {
	// 	regex: /\n{2,}/gm,
	// 	replacement: "",
	// },

	// NO_MULTILINE_EMPTY_MACROS: {
	// 	regex: />>\s+<<\//gm,
	// 	replacement: ">><</",
	// },

	// STUCK_OPERATOR_END: {
	// 	regex: /(=|\+=|-=|%=|\*=|\/=)(?=\S)/gm,
	// 	replacement: "{[1]} ",
	// },
};

export function fullDocumentFormat(
	document: vscode.TextDocument,
	modifications: vscode.TextEdit[]
) {
	const fullDocumentRange = new vscode.Range(
		document.positionAt(0),
		document.positionAt(document.getText().length)
	);
	const fullText: string = document.getText();

	for (const rule in FULL_DOCUMENT_RULES) {
		if (Object.prototype.hasOwnProperty.call(FULL_DOCUMENT_RULES, rule)) {
			const currentRule = FULL_DOCUMENT_RULES[rule];
			const exec = currentRule.regex.exec(fullText);

			if (exec) {
				modifications.push(
					vscode.TextEdit.replace(
						fullDocumentRange,
						fullText.replace(currentRule.regex, currentRule.replacement)
					)
				);
			}
		}
	}
}
