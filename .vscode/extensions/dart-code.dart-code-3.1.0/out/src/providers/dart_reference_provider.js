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
const util = require("../utils");
const utils_2 = require("../utils");
class DartReferenceProvider {
    constructor(analyzer) {
        this.analyzer = analyzer;
    }
    provideReferences(document, position, context, token) {
        return __awaiter(this, void 0, void 0, function* () {
            // If we want to include the decleration, kick off a request for that.
            const definitions = context.includeDeclaration
                ? yield this.provideDefinition(document, position, token)
                : undefined;
            const resp = yield this.analyzer.searchFindElementReferencesResults({
                file: utils_2.fsPath(document.uri),
                includePotential: true,
                offset: document.offsetAt(position),
            });
            const locations = resp.results.map((result) => {
                return new vscode_1.Location(vscode_1.Uri.file(result.location.file), util.toRangeOnLine(result.location));
            });
            return definitions
                ? locations.concat(definitions.map((dl) => new vscode_1.Location(dl.targetUri, dl.targetRange)))
                : locations;
        });
    }
    provideDefinition(document, position, token) {
        return __awaiter(this, void 0, void 0, function* () {
            const resp = yield this.analyzer.analysisGetNavigation({
                file: utils_2.fsPath(document.uri),
                length: 0,
                offset: document.offsetAt(position),
            });
            return utils_1.flatMap(resp.regions, (region) => {
                return region.targets.map((targetIndex) => {
                    const target = resp.targets[targetIndex];
                    // HACK: We sometimes get a startColumn of 0 (should be 1-based). Just treat this as 1 for now.
                    //     See https://github.com/Dart-Code/Dart-Code/issues/200
                    if (target.startColumn === 0)
                        target.startColumn = 1;
                    return {
                        originSelectionRange: util.toRange(document, region.offset, region.length),
                        targetRange: util.toRangeOnLine(target),
                        targetUri: vscode_1.Uri.file(resp.files[target.fileIndex]),
                    };
                });
            });
        });
    }
}
exports.DartReferenceProvider = DartReferenceProvider;
//# sourceMappingURL=dart_reference_provider.js.map