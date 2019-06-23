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
const config_1 = require("../config");
const utils_1 = require("../utils");
const dart_diagnostic_provider_1 = require("./dart_diagnostic_provider");
class IgnoreLintCodeActionProvider {
    constructor(selector) {
        this.selector = selector;
        this.rank = 100;
        this.metadata = {
            providedCodeActionKinds: [vscode_1.CodeActionKind.QuickFix],
        };
    }
    provideCodeActions(document, range, context, token) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!utils_1.isAnalyzableAndInWorkspace(document))
                return undefined;
            if (!config_1.config.showIgnoreQuickFixes || !context || !context.diagnostics || !context.diagnostics.length)
                return undefined;
            const lintErrors = context.diagnostics.filter((d) => d instanceof dart_diagnostic_provider_1.DartDiagnostic && (d.type === "LINT" || d.type === "HINT"));
            if (!lintErrors.length)
                return undefined;
            return lintErrors.map((diagnostic) => this.convertResult(document, diagnostic));
        });
    }
    convertResult(document, diagnostic) {
        const edit = new vscode_1.WorkspaceEdit();
        const line = document.lineAt(diagnostic.range.start.line);
        edit.insert(document.uri, line.range.start, `${" ".repeat(line.firstNonWhitespaceCharacterIndex)}// ignore: ${diagnostic.code}\n`);
        const title = `Ignore ${diagnostic.type.toLowerCase()} '${diagnostic.code}' for this line`;
        const action = new vscode_1.CodeAction(title, vscode_1.CodeActionKind.QuickFix);
        action.edit = edit;
        return action;
    }
}
exports.IgnoreLintCodeActionProvider = IgnoreLintCodeActionProvider;
//# sourceMappingURL=ignore_lint_code_action_provider.js.map