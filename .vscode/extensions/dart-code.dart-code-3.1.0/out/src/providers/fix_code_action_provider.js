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
const vscode_1 = require("vscode");
const utils_1 = require("../utils");
const log_1 = require("../utils/log");
const dart_diagnostic_provider_1 = require("./dart_diagnostic_provider");
class FixCodeActionProvider {
    constructor(selector, analyzer) {
        this.selector = selector;
        this.analyzer = analyzer;
        this.rank = 1;
        this.metadata = {
            providedCodeActionKinds: [vscode_1.CodeActionKind.QuickFix],
        };
    }
    provideCodeActions(document, range, context, token) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!utils_1.isAnalyzableAndInWorkspace(document))
                return undefined;
            try {
                const result = yield this.analyzer.editGetFixes({
                    file: utils_1.fsPath(document.uri),
                    offset: document.offsetAt(range.start),
                });
                // Because fixes may be the same for multiple errors, we'll de-dupe them based on their edit.
                const allActions = {};
                for (const errorFix of result.fixes) {
                    for (const fix of errorFix.fixes) {
                        allActions[JSON.stringify(fix.edits)] = this.convertResult(document, fix, errorFix.error);
                    }
                }
                return Object.keys(allActions).map((a) => allActions[a]);
            }
            catch (e) {
                log_1.logError(e);
                throw e;
            }
        });
    }
    convertResult(document, change, error) {
        const title = change.message;
        const diagnostics = error ? [dart_diagnostic_provider_1.DartDiagnosticProvider.createDiagnostic(error)] : undefined;
        const action = new vscode_1.CodeAction(title, vscode_1.CodeActionKind.QuickFix);
        action.command = {
            arguments: [document, change],
            command: "_dart.applySourceChange",
            title,
        };
        action.diagnostics = diagnostics;
        return action;
    }
}
exports.FixCodeActionProvider = FixCodeActionProvider;
//# sourceMappingURL=fix_code_action_provider.js.map