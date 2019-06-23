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
const vscode_debugadapter_1 = require("vscode-debugadapter");
const debugger_1 = require("../utils/debugger");
const log_1 = require("../utils/log");
const utils_1 = require("./utils");
class ThreadManager {
    constructor(debugSession) {
        this.debugSession = debugSession;
        this.nextThreadId = 0;
        this.threads = [];
        this.bps = {};
        this.hasConfigurationDone = false;
        this.exceptionMode = "Unhandled";
        this.nextDataId = 1;
        this.storedData = {};
    }
    registerThread(ref, eventKind) {
        return __awaiter(this, void 0, void 0, function* () {
            let thread = this.getThreadInfoFromRef(ref);
            if (!thread) {
                thread = new ThreadInfo(this, ref, this.nextThreadId);
                this.nextThreadId++;
                this.threads.push(thread);
                // If this is the first time we've seen it, fire an event
                this.debugSession.sendEvent(new vscode_debugadapter_1.ThreadEvent("started", thread.num));
                if (this.hasConfigurationDone)
                    thread.receivedConfigurationDone();
            }
            // If it's just become runnable (IsolateRunnable), then set breakpoints.
            if (eventKind === "IsolateRunnable" && !thread.runnable) {
                thread.runnable = true;
                if (this.debugSession.observatory) {
                    yield Promise.all([
                        this.debugSession.observatory.setExceptionPauseMode(thread.ref.id, this.exceptionMode),
                        this.setLibrariesDebuggable(thread.ref),
                        this.resetBreakpoints(),
                    ]);
                    thread.setInitialBreakpoints();
                }
            }
        });
    }
    receivedConfigurationDone() {
        this.hasConfigurationDone = true;
        for (const thread of this.threads)
            thread.receivedConfigurationDone();
    }
    getThreadInfoFromRef(ref) {
        for (const thread of this.threads) {
            if (thread.ref.id === ref.id)
                return thread;
        }
        return undefined;
    }
    getThreadInfoFromNumber(num) {
        for (const thread of this.threads) {
            if (thread.num === num)
                return thread;
        }
        return undefined;
    }
    getThreads() {
        return this.threads.map((thread) => new vscode_debugadapter_1.Thread(thread.num, thread.ref.name));
    }
    setExceptionPauseMode(mode) {
        this.exceptionMode = mode;
        if (!this.debugSession.observatory)
            return;
        for (const thread of this.threads) {
            if (thread.runnable) {
                let threadMode = mode;
                // If the mode is set to "All Exceptions" but the thread is a snapshot from pub
                // then downgrade it to Uncaught because the user is unlikely to want to be stopping
                // on internal exceptions such trying to parse versions.
                if (mode === "All" && thread.isInfrastructure)
                    threadMode = "Unhandled";
                this.debugSession.observatory.setExceptionPauseMode(thread.ref.id, threadMode);
            }
        }
    }
    setLibrariesDebuggable(isolateRef) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.debugSession.noDebug || !this.debugSession.observatory)
                return;
            // Helpers to categories libraries as SDK/ExternalLibrary/not.
            // Set whether libraries should be debuggable based on user settings.
            const response = yield this.debugSession.observatory.getIsolate(isolateRef.id);
            const isolate = response.result;
            yield Promise.all(isolate.libraries.filter((l) => this.debugSession.isValidToDebug(l.uri)).map((library) => {
                if (!this.debugSession.observatory)
                    return Promise.resolve(true);
                // Note: Condition is negated.
                const shouldDebug = !(
                // Inside here is shouldNotDebug!
                (this.debugSession.isSdkLibrary(library.uri) && !this.debugSession.debugSdkLibraries)
                    || (this.debugSession.isExternalLibrary(library.uri) && !this.debugSession.debugExternalLibraries));
                return this.debugSession.observatory.setLibraryDebuggable(isolate.id, library.id, shouldDebug);
            }));
        });
    }
    // Just resends existing breakpoints
    resetBreakpoints() {
        return __awaiter(this, void 0, void 0, function* () {
            const promises = [];
            for (const uri of Object.keys(this.bps)) {
                promises.push(this.setBreakpoints(uri, this.bps[uri]));
            }
            yield Promise.all(promises);
        });
    }
    setBreakpoints(uri, breakpoints) {
        // Remember these bps for when new threads start.
        if (breakpoints.length === 0)
            delete this.bps[uri];
        else
            this.bps[uri] = breakpoints;
        let promise;
        for (const thread of this.threads) {
            if (thread.runnable) {
                const result = thread.setBreakpoints(uri, breakpoints);
                if (!promise)
                    promise = result;
            }
        }
        if (promise)
            return promise;
        const completer = new utils_1.PromiseCompleter();
        completer.resolve(breakpoints.map((_) => true));
        return completer.promise;
    }
    storeData(thread, data) {
        const id = this.nextDataId;
        this.nextDataId++;
        this.storedData[id] = new StoredData(thread, data);
        return id;
    }
    getStoredData(id) {
        return this.storedData[id];
    }
    removeStoredData(thread) {
        for (const id of Object.keys(this.storedData).map((k) => parseInt(k, 10))) {
            if (this.storedData[id].thread.num === thread.num)
                delete this.storedData[id];
        }
    }
    removeAllStoredData() {
        for (const id of Object.keys(this.storedData).map((k) => parseInt(k, 10))) {
            delete this.storedData[id];
        }
    }
    handleIsolateExit(ref) {
        const threadInfo = this.getThreadInfoFromRef(ref);
        if (threadInfo) {
            this.debugSession.sendEvent(new vscode_debugadapter_1.ThreadEvent("exited", threadInfo.num));
            this.threads.splice(this.threads.indexOf(threadInfo), 1);
            this.removeStoredData(threadInfo);
        }
    }
}
exports.ThreadManager = ThreadManager;
class StoredData {
    constructor(thread, data) {
        this.thread = thread;
        this.data = data;
    }
}
class ThreadInfo {
    constructor(manager, ref, num) {
        this.manager = manager;
        this.ref = ref;
        this.num = num;
        this.scriptCompleters = {};
        this.runnable = false;
        this.vmBps = {};
        // TODO: Do we need both sets of breakpoints?
        this.breakpoints = {};
        this.atAsyncSuspension = false;
        this.exceptionReference = 0;
        this.paused = false;
        this.gotPauseStart = false;
        this.initialBreakpoints = false;
        this.hasConfigurationDone = false;
        this.hasPendingResume = false;
    }
    // Whether this thread is infrastructure (eg. not user code), useful for avoiding breaking
    // on handled exceptions, etc.
    get isInfrastructure() {
        return this.ref && this.ref.name && debugger_1.isKnownInfrastructureThread(this.ref);
    }
    removeBreakpointsAtUri(uri) {
        const removeBreakpointPromises = [];
        const breakpoints = this.vmBps[uri];
        if (breakpoints) {
            for (const bp of breakpoints) {
                removeBreakpointPromises.push(this.manager.debugSession.observatory.removeBreakpoint(this.ref.id, bp.id));
            }
            delete this.vmBps[uri];
        }
        return Promise.all(removeBreakpointPromises);
    }
    removeAllBreakpoints() {
        const removeBreakpointPromises = [];
        for (const uri of Object.keys(this.vmBps)) {
            removeBreakpointPromises.push(this.removeBreakpointsAtUri(uri));
        }
        return Promise.all(removeBreakpointPromises).then((results) => {
            return [].concat.apply([], results);
        });
    }
    setBreakpoints(uri, breakpoints) {
        return __awaiter(this, void 0, void 0, function* () {
            // Remove all current bps.
            yield this.removeBreakpointsAtUri(uri);
            this.vmBps[uri] = [];
            return Promise.all(breakpoints.map((bp) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const result = yield this.manager.debugSession.observatory.addBreakpointWithScriptUri(this.ref.id, uri, bp.line, bp.column);
                    const vmBp = result.result;
                    this.vmBps[uri].push(vmBp);
                    this.breakpoints[vmBp.id] = bp;
                    return vmBp;
                }
                catch (e) {
                    log_1.logError(e, utils_1.LogCategory.Observatory);
                    return undefined;
                }
            })));
        });
    }
    receivedPauseStart() {
        this.gotPauseStart = true;
        this.paused = true;
        this.checkResume();
    }
    setInitialBreakpoints() {
        this.initialBreakpoints = true;
        this.checkResume();
    }
    receivedConfigurationDone() {
        this.hasConfigurationDone = true;
        this.checkResume();
    }
    checkResume() {
        if (this.paused && this.gotPauseStart && this.initialBreakpoints && this.hasConfigurationDone)
            this.resume();
    }
    handleResumed() {
        this.manager.removeStoredData(this);
        // TODO: Should we be waiting for acknowledgement before doing this?
        this.atAsyncSuspension = false;
        this.exceptionReference = 0;
        this.paused = false;
    }
    resume(step) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.paused || this.hasPendingResume)
                return;
            this.hasPendingResume = true;
            try {
                yield this.manager.debugSession.observatory.resume(this.ref.id, step);
                this.handleResumed();
            }
            finally {
                this.hasPendingResume = false;
            }
        });
    }
    getScript(scriptRef) {
        const scriptId = scriptRef.id;
        if (this.scriptCompleters[scriptId]) {
            const completer = this.scriptCompleters[scriptId];
            return completer.promise;
        }
        else {
            const completer = new utils_1.PromiseCompleter();
            this.scriptCompleters[scriptId] = completer;
            const observatory = this.manager.debugSession.observatory;
            observatory.getObject(this.ref.id, scriptRef.id).then((result) => {
                const script = result.result;
                completer.resolve(script);
            }).catch((error) => {
                completer.reject(error);
            });
            return completer.promise;
        }
    }
    storeData(data) {
        return this.manager.storeData(this, data);
    }
    handlePaused(atAsyncSuspension, exception) {
        this.atAsyncSuspension = atAsyncSuspension;
        if (exception) {
            exception.evaluateName = "$e";
            this.exceptionReference = this.storeData(exception);
        }
        this.paused = true;
    }
}
exports.ThreadInfo = ThreadInfo;
//# sourceMappingURL=threads.js.map