"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("../utils");
class DartCapabilities {
    static get empty() { return new DartCapabilities("0.0.0"); }
    constructor(dartVersion) {
        this.version = dartVersion;
    }
    get supportsDevTools() { return utils_1.versionIsAtLeast(this.version, "2.1.0"); }
    get includesSourceForSdkLibs() { return utils_1.versionIsAtLeast(this.version, "2.2.1"); }
    get handlesBreakpointsInPartFiles() { return utils_1.versionIsAtLeast(this.version, "2.2.1-edge"); }
    get supportsDisableServiceTokens() { return utils_1.versionIsAtLeast(this.version, "2.2.1-dev.4.2"); }
}
exports.DartCapabilities = DartCapabilities;
//# sourceMappingURL=capabilities.js.map