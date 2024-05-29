import * as vscode from "vscode";
import {
	inAnyRange,
	indentationConstructor,
	getMacroData,
	macroData,
	isParent,
} from "../utils";
import { macroDef, macroList } from "./macros";
import { clamp } from "lodash";

type FullDocumentRules = {
	[name: string]: {
		regex: RegExp;
		replacement: string;
	};
};

/* the names are being read directly so... */
const FULL_DOCUMENT_RULES: FullDocumentRules = {
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

	STICKY_SET: {
		regex: /<<\s*set(?=[^a-zA-Z0-9 ])/gm,
		replacement: "<<set ",
	},
};
/* A capture group of all the possible comments */
const INSIDE_COMMENT: RegExp = /(\/\*([\s\S]*?)\*\/)|(\/%([\s\S]*?)%\/)|(<!--([\s\S]*?)-->)/gm;

const SINGLE_LINE_MACROS: RegExp = />>(?=\S)/gm;

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

			var insideComment: RegExpMatchArray | null = fullText.match(
				INSIDE_COMMENT
			);
			let ranges: [[number, number]] = [[0, 0]];

			if (insideComment) {
				/** I have no idea what is happening here, but oh well */
				while ((insideComment = INSIDE_COMMENT.exec(fullText))) {
					ranges.push([
						insideComment.index as number,
						INSIDE_COMMENT.lastIndex,
					]);
				}
			}
			await indentation(document, modifications, ranges);

			mainLoop: for (const rule in FULL_DOCUMENT_RULES) {
				if (Object.prototype.hasOwnProperty.call(FULL_DOCUMENT_RULES, rule)) {
					const currentRule = FULL_DOCUMENT_RULES[rule];
					const currentExec = currentRule.regex.exec(fullText);

					if (currentExec) {
						if (inAnyRange(currentExec.index, ranges)) {
							console.log(rule + " is inside comment");
							continue mainLoop;
						}
						modifications.push(
							vscode.TextEdit.replace(
								fullDocumentRange,
								fullText.replace(currentRule.regex, currentRule.replacement)
							)
						);
					}
				}
			}
			return modifications;
		},
	});
}

export async function indentation(
	document: vscode.TextDocument,
	modifications: vscode.TextEdit[],
	ranges: [[number, number]]
) {
	const childIndenters = ["else", "elseif", "case"];
	const newMacroList = await macroList();
	console.log(newMacroList);

	const numLines = document.lineCount;
	const fullText: string = document.getText();
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

		// console.log(fullText.indexOf(line.text));

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

		// if (macroInfo.start) console.log(macroInfo);

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

		// if ((macroInfo.container && !macroInfo.start) || macroInfo.parents) {
		// 	setIndentationLevel(-1);
		// }

		// // if (
		// // 	macroInfo.parents ||
		// // 	indentationLevel <= 1 ||
		// // 	(macroInfo.container && macroInfo.children && !macroInfo.start)
		// // ) {
		// // 	childIndentation = false;
		// // }

		// applyIndentation(line, indentationLevel + (childIndentation ? 1 : 0));

		// if (macroInfo.container && macroInfo.start) {
		// 	setIndentationLevel(1);
		// }
		// if (macroInfo.parents) {
		// 	// console.log(macroInfo);

		// 	setIndentationLevel(1);
		// 	// childIndentation = true;
		// }
	}
}
