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
const vs = require("vscode");
const open_file_tracker_1 = require("../analysis/open_file_tracker");
const outline_1 = require("../utils/vscode/outline");
exports.CURSOR_IS_IN_TEST = "dart-code:cursorIsInTest";
exports.cursorIsInTest = false; // HACK: Used for testing since we can't read contexts?
class TestCommands {
    constructor() {
        this.disposables = [];
        this.disposables.push(vs.commands.registerCommand("dart.runTestAtCursor", () => this.runTestAtCursor(false), this), vs.commands.registerCommand("dart.debugTestAtCursor", () => this.runTestAtCursor(true), this), vs.window.onDidChangeTextEditorSelection((e) => this.updateContext(e)));
    }
    runTestAtCursor(debug) {
        return __awaiter(this, void 0, void 0, function* () {
            const editor = vs.window.activeTextEditor;
            const test = editor && editor.selection && this.testForCursor(editor);
            if (test) {
                const command = debug
                    ? "_dart.startDebuggingTestFromOutline"
                    : "_dart.startWithoutDebuggingTestFromOutline";
                vs.commands.executeCommand(command, test);
            }
            else {
                vs.window.showWarningMessage("There is no test at the current location.");
            }
        });
    }
    updateContext(e) {
        const isValidTestLocation = !!(e.textEditor && e.selections && e.selections.length === 1 && this.testForCursor(e.textEditor));
        vs.commands.executeCommand("setContext", exports.CURSOR_IS_IN_TEST, isValidTestLocation);
        exports.cursorIsInTest = isValidTestLocation;
    }
    testForCursor(editor) {
        const document = editor.document;
        const outline = open_file_tracker_1.OpenFileTracker.getOutlineFor(document.uri);
        if (!outline || !outline.children || !outline.children.length)
            return;
        // We should only allow running for projects we know can actually handle `pub run` (for ex. the
        // SDK codebase cannot, and will therefore run all tests).
        if (!open_file_tracker_1.OpenFileTracker.supportsPubRunTest(document.uri))
            return;
        const visitor = new outline_1.TestOutlineVisitor();
        visitor.visit(outline);
        return visitor.tests.reverse().find((t) => {
            const start = document.positionAt(t.offset);
            const end = document.positionAt(t.offset + t.length);
            return new vs.Range(start, end).contains(editor.selection);
        });
    }
    dispose() {
        for (const command of this.disposables)
            command.dispose();
    }
}
exports.TestCommands = TestCommands;
//# sourceMappingURL=test.js.map