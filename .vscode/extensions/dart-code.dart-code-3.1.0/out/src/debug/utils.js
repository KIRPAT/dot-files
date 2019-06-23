"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const fs = require("fs");
const path = require("path");
// TODO: Move some of this to utils/debugger.ts (things that are used by debugger) and things like logging out to utils/log.ts
exports.dartCodeExtensionIdentifier = "Dart-Code.dart-code";
exports.flutterExtensionIdentifier = "Dart-Code.flutter";
exports.isWin = /^win/.test(process.platform);
exports.isMac = process.platform === "darwin";
exports.isLinux = !exports.isWin && !exports.isMac;
exports.isChromeOS = exports.isLinux && fs.existsSync("/dev/.cros_milestone");
// Used for code checks and in Dart SDK urls so Chrome OS is considered Linux.
exports.dartPlatformName = exports.isWin ? "win" : exports.isMac ? "mac" : "linux";
// Used for display (logs, analytics) so Chrome OS is its own.
exports.platformDisplayName = exports.isWin ? "win" : exports.isMac ? "mac" : exports.isChromeOS ? "chromeos" : "linux";
exports.platformEol = exports.isWin ? "\r\n" : "\n";
var LogCategory;
(function (LogCategory) {
    LogCategory[LogCategory["General"] = 0] = "General";
    LogCategory[LogCategory["CI"] = 1] = "CI";
    LogCategory[LogCategory["CommandProcesses"] = 2] = "CommandProcesses";
    LogCategory[LogCategory["Analyzer"] = 3] = "Analyzer";
    LogCategory[LogCategory["PubTest"] = 4] = "PubTest";
    LogCategory[LogCategory["FlutterDaemon"] = 5] = "FlutterDaemon";
    LogCategory[LogCategory["FlutterRun"] = 6] = "FlutterRun";
    LogCategory[LogCategory["FlutterTest"] = 7] = "FlutterTest";
    LogCategory[LogCategory["Observatory"] = 8] = "Observatory";
    LogCategory[LogCategory["WebDaemon"] = 9] = "WebDaemon";
})(LogCategory = exports.LogCategory || (exports.LogCategory = {}));
var LogSeverity;
(function (LogSeverity) {
    LogSeverity[LogSeverity["Info"] = 0] = "Info";
    LogSeverity[LogSeverity["Warn"] = 1] = "Warn";
    LogSeverity[LogSeverity["Error"] = 2] = "Error";
})(LogSeverity = exports.LogSeverity || (exports.LogSeverity = {}));
class LogMessage {
    constructor(message, severity, category) {
        this.message = message;
        this.severity = severity;
        this.category = category;
    }
}
exports.LogMessage = LogMessage;
class LogEmitter extends events_1.EventEmitter {
    fire(msg) {
        this.emit("log", msg);
    }
    onLog(listener) {
        this.on("log", listener);
        return {
            dispose: () => { this.removeListener("log", listener); },
        };
    }
}
exports.LogEmitter = LogEmitter;
// TODO: Remove this, or document why we need it as well as fsPath().
function uriToFilePath(uri, returnWindowsPath = exports.isWin) {
    let filePath = uri;
    if (uri.startsWith("file://"))
        filePath = decodeURI(uri.substring(7));
    else if (uri.startsWith("file:"))
        filePath = decodeURI(uri.substring(5)); // TODO: Does this case ever get hit? Will it be over-decoded?
    // Windows fixup.
    if (returnWindowsPath) {
        filePath = filePath.replace(/\//g, "\\");
        if (filePath[0] === "\\")
            filePath = filePath.substring(1);
    }
    else {
        if (filePath[0] !== "/")
            filePath = `/${filePath}`;
    }
    return filePath;
}
exports.uriToFilePath = uriToFilePath;
function findFile(file, startLocation) {
    let lastParent;
    let parent = startLocation;
    while (parent && parent.length > 1 && parent !== lastParent) {
        const packages = path.join(parent, file);
        if (fs.existsSync(packages))
            return packages;
        lastParent = parent;
        parent = path.dirname(parent);
    }
    return undefined;
}
exports.findFile = findFile;
function formatPathForVm(file) {
    // Handle drive letter inconsistencies.
    file = forceWindowsDriveLetterToUppercase(file);
    // Convert any Windows backslashes to forward slashes.
    file = file.replace(/\\/g, "/");
    // Remove any existing file:/(//) prefixes.
    file = file.replace(/^file:\/+/, ""); // TODO: Does this case ever get hit? Will it be over-encoded?
    // Remove any remaining leading slashes.
    file = file.replace(/^\/+/, "");
    // Ensure a single slash prefix.
    if (file.startsWith("dart:"))
        return file;
    else
        return `file:///${encodeURI(file)}`;
}
exports.formatPathForVm = formatPathForVm;
function forceWindowsDriveLetterToUppercase(p) {
    if (p && exports.isWin && path.isAbsolute(p) && p.charAt(0) === p.charAt(0).toLowerCase())
        p = p.substr(0, 1).toUpperCase() + p.substr(1);
    return p;
}
exports.forceWindowsDriveLetterToUppercase = forceWindowsDriveLetterToUppercase;
function isWithinPath(file, folder) {
    const relative = path.relative(folder, file);
    return !!relative && !relative.startsWith("..") && !path.isAbsolute(relative);
}
exports.isWithinPath = isWithinPath;
function uniq(array) {
    return array.filter((value, index) => array.indexOf(value) === index);
}
exports.uniq = uniq;
function flatMap(input, f) {
    return input.reduce((acc, x) => acc.concat(f(x)), []);
}
exports.flatMap = flatMap;
function throttle(fn, limitMilliseconds) {
    let timer;
    let lastRunTime;
    return (...args) => {
        const run = () => {
            lastRunTime = Date.now();
            fn(...args);
        };
        const now = Date.now();
        if (lastRunTime && now < lastRunTime + limitMilliseconds) {
            // Delay the call until the timer has expired.
            clearTimeout(timer);
            // Set the timer in future, but compensate for how far through we are.
            const runInMilliseconds = limitMilliseconds - (now - lastRunTime);
            timer = setTimeout(run, runInMilliseconds);
        }
        else {
            run();
        }
    };
}
exports.throttle = throttle;
function escapeRegExp(input) {
    return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}
exports.escapeRegExp = escapeRegExp;
class PromiseCompleter {
    constructor() {
        this.promise = new Promise((res, rej) => {
            this.resolve = res;
            this.reject = rej;
        });
    }
}
exports.PromiseCompleter = PromiseCompleter;
//# sourceMappingURL=utils.js.map