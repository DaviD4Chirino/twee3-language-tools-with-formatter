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
import { macroDef, macroList, macroRegex } from "../macros";
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
	/** I need a way to differentiate between an else, a macro that should wrap itself and a print, a macro that should not wrap itself */
	const newMacroList = await macroList();

	const numLines = document.lineCount;
	let indentationLevel = 0;
	let childIndentationLevel = 0;
	let startOfContainer: Boolean = false;

	function setIndentationLevel(amount: number) {
		indentationLevel = clamp(amount, 0, Infinity);
		// console.log(indentationLevel);
	}
	function setChildIndentationLevel(amount: number) {
		childIndentationLevel = clamp(amount, 0, Infinity);
	}
	function applyIndentation(line: vscode.TextLine, level: number) {
		modifications.push(
			vscode.TextEdit.insert(line.range.start, indentationConstructor(level))
		);
	}
	for (let i = 0; i < numLines; i++) {
		const line: vscode.TextLine = document.lineAt(i);
		let targetIndentationLevel = indentationLevel + childIndentationLevel;

		const isHtml: Boolean = isHtmlTag(line.text);
		const isHtmlOpen: Boolean = isHtmlTagOpen(line.text);

		const isHtmlSingleLine: Boolean = isHtmlTagSingleLine(line.text);

		//*remove any indentation const isHtml: Boolean = isHtmlTag(line.text);
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
		let macroInfo: macroData = getMacroData(line.text, newMacroList);

		// console.log(macroExec);
		const isObjectArraySingleLine: Boolean = SINGLE_LINE_OBJECT_ARRAY_REGEX.test(
			line.text
		);

		if (isObjectArraySingleLine) {
			// console.log(macroInfo.name);

			modifications.push(
				vscode.TextEdit.replace(
					line.range,
					breakDownObject(line.text, targetIndentationLevel)
				)
			);
		}
		// Lower indentation
		if (
			(!macroInfo?.indenter && macroInfo?.container && !macroInfo?.start) ||
			(END_OBJECT_ARRAY_REGEX.test(line.text) && !isObjectArraySingleLine) ||
			(isHtml && !isHtmlOpen && !isHtmlSingleLine)
		) {
			setIndentationLevel(indentationLevel - 1);
			if (childIndentationLevel > 1) {
				setChildIndentationLevel(childIndentationLevel - 1);
			}
			startOfContainer = false;
		}
		// if is a child macro and is a permitted macro, it will unindent,
		// Also when the level is 0, because if theres no more indentation  we can safely assume is the end
		if (startOfContainer && macroInfo?.indenter) {
			startOfContainer = false;
		} else if (!startOfContainer && macroInfo?.indenter) {
			setChildIndentationLevel(childIndentationLevel - 1);
		}

		if (indentationLevel == 0) {
			setChildIndentationLevel(0);
		}

		applyIndentation(line, indentationLevel + childIndentationLevel);
		// modifications.push(
		// 	vscode.TextEdit.insert(
		// 		line.range.end,
		// 		"" + (indentationLevel + childIndentationLevel)
		// 	)
		// );

		// Increase indentation
		if (
			(!macroInfo?.indenter && macroInfo?.container && macroInfo?.start) ||
			(START_OBJECT_ARRAY_REGEX.test(line.text) && !isObjectArraySingleLine) ||
			(isHtml && isHtmlOpen && !isHtmlSingleLine)
		) {
			setIndentationLevel(indentationLevel + 1);
			console.log(macroInfo?.name);
			startOfContainer = true;
		}

		if (macroInfo?.indenter) {
			setChildIndentationLevel(childIndentationLevel + 1);
		}
		// console.log(
		// 	`${i} - identation: ${indentationLevel + childIndentationLevel}`
		// );
	}

	// vscode.commands.executeCommand("editor.action.formatDocument", {
	// 	source: "vscode.html-language-features",
	// });
}
