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
const utils_1 = require("../utils");
class AnalyzerCommands {
    constructor(context, analyzer) {
        context.subscriptions.push(vs.commands.registerCommand("dart.openAnalyzerDiagnostics", () => __awaiter(this, void 0, void 0, function* () {
            const res = yield analyzer.diagnosticGetServerPort();
            utils_1.openInBrowser(`http://localhost:${res.port}/`);
        })));
    }
}
exports.AnalyzerCommands = AnalyzerCommands;
//# sourceMappingURL=analyzer.js.map