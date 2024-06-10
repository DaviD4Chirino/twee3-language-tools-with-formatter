import * as vscode from "vscode";
import { indentation } from "./indentation";
import { fullDocumentFormat } from "./fullDocumentFormat";
import { lineByLineFormat } from "./lineByLineFormat";

export async function sugarcube2Formatter() {
	vscode.languages.registerDocumentFormattingEditProvider("twee3-sugarcube-2", {
		async provideDocumentFormattingEdits(
			document: vscode.TextDocument
		): Promise<vscode.TextEdit[]> {
			const modifications: vscode.TextEdit[] = [];

			fullDocumentFormat(document, modifications);
			lineByLineFormat(document, modifications);
			await indentation(document, modifications);
			return modifications;
		},
	});
}
