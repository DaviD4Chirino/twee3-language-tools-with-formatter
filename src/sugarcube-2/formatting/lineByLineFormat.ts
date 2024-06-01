import * as vscode from "vscode";
import { handleLineByLineRules } from "./handleLineByLineRules";

export function lineByLineFormat(
	document: vscode.TextDocument,
	modifications: vscode.TextEdit[]
) {
	const numLines = document.lineCount;
	for (let i = 0; i < numLines; i++) {
		const line: vscode.TextLine = document.lineAt(i);

		handleLineByLineRules(line, modifications);
	}
}
