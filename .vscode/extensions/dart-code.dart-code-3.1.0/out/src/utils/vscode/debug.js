"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("../../debug/utils");
const observatoryPortRegex = /:([0-9]+)\/?$/;
// TODO: Remove this once --debug-uri support in `flutter attach` (v1.5.4) hits
// stable.
function extractObservatoryPort(observatoryUri) {
    const matches = observatoryPortRegex.exec(observatoryUri);
    return matches ? parseInt(matches[1], 10) : undefined;
}
exports.extractObservatoryPort = extractObservatoryPort;
class DartDebugSessionInformation {
    constructor(session) {
        this.session = session;
        /// Reporting for the launch step.
        this.launchProgressPromise = new utils_1.PromiseCompleter();
        this.sessionStart = new Date();
    }
}
exports.DartDebugSessionInformation = DartDebugSessionInformation;
//# sourceMappingURL=debug.js.map