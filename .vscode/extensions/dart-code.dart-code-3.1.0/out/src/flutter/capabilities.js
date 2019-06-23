"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("../utils");
class FlutterCapabilities {
    static get empty() { return new FlutterCapabilities("0.0.0"); }
    constructor(flutterVersion) {
        this.version = flutterVersion;
    }
    get supportsPidFileForMachine() { return utils_1.versionIsAtLeast(this.version, "0.10.0"); }
    get supportsCreatingSamples() { return utils_1.versionIsAtLeast(this.version, "1.0.0"); }
    get supportsMultipleSamplesPerElement() { return utils_1.versionIsAtLeast(this.version, "1.2.2"); }
    get supportsDevTools() { return utils_1.versionIsAtLeast(this.version, "1.1.0"); }
    get hasTestGroupFix() { return utils_1.versionIsAtLeast(this.version, "1.3.4"); }
    get hasEvictBug() { return !utils_1.versionIsAtLeast(this.version, "1.2.2"); }
    get supportsFlutterCreateListSamples() { return utils_1.versionIsAtLeast(this.version, "1.3.10"); }
    get supportsUrisForFlutterAttach() { return utils_1.versionIsAtLeast(this.version, "1.5.3"); }
    // TODO: Figure this out.
    get webSupportsDebugging() { return false; }
}
exports.FlutterCapabilities = FlutterCapabilities;
//# sourceMappingURL=capabilities.js.map