import * as vscode from "vscode";
import { indentationConstructor, isMacroContainer } from "../utils";
import { macroList } from "./macros";

const SPACED_PASSAGES: RegExp = /::\w/gm;
const SINGLE_LINE_MACROS: RegExp = />>(\w|.)/gm;
const SPACE_INSIDE_START_MACROS: RegExp = /<<\s+/gm;
const SPACE_INSIDE_END_MACROS: RegExp = /\s+>>/gm;
const START_OF_A_MACRO: RegExp = /.*<<[^\/]/gm;
const END_OF_A_MACRO: RegExp = /.*<<\//gm;
const TAB: RegExp = /\t+/gm;

export async function formatter() {
	vscode.languages.registerDocumentFormattingEditProvider("twee3-sugarcube-2", {
		async provideDocumentFormattingEdits(
			document: vscode.TextDocument
		): Promise<vscode.TextEdit[]> {
			// const fullDocumentRange = new vscode.Range(
			// 	document.positionAt(0),
			// 	document.positionAt(document.getText().length)
			// );

			const numLines = document.lineCount;
			const modifications: vscode.TextEdit[] = [];

			let indentationLevel = 0;
			const newMacroList = await macroList();
			// isMacroContainer("<<       else  >>", newMacroList);
			// isMacroContainer("<<if true       >>", newMacroList);
			// isMacroContainer("<<test>>", newMacroList);

			for (let i = 0; i < numLines; i++) {
				const line = document.lineAt(i);
				//remove any indentation
				modifications.push(
					vscode.TextEdit.replace(
						line.range,
						line.text.replace(TAB, "").trimStart()
					)
				);

				// start indenting, the level is decided below
				if (new RegExp(END_OF_A_MACRO).test(line.text)) {
					indentationLevel--;
					vscode.window.showInformationMessage(line.text);
					console.log("lowering " + indentationLevel);
				}
				modifications.push(
					vscode.TextEdit.insert(
						line.range.start,
						indentationConstructor(indentationLevel)
					)
				);

				if (new RegExp(START_OF_A_MACRO).test(line.text)) {
					if (isMacroContainer(line.text, newMacroList)) {
						indentationLevel++;
						vscode.window.showInformationMessage(line.text);
						console.log("incrementing " + indentationLevel);
					}
				}
				// if (new RegExp(END_OF_A_MACRO).test(line.text)) {
				// 	indentationLevel--;
				// 	vscode.window.showInformationMessage(line.text);
				// 	console.log("lowering " + indentationLevel);

				// }

				if (new RegExp(SPACED_PASSAGES).test(line.text)) {
					vscode.window.showInformationMessage(line.text);
					modifications.push(
						vscode.TextEdit.replace(line.range, line.text.replace("::", ":: "))
					);
				}
				if (new RegExp(SINGLE_LINE_MACROS).test(line.text)) {
					vscode.window.showInformationMessage(line.text);
					modifications.push(
						vscode.TextEdit.replace(line.range, line.text.replace(">>", ">>\n"))
					);
				}
				if (new RegExp(SPACE_INSIDE_START_MACROS).test(line.text)) {
					vscode.window.showInformationMessage(line.text);
					modifications.push(
						vscode.TextEdit.replace(
							line.range,
							line.text.replace(SPACE_INSIDE_START_MACROS, "<<")
						)
					);
				}

				if (new RegExp(SPACE_INSIDE_END_MACROS).test(line.text)) {
					vscode.window.showInformationMessage(line.text);
					modifications.push(
						vscode.TextEdit.replace(
							line.range,
							line.text.replace(SPACE_INSIDE_END_MACROS, ">>")
						)
					);
				}

				// if (new RegExp(WHITESPACE_BEFORE_PASSAGES).test(document.getText())) {
				// 	vscode.window.showInformationMessage(line.text);
				// 	modifications.push(
				// 		vscode.TextEdit.replace(
				// 			line.range,
				// 			line.text.replace(WHITESPACE_BEFORE_PASSAGES, "\n\n::")
				// 		)
				// 	);
				// }
			}

			return modifications;
		},
	});
}
