import * as vscode from "vscode";
import {
	indentationConstructor,
	getMacroData,
	macroData,
	breakDownObject,
	isHtmlTagOpen,
	isHtmlTag,
	isHtmlTagSingleLine,
} from "../../utils";
import { macroList } from "../macros";
import { clamp } from "lodash";

const SINGLE_LINE_HTML_TAG: RegExp = />(.*)(?=<\/)/m;
const SINGLE_LINE_MACRO: RegExp = />>(.*)(?=<<\/)/m;

export async function indentation(
	document: vscode.TextDocument,
	modifications: vscode.TextEdit[]
) {
	const SINGLE_LINE_OBJECT_ARRAY_REGEX: RegExp = /{.*}|\[.*\]/m;
	const START_OBJECT_ARRAY_REGEX: RegExp = /{|\[/m;
	const END_OBJECT_ARRAY_REGEX: RegExp = /}|\]/m;

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
		const targetIndentationLevel =
			indentationLevel + (childIndentation ? 1 : 0);
		const isHtml: Boolean = isHtmlTag(line.text);
		const isHtmlOpen: Boolean = isHtmlTagOpen(line.text);

		const isHtmlSingleLine: Boolean = isHtmlTagSingleLine(line.text);

		//*remove any indentationconst isHtml: Boolean = isHtmlTag(line.text);
		modifications.push(vscode.TextEdit.replace(line.range, line.text.trim()));

		// do it here to fix a bug where sometimes it messes indentation
		if (SINGLE_LINE_MACRO.test(line.text)) {
			const exec: RegExpExecArray | null = SINGLE_LINE_MACRO.exec(line.text);
			if (exec) {
				modifications.push(
					vscode.TextEdit.replace(
						line.range,
						line.text.replace(
							exec[0],
							`>>\n${indentationConstructor(
								targetIndentationLevel + 1
							)}${exec[1] || ""}\n${indentationConstructor(
								targetIndentationLevel
							)}`
						)
					)
				);
				applyIndentation(line, targetIndentationLevel);
				continue;
			}
			applyIndentation(line, targetIndentationLevel);
			continue;
		}

		if (isHtml) {
			const exec: RegExpExecArray | null = SINGLE_LINE_HTML_TAG.exec(line.text);
			if (exec) {
				modifications.push(
					vscode.TextEdit.replace(
						line.range,
						line.text.replace(
							exec[0],
							`>\n${indentationConstructor(
								targetIndentationLevel + 1
							)}${exec[1] || ""}\n${indentationConstructor(
								targetIndentationLevel
							)}`
						)
					)
				);
				applyIndentation(line, targetIndentationLevel);
				continue;
			}
		}
		const macroInfo: macroData = getMacroData(line.text, newMacroList);

		const isObjectArraySingleLine: Boolean = SINGLE_LINE_OBJECT_ARRAY_REGEX.test(
			line.text
		);

		if (isObjectArraySingleLine) {
			// console.log(line.text);

			modifications.push(
				vscode.TextEdit.replace(
					line.range,
					breakDownObject(line.text, targetIndentationLevel)
				)
			);
		}

		if (
			(macroInfo.container && !macroInfo.start) ||
			(END_OBJECT_ARRAY_REGEX.test(line.text) && !isObjectArraySingleLine) ||
			(isHtml && !isHtmlOpen)
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

		applyIndentation(line, indentationLevel);

		if (
			(macroInfo.container && macroInfo.start) ||
			(START_OBJECT_ARRAY_REGEX.test(line.text) && !isObjectArraySingleLine) ||
			(isHtml && isHtmlOpen && !isHtmlSingleLine)
		) {
			setIndentationLevel(1);
		}
		if (macroInfo.parents && childIndenters.includes(macroInfo.name || "")) {
			childIndentation = true;
		}
	}

	// vscode.commands.executeCommand("editor.action.formatDocument", {
	// 	source: "vscode.html-language-features",
	// });
}

function javaScriptIndentation(
	document: vscode.TextDocument,
	modifications: vscode.TextEdit[]
) {}
