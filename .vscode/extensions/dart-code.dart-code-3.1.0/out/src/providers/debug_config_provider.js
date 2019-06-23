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
const net = require("net");
const path = require("path");
const vs = require("vscode");
const vscode_1 = require("vscode");
const debug_1 = require("../commands/debug");
const logging_1 = require("../commands/logging");
const config_1 = require("../config");
const constants_1 = require("../constants");
const dart_debug_impl_1 = require("../debug/dart_debug_impl");
const dart_test_debug_impl_1 = require("../debug/dart_test_debug_impl");
const flutter_debug_impl_1 = require("../debug/flutter_debug_impl");
const flutter_test_debug_impl_1 = require("../debug/flutter_test_debug_impl");
const flutter_web_debug_impl_1 = require("../debug/flutter_web_debug_impl");
const flutter_web_test_debug_impl_1 = require("../debug/flutter_web_test_debug_impl");
const utils_1 = require("../debug/utils");
const project_1 = require("../project");
const webdev_1 = require("../pub/webdev");
const utils_2 = require("../sdk/utils");
const utils_3 = require("../utils");
const log_1 = require("../utils/log");
const test_view_1 = require("../views/test_view");
exports.TRACK_WIDGET_CREATION_ENABLED = "dart-code:trackWidgetCreationEnabled";
exports.HAS_LAST_DEBUG_CONFIG = "dart-code:hasLastDebugConfig";
exports.showErrorsAction = "Show Errors";
exports.debugAnywayAction = "Debug Anyway";
const isCI = !!process.env.CI;
let hasShownFlutterWebDebugWarning = false;
class DebugConfigProvider {
    constructor(sdks, analytics, pubGlobal, deviceManager, flutterCapabilities) {
        this.sdks = sdks;
        this.analytics = analytics;
        this.pubGlobal = pubGlobal;
        this.deviceManager = deviceManager;
        this.flutterCapabilities = flutterCapabilities;
        this.debugServers = {};
    }
    provideDebugConfigurations(folder, token) {
        const isFlutter = utils_3.isFlutterWorkspaceFolder(folder);
        return [{
                name: isFlutter ? "Flutter" : "Dart",
                program: isFlutter ? undefined : "bin/main.dart",
                request: "launch",
                type: "dart",
            }];
    }
    resolveDebugConfiguration(folder, debugConfig, token) {
        return __awaiter(this, void 0, void 0, function* () {
            const openFile = vscode_1.window.activeTextEditor && vscode_1.window.activeTextEditor.document && vscode_1.window.activeTextEditor.document.uri.scheme === "file"
                ? utils_3.fsPath(vscode_1.window.activeTextEditor.document.uri)
                : undefined;
            function resolveVariables(input) {
                if (!input)
                    return input;
                input = input.replace(/\${file}/gi, openFile);
                if (folder) {
                    const folderPath = utils_3.fsPath(folder.uri);
                    input = input.replace(/\${(workspaceFolder|workspaceRoot)}/gi, folderPath);
                }
                return input;
            }
            /** Gets the first unresolved variable from the given string. */
            function getUnresolvedVariable(input) {
                if (!input)
                    return undefined;
                const matches = /\${\w+}/.exec(input);
                return matches ? matches[0] : undefined;
            }
            function warnOnUnresolvedVariables(property, input) {
                if (!input)
                    return false;
                const v = getUnresolvedVariable(input);
                if (v) {
                    log_1.logError(`Launch config property '${property}' has unresolvable variable ${v}`);
                    vscode_1.window.showErrorMessage(`Launch config property '${property}' has unresolvable variable ${v}`);
                    return true;
                }
                return false;
            }
            log_1.log(`Starting debug session...`);
            if (folder)
                log_1.log(`    workspace: ${utils_3.fsPath(folder.uri)}`);
            if (debugConfig.program)
                log_1.log(`    program  : ${debugConfig.program}`);
            if (debugConfig.cwd)
                log_1.log(`    cwd      : ${debugConfig.cwd}`);
            debugConfig.program = resolveVariables(debugConfig.program);
            debugConfig.cwd = resolveVariables(debugConfig.cwd);
            if (warnOnUnresolvedVariables("program", debugConfig.program) || warnOnUnresolvedVariables("cwd", debugConfig.cwd)) {
                // Warning is shown from inside warnOnUnresolvedVariables.
                return null; // null means open launch.json.
            }
            if (openFile && !folder) {
                folder = vscode_1.workspace.getWorkspaceFolder(vscode_1.Uri.file(openFile));
                if (folder)
                    log_1.log(`Setting workspace based on open file: ${utils_3.fsPath(folder.uri)}`);
            }
            else if (!folder && vs.workspace.workspaceFolders && vs.workspace.workspaceFolders.length === 1) {
                folder = vs.workspace.workspaceFolders[0];
                if (folder)
                    log_1.log(`Setting workspace based on single open workspace: ${utils_3.fsPath(folder.uri)}`);
            }
            // Convert to an absolute paths (if possible).
            if (debugConfig.cwd && !path.isAbsolute(debugConfig.cwd) && folder) {
                debugConfig.cwd = path.join(utils_3.fsPath(folder.uri), debugConfig.cwd);
                log_1.log(`Converted cwd to absolute path: ${debugConfig.cwd}`);
            }
            if (debugConfig.program && !path.isAbsolute(debugConfig.program) && (debugConfig.cwd || folder)) {
                debugConfig.program = path.join(debugConfig.cwd || utils_3.fsPath(folder.uri), debugConfig.program);
                log_1.log(`Converted program to absolute path: ${debugConfig.program}`);
            }
            const isAttachRequest = debugConfig.request === "attach";
            if (!isAttachRequest) {
                // If there's no program set, try to guess one.
                if (!debugConfig.program) {
                    const preferredFolder = debugConfig.cwd
                        ? debugConfig.cwd
                        : folder
                            ? utils_3.fsPath(folder.uri)
                            : undefined;
                    // If we have a folder specified, we should only consider open files if it's inside it.
                    const preferredFile = !preferredFolder || (!!openFile && utils_1.isWithinPath(openFile, preferredFolder)) ? openFile : undefined;
                    debugConfig.program = debugConfig.program || this.guessBestEntryPoint(preferredFile, preferredFolder);
                }
                // If we still don't have an entry point, the user will have to provide it.
                if (!debugConfig.program) {
                    log_1.logWarn("No program was set in launch config");
                    vscode_1.window.showInformationMessage("Set the 'program' value in your launch config (eg 'bin/main.dart') then launch again");
                    return null; // null means open launch.json.
                }
            }
            // If we don't have a cwd then find the best one from the project root.
            if (!debugConfig.cwd && folder) {
                debugConfig.cwd = utils_3.fsPath(folder.uri);
                log_1.log(`Using workspace as cwd: ${debugConfig.cwd}`);
                // If we have an entry point, see if we can make this more specific by finding a .packages file
                if (debugConfig.program) {
                    const bestProjectRoot = project_1.locateBestProjectRoot(debugConfig.program);
                    if (bestProjectRoot && utils_1.isWithinPath(bestProjectRoot, utils_3.fsPath(folder.uri))) {
                        debugConfig.cwd = bestProjectRoot;
                        log_1.log(`Found better project root to use as cwd: ${debugConfig.cwd}`);
                    }
                }
            }
            // Ensure we have a full path.
            if (debugConfig.program && debugConfig.cwd && !path.isAbsolute(debugConfig.program))
                debugConfig.program = path.join(debugConfig.cwd, debugConfig.program);
            let debugType = DebuggerType.Dart;
            if (debugConfig.cwd
                // TODO: This isInsideFolderNamed often fails when we found a better project root above.
                && !utils_3.isInsideFolderNamed(debugConfig.program, "bin")
                && !utils_3.isInsideFolderNamed(debugConfig.program, "tool")) {
                // Check if we're a Flutter or FlutterWeb project.
                if (utils_3.isFlutterWebProjectFolder(debugConfig.cwd)) {
                    debugType = DebuggerType.FlutterWeb;
                    if (utils_3.isFlutterProjectFolder(debugConfig.cwd)) {
                        log_1.logError("Flutter web project references sdk:flutter and may fail to launch");
                        vscode_1.window.showWarningMessage("Flutter web projects may fail to launch if they reference the Flutter SDK in pubspec.yaml");
                    }
                }
                else if (utils_3.isFlutterProjectFolder(debugConfig.cwd))
                    debugType = DebuggerType.Flutter;
                else
                    log_1.log(`Non-Dart Project (${debugConfig.program}) not recognised as Flutter or FlutterWeb, will use Dart debugger`);
            }
            log_1.log(`Detected launch project as ${DebuggerType[debugType]}`);
            // Some helpers for conditions below.
            const isAnyFlutter = debugType === DebuggerType.Flutter || debugType === DebuggerType.FlutterWeb;
            const isStandardFlutter = debugType === DebuggerType.Flutter;
            const isTest = debugConfig.program && utils_3.isTestFileOrFolder(debugConfig.program);
            if (isTest)
                log_1.log(`Detected launch project as a Test project`);
            const canPubRunTest = isTest && debugConfig.cwd && utils_3.checkProjectSupportsPubRunTest(debugConfig.cwd);
            if (isTest && !canPubRunTest)
                log_1.log(`Project does not appear to support 'pub run test', will use VM directly`);
            if (isTest) {
                switch (debugType) {
                    case DebuggerType.Dart:
                        if (canPubRunTest)
                            debugType = DebuggerType.PubTest;
                        break;
                    case DebuggerType.Flutter:
                        debugType = DebuggerType.FlutterTest;
                        break;
                    case DebuggerType.FlutterWeb:
                        debugType = DebuggerType.FlutterWebTest;
                        break;
                    default:
                        log_1.log("Unknown debugType, unable to switch to test debugger");
                }
            }
            log_1.log(`Using ${DebuggerType[debugType]} debug adapter for this session`);
            if (debugType === DebuggerType.FlutterWebTest) {
                // TODO: IMPORTANT! When removing this if statement, add FlutterWebTest to
                // the call to TestResultsProvider.flagSuiteStart below!
                log_1.logError("Tests in Flutter web projects are not currently supported");
                vscode_1.window.showErrorMessage("Tests in Flutter web projects are not currently supported");
                return undefined; // undefined means silent (don't open launch.json).
            }
            // If we're attaching to Dart, ensure we get an observatory URI.
            if (isAttachRequest) {
                // For attaching, the Observatory address must be specified. If it's not provided already, prompt for it.
                if (!isStandardFlutter) { // TEMP Condition because there's no point asking yet as the user doesn't know how to get this..
                    debugConfig.observatoryUri = yield this.getFullVmServiceUri(debugConfig.observatoryUri /*, mostRecentAttachedProbablyReusableObservatoryUri*/);
                }
                if (!debugConfig.observatoryUri && !isStandardFlutter) {
                    log_1.logWarn("No Observatory URI/port was provided");
                    vscode_1.window.showInformationMessage("You must provide an Observatory URI/port to attach a debugger");
                    return undefined; // undefined means silent (don't open launch.json).
                }
            }
            // Ensure we have a device if required.
            let currentDevice = this.deviceManager && this.deviceManager.currentDevice;
            if (isStandardFlutter && !isTest && !currentDevice && this.deviceManager && debugConfig.deviceId !== "flutter-tester") {
                // Fetch a list of emulators.
                if (!(yield this.deviceManager.promptForAndLaunchEmulator(true))) {
                    log_1.logWarn("Unable to launch due to no active device");
                    vscode_1.window.showInformationMessage("Cannot launch without an active device");
                    return undefined; // undefined means silent (don't open launch.json).
                }
                // Otherwise try to read again.
                currentDevice = this.deviceManager && this.deviceManager.currentDevice;
            }
            // Ensure we have any require dependencies.
            if (!(yield this.installDependencies(debugType, this.pubGlobal))) {
                return undefined;
            }
            // TODO: This cast feels nasty?
            this.setupDebugConfig(folder, debugConfig, isAnyFlutter, currentDevice);
            // Debugger always uses uppercase drive letters to ensure our paths have them regardless of where they came from.
            debugConfig.program = utils_1.forceWindowsDriveLetterToUppercase(debugConfig.program);
            debugConfig.cwd = utils_1.forceWindowsDriveLetterToUppercase(debugConfig.cwd);
            // If we're launching (not attaching) then check there are no errors before we launch.
            if (!isAttachRequest && debugConfig.cwd && config_1.config.promptToRunIfErrors) {
                log_1.log("Checking for errors before launching");
                const isDartError = (d) => d.source === "dart" && d.severity === vs.DiagnosticSeverity.Error;
                const dartErrors = vs.languages
                    .getDiagnostics()
                    .filter((file) => file[1].find(isDartError));
                // Check if any are inside our CWD.
                const firstRelevantError = dartErrors.find((fd) => {
                    const file = utils_3.fsPath(fd[0]);
                    return utils_1.isWithinPath(file, debugConfig.cwd)
                        // Ignore errors in tests unless it's the file we're running.
                        && (!utils_3.isTestFile(file) || file === debugConfig.program);
                });
                if (firstRelevantError) {
                    log_1.logWarn("Project has errors, prompting user");
                    log_1.logWarn(`    ${utils_3.fsPath(firstRelevantError[0])}`);
                    log_1.logWarn(`    ${firstRelevantError[1][0].range}: ${firstRelevantError[1][0].message}`);
                    const action = yield vscode_1.window.showErrorMessage("Build errors exist in your project.", { modal: true }, exports.debugAnywayAction, exports.showErrorsAction);
                    if (action === exports.debugAnywayAction) {
                        log_1.log("Debugging anyway!");
                        // Do nothing, we'll just carry on.
                    }
                    else {
                        log_1.log("Aborting!");
                        if (action === exports.showErrorsAction)
                            vs.commands.executeCommand("workbench.action.showErrorsWarnings");
                        return undefined; // undefined means silent (don't open launch.json).
                    }
                }
            }
            // Start port listener on launch of first debug session.
            const debugServer = this.getDebugServer(debugType, debugConfig.debugServer);
            const serverAddress = debugServer.address();
            // Updated node bindings say address can be a string (used for pipes) but
            // this should never be the case here. This check is to keep the types happy.
            if (typeof serverAddress === "string") {
                log_1.log("Debug server does not have a valid address");
                vscode_1.window.showErrorMessage("Debug server does not have a valid address");
                return undefined;
            }
            // Make VS Code connect to debug server instead of launching debug adapter.
            // TODO: Why do we need this cast? The node-mock-debug does not?
            debugConfig.debugServer = serverAddress.port;
            // We don't currently support debug for FlutterWeb
            if (debugType === DebuggerType.FlutterWeb && !debugConfig.noDebug && !this.flutterCapabilities.webSupportsDebugging) {
                // TODO: Support this! :)
                debugConfig.noDebug = true;
                if (!hasShownFlutterWebDebugWarning) {
                    vscode_1.window.showInformationMessage("Breakpoints and stepping are not currently supported in VS Code for Flutter web projects, please use your browser tools if you need to break or step through code.");
                    hasShownFlutterWebDebugWarning = true;
                }
            }
            this.analytics.logDebuggerStart(folder && folder.uri, DebuggerType[debugType], debugConfig.noDebug ? "Run" : "Debug");
            if (debugType === DebuggerType.FlutterTest /*|| debugType === DebuggerType.FlutterWebTest*/ || debugType === DebuggerType.PubTest) {
                const isRunningTestSubset = debugConfig.args && (debugConfig.args.indexOf("--name") !== -1 || debugConfig.args.indexOf("--pname") !== -1);
                test_view_1.TestResultsProvider.flagSuiteStart(debugConfig.program, !isRunningTestSubset);
            }
            debugConfig.debuggerType = debugType;
            log_1.log(`Debug session starting...\n    ${JSON.stringify(debugConfig, undefined, 4).replace(/\n/g, "\n    ")}`);
            // Stash the config to support the "rerun last test(s)" command.
            debug_1.LastDebugSession.workspaceFolder = folder;
            debug_1.LastDebugSession.debugConfig = Object.assign({}, debugConfig);
            vs.commands.executeCommand("setContext", exports.HAS_LAST_DEBUG_CONFIG, true);
            return debugConfig;
        });
    }
    installDependencies(debugType, pubGlobal) {
        return debugType === DebuggerType.FlutterWeb
            ? new webdev_1.WebDev(pubGlobal).promptToInstallIfRequired()
            : true;
    }
    guessBestEntryPoint(openFile, folder) {
        // For certain open files, assume the user wants to run them.
        if (utils_3.isDartFile(openFile) &&
            (utils_3.isTestFile(openFile) || (utils_3.isInsideFolderNamed(openFile, "bin") || utils_3.isInsideFolderNamed(openFile, "tool")))) {
            log_1.log(`Using open file as entry point: ${openFile}`);
            return openFile;
        }
        // Use the open file as a clue to find the best project root, then search from there.
        const projectRoot = project_1.locateBestProjectRoot(openFile) || folder;
        if (!projectRoot)
            return;
        const commonLaunchPaths = [
            path.join(projectRoot, "lib", "main.dart"),
            path.join(projectRoot, "bin", "main.dart"),
        ];
        for (const launchPath of commonLaunchPaths) {
            if (fs.existsSync(launchPath)) {
                log_1.log(`Using found common entry point: ${launchPath}`);
                return launchPath;
            }
        }
    }
    getFullVmServiceUri(observatoryUri, defaultValue) {
        return __awaiter(this, void 0, void 0, function* () {
            observatoryUri = observatoryUri || (yield vs.commands.executeCommand("dart.promptForVmService", defaultValue));
            observatoryUri = observatoryUri && observatoryUri.trim();
            // If the input is just a number, treat is as a localhost port.
            if (observatoryUri && /^[0-9]+$/.exec(observatoryUri)) {
                observatoryUri = `http://127.0.0.1:${observatoryUri}`;
            }
            return observatoryUri;
        });
    }
    getDebugServer(debugType, port) {
        switch (debugType) {
            case DebuggerType.Flutter:
                return this.spawnOrGetServer("flutter", port, () => new flutter_debug_impl_1.FlutterDebugSession());
            case DebuggerType.FlutterTest:
                return this.spawnOrGetServer("flutterTest", port, () => new flutter_test_debug_impl_1.FlutterTestDebugSession());
            case DebuggerType.FlutterWeb:
                return this.spawnOrGetServer("flutterWeb", port, () => new flutter_web_debug_impl_1.FlutterWebDebugSession());
            case DebuggerType.FlutterWebTest:
                return this.spawnOrGetServer("pubTest", port, () => new flutter_web_test_debug_impl_1.FlutterWebTestDebugSession());
            case DebuggerType.Dart:
                return this.spawnOrGetServer("dart", port, () => new dart_debug_impl_1.DartDebugSession());
            case DebuggerType.PubTest:
                return this.spawnOrGetServer("pubTest", port, () => new dart_test_debug_impl_1.DartTestDebugSession());
            default:
                throw new Error("Unknown debugger type");
        }
    }
    spawnOrGetServer(type, port = 0, create) {
        // Start port listener on launch of first debug session.
        if (!this.debugServers[type]) {
            log_1.log(`Spawning a new ${type} debugger`);
            // Start listening on a random port.
            this.debugServers[type] = net.createServer((socket) => {
                const session = create();
                session.setRunAsServer(true);
                session.start(socket, socket);
            }).listen(port);
        }
        return this.debugServers[type];
    }
    setupDebugConfig(folder, debugConfig, isFlutter, device) {
        const conf = config_1.config.for(folder && folder.uri);
        // Attach any properties that weren't explicitly set.
        debugConfig.name = debugConfig.name || "Dart & Flutter";
        debugConfig.type = debugConfig.type || "dart";
        debugConfig.request = debugConfig.request || "launch";
        debugConfig.cwd = debugConfig.cwd || (folder && utils_3.fsPath(folder.uri));
        debugConfig.args = debugConfig.args || [];
        debugConfig.vmAdditionalArgs = debugConfig.vmAdditionalArgs || conf.vmAdditionalArgs;
        debugConfig.vmServicePort = debugConfig.vmServicePort || (utils_1.isChromeOS && config_1.config.useKnownChromeOSPorts ? constants_1.CHROME_OS_VM_SERVICE_PORT : 0);
        debugConfig.dartPath = debugConfig.dartPath || path.join(this.sdks.dart, utils_2.dartVMPath);
        debugConfig.observatoryLogFile = debugConfig.observatoryLogFile || conf.observatoryLogFile;
        debugConfig.webDaemonLogFile = debugConfig.webDaemonLogFile || conf.webDaemonLogFile;
        debugConfig.maxLogLineLength = debugConfig.maxLogLineLength || config_1.config.maxLogLineLength;
        debugConfig.pubPath = debugConfig.pubPath || path.join(this.sdks.dart, utils_2.pubPath);
        debugConfig.pubSnapshotPath = debugConfig.pubSnapshotPath || path.join(this.sdks.dart, utils_2.pubSnapshotPath);
        debugConfig.pubTestLogFile = debugConfig.pubTestLogFile || conf.pubTestLogFile;
        debugConfig.debugSdkLibraries = debugConfig.debugSdkLibraries !== undefined && debugConfig.debugSdkLibraries !== null
            ? debugConfig.debugSdkLibraries
            : !!conf.debugSdkLibraries;
        debugConfig.debugExternalLibraries = debugConfig.debugExternalLibraries !== undefined && debugConfig.debugExternalLibraries !== null
            ? debugConfig.debugExternalLibraries
            : conf.debugExternalLibraries;
        debugConfig.evaluateGettersInDebugViews = debugConfig.evaluateGettersInDebugViews || conf.evaluateGettersInDebugViews;
        if (isFlutter) {
            debugConfig.forceFlutterVerboseMode = logging_1.isLogging || isCI;
            debugConfig.flutterAttachSupportsUris = this.flutterCapabilities.supportsUrisForFlutterAttach;
            debugConfig.flutterTrackWidgetCreation =
                // Use from the launch.json if configured.
                debugConfig.flutterTrackWidgetCreation !== undefined && debugConfig.flutterTrackWidgetCreation !== null
                    ? debugConfig.flutterTrackWidgetCreation :
                    // Otherwise use the config.
                    conf.flutterTrackWidgetCreation;
            debugConfig.flutterMode = debugConfig.flutterMode || "debug";
            debugConfig.flutterPlatform = debugConfig.flutterPlatform || "default";
            debugConfig.flutterPath = debugConfig.flutterPath || (this.sdks.flutter ? path.join(this.sdks.flutter, utils_2.flutterPath) : undefined);
            debugConfig.flutterRunLogFile = debugConfig.flutterRunLogFile || conf.flutterRunLogFile;
            debugConfig.flutterTestLogFile = debugConfig.flutterTestLogFile || conf.flutterTestLogFile;
            if (!debugConfig.deviceId && device) {
                debugConfig.deviceId = device.id;
                debugConfig.deviceName = `${device.name} (${device.platform})`;
            }
            debugConfig.showMemoryUsage =
                debugConfig.showMemoryUsage || debugConfig.showMemoryUsage === false
                    ? debugConfig.showMemoryUsage
                    : debugConfig.flutterMode === "profile";
        }
    }
    dispose() {
        if (this.debugServers) {
            for (const type of Object.keys(this.debugServers)) {
                this.debugServers[type].close();
                delete this.debugServers[type];
            }
        }
    }
}
exports.DebugConfigProvider = DebugConfigProvider;
var DebuggerType;
(function (DebuggerType) {
    DebuggerType[DebuggerType["Dart"] = 0] = "Dart";
    DebuggerType[DebuggerType["PubTest"] = 1] = "PubTest";
    DebuggerType[DebuggerType["Flutter"] = 2] = "Flutter";
    DebuggerType[DebuggerType["FlutterTest"] = 3] = "FlutterTest";
    DebuggerType[DebuggerType["FlutterWeb"] = 4] = "FlutterWeb";
    DebuggerType[DebuggerType["FlutterWebTest"] = 5] = "FlutterWebTest";
})(DebuggerType = exports.DebuggerType || (exports.DebuggerType = {}));
//# sourceMappingURL=debug_config_provider.js.map