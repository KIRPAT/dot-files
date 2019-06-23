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
const utils_1 = require("../debug/utils");
const array_1 = require("../utils/array");
class RankingCodeActionProvider {
    constructor() {
        this.codeActionProviders = [];
    }
    registerProvider(provider) {
        this.codeActionProviders.push(provider);
        array_1.sortBy(this.codeActionProviders, (p) => p.rank);
    }
    get metadata() {
        const allKinds = utils_1.flatMap(this.codeActionProviders, (p) => p.metadata.providedCodeActionKinds);
        return { providedCodeActionKinds: utils_1.uniq(allKinds) };
    }
    provideCodeActions(document, range, context, token) {
        return __awaiter(this, void 0, void 0, function* () {
            // Sort the providers, because then their results will be sorted (flatMap doesn't change the order, and
            // Promise.all preserves order).
            const applicableProviders = this.codeActionProviders.filter((p) => vscode_1.languages.match(p.selector, document));
            const promises = applicableProviders.map((p) => p.provideCodeActions(document, range, context, token));
            const allResults = yield Promise.all(promises);
            const flatResults = utils_1.flatMap(allResults, (x) => x);
            return flatResults;
        });
    }
}
exports.RankingCodeActionProvider = RankingCodeActionProvider;
//# sourceMappingURL=ranking_code_action_provider.js.map