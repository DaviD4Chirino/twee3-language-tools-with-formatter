import * as vscode from "vscode";
import { ChildDefObj, macro, macroDef, macroList } from "./sugarcube-2/macros";
import { start } from "repl";

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

export type macroData = macroDef & {
	start?: Boolean;
};
export function getMacroData(
	text: string,
	macroList: Record<string, macroDef>
): macroData {
	const macroNameRegex = /<<\/?\s*(\w*)/gm.exec(text);
	if (!macroNameRegex) return {};

	const OPEN_MACRO_TOKEN: RegExp = /<<[^\/]/gm;
	const CLOSED_MACRO_TOKEN: RegExp = /<<\//gm;

	const macroName = macroNameRegex[1];

	for (const key in macroList) {
		if (Object.prototype.hasOwnProperty.call(macroList, key)) {
			let macro: macroData = macroList[key];
			if (macro.name == macroName) {
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
	}
	return {};
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
