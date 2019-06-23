"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
class vscodeUtils {
    /**
     * returns doc eol as string;
     * necessary because vscode stores it as a number for some stupid reason
     */
    static eol(doc) {
        return doc.eol == 1 ? "\n" : "\r\n";
    }
    static newUnsavedPythonDoc(content = "") {
        return __awaiter(this, void 0, void 0, function* () {
            const pyDoc = yield vscode.workspace.openTextDocument({
                content,
                language: "python",
            });
            return vscode.window.showTextDocument(pyDoc);
        });
    }
    /**
     * returns block of text at lineNum, where a block is defined as a series of adjacent non-empty lines
     */
    static getBlockOfText(editor, lineNum) {
        let block = editor.document.lineAt(lineNum).range;
        while (block.start.line > 0) {
            const aboveLine = editor.document.lineAt(block.start.line - 1);
            if (aboveLine.isEmptyOrWhitespace)
                break;
            else
                block = new vscode.Range(aboveLine.range.start, block.end);
        }
        while (block.end.line < editor.document.lineCount - 1) {
            const belowLine = editor.document.lineAt(block.end.line + 1);
            if (belowLine.isEmptyOrWhitespace)
                break;
            else
                block = new vscode.Range(block.start, belowLine.range.end);
        }
        return block;
    }
    /**
     * gets first highlighted text of active doc
     * if no highlight or no active editor returns empty string
     */
    static getHighlightedText() {
        const editor = vscode.window.activeTextEditor;
        if (!editor)
            return "";
        return editor.document.getText(editor.selection);
    }
    /**
     * returns current folder path or a string "could not find workspace folder" if no folder is open
     */
    static getCurrentWorkspaceFolder() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0 && workspaceFolders[0]) {
            return workspaceFolders[0].uri.fsPath;
        }
        else
            return "could not find workspace folder";
    }
}
exports.default = vscodeUtils;
//# sourceMappingURL=vscodeUtilities.js.map