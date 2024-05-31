import * as vscode from "vscode";
import {
	indentationConstructor,
	getMacroData,
	macroData,
	inAnyRange,
	parseReplacementString,
} from "../utils";
import {
	MacroRegexType,
	macroList,
	macroNamePattern,
	macroRegex,
	macroRegexFactory,
} from "./macros";
import { clamp } from "lodash";

type Rules = {
	[name: string]: {
		regex: RegExp;
		replacement: string;
	};
};

/* the names are being read directly so... */
const FULL_DOCUMENT_RULES: Rules = {
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
	NOT_MUCH_SPACE: {
		regex: /\n{2,}/gm,
		replacement: "",
	},

	// NO_MULTILINE_EMPTY_MACROS: {
	// 	regex: />>\s+<<\//gm,
	// 	replacement: ">><</",
	// },

	// STUCK_OPERATOR_END: {
	// 	regex: /(=|\+=|-=|%=|\*=|\/=)(?=\S)/gm,
	// 	replacement: "{[1]} ",
	// },
};

/** you can use {[index]} in the replacement to reference a group of the regex, by number */
// TODO: make it so it doest match when the string is correctly formatted
const LINE_BY_LINE_RULES: Rules = {
	CORRECTLY_FORMATTED_SET_UNSET: {
		regex: /<<\s*(set|unset)\s*(\$\w*|_\w*)\s*(=|\+=|-=|%=|\*=|\/=)\s*(.*)>>/gm,
		replacement: "<<{[1]} {[2]} {[3]} {[4]}>>",
	},
	CORRECT_UNSET_FORMATTING: {
		regex: /<<\s*(set|unset)\s*(\$\w*|_\w*)\s*>>/gm,
		replacement: "<<{[1]} {[2]}>>",
	},
	CORRECT_PRINT_FORMATTING: {
		regex: /<<\s*(print|=|-)\s*(.*)\s*>>/gm,
		replacement: "<<{[1]}({[2]}? {[2]}:)>>",
	},
	// CORRECT_PRINT_MACROS: {
	// 	regex: /<<(print|=|-)\s*(.*)>>/gm,
	// 	replacement: "<<{[1]}({[2]}? {[2]}:)>>",
	// },
	// CORRECT_MACRO_FORMAT: {
	// 	regex: macroRegexFactory(macroNamePattern, MacroRegexType.Start),
	// 	replacement: "<<{[1]}({[2]}? {[2]}:)>>",
	// },

	// STICKY_SET_UNSET: {
	// 	regex: /<<\s*(set|unset)(?=[^a-zA-Z0-9 ])/gm,
	// 	replacement: "<<{[1]} ",
	// },
};

// const macroInfoRegexp: RegExp = /<<\s*(?<name>unset|set)\s*(?<variable>\$\w*|_\w*)\s*(?<assignment>=|\+=|-=|%=|\*=|\/=)\s*(?<value>.*)>>/gm;

/* A capture group of all the possible comments */
// const INSIDE_COMMENT: RegExp = /(\/\*([\s\S]*?)\*\/)|(\/%([\s\S]*?)%\/)|(<!--([\s\S]*?)-->)/gm;

// const SINGLE_LINE_MACROS: RegExp = />>(?=\S)/gm;

/** Index[0] is the start of the pattern, [1] is the last position */

export async function formatter() {
	vscode.languages.registerDocumentFormattingEditProvider("twee3-sugarcube-2", {
		async provideDocumentFormattingEdits(
			document: vscode.TextDocument
		): Promise<vscode.TextEdit[]> {
			const fullDocumentRange = new vscode.Range(
				document.positionAt(0),
				document.positionAt(document.getText().length)
			);
			const fullText: string = document.getText();

			const modifications: vscode.TextEdit[] = [];

			// var insideComment: RegExpMatchArray | null = fullText.match(
			// 	INSIDE_COMMENT
			// );
			// let ranges: [[number, number]] = [[0, 0]];

			// if (insideComment) {
			// 	/** I have no idea what is happening here, but oh well */
			// 	while ((insideComment = INSIDE_COMMENT.exec(fullText))) {
			// 		ranges.push([
			// 			insideComment.index as number,
			// 			INSIDE_COMMENT.lastIndex,
			// 		]);
			// 	}
			// }
			await indentation(document, modifications);

			mainLoop: for (const rule in FULL_DOCUMENT_RULES) {
				if (Object.prototype.hasOwnProperty.call(FULL_DOCUMENT_RULES, rule)) {
					const currentRule = FULL_DOCUMENT_RULES[rule];
					const exec = currentRule.regex.exec(fullText);

					if (exec) {
						// if (inAnyRange(exec.index, ranges)) {
						// 	// console.log(rule + " is inside comment");
						// 	continue mainLoop;
						// }

						modifications.push(
							vscode.TextEdit.replace(
								fullDocumentRange,
								fullText.replace(currentRule.regex, currentRule.replacement)
							)
						);
					}
				}
			}

			lineByLine(document, modifications);
			return modifications;
		},
	});
}

async function indentation(
	document: vscode.TextDocument,
	modifications: vscode.TextEdit[]
) {
	const childIndenters = ["else", "elseif"];
	const newMacroList = await macroList();

	const numLines = document.lineCount;
	let indentationLevel = 0;
	let childIndentation: Boolean = false;

	function setIndentationLevel(amount: number) {
		indentationLevel = clamp(indentationLevel + amount, 0, Infinity);
	}
	function applyIndentation(line: vscode.TextLine, level: number) {
		modifications.push(
			vscode.TextEdit.insert(line.range.start, indentationConstructor(level))
		);
	}
	for (let i = 0; i < numLines; i++) {
		const line: vscode.TextLine = document.lineAt(i);

		//*remove any indentation
		modifications.push(vscode.TextEdit.replace(line.range, line.text.trim()));

		// do it here to fix a bug where sometimes it messes indentation
		// if (SINGLE_LINE_MACROS.test(line.text)) {
		// 	modifications.push(
		// 		vscode.TextEdit.replace(
		// 			line.range,
		// 			line.text.replace(SINGLE_LINE_MACROS, ">>\n")
		// 		)
		// 	);
		// 	applyIndentation(line, indentationLevel);
		// 	continue;
		// }

		const macroInfo: macroData = getMacroData(line.text, newMacroList);

		if (macroInfo.container && !macroInfo.start) {
			setIndentationLevel(-1);
		}
		if (
			(macroInfo.parents && childIndenters.includes(macroInfo.name || "")) ||
			(childIndentation && indentationLevel == 0)
		) {
			childIndentation = false;
		}

		applyIndentation(line, indentationLevel + (childIndentation ? 1 : 0));

		if (macroInfo.container && macroInfo.start) {
			setIndentationLevel(1);
		}
		if (macroInfo.parents && childIndenters.includes(macroInfo.name || "")) {
			childIndentation = true;
		}
	}
}

function lineByLine(
	document: vscode.TextDocument,
	modifications: vscode.TextEdit[]
) {
	const numLines = document.lineCount;
	for (let i = 0; i < numLines; i++) {
		const line: vscode.TextLine = document.lineAt(i);

		for (const rule in LINE_BY_LINE_RULES) {
			if (Object.prototype.hasOwnProperty.call(LINE_BY_LINE_RULES, rule)) {
				const currentRule = LINE_BY_LINE_RULES[rule];
				let replacement: string = currentRule.replacement;
				const exec: RegExpExecArray | null = currentRule.regex.exec(line.text);

				console.log(exec);

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
}

function handleLineByLineRules(line: vscode.TextLine) {}
