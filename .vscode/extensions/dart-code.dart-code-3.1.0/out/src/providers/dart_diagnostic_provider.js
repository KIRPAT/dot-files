"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const console_1 = require("console");
const vscode_1 = require("vscode");
const config_1 = require("../config");
const utils_1 = require("../utils");
// TODO: This is not a provider?
class DartDiagnosticProvider {
    constructor(analyzer, diagnostics) {
        this.analyzer = analyzer;
        this.diagnostics = diagnostics;
        this.analyzer.registerForAnalysisErrors((es) => this.handleErrors(es));
        // Fired when files are deleted
        this.analyzer.registerForAnalysisFlushResults((es) => this.flushResults(es));
    }
    handleErrors(notification) {
        const notificationJson = JSON.stringify(notification);
        // As a workaround for https://github.com/Dart-Code/Dart-Code/issues/1678, if
        // the errors we got are exactly the same as the previous set, do not give
        // them to VS Code. This avoids a potential loop of refreshing the error view
        // which triggers a request for Code Actions, which could result in analysis
        // of the file (which triggers errors to be sent, which triggers a refresh
        // of the error view... etc.!).
        if (this.lastErrorJson === notificationJson) {
            // TODO: Come up with a better fix than this!
            console_1.log("Skipping error notification as it was the same as the previous one");
            return;
        }
        let errors = notification.errors;
        if (!config_1.config.showTodos)
            errors = errors.filter((error) => error.type !== "TODO");
        this.diagnostics.set(vscode_1.Uri.file(notification.file), errors.map((e) => DartDiagnosticProvider.createDiagnostic(e)));
        this.lastErrorJson = notificationJson;
    }
    static createDiagnostic(error) {
        const diag = new DartDiagnostic(utils_1.toRangeOnLine(error.location), error.message, DartDiagnosticProvider.getSeverity(error.severity, error.type));
        diag.code = error.code;
        diag.source = "dart";
        diag.tags = DartDiagnosticProvider.getTags(error);
        diag.type = error.type;
        if (error.correction)
            diag.message += `\n${error.correction}`;
        return diag;
    }
    static getSeverity(severity, type) {
        switch (severity) {
            case "ERROR":
                return vscode_1.DiagnosticSeverity.Error;
            case "WARNING":
                return vscode_1.DiagnosticSeverity.Warning;
            case "INFO":
                switch (type) {
                    case "TODO":
                        return vscode_1.DiagnosticSeverity.Information; // https://github.com/Microsoft/vscode/issues/48376
                    default:
                        return vscode_1.DiagnosticSeverity.Information;
                }
            default:
                throw new Error("Unknown severity type: " + severity);
        }
    }
    static getTags(error) {
        const tags = [];
        if (error.code === "dead_code" || error.code === "unused_local_variable" || error.code === "unused_import")
            tags.push(vscode_1.DiagnosticTag.Unnecessary);
        return tags;
    }
    flushResults(notification) {
        this.lastErrorJson = undefined;
        const entries = notification.files.map((file) => [vscode_1.Uri.file(file), undefined]);
        this.diagnostics.set(entries);
    }
}
exports.DartDiagnosticProvider = DartDiagnosticProvider;
class DartDiagnostic extends vscode_1.Diagnostic {
}
exports.DartDiagnostic = DartDiagnostic;
//# sourceMappingURL=dart_diagnostic_provider.js.map