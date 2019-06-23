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
const minimatch = require("minimatch");
const vscode_1 = require("vscode");
const config_1 = require("../config");
const utils_1 = require("../utils");
const log_1 = require("../utils/log");
class DartFormattingEditProvider {
    constructor(analyzer, context) {
        this.analyzer = analyzer;
        this.context = context;
        this.registeredFormatters = [];
        this.formatterRegisterFuncs = [];
        vscode_1.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration("dart.enableSdkFormatter")) {
                if (config_1.config.enableSdkFormatter)
                    this.registerAllFormatters();
                else
                    this.unregisterAllFormatters();
            }
        });
    }
    registerDocumentFormatter(filter) {
        this.registerFormatter(() => vscode_1.languages.registerDocumentFormattingEditProvider(filter, this));
    }
    registerTypingFormatter(filter, firstTriggerCharacter, ...moreTriggerCharacters) {
        this.registerFormatter(() => vscode_1.languages.registerOnTypeFormattingEditProvider(filter, this, firstTriggerCharacter, ...moreTriggerCharacters));
    }
    registerFormatter(reg) {
        const registerAndTrack = () => this.registeredFormatters.push(reg());
        // Register the formatter immediately if enabled.
        if (config_1.config.enableSdkFormatter)
            registerAndTrack();
        // Add it to our list so we can re-register later..
        this.formatterRegisterFuncs.push(registerAndTrack);
    }
    registerAllFormatters() {
        for (const formatterReg of this.formatterRegisterFuncs) {
            formatterReg();
        }
    }
    unregisterAllFormatters() {
        this.registeredFormatters.forEach((s) => s.dispose());
        this.registeredFormatters.length = 0;
    }
    provideDocumentFormattingEdits(document, options, token) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.doFormat(document, true); // await is important for catch to work.
            }
            catch (_a) {
                if (!this.context.hasWarnedAboutFormatterSyntaxLimitation) {
                    this.context.hasWarnedAboutFormatterSyntaxLimitation = true;
                    vscode_1.window.showInformationMessage("The Dart formatter will not run if the file has syntax errors");
                }
                return undefined;
            }
        });
    }
    provideOnTypeFormattingEdits(document, position, ch, options, token) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.doFormat(document, false);
            }
            catch (_a) {
                return undefined;
            }
        });
    }
    doFormat(document, doLogError = true) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.shouldFormat(document))
                return undefined;
            try {
                const resp = yield this.analyzer.editFormat({
                    file: utils_1.fsPath(document.uri),
                    lineLength: config_1.config.for(document.uri).lineLength,
                    selectionLength: 0,
                    selectionOffset: 0,
                });
                if (resp.edits.length === 0)
                    return undefined;
                else
                    return resp.edits.map((e) => this.convertData(document, e));
            }
            catch (e) {
                if (doLogError)
                    log_1.logError(e);
                throw e;
            }
        });
    }
    shouldFormat(document) {
        if (!document || !document.uri || document.uri.scheme !== "file")
            return;
        const resourceConf = config_1.config.for(document.uri);
        const path = utils_1.fsPath(document.uri);
        return undefined === resourceConf.doNotFormat.find((p) => minimatch(path, p, { dot: true }));
    }
    convertData(document, edit) {
        return new vscode_1.TextEdit(new vscode_1.Range(document.positionAt(edit.offset), document.positionAt(edit.offset + edit.length)), edit.replacement);
    }
    dispose() {
        this.unregisterAllFormatters();
    }
}
exports.DartFormattingEditProvider = DartFormattingEditProvider;
//# sourceMappingURL=dart_formatting_edit_provider.js.map