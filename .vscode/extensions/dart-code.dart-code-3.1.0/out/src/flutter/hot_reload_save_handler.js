"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const vscode_1 = require("vscode");
const config_1 = require("../config");
const constants_1 = require("../constants");
const utils_1 = require("../utils");
const vm_service_extensions_1 = require("./vm_service_extensions");
function setUpHotReloadOnSave(context, diagnostics, debugCommands) {
    let hotReloadDelayTimer;
    context.subscriptions.push(vscode_1.workspace.onDidSaveTextDocument((td) => {
        if (!vscode_1.debug.activeDebugSession)
            return;
        const shouldHotReload = debugCommands.flutterExtensions.serviceIsRegistered(vm_service_extensions_1.FlutterService.HotReload)
            && config_1.config.flutterHotReloadOnSave;
        const shouldHotRestart = !debugCommands.flutterExtensions.serviceIsRegistered(vm_service_extensions_1.FlutterService.HotReload)
            && debugCommands.flutterExtensions.serviceIsRegistered(vm_service_extensions_1.FlutterService.HotRestart)
            && config_1.config.flutterHotRestartOnSave;
        // Don't do if there are no debug sessions that support it.
        if (!shouldHotReload && !shouldHotRestart)
            return;
        const commandToRun = shouldHotReload ? "flutter.hotReload" : "flutter.hotRestart";
        // Bail out if we're in an external file, or not Dart.
        if (!utils_1.isAnalyzableAndInWorkspace(td) || path.extname(utils_1.fsPath(td.uri)) !== ".dart")
            return;
        // Don't do if we have errors for the saved file.
        const errors = diagnostics.get(td.uri);
        const hasErrors = errors && !!errors.find((d) => d.severity === vscode_1.DiagnosticSeverity.Error);
        if (hasErrors)
            return;
        // Debounce to avoid reloading multiple times during multi-file-save (Save All).
        // Hopefully we can improve in future: https://github.com/Microsoft/vscode/issues/42913
        if (hotReloadDelayTimer) {
            clearTimeout(hotReloadDelayTimer);
        }
        hotReloadDelayTimer = setTimeout(() => {
            hotReloadDelayTimer = undefined;
            vscode_1.commands.executeCommand(commandToRun, { reason: constants_1.restartReasonSave });
        }, 200);
    }));
}
exports.setUpHotReloadOnSave = setUpHotReloadOnSave;
//# sourceMappingURL=hot_reload_save_handler.js.map