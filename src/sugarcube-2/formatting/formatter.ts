import * as vscode from "vscode";
import { indentation } from "./indentation";
import { Rules } from "./handleLineByLineRules";
import { fullDocumentFormat } from "./fullDocumentFormat";
import { lineByLineFormat } from "./lineByLineFormat";

/* the names are being read directly so... */

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

			fullDocumentFormat(document, modifications);

			lineByLineFormat(document, modifications);
			return modifications;
		},
	});
}
