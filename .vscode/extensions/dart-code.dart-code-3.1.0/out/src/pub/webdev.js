"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const packageName = "webdev";
const packageID = "webdev";
class WebDev {
    constructor(pubGlobal) {
        this.pubGlobal = pubGlobal;
    }
    promptToInstallIfRequired() {
        return this.pubGlobal.promptToInstallIfRequired(packageName, packageID, undefined, "2.0.4");
    }
}
exports.WebDev = WebDev;
//# sourceMappingURL=webdev.js.map