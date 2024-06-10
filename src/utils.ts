import * as vscode from "vscode";
import { macroDef } from "./sugarcube-2/macros";
import { SINGLE_LINE_OBJECT_ARRAY } from "./sugarcube-2/formatting/commonRegExp";

export type htmlTagData = {
	name: string;
	open: boolean;
	selfClosed: boolean;
};
export type macroData = macroDef & {
	start?: boolean;
};

const TAG_REGEX: RegExp = /((?<macroTag><<)|(?<htmlStart><))(?<closed>\/)?\s*(?<name>[\w\-=]*)(?<arguments>[\s\w "=]*)?((?<macroEnd>>>)|(?<htmlEnd>>))/m;

export function headsplit(raw: string, regexp: RegExp, caps: number = 1) {
	const text = raw.trim().split(/\r?\n/);
	let retArr: { header: string; content: string }[] = [],
		_header = "",
		_content = "",
		_caps = "";
	for (let c = 0; c < caps; c++) {
		_caps += "$" + (c + 1) + ".____.";
	}
	_caps = _caps.slice(0, -6);
	for (let t = 0; t < text.length; t++) {
		if (regexp.test(text[t])) {
			retArr.push({
				header: _header.trim(),
				content: _content.trim(),
			});
			_header = text[t].replace(regexp, _caps);
			_content = "";
		} else {
			_content += text[t] + "\n";
		}
		if (t === text.length - 1) {
			retArr.push({
				header: _header.trim(),
				content: _content.trim(),
			});
		}
	}
	retArr.shift();
	return retArr;
}

export function tabstring() {
	const editorConfig = vscode.workspace.getConfiguration("editor");
	return editorConfig.get("insertSpaces") ?? false
		? (editorConfig.get("tabSize") as number) ?? 4
		: "\t";
}

export function indentationConstructor(levels: number): string {
	// const editorConfig = vscode.workspace.getConfiguration("editor");
	// console.log(editorConfig.get("tabSize"));
	// console.log(editorConfig.get("insertSpaces"));
	if (levels < 0) {
		return "";
	}
	const arr: string[] = [];
	for (let level = 0; level < levels; level++) {
		arr.push("\t");
	}
	return arr.join("");
}

export function getMacroData(
	text: string,
	macroList: Record<string, macroDef>
): macroData {
	// console.log(
	// 	macroRegexFactory(macroNamePattern, MacroRegexType.Start).exec(text)
	// );

	const macroNameRegex = /<<\/?\s*([A-Za-z][\w-]*|[=-])/gm.exec(text);

	if (!macroNameRegex) {
		return {};
	}

	const OPEN_MACRO_TOKEN: RegExp = /<<[^\/]/gm;
	const CLOSED_MACRO_TOKEN: RegExp = /<<\//gm;

	const macroName = macroNameRegex[1];

	// if (macroList[name]) {
	// 	let macro: macroData = macroList[name];
	// 	return macro;
	// }
	// * Doing it any other way did not gave me the result i wanted
	for (const key in macroList) {
		if (Object.prototype.hasOwnProperty.call(macroList, key)) {
			let macro: macroData = macroList[key];
			if (macro.name != macroName) continue;

			if (OPEN_MACRO_TOKEN.test(macroNameRegex[0])) {
				macro["start"] = macro.parents ? false : true;
				return macro;
			}
			if (CLOSED_MACRO_TOKEN.test(macroNameRegex[0])) {
				macro["start"] = macro.parents ? true : false;
				return macro;
			}
		}
	}

	return {};
}

/**
 * The differences between macros and html in RegExp are minimal, so for me to differentiate i had to detect both and filter them manually
 * @param text the current line
 * @returns
 */
export function getHtmlData(text: string): htmlTagData | null {
	if (!TAG_REGEX.test(text)) return null;
	const exec: RegExpExecArray = TAG_REGEX.exec(text) as RegExpExecArray;

	// if it starts with html tag, and ends with html tag, it is a html tag
	if (!exec.groups?.htmlStart && !exec.groups?.htmlEnd) return null;
	const htmlSelfClosedTags: string[] = [
		"area",
		"base",
		"br",
		"col",
		"embed",
		"hr",
		"img",
		"input",
		"link",
		"meta",
		"param",
		"source",
		"track",
		"wbr",
	];

	// default object
	let result: htmlTagData = {
		name: "",
		open: false,
		selfClosed: false,
	};
	// the name is not externally, but it may be necessary later
	result.name = exec.groups.name || "";
	result.open = exec.groups.closed ? false : true;
	result.selfClosed = htmlSelfClosedTags.includes(result.name);

	return result;
}

export function inRange(number: number, min: number, max: number): boolean {
	return number >= min && number <= max;
}
/**
 * You can use this to say, detect where the comments lines are and prevent formatting there, or if you have an array of numbers and want to check if is not between any of them
 * @param number
 * @param ranges
 * @returns
 */
export function inAnyRange(
	number: number,
	ranges: [[number, number]]
): Boolean {
	for (const r in ranges) {
		const range: [number, number] = ranges[r];
		if (inRange(number, range[0], range[1])) {
			return true;
		}
	}
	return false;
}

/**
 * A tool to make replacements easier, when you want to replace something but need a replacement to be a text detected in the RexExp, you can use a ternary wrapped in parenthesis like: ({[1]}:{[1]}?{[2]})
 * in that case it says: if the group 1 exist, replace everything in the () with the group after the :
 * otherwise replace is with the group after ?
 * @param text
 * @param exec
 * @returns
 */
export function parseReplacementString(text: string, exec: RegExpExecArray) {
	const REPLACEMENT_REGEXP: RegExp = /{\[(\d)\]}/m;
	const TERNARY_REGEXP: RegExp = /(\(\{\[(?<index>\d)\]})[^\S\n]*\?(?<ifTrue>.*):(?<ifFalse>.*)\)/m;

	const ternaryExec: RegExpExecArray | null = TERNARY_REGEXP.exec(text);

	if (ternaryExec) {
		if (exec[Number(ternaryExec.groups?.index)]) {
			text = text.replace(
				TERNARY_REGEXP,
				ternaryExec.groups?.ifTrue ? ternaryExec.groups?.ifTrue : ""
			);
		} else {
			text = text.replace(
				TERNARY_REGEXP,
				ternaryExec.groups?.ifFalse ? ternaryExec.groups?.ifFalse : ""
			);
		}
	}
	let matches: string[] | null = [];
	while ((matches = text.match(REPLACEMENT_REGEXP))) {
		text = text.replace(
			REPLACEMENT_REGEXP,
			`${exec[Number(matches[1])] ? exec[Number(matches[1])] : ""}`
		);
	}
	return text;
}

/**
 * Used in formatting, it returns a string that separates an object or array if is too long in a single line
 * @param text string
 */
export function breakDownObject(
	text: string,
	indentationLevel: number
): string {
	const exec: RegExpExecArray | null = SINGLE_LINE_OBJECT_ARRAY.exec(text);
	let result: string = text;

	if (exec) {
		const arrayOrObjectContents: string = exec[2] ? exec[2] : exec[3];
		if (!arrayOrObjectContents) return result;
		/** Splits either an object or an array, both have the same procedure */
		let elements: string[] = arrayOrObjectContents.split(",");

		elements = elements.map((el: string) => el.trim());
		// console.log(elements);

		if (elements.length > 1) {
			result = text.replace(
				arrayOrObjectContents,
				`\n${indentationConstructor(indentationLevel + 1)}` +
					elements.join(`,\n${indentationConstructor(indentationLevel + 1)}`) +
					`\n${indentationConstructor(indentationLevel)}`
			);
		} else {
			result = text.replace(arrayOrObjectContents, elements.join(", "));
		}
		// const STUCK_PERIODS: RegExp = /\s*?:(\s{2,}|(?=\S))/gm;
		// if (STUCK_PERIODS.test(result)) {
		// 	// const stuckExec: RegExpExecArray = STUCK_PERIODS.exec(
		// 	// 	result
		// 	// ) as RegExpExecArray;

		// 	result = result.replace(STUCK_PERIODS, ": ");
		// }
	}

	return result;
}
