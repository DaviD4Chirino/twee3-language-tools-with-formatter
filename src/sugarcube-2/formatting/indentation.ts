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
	/**
	 * TODO: add a way for the user to not format the document
	 * TODO: Add a way for the user to select if they want spaces or tabs and how many
	 */
	// We get the macro list here, because otherwise it will create and wait for a new one in each loop
	const newMacroList = await macroList();

	const numLines = document.lineCount;

	let indentationLevel = 0;
	/**
	 * Two separated indentations because a child can indent into
	 * other child´s, like adding a nested if into an elseif that
	 * also have an elseif
	 */
	let childIndentationLevel = 0;

	/** I needed a way to make sure the first child indentation would not unindent below the parent if it was the first child*/
	let startOfContainer: boolean = false;

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

		/**
		 * * remove any indentation
		 */
		modifications.push(vscode.TextEdit.replace(line.range, line.text.trim()));

		// do it here to fix a bug where sometimes it messes indentation
		/**
		 * * maybe all of the indentation formatting should be here
		 * * I did not because its already bloated and is as simple
		 * * as a replacement in some cases
		 */
		if (SINGLE_LINE_MACRO.test(line.text)) {
			const exec: RegExpExecArray | null = SINGLE_LINE_MACRO.exec(line.text);
			/**
			 *  This is basically calculating the correct level of
			 *  tabs depending if it has content in between the
			 *  macros or not
			 *  It makes a string like this:
			 * 	<<if condition>>content<</if>>
			 * 	into:
			 * 	<<if condition>>\n
			 * 	\tcontent
			 *	<</if>>
			 * or
			 * <<if condition>>\n
			 * <</if>>
			 * if theres nothing inside
			 */
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

		/**
		 *  When importing a project from twine, the passages have
		 * tags and position data as arrays and objects, i have
		 * indentation for both so this makes sure it ignores
		 * them if is a passage
		 */
		const isPassage = PASSAGE_TOKEN.test(line.text);
		/**
		 * Similar to passages, is hard to distinguish between arrays
		 * and links when they have similar tokens
		 * also skill issue for me
		 */
		const isLink = LINK.test(line.text);
		//! Lower indentation
		if (
			!isPassage &&
			((!macroInfo?.indenter && macroInfo?.container && !macroInfo?.start) ||
				(!isLink &&
					END_OBJECT_ARRAY_REGEX.test(line.text) &&
					!isObjectArraySingleLine) ||
				(htmlData && !htmlData.open && !htmlData.selfClosed))
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
			!isPassage &&
			((!macroInfo?.indenter && macroInfo?.container && macroInfo?.start) ||
				(!isLink &&
					START_OBJECT_ARRAY_REGEX.test(line.text) &&
					!isObjectArraySingleLine) ||
				(htmlData && htmlData.open && !htmlData.selfClosed))
		) {
			setIndentationLevel(indentationLevel + 1);
			startOfContainer = true;
		}

		if (!isPassage && macroInfo?.indenter) {
			setChildIndentationLevel(childIndentationLevel + 1);
		}
	}
}
