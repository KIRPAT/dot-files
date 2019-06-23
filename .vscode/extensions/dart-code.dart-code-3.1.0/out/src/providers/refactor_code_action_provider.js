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
const supportedRefactors = {
    CONVERT_METHOD_TO_GETTER: "Convert Method to Getter",
    EXTRACT_LOCAL_VARIABLE: "Extract Local Variable",
    EXTRACT_METHOD: "Extract Method",
    EXTRACT_WIDGET: "Extract Widget",
};
class RefactorCodeActionProvider {
    constructor(selector, analyzer) {
        this.selector = selector;
        this.analyzer = analyzer;
        this.rank = 50;
        this.metadata = {
            providedCodeActionKinds: [vscode_1.CodeActionKind.Refactor],
        };
    }
    provideCodeActions(document, range, context, token) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!utils_1.isAnalyzableAndInWorkspace(document))
                return undefined;
            try {
                const result = yield this.analyzer.editGetAvailableRefactorings({
                    file: utils_1.fsPath(document.uri),
                    length: document.offsetAt(range.end) - document.offsetAt(range.start),
                    offset: document.offsetAt(range.start),
                });
                return result.kinds.map((k) => this.getRefactorForKind(document, range, k)).filter((r) => r);
            }
            catch (e) {
                // TODO: Swap this back to logError/throw when https://github.com/dart-lang/sdk/issues/33471 is fixed.
                return [];
                // logError(e);
                // reject();
            }
        });
    }
    getRefactorForKind(document, range, k) {
        if (!supportedRefactors[k])
            return;
        const title = supportedRefactors[k];
        const action = new vscode_1.CodeAction(title, vscode_1.CodeActionKind.Refactor);
        action.command = {
            arguments: [document, range, k],
            command: "_dart.performRefactor",
            title,
        };
        return action;
    }
}
exports.RefactorCodeActionProvider = RefactorCodeActionProvider;
//# sourceMappingURL=refactor_code_action_provider.js.map