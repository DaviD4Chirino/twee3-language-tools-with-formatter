import * as vscode from "vscode";
import {
	MacroRegexType,
	macroDef,
	macroNamePattern,
	macroRegex,
	macroRegexFactory,
} from "./sugarcube-2/macros";
const TAG_REGEX: RegExp = /((?<macroTag><<)|(?<htmlStart><))(?<closed>\/)?([a-zA-z "=+*]*)((?<macroEnd>>>)|(?<htmlEnd>>))/m;

export type macroData = macroDef & {
	start?: Boolean;
};

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

	const macroNameRegex = /<<?\/?\s*(\w*)/gm.exec(text);
	if (!macroNameRegex) {
		return {};
	}

	const OPEN_MACRO_TOKEN: RegExp = /<<[^\/]/gm;
	const CLOSED_MACRO_TOKEN: RegExp = /<<\//gm;

	const macroName = macroNameRegex[1];

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

export type htmlTagData = {
	start: Boolean;
};

export function isHtmlTag(text: string): Boolean {
	if (!TAG_REGEX.test(text)) return false;
	const exec: RegExpExecArray = TAG_REGEX.exec(text) as RegExpExecArray;

	if (exec.groups?.htmlStart && exec.groups?.htmlEnd) {
		return true;
	}

	return false;
}

export function isHtmlTagOpen(text: string): Boolean {
	const exec: RegExpExecArray | null = TAG_REGEX.exec(text);
	if (exec) {
		return exec.groups?.closed ? false : true;
	}
	return false;

	// console.log();
}

export function inRange(number: number, min: number, max: number): boolean {
	return number >= min && number <= max;
}

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

export function parseReplacementString(text: string, exec: RegExpExecArray) {
	const REPLACEMENT_REGEXP: RegExp = /{\[(\d)\]}/m;
	const TERNARY_REGEXP: RegExp = /(\(\{\[(?<index>\d)\]})[^\S\n]*\?(?<ifTrue>.*):(?<ifFalse>.*)\)/m;

	const ternaryExec: RegExpExecArray | null = TERNARY_REGEXP.exec(text);

	if (ternaryExec) {
		// while ((matches = text.match(TERNARY_REGEXP))) {
		// 	console.log(matches);
		// }
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
		// if (exec[Number(ternaryExec.groups?.index)]) {
		// 	text = text.replace(/\(.*\)/m, exec[Number(ternaryExec.groups?.ifTrue)]);
		// } else {
		// 	text = text.replace(
		// 		/\(.*\)/m,
		// 		exec[Number(ternaryExec.groups?.ifFalse)]
		// 			? exec[Number(ternaryExec.groups?.ifFalse)]
		// 			: ""
		// 	);
		// }
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
 * Used in formatting, it returns a string that separates an object if is too long in a single line
 * @param text string
 */
export function breakDownObject(
	text: string,
	indentationLevel: number
): string {
	const OBJECT_REGEX: RegExp = /{(.*)}|\[(.*)\]/m;
	const exec: RegExpExecArray | null = OBJECT_REGEX.exec(text);
	let result: string = text;

	if (exec) {
		const level: string = indentationConstructor(indentationLevel);

		/** Splits either an object or an array, both have the same procedure */
		let elements: string[] = exec[1] ? exec[1].split(",") : exec[2].split(",");

		elements = elements.map((el: string) => el.trim());
		// console.log(elements);

		if (elements.length > 2) {
			result = text.replace(
				exec[1] ? exec[1] : exec[2],
				`\n${indentationConstructor(indentationLevel + 1)}` +
					elements.join(`,\n${indentationConstructor(indentationLevel + 1)}`) +
					`\n${indentationConstructor(indentationLevel)}`
			);
		}
	}

	return result;
}
