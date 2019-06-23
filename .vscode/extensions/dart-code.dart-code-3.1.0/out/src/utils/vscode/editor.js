"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vs = require("vscode");
function showCode(editor, displayRange, highlightRange, selectionRange) {
    if (selectionRange)
        editor.selection = new vs.Selection(selectionRange.start, selectionRange.end);
    // Ensure the code is visible on screen.
    editor.revealRange(displayRange, vs.TextEditorRevealType.InCenterIfOutsideViewport);
    // Re-reveal the first line, to ensure it was always visible (eg. in case the main range was bigger than the screen).
    // Using .Default means it'll do as little scrolling as possible.
    editor.revealRange(new vs.Range(displayRange.start, displayRange.start), vs.TextEditorRevealType.Default);
    // TODO: Implement highlighting
    // See https://github.com/Microsoft/vscode/issues/45059
}
exports.showCode = showCode;
//# sourceMappingURL=editor.js.map