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
const vscode_debugadapter_1 = require("vscode-debugadapter");
const config_1 = require("../config");
const constants_1 = require("../constants");
const colors_1 = require("../utils/colors");
const log_1 = require("../utils/log");
const processes_1 = require("../utils/processes");
const dart_debug_protocol_1 = require("./dart_debug_protocol");
const package_map_1 = require("./package_map");
const threads_1 = require("./threads");
const utils_1 = require("./utils");
const maxValuesToCallToString = 15;
// Prefix that appears at the start of stack frame names that are unoptimized
// which we'd prefer not to show to the user.
const unoptimizedPrefix = "[Unoptimized] ";
const stackFrameWithUriPattern = new RegExp(`(.*#\\d+)(.*)\\(((?:package|dart|file):.*\\.dart):(\\d+):(\\d+)\\)\\s*$`);
const webStackFrameWithUriPattern = new RegExp(`((?:package|dart|file):.*\\.dart) (\\d+):(\\d+)\\s*(\\S+)\\s*$`);
// TODO: supportsSetVariable
// TODO: class variables?
// TODO: library variables?
// stepBackRequest(response: DebugProtocol.StepBackResponse, args: DebugProtocol.StepBackArguments): void;
// restartFrameRequest(response: DebugProtocol.RestartFrameResponse, args: DebugProtocol.RestartFrameArguments): void;
// completionsRequest(response: DebugProtocol.CompletionsResponse, args: DebugProtocol.CompletionsArguments): void;
class DartDebugSession extends vscode_debugadapter_1.DebugSession {
    constructor() {
        super();
        this.additionalPidsToTerminate = [];
        // We normally track the pid from Observatory to terminate the VM afterwards, but for Flutter Run it's
        // a remote PID and therefore doesn't make sense to try and terminate.
        this.allowTerminatingObservatoryVmPid = true;
        // Normally we don't connect to the VM when running no noDebug mode, but for
        // Flutter, this means we can't call service extensions (for ex. toggling
        // debug modes) so we allow it to override this (and then we skip things
        // like breakpoints). We can't do it always, because some functionality
        // (such as running multiple test suites) will break by having multiple
        // potential VM services come and go.
        // https://github.com/Dart-Code/Dart-Code/issues/1673
        this.connectVmEvenForNoDebug = false;
        this.processExited = false;
        this.sendStdOutToConsole = true;
        this.supportsObservatory = true;
        this.parseObservatoryUriFromStdOut = true;
        this.requiresProgram = true;
        this.processExit = Promise.resolve();
        this.shouldKillProcessOnTerminate = true;
        this.logCategory = utils_1.LogCategory.General; // This isn't used as General, since both Flutter and FlutterWeb override it.
        this.knownOpenFiles = []; // Keep track of these for internal requests
        this.requestCoverageUpdate = utils_1.throttle((reason) => __awaiter(this, void 0, void 0, function* () {
            if (!this.knownOpenFiles || !this.knownOpenFiles.length)
                return;
            const coverageReport = yield this.getCoverageReport(this.knownOpenFiles);
            // Unwrap tokenPos into real locations.
            const coverageData = coverageReport.map((r) => {
                const allTokens = [r.startPos, r.endPos, ...r.hits, ...r.misses];
                const hitLines = [];
                r.hits.forEach((h) => {
                    const startTokenIndex = allTokens.indexOf(h);
                    const endTokenIndex = startTokenIndex < allTokens.length - 1 ? startTokenIndex + 1 : startTokenIndex;
                    const startLoc = this.resolveFileLocation(r.script, allTokens[startTokenIndex]);
                    const endLoc = this.resolveFileLocation(r.script, allTokens[endTokenIndex]);
                    for (let i = startLoc.line; i <= endLoc.line; i++)
                        hitLines.push(i);
                });
                return {
                    hitLines,
                    scriptPath: r.hostScriptPath,
                };
            });
            this.sendEvent(new vscode_debugadapter_1.Event("dart.coverage", coverageData));
        }), 2000);
        this.threadManager = new threads_1.ThreadManager(this);
    }
    // protected observatoryUriIsProbablyReconnectable = false;
    get shouldConnectDebugger() {
        return !this.noDebug || this.connectVmEvenForNoDebug;
    }
    initializeRequest(response, args) {
        response.body = response.body || {};
        response.body.supportsConfigurationDoneRequest = true;
        response.body.supportsEvaluateForHovers = true;
        response.body.supportsDelayedStackTraceLoading = true;
        response.body.supportsConditionalBreakpoints = true;
        response.body.supportsLogPoints = true;
        response.body.supportsTerminateRequest = true;
        response.body.exceptionBreakpointFilters = [
            { filter: "All", label: "All Exceptions", default: false },
            { filter: "Unhandled", label: "Uncaught Exceptions", default: true },
        ];
        this.sendResponse(response);
    }
    launchRequest(response, args) {
        if (!args || !args.dartPath || (this.requiresProgram && !args.program)) {
            this.logToUser("Unable to restart debugging. Please try ending the debug session and starting again.\n");
            this.sendEvent(new vscode_debugadapter_1.TerminatedEvent());
            return;
        }
        // Force relative paths to absolute.
        if (args.program && !path.isAbsolute(args.program))
            args.program = path.join(args.cwd, args.program);
        this.shouldKillProcessOnTerminate = true;
        this.cwd = args.cwd;
        this.noDebug = args.noDebug;
        // Set default exception mode based on noDebug. This will be sent to threads
        // prior to VS Code sending (or, in the case of noDebug, due to not sending)
        // the exception mode.
        this.threadManager.setExceptionPauseMode(this.noDebug ? "None" : "Unhandled");
        this.packageMap = new package_map_1.PackageMap(package_map_1.PackageMap.findPackagesFile(args.program || args.cwd));
        this.debugSdkLibraries = args.debugSdkLibraries;
        this.debugExternalLibraries = args.debugExternalLibraries;
        this.evaluateGettersInDebugViews = args.evaluateGettersInDebugViews;
        this.logFile = args.observatoryLogFile;
        this.maxLogLineLength = args.maxLogLineLength;
        this.sendResponse(response);
        this.childProcess = this.spawnProcess(args);
        const process = this.childProcess;
        this.processExited = false;
        this.processExit = new Promise((resolve) => process.on("exit", resolve));
        process.stdout.setEncoding("utf8");
        process.stdout.on("data", (data) => {
            let match = null;
            if (this.shouldConnectDebugger && this.parseObservatoryUriFromStdOut && !this.observatory) {
                match = dart_debug_protocol_1.ObservatoryConnection.bannerRegex.exec(data.toString());
            }
            if (match) {
                this.initDebugger(this.websocketUriForObservatoryUri(match[1]));
            }
            else if (this.sendStdOutToConsole)
                this.logToUser(data.toString(), "stdout");
        });
        process.stderr.setEncoding("utf8");
        process.stderr.on("data", (data) => {
            this.logToUser(data.toString(), "stderr");
        });
        process.on("error", (error) => {
            this.logToUser(`${error}\n`, "stderr");
        });
        process.on("exit", (code, signal) => {
            this.processExited = true;
            this.log(`Process exited (${signal ? `${signal}`.toLowerCase() : code})`);
            if (!code && !signal)
                this.logToUser("Exited\n");
            else
                this.logToUser(`Exited (${signal ? `${signal}`.toLowerCase() : code})\n`);
            this.sendEvent(new vscode_debugadapter_1.TerminatedEvent());
        });
        if (!this.shouldConnectDebugger)
            this.sendEvent(new vscode_debugadapter_1.InitializedEvent());
    }
    attachRequest(response, args) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!args || !args.observatoryUri) {
                return this.errorResponse(response, "Unable to attach; no Observatory address provided.");
            }
            // this.observatoryUriIsProbablyReconnectable = true;
            this.shouldKillProcessOnTerminate = false;
            this.cwd = args.cwd;
            this.debugSdkLibraries = args.debugSdkLibraries;
            this.debugExternalLibraries = args.debugExternalLibraries;
            this.logFile = args.observatoryLogFile;
            this.log(`Attaching to process via ${args.observatoryUri}`);
            // If we were given an explicity packages path, use it (otherwise we'll try
            // to extract from the VM)
            if (args.packages) {
                // Support relative paths
                if (args.packages && !path.isAbsolute(args.packages))
                    args.packages = path.join(args.cwd, args.packages);
                try {
                    this.packageMap = new package_map_1.PackageMap(package_map_1.PackageMap.findPackagesFile(args.packages));
                }
                catch (e) {
                    this.errorResponse(response, `Unable to load packages file: ${e}`);
                }
            }
            try {
                yield this.initDebugger(this.websocketUriForObservatoryUri(args.observatoryUri));
                this.sendResponse(response);
            }
            catch (e) {
                this.errorResponse(response, `Unable to connect to Observatory: ${e}`);
            }
        });
    }
    sourceFileForArgs(args) {
        return path.relative(args.cwd, args.program);
    }
    spawnProcess(args) {
        let appArgs = [];
        if (this.shouldConnectDebugger) {
            appArgs.push(`--enable-vm-service=${args.vmServicePort}`);
            appArgs.push("--pause_isolates_on_start=true");
        }
        if (args.enableAsserts !== false) { // undefined = on
            appArgs.push("--enable-asserts");
        }
        if (args.vmAdditionalArgs) {
            appArgs = appArgs.concat(args.vmAdditionalArgs);
        }
        appArgs.push(this.sourceFileForArgs(args));
        if (args.args) {
            appArgs = appArgs.concat(args.args);
        }
        this.log(`Spawning ${args.dartPath} with args ${JSON.stringify(appArgs)}`);
        if (args.cwd)
            this.log(`..  in ${args.cwd}`);
        const process = processes_1.safeSpawn(args.cwd, args.dartPath, appArgs, args.env);
        this.log(`    PID: ${process.pid}`);
        return process;
    }
    websocketUriForObservatoryUri(uri) {
        const wsUri = uri.trim();
        if (wsUri.endsWith("/ws"))
            return wsUri;
        else if (wsUri.endsWith("/ws/"))
            return wsUri.substr(0, wsUri.length - 1);
        else if (wsUri.endsWith("/"))
            return `${wsUri}ws`;
        else
            return `${wsUri}/ws`;
    }
    log(message, severity = utils_1.LogSeverity.Info) {
        if (this.logFile) {
            if (!this.logStream) {
                this.logStream = fs.createWriteStream(this.logFile);
                this.logStream.write(log_1.getLogHeader());
            }
            this.logStream.write(`[${(new Date()).toLocaleTimeString()}]: `);
            if (this.maxLogLineLength && message.length > this.maxLogLineLength)
                this.logStream.write(message.substring(0, this.maxLogLineLength) + "…\r\n");
            else
                this.logStream.write(message.trim() + "\r\n");
        }
        this.sendEvent(new vscode_debugadapter_1.Event("dart.log", new utils_1.LogMessage(message, severity, utils_1.LogCategory.Observatory)));
    }
    initDebugger(uri) {
        // Send the uri back to the editor so it can be used to launch browsers etc.
        let browserFriendlyUri;
        if (uri.endsWith("/ws")) {
            browserFriendlyUri = uri.substring(0, uri.length - 2);
            if (browserFriendlyUri.startsWith("ws:"))
                browserFriendlyUri = "http:" + browserFriendlyUri.substring(3);
        }
        else {
            browserFriendlyUri = uri;
        }
        this.sendEvent(new vscode_debugadapter_1.Event("dart.debuggerUris", {
            // If we won't be killing the process on terminate, then it's likely the
            // process will remain around and can be reconnected to, so let the
            // editor know that it should stash this URL for easier re-attaching.
            // isProbablyReconnectable: this.observatoryUriIsProbablyReconnectable,
            // If we don't support Observatory, don't send its URL back to the editor.
            observatoryUri: this.supportsObservatory ? browserFriendlyUri.toString() : undefined,
            vmServiceUri: browserFriendlyUri.toString(),
        }));
        if (!this.shouldConnectDebugger)
            return;
        return new Promise((resolve, reject) => {
            this.log(`Connecting to VM Service at ${uri}`);
            this.observatory = new dart_debug_protocol_1.ObservatoryConnection(uri);
            this.observatory.onLogging((message) => this.log(message));
            this.observatory.onOpen(() => {
                if (!this.observatory)
                    return;
                this.observatory.on("Isolate", (event) => this.handleIsolateEvent(event));
                this.observatory.on("Extension", (event) => this.handleExtensionEvent(event));
                this.observatory.on("Debug", (event) => this.handleDebugEvent(event));
                this.observatory.on("_Service", (event) => this.handleServiceEvent(event));
                this.observatory.getVM().then((result) => __awaiter(this, void 0, void 0, function* () {
                    if (!this.observatory)
                        return;
                    const vm = result.result;
                    // If we own this process (we launched it, didn't attach) and the PID we get from Observatory is different, then
                    // we should keep a ref to this process to terminate when we quit. This avoids issues where our process is a shell
                    // (we use shell execute to fix issues on Windows) and the kill signal isn't passed on correctly.
                    // See: https://github.com/Dart-Code/Dart-Code/issues/907
                    if (this.allowTerminatingObservatoryVmPid && this.childProcess && this.childProcess.pid !== vm.pid) {
                        this.additionalPidsToTerminate.push(vm.pid);
                    }
                    const isolates = yield Promise.all(vm.isolates.map((isolateRef) => this.observatory.getIsolate(isolateRef.id)));
                    // TODO: Is it valid to assume the first (only?) isolate with a rootLib is the one we care about here?
                    // If it's always the first, could we even just query the first instead of getting them all before we
                    // start the other processing?
                    const rootIsolateResult = isolates.find((isolate) => !!isolate.result.rootLib);
                    const rootIsolate = rootIsolateResult && rootIsolateResult.result;
                    if (rootIsolate && rootIsolate.extensionRPCs) {
                        // If we're attaching, we won't see ServiceExtensionAdded events for extensions already loaded so
                        // we need to enumerate them here.
                        rootIsolate.extensionRPCs.forEach((id) => this.notifyServiceExtensionAvailable(id, rootIsolate.id));
                    }
                    if (!this.packageMap) {
                        // TODO: There's a race here if the isolate is not yet runnable, it might not have rootLib yet. We don't
                        // currently fill this in later.
                        if (rootIsolate)
                            this.packageMap = new package_map_1.PackageMap(package_map_1.PackageMap.findPackagesFile(this.convertVMUriToSourcePath(rootIsolate.rootLib.uri)));
                    }
                    yield Promise.all(isolates.map((response) => __awaiter(this, void 0, void 0, function* () {
                        const isolate = response.result;
                        this.threadManager.registerThread(isolate, isolate.runnable ? "IsolateRunnable" : "IsolateStart");
                        if (isolate.pauseEvent.kind.startsWith("Pause")) {
                            yield this.handlePauseEvent(isolate.pauseEvent);
                        }
                    })));
                    // Set a timer for memory updates.
                    if (this.pollforMemoryMs)
                        setTimeout(() => this.pollForMemoryUsage(), this.pollforMemoryMs);
                    this.sendEvent(new vscode_debugadapter_1.InitializedEvent());
                }));
                resolve();
            });
            this.observatory.onClose((code, message) => {
                this.log(`Observatory connection closed: ${code} (${message})`);
                if (this.logStream) {
                    this.logStream.end();
                    this.logStream = undefined;
                    // Wipe out the filename so if a message arrives late, it doesn't
                    // wipe out the logfile with just a "process exited" or similar message.
                    this.logFile = undefined;
                }
                // If we don't have a process (eg. we're attached) then this is our signal to quit, since we won't
                // get a process exit event.
                if (!this.childProcess) {
                    this.sendEvent(new vscode_debugadapter_1.TerminatedEvent());
                }
                else {
                    // In some cases Observatory closes but we never get the exit/close events from the process
                    // so this is a fallback to termiante the session after a short period. Without this, we have
                    // issues like https://github.com/Dart-Code/Dart-Code/issues/1268 even though when testing from
                    // the terminal the app does terminate as expected.
                    setTimeout(() => {
                        if (!this.processExited)
                            this.sendEvent(new vscode_debugadapter_1.TerminatedEvent());
                    }, 500);
                }
            });
            this.observatory.onError((error) => {
                reject(error);
            });
        });
    }
    terminate(force) {
        return __awaiter(this, void 0, void 0, function* () {
            const signal = force ? "SIGKILL" : "SIGINT";
            const request = force ? "DISC" : "TERM";
            this.log(`${request}: Going to terminate with ${signal}...`);
            if (this.shouldKillProcessOnTerminate && this.childProcess && !this.processExited) {
                for (const pid of this.additionalPidsToTerminate) {
                    try {
                        this.log(`${request}: Terminating related process ${pid} with ${signal}...`);
                        process.kill(pid, signal);
                    }
                    catch (e) {
                        // Sometimes this process will have already gone away (eg. the app finished/terminated)
                        // so logging here just results in lots of useless info.
                    }
                }
                // Don't remove these PIDs from the list as we don't know that they actually quit yet.
                try {
                    this.log(`${request}: Terminating main process with ${signal}...`);
                    this.childProcess.kill(signal);
                }
                catch (e) {
                    // This tends to throw a lot because the shell process quit when we terminated the related
                    // VM process above, so just swallow the error.
                }
                // Don't do this - because the process might ignore our kill (eg. test framework lets the current
                // test finish) so we may need to send again it we get another disconnectRequest.
                // We also use !childProcess to mean we're attached.
                // this.childProcess = undefined;
            }
            else if (!this.shouldKillProcessOnTerminate && this.observatory) {
                try {
                    this.log(`${request}: Disconnecting from process...`);
                    // Remove all breakpoints from the VM.
                    yield yield Promise.race([
                        Promise.all(this.threadManager.threads.map((thread) => thread.removeAllBreakpoints())),
                        new Promise((resolve) => setTimeout(resolve, 500)),
                    ]);
                    // Restart any paused threads.
                    // Note: Only wait up to 500ms here because sometimes we don't get responses because the VM terminates.
                    this.log(`${request}: Unpausing all threads...`);
                    yield Promise.race([
                        Promise.all(this.threadManager.threads.map((thread) => thread.resume())),
                        new Promise((resolve) => setTimeout(resolve, 500)),
                    ]);
                }
                catch (_a) { }
                try {
                    this.log(`${request}: Closing observatory...`);
                    this.observatory.close();
                }
                catch (_b) { }
                finally {
                    this.observatory = undefined;
                }
            }
            this.log(`${request}: Removing all stored data...`);
            this.threadManager.removeAllStoredData();
            this.log(`${request}: Waiting for process to finish...`);
            yield this.processExit;
            this.log(`${request}: Disconnecting...`);
        });
    }
    terminateRequest(response, args) {
        const _super = Object.create(null, {
            terminateRequest: { get: () => super.terminateRequest }
        });
        return __awaiter(this, void 0, void 0, function* () {
            this.log(`Termination requested!`);
            try {
                yield this.terminate(false);
            }
            catch (e) {
                return this.errorResponse(response, `${e}`);
            }
            _super.terminateRequest.call(this, response, args);
        });
    }
    disconnectRequest(response, args) {
        const _super = Object.create(null, {
            disconnectRequest: { get: () => super.disconnectRequest }
        });
        return __awaiter(this, void 0, void 0, function* () {
            this.log(`Disconnect requested!`);
            try {
                const didTimeout = yield Promise.race([
                    this.terminate(false).then((_) => false),
                    new Promise((resolve) => setTimeout(() => resolve(true), 2000)),
                ]);
                // If we hit the 2s timeout, then terminate more forcefully.
                if (didTimeout)
                    yield this.terminate(true);
            }
            catch (e) {
                return this.errorResponse(response, `${e}`);
            }
            _super.disconnectRequest.call(this, response, args);
        });
    }
    setBreakPointsRequest(response, args) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.noDebug) {
                response.body = { breakpoints: args.breakpoints.map((b) => ({ verified: false })) };
                this.sendResponse(response);
                return;
            }
            const source = args.source;
            let breakpoints = args.breakpoints;
            if (!breakpoints)
                breakpoints = [];
            // Get the correct format for the path depending on whether it's a package.
            // TODO: The `|| source.name` stops a crash (#1566) but doesn't actually make
            // the breakpoints work. This needs more work.
            const uri = this.packageMap
                ? this.packageMap.convertFileToPackageUri(source.path) || utils_1.formatPathForVm(source.path || source.name)
                : utils_1.formatPathForVm(source.path || source.name);
            try {
                const result = yield this.threadManager.setBreakpoints(uri, breakpoints);
                const bpResponse = [];
                for (const bpRes of result) {
                    bpResponse.push({ verified: !!bpRes });
                }
                response.body = { breakpoints: bpResponse };
                this.sendResponse(response);
            }
            catch (error) {
                this.errorResponse(response, `${error}`);
            }
        });
    }
    setExceptionBreakPointsRequest(response, args) {
        const filters = args.filters;
        let mode = "None";
        // If we're running in noDebug mode, we'll always set None.
        if (!this.noDebug) {
            if (filters.indexOf("Unhandled") !== -1)
                mode = "Unhandled";
            if (filters.indexOf("All") !== -1)
                mode = "All";
        }
        this.threadManager.setExceptionPauseMode(mode);
        this.sendResponse(response);
    }
    configurationDoneRequest(response, args) {
        this.sendResponse(response);
        this.threadManager.receivedConfigurationDone();
    }
    pauseRequest(response, args) {
        const thread = this.threadManager.getThreadInfoFromNumber(args.threadId);
        if (!thread) {
            this.errorResponse(response, `No thread with id ${args.threadId}`);
            return;
        }
        this.observatory.pause(thread.ref.id)
            .then((_) => this.sendResponse(response))
            .catch((error) => this.errorResponse(response, `${error}`));
    }
    sourceRequest(response, args) {
        const sourceReference = args.sourceReference;
        const data = this.threadManager.getStoredData(sourceReference);
        const scriptRef = data.data;
        data.thread.getScript(scriptRef).then((script) => {
            if (script.source) {
                response.body = { content: script.source };
            }
            else {
                response.success = false;
                response.message = "<source not available>";
            }
            this.sendResponse(response);
        }).catch((error) => this.errorResponse(response, `${error}`));
    }
    threadsRequest(response) {
        response.body = { threads: this.threadManager.getThreads() };
        this.sendResponse(response);
    }
    stackTraceRequest(response, args) {
        const thread = this.threadManager.getThreadInfoFromNumber(args.threadId);
        let startFrame = args.startFrame;
        let levels = args.levels;
        if (!thread) {
            this.errorResponse(response, `No thread with id ${args.threadId}`);
            return;
        }
        this.observatory.getStack(thread.ref.id).then((result) => {
            const stack = result.result;
            let vmFrames = stack.asyncCausalFrames;
            if (!vmFrames)
                vmFrames = stack.frames;
            const totalFrames = vmFrames.length;
            if (!startFrame)
                startFrame = 0;
            if (!levels)
                levels = totalFrames;
            if (startFrame + levels > totalFrames)
                levels = totalFrames - startFrame;
            vmFrames = vmFrames.slice(startFrame, startFrame + levels);
            const stackFrames = [];
            const promises = [];
            vmFrames.forEach((frame) => {
                const frameId = thread.storeData(frame);
                if (frame.kind === "AsyncSuspensionMarker") {
                    const stackFrame = new vscode_debugadapter_1.StackFrame(frameId, "<asynchronous gap>");
                    stackFrame.presentationHint = "label";
                    stackFrames.push(stackFrame);
                    return;
                }
                const frameName = frame && frame.code && frame.code.name
                    ? (frame.code.name.startsWith(unoptimizedPrefix)
                        ? frame.code.name.substring(unoptimizedPrefix.length)
                        : frame.code.name)
                    : "<unknown>";
                const location = frame.location;
                if (!location) {
                    const stackFrame = new vscode_debugadapter_1.StackFrame(frameId, frameName);
                    stackFrame.presentationHint = "subtle";
                    stackFrames.push(stackFrame);
                    return;
                }
                const uri = location.script.uri;
                let sourcePath = this.convertVMUriToSourcePath(uri);
                let canShowSource = sourcePath && fs.existsSync(sourcePath);
                // Download the source if from a "dart:" uri.
                let sourceReference;
                if (uri.startsWith("dart:")) {
                    sourcePath = undefined;
                    sourceReference = thread.storeData(location.script);
                    canShowSource = true;
                }
                const shortName = this.formatUriForShortDisplay(uri);
                const stackFrame = new vscode_debugadapter_1.StackFrame(frameId, frameName, canShowSource ? new vscode_debugadapter_1.Source(shortName, sourcePath, sourceReference, undefined, location.script) : undefined, 0, 0);
                // The top frame is only allowed to be deemphasized when it's an exception (so the editor walks
                // up the stack to user code). If the reson for stopping was a breakpoint, step, etc., then we
                // should always leave the frame focusable.
                const isTopFrame = stackFrames.length === 0;
                const isStoppedAtException = thread.exceptionReference !== 0;
                const allowDeemphasizingFrame = !isTopFrame || isStoppedAtException;
                // If we wouldn't debug this source, then deemphasize in the stack.
                if (stackFrame.source && allowDeemphasizingFrame) {
                    if (!this.isValidToDebug(uri) || (this.isSdkLibrary(uri) && !this.debugSdkLibraries)) {
                        stackFrame.source.origin = "from the Dart SDK";
                        stackFrame.source.presentationHint = "deemphasize";
                    }
                    else if (this.isExternalLibrary(uri) && !this.debugExternalLibraries) {
                        stackFrame.source.origin = uri.startsWith("package:flutter/") ? "from the Flutter framework" : "from Pub packages";
                        stackFrame.source.presentationHint = "deemphasize";
                    }
                }
                stackFrames.push(stackFrame);
                // Resolve the line and column information.
                const promise = thread.getScript(location.script).then((script) => {
                    const fileLocation = this.resolveFileLocation(script, location.tokenPos);
                    if (fileLocation) {
                        stackFrame.line = fileLocation.line;
                        stackFrame.column = fileLocation.column;
                    }
                });
                promises.push(promise);
            });
            response.body = {
                stackFrames,
                totalFrames,
            };
            Promise.all(promises).then((_) => {
                this.sendResponse(response);
            }).catch((_) => {
                this.sendResponse(response);
            });
        }).catch((_) => {
            // TODO: VS Code doesn't handle errors or empty lists, so we send
            // a fake frame for now.
            // https://github.com/Microsoft/vscode/issues/73090
            response.body = {
                stackFrames: args.startFrame === 0 ? [
                    {
                        column: 0,
                        id: -1,
                        line: 0,
                        name: "unavailable",
                    },
                ] : [],
                totalFrames: 0,
            };
            this.sendResponse(response);
        });
        // }).catch((error) => this.errorResponse(response, `${error}`));
    }
    scopesRequest(response, args) {
        const frameId = args.frameId;
        const data = this.threadManager.getStoredData(frameId);
        const frame = data.data;
        // TODO: class variables? library variables?
        const variablesReference = data.thread.storeData(frame);
        const scopes = [];
        if (data.thread.exceptionReference) {
            scopes.push(new vscode_debugadapter_1.Scope("Exception", data.thread.exceptionReference));
        }
        scopes.push(new vscode_debugadapter_1.Scope("Locals", variablesReference));
        response.body = { scopes };
        this.sendResponse(response);
    }
    variablesRequest(response, args) {
        return __awaiter(this, void 0, void 0, function* () {
            const variablesReference = args.variablesReference;
            // implement paged arrays
            // let filter = args.filter; // optional; either "indexed" or "named"
            let start = args.start; // (optional) index of the first variable to return; if omitted children start at 0
            const count = args.count; // (optional) number of variables to return. If count is missing or 0, all variables are returned
            const data = this.threadManager.getStoredData(variablesReference);
            const thread = data.thread;
            if (data.data.type === "Frame") {
                const frame = data.data;
                const variables = [];
                if (frame.vars) {
                    for (const variable of frame.vars) {
                        // Skip variables that don't evaluate nicely.
                        if (variable.value && variable.value.type === "@TypeArguments")
                            continue;
                        variables.push(yield this.instanceRefToVariable(thread, true, variable.name, variable.name, variable.value, frame.vars.length <= maxValuesToCallToString));
                    }
                }
                response.body = { variables };
                this.sendResponse(response);
            }
            else if (data.data.type === "MapEntry") {
                const mapRef = data.data;
                const results = yield Promise.all([
                    this.observatory.getObject(thread.ref.id, mapRef.keyId),
                    this.observatory.getObject(thread.ref.id, mapRef.valueId),
                ]);
                const variables = [];
                const [keyDebuggerResult, valueDebuggerResult] = results;
                const keyInstanceRef = keyDebuggerResult.result;
                const valueInstanceRef = valueDebuggerResult.result;
                variables.push(yield this.instanceRefToVariable(thread, false, "key", "key", keyInstanceRef, true));
                let canEvaluateValueName = false;
                let valueEvaluateName = "value";
                if (this.isSimpleKind(keyInstanceRef.kind)) {
                    canEvaluateValueName = true;
                    valueEvaluateName = `${mapRef.mapEvaluateName}[${this.valueAsString(keyInstanceRef)}]`;
                }
                variables.push(yield this.instanceRefToVariable(thread, canEvaluateValueName, valueEvaluateName, "value", valueInstanceRef, true));
                response.body = { variables };
                this.sendResponse(response);
            }
            else {
                const instanceRef = data.data;
                try {
                    const result = yield this.observatory.getObject(thread.ref.id, instanceRef.id, start, count);
                    const variables = [];
                    // If we're the top-level exception, or our parent has an evaluateName of undefined (its children)
                    // we cannot evaluate (this will disable "Add to Watch" etc).
                    const canEvaluate = instanceRef.evaluateName !== undefined;
                    if (result.result.type === "Sentinel") {
                        variables.push({
                            name: "<evalError>",
                            value: result.result.valueAsString,
                            variablesReference: 0,
                        });
                    }
                    else {
                        const obj = result.result;
                        if (obj.type === "Instance") {
                            const instance = obj;
                            // TODO: show by kind instead
                            if (this.isSimpleKind(instance.kind)) {
                                variables.push(yield this.instanceRefToVariable(thread, canEvaluate, `${instanceRef.evaluateName}`, instance.kind, instanceRef, true));
                            }
                            else if (instance.elements) {
                                const len = instance.elements.length;
                                if (!start)
                                    start = 0;
                                for (let i = 0; i < len; i++) {
                                    const element = instance.elements[i];
                                    variables.push(yield this.instanceRefToVariable(thread, canEvaluate, `${instanceRef.evaluateName}[${i + start}]`, `[${i + start}]`, element, len <= maxValuesToCallToString));
                                }
                            }
                            else if (instance.associations) {
                                const len = instance.associations.length;
                                if (!start)
                                    start = 0;
                                for (let i = 0; i < len; i++) {
                                    const association = instance.associations[i];
                                    const keyName = this.valueAsString(association.key, true);
                                    const valueName = this.valueAsString(association.value, true);
                                    let variablesReference = 0;
                                    if (association.key.type !== "Sentinel" && association.value.type !== "Sentinel") {
                                        const mapRef = {
                                            keyId: association.key.id,
                                            mapEvaluateName: instanceRef.evaluateName,
                                            type: "MapEntry",
                                            valueId: association.value.id,
                                        };
                                        variablesReference = thread.storeData(mapRef);
                                    }
                                    variables.push({
                                        name: `${i + start}`,
                                        type: `${keyName} -> ${valueName}`,
                                        value: `${keyName} -> ${valueName}`,
                                        variablesReference,
                                    });
                                }
                            }
                            else if (instance.fields) {
                                let len = instance.fields.length;
                                // Add getters
                                if (this.evaluateGettersInDebugViews && instance.class) {
                                    let getterNames = yield this.getGetterNamesForHierarchy(thread.ref, instance.class);
                                    getterNames = getterNames.sort();
                                    len += getterNames.length;
                                    // Call each getter, adding the result as a variable.
                                    for (const getterName of getterNames) {
                                        const getterDisplayName = getterName; // `get ${getterName}`;
                                        const getterResult = yield this.observatory.evaluate(thread.ref.id, instanceRef.id, getterName, true);
                                        if (getterResult.result.type === "@Error") {
                                            variables.push({ name: getterDisplayName, value: getterResult.result.message, variablesReference: 0 });
                                        }
                                        else if (getterResult.result.type === "Sentinel") {
                                            variables.push({ name: getterDisplayName, value: getterResult.result.valueAsString, variablesReference: 0 });
                                        }
                                        else {
                                            const getterResultInstanceRef = getterResult.result;
                                            variables.push(yield this.instanceRefToVariable(thread, canEvaluate, `${instanceRef.evaluateName}.${getterName}`, getterDisplayName, getterResultInstanceRef, len <= maxValuesToCallToString));
                                        }
                                    }
                                }
                                // Add all of the fields.
                                for (const field of instance.fields)
                                    variables.push(yield this.instanceRefToVariable(thread, canEvaluate, `${instanceRef.evaluateName}.${field.decl.name}`, field.decl.name, field.value, len <= maxValuesToCallToString));
                            }
                            else {
                                this.logToUser(`Unknown instance kind: ${instance.kind}. ${constants_1.pleaseReportBug}\n`);
                            }
                        }
                        else {
                            this.logToUser(`Unknown object type: ${obj.type}. ${constants_1.pleaseReportBug}\n`);
                        }
                    }
                    response.body = { variables };
                    this.sendResponse(response);
                }
                catch (error) {
                    this.errorResponse(response, `${error}`);
                }
            }
        });
    }
    getGetterNamesForHierarchy(thread, classRef) {
        return __awaiter(this, void 0, void 0, function* () {
            let getterNames = [];
            while (classRef) {
                const classResponse = yield this.observatory.getObject(thread.id, classRef.id);
                if (classResponse.result.type !== "Class")
                    break;
                const c = classResponse.result;
                // TODO: This kinda smells for two reasons:
                // 1. This is supposed to be an @Function but it has loads of extra stuff on it compare to the docs
                // 2. We're accessing _kind to check if it's a getter :/
                getterNames = getterNames.concat(getterNames, c.functions.filter((f) => f._kind === "GetterFunction" && !f.static && !f.const).map((f) => f.name));
                classRef = c.super;
            }
            // Distinct the list; since we may have got dupes from the super-classes.
            getterNames = utils_1.uniq(getterNames);
            // Remove _identityHashCode because it seems to throw (and probably isn't useful to the user).
            return getterNames.filter((g) => g !== "_identityHashCode");
        });
    }
    isSimpleKind(kind) {
        return kind === "String" || kind === "Bool" || kind === "Int" || kind === "Num" || kind === "Double" || kind === "Null";
    }
    callToString(isolate, instanceRef, getFullString = false) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield this.observatory.evaluate(isolate.id, instanceRef.id, "toString()", true);
                if (result.result.type === "@Error") {
                    return undefined;
                }
                else {
                    let evalResult = result.result;
                    if (evalResult.valueAsStringIsTruncated && getFullString) {
                        const result = yield this.observatory.getObject(isolate.id, evalResult.id);
                        evalResult = result.result;
                    }
                    return this.valueAsString(evalResult, undefined, true);
                }
            }
            catch (e) {
                log_1.logError(e, utils_1.LogCategory.Observatory);
                return undefined;
            }
        });
    }
    setVariableRequest(response, args) {
        // const variablesReference: number = args.variablesReference;
        // const name: string = args.name;
        // const value: string = args.value;
        // TODO: Use eval to implement this.
        this.errorResponse(response, "not supported");
    }
    continueRequest(response, args) {
        const thread = this.threadManager.getThreadInfoFromNumber(args.threadId);
        if (!thread) {
            this.errorResponse(response, `No thread with id ${args.threadId}`);
            return;
        }
        thread.resume().then((_) => {
            response.body = { allThreadsContinued: false };
            this.sendResponse(response);
            this.requestCoverageUpdate("resume");
        }).catch((error) => this.errorResponse(response, `${error}`));
    }
    nextRequest(response, args) {
        const thread = this.threadManager.getThreadInfoFromNumber(args.threadId);
        if (!thread) {
            this.errorResponse(response, `No thread with id ${args.threadId}`);
            return;
        }
        const type = thread.atAsyncSuspension ? "OverAsyncSuspension" : "Over";
        thread.resume(type).then((_) => {
            this.sendResponse(response);
            this.requestCoverageUpdate("step-over");
        }).catch((error) => this.errorResponse(response, `${error}`));
    }
    stepInRequest(response, args) {
        const thread = this.threadManager.getThreadInfoFromNumber(args.threadId);
        if (!thread) {
            this.errorResponse(response, `No thread with id ${args.threadId}`);
            return;
        }
        thread.resume("Into").then((_) => {
            this.sendResponse(response);
            this.requestCoverageUpdate("step-in");
        }).catch((error) => this.errorResponse(response, `${error}`));
    }
    stepOutRequest(response, args) {
        const thread = this.threadManager.getThreadInfoFromNumber(args.threadId);
        if (!thread) {
            this.errorResponse(response, `No thread with id ${args.threadId}`);
            return;
        }
        thread.resume("Out").then((_) => {
            this.sendResponse(response);
            this.requestCoverageUpdate("step-out");
        }).catch((error) => this.errorResponse(response, `${error}`));
    }
    stepBackRequest(response, args) {
        // unsupported
    }
    evaluateRequest(response, args) {
        return __awaiter(this, void 0, void 0, function* () {
            const expression = args.expression;
            // Stack frame scope; if not specified, the expression is evaluated in the global scope.
            const frameId = args.frameId;
            // const context: string = args.context; // "watch", "repl", "hover"
            if (!frameId) {
                this.errorResponse(response, "global evaluation not supported");
                return;
            }
            const data = this.threadManager.getStoredData(frameId);
            const thread = data.thread;
            const frame = data.data;
            try {
                let result;
                if ((expression === "$e" || expression.startsWith("$e.")) && thread.exceptionReference) {
                    const exceptionData = this.threadManager.getStoredData(thread.exceptionReference);
                    const exceptionInstanceRef = exceptionData && exceptionData.data;
                    if (expression === "$e") {
                        response.body = {
                            result: yield this.fullValueAsString(thread.ref, exceptionInstanceRef),
                            variablesReference: thread.exceptionReference,
                        };
                        this.sendResponse(response);
                        return;
                    }
                    const exceptionId = exceptionInstanceRef && exceptionInstanceRef.id;
                    if (exceptionId)
                        result = yield this.observatory.evaluate(thread.ref.id, exceptionId, expression.substr(3), true);
                }
                if (!result) {
                    // Don't wait more than half a second for the response:
                    //   1. VS Code's watch window behaves badly when there are incomplete evaluate requests
                    //      https://github.com/Microsoft/vscode/issues/52317
                    //   2. The VM sometimes doesn't respond to your requests at all
                    //      https://github.com/flutter/flutter/issues/18595
                    result = yield Promise.race([
                        this.observatory.evaluateInFrame(thread.ref.id, frame.index, expression, true),
                        new Promise((resolve, reject) => setTimeout(() => reject(new Error("<timed out>")), 500)),
                    ]);
                }
                // InstanceRef or ErrorRef
                if (result.result.type === "@Error") {
                    const error = result.result;
                    let str = error.message;
                    if (str)
                        str = str.split("\n").slice(0, 6).join("\n");
                    this.errorResponse(response, str);
                }
                else {
                    const instanceRef = result.result;
                    instanceRef.evaluateName = expression;
                    const text = yield this.fullValueAsString(thread.ref, instanceRef);
                    response.body = {
                        result: text,
                        variablesReference: this.isSimpleKind(instanceRef.kind) ? 0 : thread.storeData(instanceRef),
                    };
                    this.sendResponse(response);
                }
            }
            catch (e) {
                this.errorResponse(response, `${e}`);
            }
        });
    }
    customRequest(request, response, args) {
        const _super = Object.create(null, {
            customRequest: { get: () => super.customRequest }
        });
        return __awaiter(this, void 0, void 0, function* () {
            switch (request) {
                case "coverageFilesUpdate":
                    this.knownOpenFiles = args.scriptUris;
                    this.sendResponse(response);
                    break;
                case "requestCoverageUpdate":
                    this.requestCoverageUpdate("editor");
                    this.sendResponse(response);
                    break;
                case "service":
                    try {
                        yield this.callService(args.type, args.params);
                        this.sendResponse(response);
                    }
                    catch (e) {
                        this.errorResponse(response, e && e.message);
                    }
                    break;
                // Flutter requests that may be sent during test runs or other places
                // that we don't currently support. TODO: Fix this by moving all the
                // service extension stuff out of Flutter to here, and making it not
                // Flutter-specific. This requires sending all service extensions
                // directly to the VM and not via Flutter's run daemon.
                case "serviceExtension":
                case "checkPlatformOverride":
                case "checkIsWidgetCreationTracked":
                case "hotReload":
                case "hotRestart":
                    // TODO: Get rid of this!
                    this.log(`Ignoring Flutter customRequest ${request} for non-Flutter-run app`, utils_1.LogSeverity.Warn);
                    this.sendResponse(response);
                    break;
                default:
                    this.log(`Unknown customRequest ${request}`, utils_1.LogSeverity.Warn);
                    _super.customRequest.call(this, request, response, args);
                    break;
            }
        });
    }
    // IsolateStart, IsolateRunnable, IsolateExit, IsolateUpdate, ServiceExtensionAdded
    handleIsolateEvent(event) {
        const kind = event.kind;
        if (kind === "IsolateStart" || kind === "IsolateRunnable") {
            this.threadManager.registerThread(event.isolate, kind);
        }
        else if (kind === "IsolateExit") {
            this.threadManager.handleIsolateExit(event.isolate);
        }
        else if (kind === "ServiceExtensionAdded") {
            this.handleServiceExtensionAdded(event);
        }
    }
    // Extension
    handleExtensionEvent(event) {
        // Nothing Dart-specific, but Flutter overrides this
    }
    // _Service
    handleServiceEvent(event) {
        const kind = event.kind;
        if (kind === "ServiceRegistered")
            this.handleServiceRegistered(event);
    }
    // PauseStart, PauseExit, PauseBreakpoint, PauseInterrupted, PauseException, Resume,
    // BreakpointAdded, BreakpointResolved, BreakpointRemoved, Inspect, None
    handleDebugEvent(event) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const kind = event.kind;
                if (kind.startsWith("Pause")) {
                    yield this.handlePauseEvent(event);
                }
                else if (kind === "Inspect") {
                    yield this.handleInspectEvent(event);
                }
            }
            catch (e) {
                log_1.logError(e, utils_1.LogCategory.Observatory);
            }
        });
    }
    handlePauseEvent(event) {
        return __awaiter(this, void 0, void 0, function* () {
            const kind = event.kind;
            const thread = event.isolate ? this.threadManager.getThreadInfoFromRef(event.isolate) : undefined;
            if (!event.isolate || !thread) {
                log_1.logWarn("No thread for pause event");
                return;
            }
            if (!this.observatory) {
                log_1.logWarn("No observatory connection");
                return;
            }
            // For PausePostRequest we need to re-send all breakpoints; this happens after a flutter restart
            if (kind === "PausePostRequest") {
                try {
                    yield this.threadManager.resetBreakpoints();
                }
                catch (e) {
                    log_1.logError(e, utils_1.LogCategory.Observatory);
                }
                try {
                    yield this.observatory.resume(event.isolate.id);
                }
                catch (e) {
                    // Ignore failed-to-resume errors https://github.com/flutter/flutter/issues/10934
                    if (e.code !== 106)
                        throw e;
                }
            }
            else if (kind === "PauseStart") {
                // "PauseStart" should auto-resume after breakpoints are set if we launched the process.
                if (this.childProcess)
                    thread.receivedPauseStart();
                else {
                    // Otherwise, if we were attaching, then just issue a step-into to put the debugger
                    // right at the start of the application.
                    thread.handlePaused(event.atAsyncSuspension, event.exception);
                    yield thread.resume("Into");
                }
            }
            else {
                // PauseStart, PauseExit, PauseBreakpoint, PauseInterrupted, PauseException
                let reason = "pause";
                let exceptionText;
                let shouldRemainedStoppedOnBreakpoint = true;
                if (kind === "PauseBreakpoint" && event.pauseBreakpoints && event.pauseBreakpoints.length) {
                    reason = "breakpoint";
                    const breakpoints = event.pauseBreakpoints.map((bp) => thread.breakpoints[bp.id]);
                    // When attaching to an already-stopped process, this event can be handled before the
                    // breakpoints have been registered. If that happens, replace any unknown breakpoints with
                    // dummy unconditional breakpoints.
                    // TODO: Ensure that VM breakpoint state is reconciled with debugger breakpoint state before
                    // handling thread state so that this doesn't happen, and remove this check.
                    const hasUnknownBreakpoints = breakpoints.indexOf(undefined) !== -1;
                    if (!hasUnknownBreakpoints) {
                        const hasUnconditionalBreakpoints = !!breakpoints.find((bp) => !bp.condition && !bp.logMessage);
                        const conditionalBreakpoints = breakpoints.filter((bp) => bp.condition);
                        const logPoints = breakpoints.filter((bp) => bp.logMessage);
                        // Evalute conditions to see if we should remain stopped or continue.
                        shouldRemainedStoppedOnBreakpoint =
                            hasUnconditionalBreakpoints
                                || (yield this.anyBreakpointConditionReturnsTrue(conditionalBreakpoints, thread));
                        // Output any logpoint messages.
                        for (const logPoint of logPoints) {
                            const logMessage = logPoint.logMessage
                                .replace(/(^|[^\\\$]){/g, "$1\${") // Prefix any {tokens} with $ if they don't have
                                .replace(/\\({)/g, "$1") // Remove slashes
                                .replace(/"""/g, '\\"\\"\\"'); // Escape triple-quotes
                            const printCommand = `print("""${logMessage}""")`;
                            yield this.evaluateAndSendErrors(thread, printCommand);
                        }
                    }
                }
                else if (kind === "PauseBreakpoint") {
                    reason = "step";
                }
                else if (kind === "PauseException") {
                    reason = "exception";
                    exceptionText = yield this.fullValueAsString(event.isolate, event.exception);
                }
                thread.handlePaused(event.atAsyncSuspension, event.exception);
                if (shouldRemainedStoppedOnBreakpoint) {
                    this.sendEvent(new vscode_debugadapter_1.StoppedEvent(reason, thread.num, exceptionText));
                }
                else {
                    thread.resume();
                }
            }
        });
    }
    handleInspectEvent(event) {
        return __awaiter(this, void 0, void 0, function* () {
            // No implementation for Dart.
        });
    }
    // Like valueAsString, but will call toString() if the thing is truncated.
    fullValueAsString(isolate, instanceRef) {
        return __awaiter(this, void 0, void 0, function* () {
            let text;
            if (!instanceRef.valueAsStringIsTruncated)
                text = this.valueAsString(instanceRef, false);
            if (!text)
                text = yield this.callToString(isolate, instanceRef, true);
            // If it has a custom toString(), put that in parens after the type name.
            if (instanceRef.kind === "PlainInstance" && instanceRef.class && instanceRef.class.name) {
                if (text === `Instance of '${instanceRef.class.name}'`)
                    text = instanceRef.class.name;
                else
                    text = `${instanceRef.class.name} (${text})`;
            }
            return text;
        });
    }
    anyBreakpointConditionReturnsTrue(breakpoints, thread) {
        return __awaiter(this, void 0, void 0, function* () {
            for (const bp of breakpoints) {
                const evalResult = yield this.evaluateAndSendErrors(thread, bp.condition);
                if (evalResult) {
                    // To be considered true, we need to have a value and either be not-a-bool
                    const breakpointconditionEvaluatesToTrue = (evalResult.kind === "Bool" && evalResult.valueAsString === "true")
                        || (evalResult.kind === "Int" && evalResult.valueAsString !== "0");
                    if (breakpointconditionEvaluatesToTrue)
                        return true;
                }
            }
            return false;
        });
    }
    callService(type, args) {
        return this.observatory.callMethod(type, args);
    }
    evaluateAndSendErrors(thread, expression) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield this.observatory.evaluateInFrame(thread.ref.id, 0, expression, true);
                if (result.result.type !== "@Error") {
                    return result.result;
                }
                else {
                    this.logToUser(`Debugger failed to evaluate expression \`${expression}\`\n`);
                }
            }
            catch (_a) {
                this.logToUser(`Debugger failed to evaluate expression \`${expression}\`\n`);
            }
        });
    }
    handleServiceExtensionAdded(event) {
        if (event && event.extensionRPC) {
            this.notifyServiceExtensionAvailable(event.extensionRPC, event.isolate ? event.isolate.id : undefined);
        }
    }
    handleServiceRegistered(event) {
        if (event && event.service) {
            this.notifyServiceRegistered(event.service, event.method);
        }
    }
    notifyServiceExtensionAvailable(id, isolateId) {
        this.sendEvent(new vscode_debugadapter_1.Event("dart.serviceExtensionAdded", { id, isolateId }));
    }
    notifyServiceRegistered(service, method) {
        this.sendEvent(new vscode_debugadapter_1.Event("dart.serviceRegistered", { service, method }));
    }
    getCoverageReport(scriptUris) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!scriptUris || !scriptUris.length)
                return [];
            const result = yield this.observatory.getVM();
            const vm = result.result;
            const isolatePromises = vm.isolates.map((isolateRef) => this.observatory.getIsolate(isolateRef.id));
            const isolatesResponses = yield Promise.all(isolatePromises);
            const isolates = isolatesResponses.map((response) => response.result);
            // Make a quick map for looking up with scripts we are tracking.
            const trackedScriptUris = {};
            scriptUris.forEach((uri) => trackedScriptUris[uri] = true);
            const results = [];
            for (const isolate of isolates) {
                const libraryPromises = isolate.libraries.map((library) => this.observatory.getObject(isolate.id, library.id));
                const libraryResponses = yield Promise.all(libraryPromises);
                const libraries = libraryResponses.map((response) => response.result);
                const scriptRefs = utils_1.flatMap(libraries, (library) => library.scripts);
                // Filter scripts to the ones we care about.
                const scripts = scriptRefs.filter((s) => trackedScriptUris[s.uri]);
                for (const scriptRef of scripts) {
                    const script = (yield this.observatory.getObject(isolate.id, scriptRef.id)).result;
                    try {
                        const report = yield this.observatory.getSourceReport(isolate, [dart_debug_protocol_1.SourceReportKind.Coverage], scriptRef);
                        const sourceReport = report.result;
                        const ranges = sourceReport.ranges.filter((r) => r.coverage && r.coverage.hits && r.coverage.hits.length);
                        for (const range of ranges) {
                            results.push({
                                endPos: range.endPos,
                                hits: range.coverage.hits,
                                hostScriptPath: utils_1.uriToFilePath(script.uri),
                                misses: range.coverage.misses,
                                script,
                                startPos: range.startPos,
                                tokenPosTable: script.tokenPosTable,
                            });
                        }
                    }
                    catch (e) {
                        log_1.logError(e, utils_1.LogCategory.Observatory);
                    }
                }
            }
            return results;
        });
    }
    errorResponse(response, message) {
        response.success = false;
        response.message = message;
        this.sendResponse(response);
    }
    formatUriForShortDisplay(uri) {
        if (uri.startsWith("file:")) {
            uri = utils_1.uriToFilePath(uri);
            if (this.cwd)
                uri = path.relative(this.cwd, uri);
        }
        // Split on the separators and return only the first and last two parts.
        const sep = uri.indexOf("/") === -1 && uri.indexOf("\\") !== -1 ? "\\" : "/";
        const parts = uri.split(sep);
        if (parts.length > 3) {
            return [parts[0], "…", parts[parts.length - 2], parts[parts.length - 1]].join(sep);
        }
        else {
            return uri;
        }
    }
    convertVMUriToSourcePath(uri, returnWindowsPath) {
        if (uri.startsWith("file:"))
            return utils_1.uriToFilePath(uri, returnWindowsPath);
        if (uri.startsWith("package:") && this.packageMap)
            return this.packageMap.resolvePackageUri(uri);
        return uri;
    }
    valueAsString(ref, useClassNameAsFallback = true, suppressQuotesAroundStrings = false) {
        if (ref.type === "Sentinel")
            return ref.valueAsString;
        const instanceRef = ref;
        if (ref.kind === "String" || ref.valueAsString) {
            let str = instanceRef.valueAsString;
            if (instanceRef.valueAsStringIsTruncated)
                str += "…";
            if (instanceRef.kind === "String" && !suppressQuotesAroundStrings)
                str = `"${str}"`;
            return str;
        }
        else if (ref.kind === "List") {
            return `List (${instanceRef.length} ${instanceRef.length === 1 ? "item" : "items"})`;
        }
        else if (ref.kind === "Map") {
            return `Map (${instanceRef.length} ${instanceRef.length === 1 ? "item" : "items"})`;
        }
        else if (ref.kind === "Type") {
            const typeRef = ref;
            return `Type (${typeRef.name})`;
        }
        else if (useClassNameAsFallback) {
            return this.getFriendlyTypeName(instanceRef);
        }
        else {
            return undefined;
        }
    }
    getFriendlyTypeName(ref) {
        return ref.kind !== "PlainInstance" ? ref.kind : ref.class.name;
    }
    instanceRefToVariable(thread, canEvaluate, evaluateName, name, ref, allowFetchFullString) {
        return __awaiter(this, void 0, void 0, function* () {
            if (ref.type === "Sentinel") {
                return {
                    name,
                    value: ref.valueAsString,
                    variablesReference: 0,
                };
            }
            else {
                const val = ref;
                // Stick on the evaluateName as we'll need this to build
                // the evaluateName for the child, and we don't have the parent
                // (or a string expression) in the response.
                val.evaluateName = canEvaluate ? evaluateName : undefined;
                const str = config_1.config.previewToStringInDebugViews && allowFetchFullString && !val.valueAsString
                    ? yield this.fullValueAsString(thread.ref, val)
                    : this.valueAsString(val);
                return {
                    evaluateName: canEvaluate ? evaluateName : undefined,
                    indexedVariables: (val && val.kind && val.kind.endsWith("List") ? val.length : undefined),
                    name,
                    type: `${val.kind} (${val.class.name})`,
                    value: str || "",
                    variablesReference: val.valueAsString ? 0 : thread.storeData(val),
                };
            }
        });
    }
    isValidToDebug(uri) {
        // TODO: See https://github.com/dart-lang/sdk/issues/29813
        return !uri.startsWith("dart:_");
    }
    isSdkLibrary(uri) {
        return uri.startsWith("dart:");
    }
    isExternalLibrary(uri) {
        // If it's not a package URI, or we don't have a package map, so we assume not external. We don't want
        // to ever disable debugging of something if we're not certain.
        if (!uri.startsWith("package:") || !this.packageMap)
            return false;
        // package:flutter won't be in pub-cache, but should be considered external.
        if (uri.startsWith("package:flutter/"))
            return true;
        const path = this.packageMap.resolvePackageUri(uri);
        // If we don't have the path, we can't tell if it's external or not.
        if (!path)
            return false;
        // HACK: Take a guess at whether it's inside the pubcache (in which case we're considering it external).
        return path.indexOf("/hosted/pub.dartlang.org/") !== -1 || path.indexOf("\\hosted\\pub.dartlang.org\\") !== -1;
    }
    resolveFileLocation(script, tokenPos) {
        const table = script.tokenPosTable;
        for (const entry of table) {
            // [lineNumber, (tokenPos, columnNumber)*]
            for (let index = 1; index < entry.length; index += 2) {
                if (entry[index] === tokenPos) {
                    const line = entry[0];
                    return { line, column: entry[index + 1] };
                }
            }
        }
        return undefined;
    }
    pollForMemoryUsage() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.childProcess || this.childProcess.killed)
                return;
            const result = yield this.observatory.getVM();
            const vm = result.result;
            const isolatePromises = vm.isolates.map((isolateRef) => this.observatory.getIsolate(isolateRef.id));
            const isolatesResponses = yield Promise.all(isolatePromises);
            const isolates = isolatesResponses.map((response) => response.result);
            let current = 0;
            let total = 0;
            for (const isolate of isolates) {
                for (const heap of [isolate._heaps.old, isolate._heaps.new]) {
                    current += heap.used + heap.external;
                    total += heap.capacity + heap.external;
                }
            }
            this.sendEvent(new vscode_debugadapter_1.Event("dart.debugMetrics", { memory: { current, total } }));
            setTimeout(() => this.pollForMemoryUsage(), this.pollforMemoryMs);
        });
    }
    getStackFrameData(message) {
        const match = message && stackFrameWithUriPattern.exec(message);
        if (match) {
            // TODO: Handle dart: uris (using source references)?
            return {
                col: parseInt(match[5], 10),
                functionName: match[2],
                line: parseInt(match[4], 10),
                prefix: match[1],
                sourceUri: match[3],
            };
        }
        return undefined;
    }
    getWebStackFrameData(message) {
        const match = message && webStackFrameWithUriPattern.exec(message);
        if (match) {
            // TODO: Handle dart: uris (using source references)?
            return {
                col: parseInt(match[3], 10),
                functionName: match[4],
                line: parseInt(match[2], 10),
                sourceUri: match[1],
            };
        }
        return undefined;
    }
    logToUser(message, category) {
        // Extract stack frames from the message so we can do nicer formatting of them.
        const frame = this.getStackFrameData(message) || this.getWebStackFrameData(message);
        // If we get a multi-line message that contains an error/stack trace, process each
        // line individually, so we can attach location metadata to individual lines.
        const isMultiLine = message.trimRight().indexOf("\n") !== -1;
        if (frame && isMultiLine) {
            message.split("\n").forEach((line) => this.logToUser(`${line}\n`, category));
            return;
        }
        const output = new vscode_debugadapter_1.OutputEvent(`${message}`, category);
        // If the output line looks like a stack frame with users code, attempt to link it up to make
        // it clickable.
        if (frame) {
            const sourcePath = this.convertVMUriToSourcePath(frame.sourceUri);
            const canShowSource = sourcePath && sourcePath !== frame.sourceUri && fs.existsSync(sourcePath);
            const shortName = this.formatUriForShortDisplay(frame.sourceUri);
            const source = canShowSource ? new vscode_debugadapter_1.Source(shortName, sourcePath, undefined, undefined, undefined) : undefined;
            let text = `${frame.functionName} (${frame.sourceUri}:${frame.line}:${frame.col})`;
            if (source) {
                output.body.source = source;
                output.body.line = frame.line;
                output.body.column = frame.col;
                // Replace the output to only the text part to avoid the duplicated uri.
                text = frame.functionName;
            }
            // Colour based on whether it's framework code or not.
            const isFramework = this.isSdkLibrary(frame.sourceUri)
                || (this.isExternalLibrary(frame.sourceUri) && frame.sourceUri.startsWith("package:flutter/"))
                || (this.isExternalLibrary(frame.sourceUri) && frame.sourceUri.startsWith("package:flutter_web/"));
            // In both dark and light themes, white() is more subtle than default text. VS Code maps black/white
            // to ensure it's always visible regardless of theme (eg. white-on-white is still visible).
            const colouredText = isFramework ? colors_1.white(text) : text;
            output.body.output = `${frame.prefix || ""}${colouredText}\n`;
        }
        this.sendEvent(output);
    }
}
exports.DartDebugSession = DartDebugSession;
//# sourceMappingURL=dart_debug_impl.js.map