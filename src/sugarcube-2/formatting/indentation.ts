import * as vscode from "vscode";
import {
	indentationConstructor,
	getMacroData,
	macroData,
	breakDownObject,
	htmlTagData,
	getHtmlData,
} from "../../utils";
import { macroList } from "../macros";
import { clamp } from "lodash";

const SINGLE_LINE_OBJECT_ARRAY_REGEX: RegExp = /{.*}|\[.*\]/m;
const START_OBJECT_ARRAY_REGEX: RegExp = /{|\[/m;
const END_OBJECT_ARRAY_REGEX: RegExp = /}|\]/m;

const SINGLE_LINE_HTML_TAG: RegExp = />(.*)(?=<\/)/m;
const SINGLE_LINE_MACRO: RegExp = />>(.*)(?=<<\/)/m;

export async function indentation(
	document: vscode.TextDocument,
	modifications: vscode.TextEdit[]
) {
	// We get the macro list, because otherwise it will create and wait for a new one in each loop
	const newMacroList = await macroList();

	const numLines = document.lineCount;
	let indentationLevel = 0;
	let childIndentationLevel = 0;

	/** I needed a way to make sure the first child indentation would not unindent below the parent if it was the first child*/
	let startOfContainer: Boolean = false;

	function setIndentationLevel(amount: number) {
		indentationLevel = clamp(amount, 0, Infinity);
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
		// * For some reason it does not work when using applyIndentation a bit below
		const targetIndentationLevel = indentationLevel + childIndentationLevel;

		const htmlData: htmlTagData | null = getHtmlData(line.text);

		//* remove any indentation
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

		// The same with single_line_Macro check
		if (htmlData) {
			const exec: RegExpExecArray | null = SINGLE_LINE_HTML_TAG.exec(line.text);

			if (exec) {
				modifications.push(
					vscode.TextEdit.replace(
						line.range,
						line.text.replace(
							exec[0],
							`>\n${exec[1] &&
								indentationConstructor(targetIndentationLevel + 1)}${exec[1] ||
								""}${exec[1] &&
								"\n" + indentationConstructor(targetIndentationLevel)}`
						)
					)
				);
				applyIndentation(line, targetIndentationLevel);
				continue;
			}
		}

		let macroInfo: macroData = getMacroData(line.text, newMacroList);

		const isObjectArraySingleLine: Boolean = SINGLE_LINE_OBJECT_ARRAY_REGEX.test(
			line.text
		);

		if (isObjectArraySingleLine) {
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
			(htmlData && !htmlData.open && !htmlData.selfClosed)
			//isHtml && isHtmlOpen && !isHtmlSingleLine
		) {
			setIndentationLevel(indentationLevel - 1);
			if (childIndentationLevel >= 1) {
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
			(htmlData && htmlData.open && !htmlData.selfClosed)
		) {
			setIndentationLevel(indentationLevel + 1);
			// console.log(macroInfo?.name);
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
