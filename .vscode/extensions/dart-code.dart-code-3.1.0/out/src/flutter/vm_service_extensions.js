"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vs = require("vscode");
const utils_1 = require("../debug/utils");
const extension_1 = require("../extension");
const debug_config_provider_1 = require("../providers/debug_config_provider");
exports.IS_INSPECTING_WIDGET_CONTEXT = "dart-code:flutter.isInspectingWidget";
/// The service extensions we know about.
var FlutterServiceExtension;
(function (FlutterServiceExtension) {
    FlutterServiceExtension["PlatformOverride"] = "ext.flutter.platformOverride";
    FlutterServiceExtension["DebugBanner"] = "ext.flutter.debugAllowBanner";
    FlutterServiceExtension["CheckElevations"] = "ext.flutter.debugCheckElevationsEnabled";
    FlutterServiceExtension["DebugPaint"] = "ext.flutter.debugPaint";
    FlutterServiceExtension["PaintBaselines"] = "ext.flutter.debugPaintBaselinesEnabled";
    FlutterServiceExtension["InspectorSelectMode"] = "ext.flutter.inspector.show";
    FlutterServiceExtension["InspectorSetPubRootDirectories"] = "ext.flutter.inspector.setPubRootDirectories";
    FlutterServiceExtension["RepaintRainbow"] = "ext.flutter.repaintRainbow";
    FlutterServiceExtension["PerformanceOverlay"] = "ext.flutter.showPerformanceOverlay";
    FlutterServiceExtension["SlowAnimations"] = "ext.flutter.timeDilation";
})(FlutterServiceExtension = exports.FlutterServiceExtension || (exports.FlutterServiceExtension = {}));
/// The service extensions we know about and allow toggling via commands.
var FlutterService;
(function (FlutterService) {
    FlutterService["HotReload"] = "reloadSources";
    FlutterService["HotRestart"] = "hotRestart";
    FlutterService["LaunchDevTools"] = "launchDevTools";
})(FlutterService = exports.FlutterService || (exports.FlutterService = {}));
const keyTimeDilation = "timeDilation";
const keyEnabled = "enabled";
const keyValue = "value";
/// Service extension values must be wrapped in objects when sent to the VM, eg:
///
///     { timeDilation: x.x }
///     { enabled: true }
///
/// This map tracks the name of the key for a given extension.
const toggleExtensionStateKeys = {
    [FlutterServiceExtension.PlatformOverride]: keyValue,
    [FlutterServiceExtension.DebugBanner]: keyEnabled,
    [FlutterServiceExtension.CheckElevations]: keyEnabled,
    [FlutterServiceExtension.DebugPaint]: keyEnabled,
    [FlutterServiceExtension.PaintBaselines]: keyEnabled,
    [FlutterServiceExtension.InspectorSelectMode]: keyEnabled,
    [FlutterServiceExtension.RepaintRainbow]: keyEnabled,
    [FlutterServiceExtension.PerformanceOverlay]: keyEnabled,
    [FlutterServiceExtension.SlowAnimations]: keyTimeDilation,
};
exports.timeDilationNormal = 1.0;
exports.timeDilationSlow = 5.0;
/// Default values for each service extension.
const defaultToggleExtensionState = {
    [FlutterServiceExtension.PlatformOverride]: null,
    [FlutterServiceExtension.DebugBanner]: true,
    [FlutterServiceExtension.CheckElevations]: false,
    [FlutterServiceExtension.DebugPaint]: false,
    [FlutterServiceExtension.PaintBaselines]: false,
    [FlutterServiceExtension.InspectorSelectMode]: false,
    [FlutterServiceExtension.RepaintRainbow]: false,
    [FlutterServiceExtension.PerformanceOverlay]: false,
    [FlutterServiceExtension.SlowAnimations]: exports.timeDilationNormal,
};
/// Manages state for Flutter VM service extensions.
class FlutterVmServiceExtensions {
    constructor(sendRequest) {
        this.registeredServices = {};
        this.loadedServiceExtensions = [];
        this.currentExtensionState = Object.assign({}, defaultToggleExtensionState);
        // To avoid any code in this class accidentally calling sendRequestToFlutter directly, we wrap it here and don't
        // keep a reference to it.
        this.sendValueToVM = (extension) => {
            // Only ever send values for enabled and known extensions.
            if (this.loadedServiceExtensions.indexOf(extension) !== -1 && toggleExtensionStateKeys[extension] !== undefined) {
                // Build the args in the required format using the correct key and value.
                const params = { [toggleExtensionStateKeys[extension]]: this.currentExtensionState[extension] };
                const args = { type: extension, params };
                sendRequest(extension, args);
                this.syncInspectingWidgetContext(extension);
            }
        };
    }
    /// Handles an event from the Debugger, such as extension services being loaded and values updated.
    handleDebugEvent(e) {
        if (e.event === "dart.serviceExtensionAdded") {
            this.handleServiceExtensionLoaded(e.body.id);
            // If the isWidgetCreationTracked extension loads, send a command to the debug adapter
            // asking it to query whether it's enabled (it'll send us an event back with the answer).
            if (e.body.id === "ext.flutter.inspector.isWidgetCreationTracked") {
                e.session.customRequest("checkIsWidgetCreationTracked");
                // If it's the PlatformOverride, send a request to get the current value.
            }
            else if (e.body.id === FlutterServiceExtension.PlatformOverride) {
                e.session.customRequest("checkPlatformOverride");
            }
            else if (e.body.id === FlutterServiceExtension.InspectorSetPubRootDirectories) {
                // TODO: We should send all open workspaces (arg0, arg1, arg2) so that it
                // works for open packages too.
                const debuggerType = e.session.configuration.debuggerType;
                if (debuggerType !== debug_config_provider_1.DebuggerType.FlutterWeb) {
                    e.session.customRequest("serviceExtension", {
                        params: {
                            arg0: this.formatPathForPubRootDirectories(e.session.configuration.cwd),
                            arg1: e.session.configuration.cwd,
                            // TODO: Is this OK???
                            isolateId: e.body.isolateId,
                        },
                        type: "ext.flutter.inspector.setPubRootDirectories",
                    });
                }
            }
        }
        else if (e.event === "dart.serviceRegistered") {
            this.handleServiceRegistered(e.body.service, e.body.method);
        }
        else if (e.event === "dart.flutter.firstFrame") {
            // Send all values back to the VM on the first frame so that they persist across restarts.
            for (const extension in FlutterServiceExtension)
                this.sendValueToVM(extension);
        }
        else if (e.event === "dart.flutter.updateIsWidgetCreationTracked") {
            vs.commands.executeCommand("setContext", debug_config_provider_1.TRACK_WIDGET_CREATION_ENABLED, e.body.isWidgetCreationTracked);
        }
        else if (e.event === "dart.flutter.updatePlatformOverride") {
            this.currentExtensionState[FlutterServiceExtension.PlatformOverride] = e.body.platform;
        }
        else if (e.event === "dart.flutter.serviceExtensionStateChanged") {
            this.handleRemoteValueUpdate(e.body.extension, e.body.value);
        }
    }
    // TODO: Remove this function (and the call to it) once the fix has rolled to Flutter beta.
    // https://github.com/flutter/flutter-intellij/issues/2217
    formatPathForPubRootDirectories(path) {
        return utils_1.isWin
            ? path && `file:///${path.replace(/\\/g, "/")}`
            : path;
    }
    /// Toggles between two values. Always picks the value1 if the current value
    // is not already value1 (eg. if it's neither of those, it'll pick val1).
    toggle(id, val1 = true, val2 = false) {
        this.currentExtensionState[id] = this.currentExtensionState[id] !== val1 ? val1 : val2;
        this.sendValueToVM(id);
    }
    /// Keep the context in sync so that the "Cancel Inspect Widget" command is enabled/disabled.
    syncInspectingWidgetContext(id) {
        vs.commands.executeCommand("setContext", exports.IS_INSPECTING_WIDGET_CONTEXT, this.currentExtensionState[FlutterServiceExtension.InspectorSelectMode]);
    }
    /// Handles updates that come from the VM (eg. were updated by another tool).
    handleRemoteValueUpdate(id, value) {
        // Don't try to process service extension we don't know about.
        if (this.currentExtensionState[id] === undefined) {
            return;
        }
        // HACK: Everything comes through as strings, but we need bools/ints and sometimes strings,
        // so attempt to parse it, but keep the original string in the case of failure.
        if (typeof value === "string") {
            try {
                value = JSON.parse(value);
            }
            catch (_a) {
            }
        }
        this.currentExtensionState[id] = value;
        this.syncInspectingWidgetContext(id);
    }
    /// Resets all local state to defaults - used when terminating the last debug session (or
    // starting the first) to ensure debug toggles don't "persist" across sessions.
    resetToDefaults() {
        this.currentExtensionState = Object.assign({}, defaultToggleExtensionState);
    }
    /// Tracks registered services and updates contexts to enable VS Code commands.
    handleServiceRegistered(service, method) {
        this.registeredServices[service] = method;
        vs.commands.executeCommand("setContext", `${extension_1.SERVICE_CONTEXT_PREFIX}${service}`, true);
    }
    /// Tracks loaded service extensions and updates contexts to enable VS Code commands.
    handleServiceExtensionLoaded(id) {
        this.loadedServiceExtensions.push(id);
        vs.commands.executeCommand("setContext", `${extension_1.SERVICE_EXTENSION_CONTEXT_PREFIX}${id}`, true);
    }
    /// Marks all services and service extensions as not-loaded in the context to disable VS Code Commands.
    markAllServicesUnloaded() {
        for (const id of Object.keys(this.registeredServices)) {
            vs.commands.executeCommand("setContext", `${extension_1.SERVICE_CONTEXT_PREFIX}${id}`, undefined);
        }
        this.registeredServices = {};
        for (const id of this.loadedServiceExtensions) {
            vs.commands.executeCommand("setContext", `${extension_1.SERVICE_EXTENSION_CONTEXT_PREFIX}${id}`, undefined);
        }
        this.loadedServiceExtensions.length = 0;
        vs.commands.executeCommand("setContext", debug_config_provider_1.TRACK_WIDGET_CREATION_ENABLED, false);
    }
    // TODO: These services should be per-session!
    serviceIsRegistered(service) {
        return !!this.registeredServices[service];
    }
    getServiceMethodName(service) {
        return this.registeredServices[service];
    }
    serviceExtensionIsLoaded(id) {
        return !!this.loadedServiceExtensions.find((loadedID) => loadedID === id);
    }
}
exports.FlutterVmServiceExtensions = FlutterVmServiceExtensions;
//# sourceMappingURL=vm_service_extensions.js.map