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
const https = require("https");
const querystring = require("querystring");
const vscode_1 = require("vscode");
const config_1 = require("./config");
const utils_1 = require("./debug/utils");
const utils_2 = require("./utils");
const log_1 = require("./utils/log");
// Set to true for analytics to be sent to the debug endpoint (non-logging) for validation.
// This is only required for debugging analytics and needn't be sent for standard Dart Code development (dev hits are already filtered with isDevelopment).
const debug = false;
/// Analytics require that we send a value for uid or cid, but when running in the VS Code
// dev host we don't have either.
const sendAnalyticsFromExtensionDevHost = false;
// Machine ID is not set for extension dev host unless the boolean above is set to true (which
// is usually done for testing purposes).
const machineId = vscode_1.env.machineId !== "someValue.machineId"
    ? vscode_1.env.machineId
    : (sendAnalyticsFromExtensionDevHost ? "35009a79-1a05-49d7-dede-dededededede" : undefined);
var Category;
(function (Category) {
    Category[Category["Extension"] = 0] = "Extension";
    Category[Category["Analyzer"] = 1] = "Analyzer";
    Category[Category["Debugger"] = 2] = "Debugger";
})(Category || (Category = {}));
var EventAction;
(function (EventAction) {
    EventAction[EventAction["Activated"] = 0] = "Activated";
    EventAction[EventAction["SdkDetectionFailure"] = 1] = "SdkDetectionFailure";
    EventAction[EventAction["Deactivated"] = 2] = "Deactivated";
    EventAction[EventAction["Restart"] = 3] = "Restart";
    EventAction[EventAction["HotReload"] = 4] = "HotReload";
    EventAction[EventAction["OpenObservatory"] = 5] = "OpenObservatory";
    EventAction[EventAction["OpenTimeline"] = 6] = "OpenTimeline";
    EventAction[EventAction["OpenDevTools"] = 7] = "OpenDevTools";
})(EventAction || (EventAction = {}));
var TimingVariable;
(function (TimingVariable) {
    TimingVariable[TimingVariable["Startup"] = 0] = "Startup";
    TimingVariable[TimingVariable["FirstAnalysis"] = 1] = "FirstAnalysis";
    TimingVariable[TimingVariable["SessionDuration"] = 2] = "SessionDuration";
})(TimingVariable || (TimingVariable = {}));
class Analytics {
    constructor(workspaceContext) {
        this.workspaceContext = workspaceContext;
    }
    logExtensionStartup(timeInMS) {
        this.event(Category.Extension, EventAction.Activated);
        this.time(Category.Extension, TimingVariable.Startup, timeInMS);
    }
    logExtensionRestart(timeInMS) {
        this.event(Category.Extension, EventAction.Restart);
        this.time(Category.Extension, TimingVariable.Startup, timeInMS);
    }
    logExtensionShutdown() { return this.event(Category.Extension, EventAction.Deactivated); }
    logSdkDetectionFailure() { this.event(Category.Extension, EventAction.SdkDetectionFailure); }
    logAnalyzerError(description, fatal) { this.error("AS: " + description, fatal); }
    logAnalyzerStartupTime(timeInMS) { this.time(Category.Analyzer, TimingVariable.Startup, timeInMS); }
    logDebugSessionDuration(timeInMS) { this.time(Category.Debugger, TimingVariable.SessionDuration, timeInMS); }
    logAnalyzerFirstAnalysisTime(timeInMS) { this.time(Category.Analyzer, TimingVariable.FirstAnalysis, timeInMS); }
    logDebuggerStart(resourceUri, debuggerType, runType) {
        const customData = {
            cd15: debuggerType,
            cd16: runType,
        };
        this.event(Category.Debugger, EventAction.Activated, resourceUri, customData);
    }
    logDebuggerRestart() { this.event(Category.Debugger, EventAction.Restart); }
    logDebuggerHotReload() { this.event(Category.Debugger, EventAction.HotReload); }
    logDebuggerOpenObservatory() { this.event(Category.Debugger, EventAction.OpenObservatory); }
    logDebuggerOpenTimeline() { this.event(Category.Debugger, EventAction.OpenTimeline); }
    logDebuggerOpenDevTools() { this.event(Category.Debugger, EventAction.OpenDevTools); }
    event(category, action, resourceUri, customData) {
        const data = {
            ea: EventAction[action],
            ec: Category[category],
            t: "event",
        };
        // Copy custom data over.
        Object.assign(data, customData);
        // Force a session start if this is extension activation.
        if (category === Category.Extension && action === EventAction.Activated)
            data.sc = "start";
        // Force a session end if this is extension deactivation.
        if (category === Category.Extension && action === EventAction.Deactivated)
            data.sc = "end";
        return this.send(data, resourceUri);
    }
    time(category, timingVariable, timeInMS) {
        const data = {
            t: "timing",
            utc: Category[category],
            utt: Math.round(timeInMS),
            utv: TimingVariable[timingVariable],
        };
        this.send(data);
    }
    error(description, fatal) {
        const data = {
            exd: description.split(/[\n\{\/\\]/)[0].substring(0, 150).trim(),
            exf: fatal ? 1 : 0,
            t: "exception",
        };
        this.send(data);
    }
    send(customData, resourceUri) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!machineId || !config_1.config.allowAnalytics || process.env.DART_CODE_IS_TEST_RUN)
                return;
            const data = {
                aip: 1,
                an: "Dart Code",
                av: utils_2.extensionVersion,
                cd1: utils_2.isDevExtension,
                cd10: config_1.config.showTodos ? "On" : "Off",
                // cd11: config.showLintNames ? "On" : "Off",
                // cd12: "Removed",
                cd13: this.flutterSdkVersion,
                cd14: utils_2.hasFlutterExtension ? "Installed" : "Not Installed",
                cd2: utils_1.isChromeOS ? `${process.platform} (ChromeOS)` : process.platform,
                cd3: this.sdkVersion,
                cd4: this.analysisServerVersion,
                cd5: vscode_1.version,
                cd6: resourceUri ? this.getDebuggerPreference(resourceUri) : null,
                cd7: this.workspaceContext.workspaceTypeDescription,
                cd8: config_1.config.closingLabels ? "On" : "Off",
                cd9: this.workspaceContext.hasAnyFlutterProjects ? (config_1.config.flutterHotReloadOnSave ? "On" : "Off") : null,
                // TODO: Auto-save
                // TODO: Hot-restart-on-save
                cid: machineId,
                tid: "UA-2201586-19",
                ul: vscode_1.env.language,
                v: "1",
            };
            // Copy custom data over.
            Object.assign(data, customData);
            if (debug)
                log_1.logInfo("Sending analytic: " + JSON.stringify(data));
            const options = {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                hostname: "www.google-analytics.com",
                method: "POST",
                path: debug ? "/debug/collect" : "/collect",
                port: 443,
            };
            yield new Promise((resolve) => {
                try {
                    const req = https.request(options, (resp) => {
                        if (debug)
                            resp.on("data", (c) => {
                                try {
                                    const gaDebugResp = JSON.parse(c.toString());
                                    if (gaDebugResp && gaDebugResp.hitParsingResult && gaDebugResp.hitParsingResult[0].valid === true)
                                        log_1.logInfo("Sent OK!");
                                    else if (gaDebugResp && gaDebugResp.hitParsingResult && gaDebugResp.hitParsingResult[0].valid === false)
                                        log_1.logWarn(c.toString());
                                    else
                                        log_1.logWarn("Unexpected GA debug response: " + c.toString());
                                }
                                catch (e) {
                                    log_1.logWarn("Error in GA debug response: " + c.toString());
                                }
                            });
                        if (!resp || !resp.statusCode || resp.statusCode < 200 || resp.statusCode > 300) {
                            log_1.logInfo(`Failed to send analytics ${resp && resp.statusCode}: ${resp && resp.statusMessage}`);
                        }
                        resolve();
                    });
                    req.write(querystring.stringify(data));
                    req.end();
                }
                catch (e) {
                    log_1.logError(`Failed to send analytics: ${e}`);
                    resolve();
                }
            });
        });
    }
    getDebuggerPreference(resourceUri) {
        const conf = config_1.config.for(resourceUri);
        if (conf.debugSdkLibraries && conf.debugExternalLibraries)
            return "All code";
        else if (conf.debugSdkLibraries)
            return "My code + SDK";
        else if (conf.debugExternalLibraries)
            return "My code + Libraries";
        else
            return "My code";
    }
}
exports.Analytics = Analytics;
//# sourceMappingURL=analytics.js.map