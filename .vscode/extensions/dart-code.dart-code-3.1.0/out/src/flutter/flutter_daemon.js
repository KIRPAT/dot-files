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
const vscode_1 = require("vscode");
const config_1 = require("../config");
const utils_1 = require("../debug/utils");
const extension_1 = require("../extension");
const stdio_service_1 = require("../services/stdio_service");
const utils_2 = require("../utils");
const log_1 = require("../utils/log");
const processes_1 = require("../utils/processes");
const device_manager_1 = require("./device_manager");
class DaemonCapabilities {
    static get empty() { return new DaemonCapabilities("0.0.0"); }
    constructor(daemonProtocolVersion) {
        this.version = daemonProtocolVersion;
    }
    get canCreateEmulators() { return utils_2.versionIsAtLeast(this.version, "0.4.0"); }
    get canFlutterAttach() { return utils_2.versionIsAtLeast(this.version, "0.4.1"); }
}
exports.DaemonCapabilities = DaemonCapabilities;
class FlutterDaemon extends stdio_service_1.StdIOService {
    constructor(flutterBinPath, projectFolder) {
        super(() => config_1.config.flutterDaemonLogFile, (message, severity) => log_1.log(message, severity, utils_1.LogCategory.FlutterDaemon), config_1.config.maxLogLineLength, true);
        this.hasStarted = false;
        this.daemonStartedCompleter = new utils_1.PromiseCompleter();
        this.capabilities = DaemonCapabilities.empty;
        // Subscription lists.
        this.daemonConnectedSubscriptions = [];
        this.deviceAddedSubscriptions = [];
        this.deviceRemovedSubscriptions = [];
        this.daemonLogMessageSubscriptions = [];
        this.daemonLogSubscriptions = [];
        this.daemonShowMessageSubscriptions = [];
        this.registerForDaemonConnected((e) => {
            this.additionalPidsToTerminate.push(e.pid);
            this.capabilities.version = e.version;
            vs.commands.executeCommand("setContext", extension_1.FLUTTER_SUPPORTS_ATTACH, this.capabilities.canFlutterAttach);
            // Enable device polling.
            this.deviceEnable().then(() => this.deviceManager.updateStatusBar());
        });
        this.createProcess(projectFolder, flutterBinPath, ["daemon"]);
        this.deviceManager = new device_manager_1.FlutterDeviceManager(this);
        if (utils_1.isChromeOS && config_1.config.flutterAdbConnectOnChromeOs) {
            log_1.log("Running ADB Connect on Chrome OS");
            const adbConnectProc = processes_1.safeSpawn(undefined, "adb", ["connect", "100.115.92.2:5555"]);
            log_1.logProcess(utils_1.LogCategory.General, adbConnectProc);
        }
    }
    get isReady() { return this.hasStarted; }
    dispose() {
        this.deviceManager.dispose();
        super.dispose();
    }
    sendMessage(json) {
        try {
            super.sendMessage(json);
        }
        catch (e) {
            utils_2.reloadExtension("The Flutter Daemon has terminated.", undefined, true);
            throw e;
        }
    }
    shouldHandleMessage(message) {
        // Everything in flutter is wrapped in [] so we can tell what to handle.
        if (message.startsWith("[{") && message.endsWith("}]")) {
            // When we get the first message to handle, complete the status notifications.
            if (!this.hasStarted) {
                this.hasStarted = true;
                this.daemonStartedCompleter.resolve();
            }
            return true;
        }
        return false;
    }
    processUnhandledMessage(message) {
        return __awaiter(this, void 0, void 0, function* () {
            let upgradeMessage;
            const matches = FlutterDaemon.outOfDateWarning.exec(message);
            if (matches && matches.length === 2)
                upgradeMessage = `Your installation of Flutter is ${matches[1]} days old.`;
            else if (message.indexOf(FlutterDaemon.newVersionMessage) !== -1)
                upgradeMessage = "A new version of Flutter is available";
            if (upgradeMessage) {
                if (yield vs.window.showWarningMessage(upgradeMessage, "Upgrade Flutter"))
                    vs.commands.executeCommand("flutter.upgrade");
                return;
            }
            // Show as progress message, this is likely "Building flutter tool" or "downloading Dart SDK" messages.
            if ((message.startsWith("Building ") || message.startsWith("Downloading ") || message.startsWith("Starting "))
                && !message.startsWith("Starting device daemon") // Don't show this one as it happens for normal startups too.
            ) {
                if (!this.hasStarted) {
                    if (this.startupReporter) {
                        this.startupReporter.report({ message });
                    }
                    else {
                        vs.window.withProgress({
                            location: vscode_1.ProgressLocation.Notification,
                            title: "Flutter Setup",
                        }, (progressReporter) => {
                            this.startupReporter = progressReporter;
                            this.startupReporter.report({ message });
                            return this.daemonStartedCompleter.promise;
                        });
                    }
                }
            }
        });
    }
    // TODO: Can we code-gen all this like the analysis server?
    handleNotification(evt) {
        switch (evt.event) {
            case "daemon.connected":
                this.notify(this.daemonConnectedSubscriptions, evt.params);
                break;
            case "device.added":
                this.notify(this.deviceAddedSubscriptions, evt.params);
                break;
            case "device.removed":
                this.notify(this.deviceRemovedSubscriptions, evt.params);
                break;
            case "daemon.logMessage":
                this.notify(this.daemonLogMessageSubscriptions, evt.params);
                break;
            case "daemon.log":
                this.notify(this.daemonLogSubscriptions, evt.params);
                break;
            case "daemon.showMessage":
                this.notify(this.daemonShowMessageSubscriptions, evt.params);
                break;
        }
    }
    // Request methods.
    deviceEnable() {
        return this.sendRequest("device.enable");
    }
    getEmulators() {
        return this.sendRequest("emulator.getEmulators");
    }
    launchEmulator(emulatorId) {
        return this.sendRequest("emulator.launch", { emulatorId });
    }
    createEmulator(name) {
        return this.sendRequest("emulator.create", { name });
    }
    // Subscription methods.
    registerForDaemonConnected(subscriber) {
        return this.subscribe(this.daemonConnectedSubscriptions, subscriber);
    }
    registerForDeviceAdded(subscriber) {
        return this.subscribe(this.deviceAddedSubscriptions, subscriber);
    }
    registerForDeviceRemoved(subscriber) {
        return this.subscribe(this.deviceRemovedSubscriptions, subscriber);
    }
    registerForDaemonLogMessage(subscriber) {
        return this.subscribe(this.daemonLogMessageSubscriptions, subscriber);
    }
    registerForDaemonLog(subscriber) {
        return this.subscribe(this.daemonLogSubscriptions, subscriber);
    }
    registerForDaemonShowMessage(subscriber) {
        return this.subscribe(this.daemonShowMessageSubscriptions, subscriber);
    }
}
FlutterDaemon.outOfDateWarning = new RegExp("WARNING: .* Flutter is (\\d+) days old");
FlutterDaemon.newVersionMessage = "A new version of Flutter is available";
exports.FlutterDaemon = FlutterDaemon;
//# sourceMappingURL=flutter_daemon.js.map