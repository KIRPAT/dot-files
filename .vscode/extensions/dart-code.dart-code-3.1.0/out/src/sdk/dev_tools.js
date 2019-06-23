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
const os = require("os");
const path = require("path");
const vs = require("vscode");
const vscode_1 = require("vscode");
const debug_1 = require("../commands/debug");
const config_1 = require("../config");
const constants_1 = require("../constants");
const utils_1 = require("../debug/utils");
const vm_service_extensions_1 = require("../flutter/vm_service_extensions");
const stdio_service_1 = require("../services/stdio_service");
const utils_2 = require("../utils");
const log_1 = require("../utils/log");
const promises_1 = require("../utils/promises");
const utils_3 = require("./utils");
const devtools = "devtools";
const devtoolsPackageName = "Dart DevTools";
// This starts off undefined, which means we'll read from config.devToolsPort and all back to 0 (auto-assign).
// Once we get a port we'll update this variable so that if we restart (eg. a silent extension restart due to
// SDK change or similar) we will try to use the same port, so if the user has browser windows open they're
// still valid.
let portToBind;
/// Handles launching DevTools in the browser and managing the underlying service.
class DevToolsManager {
    constructor(sdks, debugCommands, analytics, pubGlobal) {
        this.sdks = sdks;
        this.debugCommands = debugCommands;
        this.analytics = analytics;
        this.pubGlobal = pubGlobal;
        this.disposables = [];
        this.devToolsStatusBarItem = vs.window.createStatusBarItem(vs.StatusBarAlignment.Right, 100);
        this.disposables.push(this.devToolsStatusBarItem);
    }
    /// Spawns DevTools and returns the full URL to open for that session
    ///   eg. http://localhost:8123/?port=8543
    spawnForSession(session) {
        return __awaiter(this, void 0, void 0, function* () {
            this.analytics.logDebuggerOpenDevTools();
            const isAvailable = yield this.pubGlobal.promptToInstallIfRequired(devtoolsPackageName, devtools, undefined, "0.1.0", true);
            if (!isAvailable) {
                return undefined;
            }
            if (!this.devtoolsUrl) {
                this.devtoolsUrl = vs.window.withProgress({
                    location: vs.ProgressLocation.Notification,
                    title: "Starting Dart DevTools...",
                }, (_) => __awaiter(this, void 0, void 0, function* () { return this.startServer(); }));
            }
            try {
                const url = yield this.devtoolsUrl;
                const didLaunch = yield vs.window.withProgress({
                    location: vs.ProgressLocation.Notification,
                    title: "Opening Dart DevTools...",
                }, (_) => __awaiter(this, void 0, void 0, function* () {
                    const canLaunchDevToolsThroughService = yield promises_1.waitFor(() => this.debugCommands.flutterExtensions.serviceIsRegistered(vm_service_extensions_1.FlutterService.LaunchDevTools), 500);
                    if (canLaunchDevToolsThroughService) {
                        try {
                            yield session.session.customRequest("service", {
                                params: {
                                    queryParams: {
                                        hide: "debugger",
                                        theme: config_1.config.useDevToolsDarkTheme ? "dark" : null,
                                    },
                                },
                                type: this.debugCommands.flutterExtensions.getServiceMethodName(vm_service_extensions_1.FlutterService.LaunchDevTools),
                            });
                            return true;
                        }
                        catch (e) {
                            log_1.logError(`DevTools failed to launch browser ${e.message}`);
                            vs.window.showErrorMessage(`The DevTools service failed to launch the browser. ${constants_1.pleaseReportBug}`, "Show Full Error").then((res) => {
                                if (res) {
                                    const fileName = `bug-${utils_2.getRandomInt(0x1000, 0x10000).toString(16)}.txt`;
                                    const tempPath = path.join(os.tmpdir(), fileName);
                                    fs.writeFileSync(tempPath, e.message);
                                    vscode_1.workspace.openTextDocument(tempPath).then((document) => {
                                        vscode_1.window.showTextDocument(document);
                                    });
                                }
                            });
                            return false;
                        }
                    }
                    else {
                        // const fullUrl = `${url}?hide=debugger&uri=${encodeURIComponent(session.vmServiceUri)}${config.useDevToolsDarkTheme ? "&theme=dark" : ""}`;
                        // openInBrowser(fullUrl);
                        log_1.logError(`DevTools failed to register launchDevTools service`);
                        vs.window.showErrorMessage(`The DevTools service failed to register. ${constants_1.pleaseReportBug}`);
                        return false;
                    }
                }));
                if (!didLaunch)
                    return;
                this.devToolsStatusBarItem.text = "Dart DevTools";
                this.devToolsStatusBarItem.tooltip = `Dart DevTools is running at ${url}`;
                this.devToolsStatusBarItem.command = "dart.openDevTools";
                this.devToolsStatusBarItem.show();
                return { url, dispose: () => this.dispose() };
            }
            catch (e) {
                this.devToolsStatusBarItem.hide();
                log_1.logError(e);
                vs.window.showErrorMessage(`${e}`);
            }
        });
    }
    /// Starts the devtools server and returns the URL of the running app.
    startServer() {
        return new Promise((resolve, reject) => {
            const service = new DevToolsService(this.sdks);
            this.disposables.push(service);
            service.registerForServerStarted((n) => {
                // When a new debug session starts, we need to wait for its VM
                // Service, then register it with this server.
                this.disposables.push(this.debugCommands.onDebugSessionVmServiceAvailable((session) => service.vmRegister({ uri: session.vmServiceUri })));
                // And send any existing sessions we have.
                debug_1.debugSessions.forEach((session) => service.vmRegister({ uri: session.vmServiceUri }));
                portToBind = n.port;
                resolve(`http://${n.host}:${n.port}/`);
            });
            service.process.on("close", (code) => {
                this.devtoolsUrl = undefined;
                this.devToolsStatusBarItem.hide();
                if (code && code !== 0) {
                    // Reset the port to 0 on error in case it was from us trying to reuse the previous port.
                    portToBind = 0;
                    const errorMessage = `${devtoolsPackageName} exited with code ${code}`;
                    log_1.logError(errorMessage);
                    reject(errorMessage);
                }
            });
        });
    }
    dispose() {
        this.disposables.forEach((d) => d.dispose());
    }
}
exports.DevToolsManager = DevToolsManager;
class DevToolsService extends stdio_service_1.StdIOService {
    constructor(sdks) {
        super(() => config_1.config.devToolsLogFile, (message, severity) => log_1.log(message, severity, utils_1.LogCategory.CommandProcesses), config_1.config.maxLogLineLength);
        this.serverStartedSubscriptions = [];
        const pubBinPath = path.join(sdks.dart, utils_3.pubPath);
        portToBind = config_1.config.devToolsPort // Always config first
            || portToBind // Then try the last port we bound this session
            || (utils_1.isChromeOS && config_1.config.useKnownChromeOSPorts ? constants_1.CHROME_OS_DEVTOOLS_PORT : 0);
        const args = ["global", "run", "devtools", "--machine", "--port", portToBind.toString()];
        this.registerForServerStarted((n) => this.additionalPidsToTerminate.push(n.pid));
        this.createProcess(undefined, pubBinPath, args);
    }
    shouldHandleMessage(message) {
        return message.startsWith("{") && message.endsWith("}");
    }
    // TODO: Remove this if we fix the DevTools server (and rev min version) to not use method for
    // the server.started event.
    isNotification(msg) { return msg.event || msg.method === "server.started"; }
    handleNotification(evt) {
        switch (evt.method || evt.event) {
            case "server.started":
                this.notify(this.serverStartedSubscriptions, evt.params);
                break;
        }
    }
    registerForServerStarted(subscriber) {
        return this.subscribe(this.serverStartedSubscriptions, subscriber);
    }
    vmRegister(request) {
        return this.sendRequest("vm.register", request);
    }
}
//# sourceMappingURL=dev_tools.js.map