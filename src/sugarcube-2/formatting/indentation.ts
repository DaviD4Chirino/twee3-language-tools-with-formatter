import * as vscode from "vscode";
import { indentationConstructor, getMacroData, macroData } from "../../utils";
import { macroList } from "../macros";
import { clamp } from "lodash";

export async function indentation(
	document: vscode.TextDocument,
	modifications: vscode.TextEdit[]
) {
	const SINGLE_LINE_OBJECT_ARRAY_REGEX: RegExp = /{.*}|\[.*\]/gm;
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

		const isObjectArraySingleLine: Boolean = SINGLE_LINE_OBJECT_ARRAY_REGEX.test(
			line.text
		);

		if (
			(macroInfo.container && !macroInfo.start) ||
			(line.text.includes("}") && !isObjectArraySingleLine)
		) {
			setIndentationLevel(-1);
		}
		// if is a child macro and is a permitted macro, it will unindent,
		// Also when the level is 0, because if theres no more indentation  we can safely assume is the end
		if (
			(macroInfo.parents && childIndenters.includes(macroInfo.name || "")) ||
			(childIndentation && indentationLevel == 0)
		) {
			childIndentation = false;
		}

		applyIndentation(line, indentationLevel + (childIndentation ? 1 : 0));

		if (
			(macroInfo.container && macroInfo.start) ||
			(line.text.includes("{") && !isObjectArraySingleLine)
		) {
			setIndentationLevel(1);
		}
		if (macroInfo.parents && childIndenters.includes(macroInfo.name || "")) {
			childIndentation = true;
		}
	}
}
