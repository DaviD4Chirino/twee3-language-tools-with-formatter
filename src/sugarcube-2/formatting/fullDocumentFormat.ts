import * as vscode from "vscode";
import { FULL_DOCUMENT_RULES } from "./formatter";

export function fullDocumentFormat(
	document: vscode.TextDocument,
	modifications: vscode.TextEdit[]
) {
	const fullDocumentRange = new vscode.Range(
		document.positionAt(0),
		document.positionAt(document.getText().length)
	);
	const fullText: string = document.getText();

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
}
