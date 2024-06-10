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
import { SINGLE_LINE_OBJECT_ARRAY } from "./commonRegExp";

const LINK: RegExp = /\[\[.*\]\]/m;
const PASSAGE_TOKEN: RegExp = /::/m;
const START_OBJECT_ARRAY_REGEX: RegExp = /{|\[/m;
const END_OBJECT_ARRAY_REGEX: RegExp = /}|\]/m;

const SINGLE_LINE_HTML_TAG: RegExp = />(.*)(?=<\/)/m;
const SINGLE_LINE_MACRO: RegExp = />>(.*)(?=<<\/)/m;

export async function indentation(
	document: vscode.TextDocument,
	modifications: vscode.TextEdit[]
) {
	await document.save();
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
			// applyIndentation(line, targetIndentationLevel);
			// continue;
		}

		if (htmlData) {
			// The same with single_line_Macro check
			const exec: RegExpExecArray | null = SINGLE_LINE_HTML_TAG.exec(line.text);

			if (exec) {
				const replacement = `>\n${exec[1] &&
					indentationConstructor(targetIndentationLevel + 1)}${exec[1] ||
					""}${exec[1] &&
					"\n" + indentationConstructor(targetIndentationLevel)}`;

				modifications.push(
					vscode.TextEdit.replace(
						line.range,
						line.text.replace(exec[0], replacement)
					)
				);
				applyIndentation(line, targetIndentationLevel);
				continue;
			}
		}

		let macroInfo: macroData = getMacroData(line.text, newMacroList);

		const isObjectArraySingleLine: Boolean = SINGLE_LINE_OBJECT_ARRAY.test(
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

		// * there are a lot of rules of when or not to indent so i break them into variables for redability
		const isPassage = PASSAGE_TOKEN.test(line.text);
		const isLink = LINK.test(line.text);
		//! Lower indentation
		if (
			(!isPassage &&
				!macroInfo?.indenter &&
				macroInfo?.container &&
				!macroInfo?.start) ||
			(!isPassage &&
				!isLink &&
				END_OBJECT_ARRAY_REGEX.test(line.text) &&
				!isObjectArraySingleLine) ||
			(!isPassage && htmlData && !htmlData.open && !htmlData.selfClosed)
			//isHtml && isHtmlOpen && !isHtmlSingleLine
		) {
			setIndentationLevel(indentationLevel - 1);
			if (
				childIndentationLevel >= 1 &&
				macroInfo?.children &&
				!startOfContainer
			) {
				setChildIndentationLevel(childIndentationLevel - 1);
			}
			startOfContainer = false;
		}
		// if is a child macro and is a permitted macro, it will unindent,
		// Also when the level is 0, because if theres no more indentation  we can safely assume is the end
		if (!isPassage && startOfContainer && macroInfo?.indenter) {
			startOfContainer = false;
		} else if (!startOfContainer && macroInfo?.indenter) {
			setChildIndentationLevel(childIndentationLevel - 1);
		}

		if (indentationLevel == 0) {
			setChildIndentationLevel(0);
		}

		applyIndentation(line, indentationLevel + childIndentationLevel);

		//! Increase indentation
		if (
			(!isPassage &&
				!macroInfo?.indenter &&
				macroInfo?.container &&
				macroInfo?.start) ||
			(!isPassage &&
				!isLink &&
				START_OBJECT_ARRAY_REGEX.test(line.text) &&
				!isObjectArraySingleLine) ||
			(!isPassage && htmlData && htmlData.open && !htmlData.selfClosed)
		) {
			setIndentationLevel(indentationLevel + 1);
			startOfContainer = true;
		}

		if (!isPassage && macroInfo?.indenter) {
			setChildIndentationLevel(childIndentationLevel + 1);
		}
	}
}
