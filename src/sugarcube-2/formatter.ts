import * as vscode from "vscode";
import { indentationConstructor, isMacroContainer } from "../utils";
import { macroList } from "./macros";
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
		replacement: "\\n\\n",
	},

	// NO_MULTILINE_EMPTY_MACROS: {
	// 	regex: />>\s+<<\//gm,
	// 	replacement: ">><</",
	// },
};
/* A capture group of all the possible comments */
const INSIDE_COMMENT: RegExp = /(\/\*([\s\S]*?)\*\/)|(\/%([\s\S]*?)%\/)|(<!--([\s\S]*?)-->)/gm;

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

			await indentation(document, modifications);

			/** Index[0] is the start of the pattern, [1] is the last position */
			let ranges: [[number, number]] = [[0, 0]];

			var match: RegExpMatchArray | null = fullText.match(INSIDE_COMMENT);

			if (match) {
				/** I have no idea what is happening here, but oh well */
				while ((match = INSIDE_COMMENT.exec(fullText))) {
					ranges.push([match.index as number, INSIDE_COMMENT.lastIndex]);
				}
			}

			mainLoop: for (const rule in FULL_DOCUMENT_RULES) {
				if (Object.prototype.hasOwnProperty.call(FULL_DOCUMENT_RULES, rule)) {
					const currentRule = FULL_DOCUMENT_RULES[rule];
					const currentExec = currentRule.regex.exec(fullText);

					if (currentExec) {
						// console.log(
						// 	FULL_DOCUMENT_RULES.EMPTY_PASSAGES.regex.exec(fullText)?.index
						// );

						for (let r in ranges) {
							const range: [number, number] = ranges[r];
							// console.log(range);

							if (
								currentExec.index >= range[0] &&
								currentExec.index <= range[1]
							) {
								console.log(rule + " is inside comment");

								continue mainLoop;
							}
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
	modifications: vscode.TextEdit[]
) {
	const newMacroList = await macroList();
	const numLines = document.lineCount;
	let indentationLevel = 0;

	function setIndentationLevel(amount: number) {
		indentationLevel = clamp(indentationLevel + amount, 0, Infinity);
	}
	function applyIndentation(line: vscode.TextLine, level: number) {
		modifications.push(
			vscode.TextEdit.insert(
				line.range.start,
				indentationConstructor(level) + level
			)
		);
	}
	for (let i = 0; i < numLines; i++) {
		const line: vscode.TextLine = document.lineAt(i);

		//*remove any indentation
		modifications.push(vscode.TextEdit.replace(line.range, line.text.trim()));

		if (/>>(?=\S)/gm.test(line.text)) {
			modifications.push(
				vscode.TextEdit.replace(
					line.range,
					line.text.replace(/>>(?=\S)/gm, ">>\n")
				)
			);
			applyIndentation(line, indentationLevel);
			continue;
		}
		const isContainer: isMacroContainer = isMacroContainer(
			line.text,
			newMacroList
		);
		if (isContainer.container && !isContainer.startOfMacro) {
			setIndentationLevel(-1);
		}

		applyIndentation(line, indentationLevel);

		if (isContainer.container && isContainer.startOfMacro) {
			setIndentationLevel(1);
		}
	}
}
