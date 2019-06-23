"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const buffer_1 = require("buffer");
const vscode_1 = require("vscode");
const vscode_extension_telemetry_1 = require("vscode-extension-telemetry");
const os_1 = require("os");
const path_1 = require("path");
class Reporter {
    constructor(enabled) {
        this.enabled = enabled;
        const extensionId = "almenon.arepl";
        const extension = vscode_1.extensions.getExtension(extensionId);
        const extensionVersion = extension.packageJSON.version;
        // following key just allows you to send events to azure insights API
        // so it does not need to be protected
        // but obfuscating anyways - bots scan github for keys, but if you want my key you better work for it, damnit!
        const innocentKitten = buffer_1.Buffer.from("NWYzMWNjNDgtNTA2OC00OGY4LWFjMWMtZDRkY2Y3ZWFhMTM1", "base64").toString();
        this.reporter = new vscode_extension_telemetry_1.default(extensionId, extensionVersion, innocentKitten);
        this.resetMeasurements();
    }
    sendError(name, stackTrace, code = 0, category = 'typescript') {
        console.error(`${category} error: ${name} code ${code}\n${stackTrace}`);
        if (this.enabled) {
            // no point in sending same error twice (and we want to stay under free API limit)
            if (stackTrace == this.lastStackTrace)
                return;
            stackTrace = this.anonymizePaths(stackTrace);
            this.reporter.sendTelemetryEvent("error", {
                code: code.toString(),
                name,
                stackTrace,
                category,
            });
            this.lastStackTrace = stackTrace;
        }
    }
    /**
     * sends various stats to azure app insights
     */
    sendFinishedEvent(settings) {
        if (this.enabled) {
            const measurements = {};
            measurements['timeSpent'] = (Date.now() - this.timeOpened) / 1000;
            measurements['numRuns'] = this.numRuns;
            measurements['numInterruptedRuns'] = this.numInterruptedRuns;
            if (this.numRuns != 0) {
                measurements['execTime'] = this.execTime / this.numRuns;
                measurements['totalPyTime'] = this.totalPyTime / this.numRuns;
                measurements['totalTime'] = this.totalTime / this.numRuns;
            }
            else { // lets avoid 0/0 NaN error
                measurements['execTime'] = 0;
                measurements['totalPyTime'] = 0;
                measurements['totalTime'] = 0;
            }
            const properties = {};
            // no idea why I did this but i think there was a reason?
            // this is why you leave comments people
            const settingsDict = JSON.parse(JSON.stringify(settings));
            for (let key in settingsDict) {
                properties[key] = settingsDict[key];
            }
            properties['pythonPath'] = this.anonymizePaths(properties['pythonPath']);
            this.reporter.sendTelemetryEvent("closed", properties, measurements);
            this.resetMeasurements();
        }
    }
    resetMeasurements() {
        this.timeOpened = Date.now();
        this.numRuns = 0;
        this.numInterruptedRuns = 0;
        this.execTime = 0;
        this.totalPyTime = 0;
        this.totalTime = 0;
    }
    /**
     * replace username with anon
     */
    anonymizePaths(input) {
        if (input == null)
            return input;
        return input.replace(new RegExp('\\' + path_1.sep + os_1.userInfo().username, 'g'), path_1.sep + 'anon');
    }
    dispose() { this.reporter.dispose(); }
}
exports.default = Reporter;
//# sourceMappingURL=telemetry.js.map