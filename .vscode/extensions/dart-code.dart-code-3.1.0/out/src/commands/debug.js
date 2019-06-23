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
const fs = require("fs");
const path = require("path");
const vs = require("vscode");
const utils_1 = require("../debug/utils");
const vm_service_extensions_1 = require("../flutter/vm_service_extensions");
const debug_config_provider_1 = require("../providers/debug_config_provider");
const dev_tools_1 = require("../sdk/dev_tools");
const user_prompts_1 = require("../user_prompts");
const utils_2 = require("../utils");
const log_1 = require("../utils/log");
const debug_1 = require("../utils/vscode/debug");
// TODO: Try to avoid exporting this...
exports.debugSessions = [];
// export let mostRecentAttachedProbablyReusableObservatoryUri: string;
// As a workaround for https://github.com/Microsoft/vscode/issues/71651 we
// will keep any events that arrive before their session "started" and then
// replace them when the start event comes through.
let pendingCustomEvents = [];
class LastDebugSession {
}
exports.LastDebugSession = LastDebugSession;
class DebugCommands {
    constructor(context, workspaceContext, analytics, pubGlobal) {
        this.context = context;
        this.analytics = analytics;
        this.debugMetrics = vs.window.createStatusBarItem(vs.StatusBarAlignment.Right, 0);
        this.onWillHotReloadEmitter = new vs.EventEmitter();
        this.onWillHotReload = this.onWillHotReloadEmitter.event;
        this.onWillHotRestartEmitter = new vs.EventEmitter();
        this.onWillHotRestart = this.onWillHotRestartEmitter.event;
        this.onReceiveCoverageEmitter = new vs.EventEmitter();
        this.onReceiveCoverage = this.onReceiveCoverageEmitter.event;
        this.onFirstFrameEmitter = new vs.EventEmitter();
        this.onFirstFrame = this.onFirstFrameEmitter.event;
        this.onDebugSessionVmServiceAvailableEmitter = new vs.EventEmitter();
        this.onDebugSessionVmServiceAvailable = this.onDebugSessionVmServiceAvailableEmitter.event;
        this.flutterExtensions = new vm_service_extensions_1.FlutterVmServiceExtensions(this.sendServiceSetting);
        this.devTools = new dev_tools_1.DevToolsManager(workspaceContext.sdks, this, analytics, pubGlobal);
        context.subscriptions.push(this.devTools);
        context.subscriptions.push(this.debugMetrics);
        context.subscriptions.push(vs.debug.onDidStartDebugSession((s) => this.handleDebugSessionStart(s)));
        context.subscriptions.push(vs.debug.onDidReceiveDebugSessionCustomEvent((e) => this.handleDebugSessionCustomEvent(e)));
        context.subscriptions.push(vs.debug.onDidTerminateDebugSession((s) => this.handleDebugSessionEnd(s)));
        context.subscriptions.push(vs.commands.registerCommand("flutter.togglePlatform", () => this.flutterExtensions.toggle(vm_service_extensions_1.FlutterServiceExtension.PlatformOverride, "iOS", "android")));
        context.subscriptions.push(vs.commands.registerCommand("flutter.toggleDebugPainting", () => this.flutterExtensions.toggle(vm_service_extensions_1.FlutterServiceExtension.DebugPaint)));
        context.subscriptions.push(vs.commands.registerCommand("flutter.togglePerformanceOverlay", () => this.flutterExtensions.toggle(vm_service_extensions_1.FlutterServiceExtension.PerformanceOverlay)));
        context.subscriptions.push(vs.commands.registerCommand("flutter.toggleRepaintRainbow", () => this.flutterExtensions.toggle(vm_service_extensions_1.FlutterServiceExtension.RepaintRainbow)));
        context.subscriptions.push(vs.commands.registerCommand("flutter.toggleDebugModeBanner", () => this.flutterExtensions.toggle(vm_service_extensions_1.FlutterServiceExtension.DebugBanner)));
        context.subscriptions.push(vs.commands.registerCommand("flutter.toggleCheckElevations", () => this.flutterExtensions.toggle(vm_service_extensions_1.FlutterServiceExtension.CheckElevations)));
        context.subscriptions.push(vs.commands.registerCommand("flutter.togglePaintBaselines", () => this.flutterExtensions.toggle(vm_service_extensions_1.FlutterServiceExtension.PaintBaselines)));
        context.subscriptions.push(vs.commands.registerCommand("flutter.toggleSlowAnimations", () => this.flutterExtensions.toggle(vm_service_extensions_1.FlutterServiceExtension.SlowAnimations, vm_service_extensions_1.timeDilationNormal, vm_service_extensions_1.timeDilationSlow)));
        context.subscriptions.push(vs.commands.registerCommand("flutter.inspectWidget", () => this.flutterExtensions.toggle(vm_service_extensions_1.FlutterServiceExtension.InspectorSelectMode, true, true)));
        context.subscriptions.push(vs.commands.registerCommand("flutter.cancelInspectWidget", () => this.flutterExtensions.toggle(vm_service_extensions_1.FlutterServiceExtension.InspectorSelectMode, false, false)));
        context.subscriptions.push(vs.commands.registerCommand("dart.openObservatory", () => __awaiter(this, void 0, void 0, function* () {
            if (!exports.debugSessions.length)
                return;
            const session = exports.debugSessions.length === 1
                ? exports.debugSessions[0]
                : yield this.promptForDebugSession();
            if (session && !session.session.configuration.noDebug && session.observatoryUri) {
                utils_2.openInBrowser(session.observatoryUri);
                analytics.logDebuggerOpenObservatory();
            }
            else if (session) {
                log_1.logWarn("Cannot start Observatory for session without debug/observatoryUri");
            }
        })));
        context.subscriptions.push(vs.commands.registerCommand("flutter.openTimeline", () => __awaiter(this, void 0, void 0, function* () {
            if (!exports.debugSessions.length)
                return;
            const session = exports.debugSessions.length === 1
                ? exports.debugSessions[0]
                : yield this.promptForDebugSession();
            if (session && !session.session.configuration.noDebug && session.observatoryUri) {
                utils_2.openInBrowser(session.observatoryUri + "/#/timeline-dashboard");
                analytics.logDebuggerOpenTimeline();
            }
            else if (session) {
                log_1.logWarn("Cannot start Observatory for session without debug/observatoryUri");
            }
        })));
        context.subscriptions.push(vs.commands.registerCommand("_dart.openDevTools.touchBar", (args) => vs.commands.executeCommand("dart.openDevTools", args)));
        context.subscriptions.push(vs.commands.registerCommand("dart.openDevTools", () => __awaiter(this, void 0, void 0, function* () {
            if (!exports.debugSessions.length) {
                vs.window.showInformationMessage("Dart DevTools requires an active debug session.");
                return;
            }
            const session = exports.debugSessions.length === 1
                ? exports.debugSessions[0]
                : yield this.promptForDebugSession();
            if (!session)
                return; // User cancelled
            if (session.vmServiceUri) {
                return this.devTools.spawnForSession(session);
            }
            else if (session.session.configuration.noDebug) {
                vs.window.showInformationMessage("You must start your app with debugging in order to use DevTools.");
            }
            else {
                vs.window.showInformationMessage("This debug session is not ready yet.");
            }
        })));
        // Misc custom debug commands.
        context.subscriptions.push(vs.commands.registerCommand("_flutter.hotReload.touchBar", (args) => vs.commands.executeCommand("flutter.hotReload", args)));
        context.subscriptions.push(vs.commands.registerCommand("flutter.hotReload", (args) => {
            if (!exports.debugSessions.length)
                return;
            this.onWillHotReloadEmitter.fire();
            exports.debugSessions.forEach((s) => s.session.customRequest("hotReload", args));
            analytics.logDebuggerHotReload();
        }));
        context.subscriptions.push(vs.commands.registerCommand("flutter.hotRestart", (args) => {
            if (!exports.debugSessions.length)
                return;
            this.onWillHotRestartEmitter.fire();
            exports.debugSessions.forEach((s) => s.session.customRequest("hotRestart", args));
            analytics.logDebuggerRestart();
        }));
        context.subscriptions.push(vs.commands.registerCommand("_dart.requestCoverageUpdate", (scriptUris) => {
            exports.debugSessions.forEach((s) => s.session.customRequest("requestCoverageUpdate", { scriptUris }));
        }));
        context.subscriptions.push(vs.commands.registerCommand("_dart.coverageFilesUpdate", (scriptUris) => {
            exports.debugSessions.forEach((s) => s.session.customRequest("coverageFilesUpdate", { scriptUris }));
        }));
        context.subscriptions.push(vs.commands.registerCommand("dart.startDebugging", (resource) => {
            vs.debug.startDebugging(vs.workspace.getWorkspaceFolder(resource), {
                name: "Dart",
                program: utils_2.fsPath(resource),
                request: "launch",
                type: "dart",
            });
        }));
        context.subscriptions.push(vs.commands.registerCommand("dart.startWithoutDebugging", (resource) => {
            vs.debug.startDebugging(vs.workspace.getWorkspaceFolder(resource), {
                name: "Dart",
                noDebug: true,
                program: utils_2.fsPath(resource),
                request: "launch",
                type: "dart",
            });
        }));
        context.subscriptions.push(vs.commands.registerCommand("dart.runAllTestsWithoutDebugging", () => {
            const testFolders = utils_2.getDartWorkspaceFolders()
                .map((project) => path.join(utils_2.fsPath(project.uri), "test"))
                .filter((testFolder) => fs.existsSync(testFolder));
            if (testFolders.length === 0) {
                vs.window.showErrorMessage("Unable to find any test folders");
                return;
            }
            for (const folder of testFolders) {
                const ws = vs.workspace.getWorkspaceFolder(vs.Uri.file(folder));
                const name = path.basename(path.dirname(folder));
                vs.debug.startDebugging(ws, {
                    name: `Dart ${name}`,
                    noDebug: true,
                    // To run all tests, we set `program` to a test folder.
                    program: folder,
                    request: "launch",
                    type: "dart",
                });
            }
        }));
        context.subscriptions.push(vs.commands.registerCommand("dart.rerunLastDebugSession", () => {
            if (LastDebugSession.debugConfig) {
                vs.debug.startDebugging(LastDebugSession.workspaceFolder, LastDebugSession.debugConfig);
            }
            else {
                vs.window.showErrorMessage("There is no previous debug session to run.");
            }
        }));
        // Attach commands.
        context.subscriptions.push(vs.commands.registerCommand("dart.attach", () => {
            vs.debug.startDebugging(undefined, {
                name: "Dart: Attach to Process",
                request: "attach",
                type: "dart",
            });
        }));
        context.subscriptions.push(vs.commands.registerCommand("flutter.attachProcess", () => {
            vs.debug.startDebugging(undefined, {
                name: "Flutter: Attach to Process",
                observatoryUri: "${command:dart.promptForVmService}",
                request: "attach",
                type: "dart",
            });
        }));
        context.subscriptions.push(vs.commands.registerCommand("flutter.attach", () => {
            vs.debug.startDebugging(undefined, {
                name: "Flutter: Attach to Device",
                request: "attach",
                type: "dart",
            });
        }));
        context.subscriptions.push(vs.commands.registerCommand("dart.promptForVmService", (defaultValueOrConfig) => __awaiter(this, void 0, void 0, function* () {
            const defaultValue = typeof defaultValueOrConfig === "string" ? defaultValueOrConfig : undefined;
            return vs.window.showInputBox({
                ignoreFocusOut: true,
                placeHolder: "Paste an Observatory URI",
                prompt: "Enter Observatory URI",
                validateInput: (input) => {
                    if (!input)
                        return;
                    input = input.trim();
                    if (Number.isInteger(parseFloat(input)))
                        return;
                    // Uri.parse doesn't seem to work as expected, so do our own basic validation
                    // https://github.com/Microsoft/vscode/issues/49818
                    if (!input.startsWith("http://") && !input.startsWith("https://"))
                        return "Please enter a valid Observatory URI";
                },
                value: defaultValue,
            });
        })));
    }
    handleDebugSessionStart(s) {
        if (s.type === "dart") {
            const session = new debug_1.DartDebugSessionInformation(s);
            // If we're the first fresh debug session, reset all settings to default.
            // Subsequent launches will inherit the "current" values.
            if (exports.debugSessions.length === 0)
                this.flutterExtensions.resetToDefaults();
            exports.debugSessions.push(session);
            // Process any queued events that came in before the session start
            // event.
            const eventsToProcess = pendingCustomEvents.filter((e) => e.session.id === s.id);
            pendingCustomEvents = pendingCustomEvents.filter((e) => e.session.id !== s.id);
            eventsToProcess.forEach((e) => {
                log_1.logInfo(`Processing delayed event ${e.event} for session ${e.session.id}`);
                this.handleCustomEventWithSession(session, e);
            });
        }
    }
    handleDebugSessionCustomEvent(e) {
        this.flutterExtensions.handleDebugEvent(e);
        if (this.handleCustomEvent(e))
            return;
        const session = exports.debugSessions.find((ds) => ds.session.id === e.session.id);
        if (!session) {
            log_1.logWarn(`Did not find session ${e.session.id} to handle ${e.event}. There were ${exports.debugSessions.length} sessions:\n${exports.debugSessions.map((ds) => `  ${ds.session.id}`).join("\n")}`);
            log_1.logWarn(`Event will be queued and processed when the session start event fires`);
            pendingCustomEvents.push(e);
            return;
        }
        this.handleCustomEventWithSession(session, e);
    }
    handleDebugSessionEnd(s) {
        const sessionIndex = exports.debugSessions.findIndex((ds) => ds.session.id === s.id);
        if (sessionIndex === -1)
            return;
        // Grab the session and remove it from the list so we don't try to interact with it anymore.
        const session = exports.debugSessions[sessionIndex];
        exports.debugSessions.splice(sessionIndex, 1);
        this.clearProgressIndicators(session);
        this.debugMetrics.hide();
        const debugSessionEnd = new Date();
        this.analytics.logDebugSessionDuration(debugSessionEnd.getTime() - session.sessionStart.getTime());
        // If this was the last session terminating, then remove all the flags for which service extensions are supported.
        // Really we should track these per-session, but the changes of them being different given we only support one
        // SDK at a time are practically zero.
        if (exports.debugSessions.length === 0)
            this.flutterExtensions.markAllServicesUnloaded();
    }
    handleCustomEvent(e) {
        if (e.event === "dart.log") {
            log_1.handleDebugLogEvent(e.event, e.body);
        }
        else if (e.event === "dart.hotRestartRequest") {
            // This event comes back when the user restarts with the Restart button
            // (eg. it wasn't intiated from our extension, so we don't get to log it
            // in the command).
            this.analytics.logDebuggerRestart();
            this.onWillHotRestartEmitter.fire();
        }
        else if (e.event === "dart.hotReloadRequest") {
            // This event comes back when the user restarts with the Restart button
            // (eg. it wasn't intiated from our extension, so we don't get to log it
            // in the command).
            this.analytics.logDebuggerHotReload();
            this.onWillHotReloadEmitter.fire();
        }
        else if (e.event === "dart.flutter.firstFrame") {
            this.onFirstFrameEmitter.fire();
        }
        else if (e.event === "dart.debugMetrics") {
            const memory = e.body.memory;
            const message = `${Math.ceil(memory.current / 1024 / 1024)}MB of ${Math.ceil(memory.total / 1024 / 1024)}MB`;
            this.debugMetrics.text = message;
            this.debugMetrics.tooltip = "This is the amount of memory being consumed by your applications heaps (out of what has been allocated).\n\nNote: memory usage shown in debug builds may not be indicative of usage in release builds. Use profile builds for more accurate figures when testing memory usage.";
            this.debugMetrics.show();
        }
        else if (e.event === "dart.coverage") {
            this.onReceiveCoverageEmitter.fire(e.body);
        }
        else if (e.event === "dart.navigate") {
            if (e.body.file && e.body.line && e.body.column)
                vs.commands.executeCommand("_dart.jumpToLineColInUri", vs.Uri.parse(e.body.file), e.body.line, e.body.column);
        }
        else {
            // Not handled, will fall through in the caller.
            return false;
        }
        return true;
    }
    handleCustomEventWithSession(session, e) {
        if (e.event === "dart.launching") {
            vs.window.withProgress({ location: vs.ProgressLocation.Notification }, (progress) => {
                progress.report({ message: e.body.message });
                session.launchProgressReporter = progress;
                return session.launchProgressPromise.promise;
            });
        }
        else if (e.event === "dart.launched") {
            this.clearProgressIndicators(session);
        }
        else if (e.event === "dart.progress") {
            if (e.body.message) {
                if (session.launchProgressReporter) {
                    session.launchProgressReporter.report({ message: e.body.message });
                }
                else if (session.progressReporter) {
                    session.progressReporter.report({ message: e.body.message });
                }
                else {
                    session.progressID = e.body.progressID;
                    vs.window.withProgress({ location: vs.ProgressLocation.Notification }, (progress) => {
                        progress.report({ message: e.body.message });
                        session.progressReporter = progress;
                        if (!session.progressPromise)
                            session.progressPromise = new utils_1.PromiseCompleter();
                        return session.progressPromise.promise;
                    });
                }
            }
            if (e.body.finished) {
                if (session.launchProgressReporter) {
                    // Ignore "finished" events during launch, as we'll keep the progress indicator
                    // until we get dart.launched.
                }
                else if (session.progressID === e.body.progressID) {
                    // Otherwise, signal completion if it matches the thing that started the progress.
                    if (session.progressPromise)
                        session.progressPromise.resolve();
                    session.progressPromise = undefined;
                    session.progressReporter = undefined;
                }
            }
        }
        else if (e.event === "dart.debuggerUris") {
            session.observatoryUri = e.body.observatoryUri;
            session.vmServiceUri = e.body.vmServiceUri;
            const debuggerType = session.session.configuration.debuggerType;
            if (debuggerType === debug_config_provider_1.DebuggerType.Flutter || debuggerType === debug_config_provider_1.DebuggerType.FlutterWeb)
                user_prompts_1.showDevToolsNotificationIfAppropriate(this.context);
            this.onDebugSessionVmServiceAvailableEmitter.fire(session);
            // if (e.body.isProbablyReconnectable) {
            // 	mostRecentAttachedProbablyReusableObservatoryUri = session.observatoryUri;
            // } else {
            // 	mostRecentAttachedProbablyReusableObservatoryUri = undefined;
            // }
        }
    }
    clearProgressIndicators(session) {
        if (session.launchProgressPromise)
            session.launchProgressPromise.resolve();
        session.launchProgressReporter = undefined;
        if (session.progressPromise)
            session.progressPromise.resolve();
        session.progressPromise = undefined;
        session.progressReporter = undefined;
    }
    promptForDebugSession() {
        return __awaiter(this, void 0, void 0, function* () {
            const selectedItem = yield vs.window.showQuickPick(exports.debugSessions.map((s) => ({
                description: s.session.workspaceFolder ? s.session.workspaceFolder.name : undefined,
                detail: s.session.configuration.deviceName || `Started ${s.sessionStart.toLocaleTimeString()}`,
                label: s.session.name,
                session: s,
            })), {
                placeHolder: "Which debug session?",
            });
            return selectedItem && selectedItem.session;
        });
    }
    sendServiceSetting(extension, args) {
        exports.debugSessions.forEach((session) => {
            session.session.customRequest("serviceExtension", args);
        });
    }
}
exports.DebugCommands = DebugCommands;
//# sourceMappingURL=debug.js.map