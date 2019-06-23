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
const path = require("path");
const vs = require("vscode");
const constants_1 = require("../constants");
const utils_1 = require("../debug/utils");
const utils_2 = require("../sdk/utils");
const utils_3 = require("../utils");
const fetch_1 = require("../utils/fetch");
const log_1 = require("../utils/log");
const processes_1 = require("../utils/processes");
class PubGlobal {
    constructor(context, sdks) {
        this.context = context;
        this.sdks = sdks;
    }
    promptToInstallIfRequired(packageName, packageID, moreInfoLink = constants_1.pubGlobalDocsUrl, requiredVersion, autoUpdate = false) {
        return __awaiter(this, void 0, void 0, function* () {
            const versionStatus = yield this.getInstalledStatus(packageName, packageID, requiredVersion);
            if (versionStatus === VersionStatus.Valid)
                return true;
            const moreInfo = "More Info";
            const activateForMe = versionStatus === VersionStatus.NotInstalled ? `Activate ${packageName}` : `Update ${packageName}`;
            const message = versionStatus === VersionStatus.NotInstalled
                ? `${packageName} needs to be installed with 'pub global activate ${packageID}' to use this feature.`
                : (versionStatus === VersionStatus.UpdateRequired
                    ? `${packageName} needs to be updated with 'pub global activate ${packageID}' to use this feature.`
                    : `A new version of ${packageName} is available and can be installed with 'pub global activate ${packageID}'.`);
            let action = 
            // If we need an update and we're allowed to auto-update, to the same as if the user
            // clicked the activate button, otherwise prompt them.
            (versionStatus === VersionStatus.UpdateRequired || versionStatus === VersionStatus.UpdateAvailable) && autoUpdate
                ? activateForMe
                : yield vs.window.showWarningMessage(message, activateForMe, moreInfo);
            if (action === moreInfo) {
                utils_3.openInBrowser(moreInfoLink);
                return false;
            }
            else if (action === activateForMe) {
                const actionName = versionStatus === VersionStatus.NotInstalled ? `Activating ${packageName}` : `Updating ${packageName}`;
                const args = ["global", "activate", packageID];
                yield this.runCommandWithProgress(packageName, `${actionName}...`, args);
                if ((yield this.getInstalledStatus(packageName, packageID)) === VersionStatus.Valid) {
                    return true;
                }
                else {
                    action = yield vs.window.showErrorMessage(`${actionName} failed. Please try running 'pub global activate ${packageID}' manually.`, moreInfo);
                    if (action === moreInfo) {
                        utils_3.openInBrowser(moreInfoLink);
                    }
                    return false;
                }
            }
            return false;
        });
    }
    uninstall(packageID) {
        return __awaiter(this, void 0, void 0, function* () {
            const args = ["global", "deactivate", packageID];
            yield this.runCommand(packageID, args);
        });
    }
    getInstalledStatus(packageName, packageID, requiredVersion) {
        return __awaiter(this, void 0, void 0, function* () {
            const output = yield this.runCommand(packageName, ["global", "list"]);
            const versionMatch = new RegExp(`^${packageID} (\\d+\\.\\d+\\.\\d+)(?: at| from|$|\\-|\\+)`, "m");
            const match = versionMatch.exec(output);
            // No match = not installed.
            if (!match)
                return VersionStatus.NotInstalled;
            // If we need a specific version, check it here.
            if (requiredVersion && !utils_3.versionIsAtLeast(match[1], requiredVersion))
                return VersionStatus.UpdateRequired;
            // If we haven't checked in the last 24 hours, check if there's an update available.
            const lastChecked = this.context.getPackageLastCheckedForUpdates(packageID);
            if (!lastChecked || lastChecked <= Date.now() - constants_1.noRepeatPromptThreshold) {
                this.context.setPackageLastCheckedForUpdates(packageID, Date.now());
                try {
                    const packageJson = JSON.parse(yield fetch_1.fetch(`https://pub.dartlang.org/api/packages/${packageID}`));
                    if (!utils_3.versionIsAtLeast(match[1], packageJson.latest.version))
                        return VersionStatus.UpdateAvailable;
                }
                catch (e) {
                    // If we fail to call the API to check for a new version, then we can run
                    // with what we have.
                    log_1.logWarn(`Failed to check for new version of ${packageID}: ${e}`, utils_1.LogCategory.CommandProcesses);
                    return VersionStatus.Valid;
                }
            }
            // Otherwise, we're installed and have a new enough version.
            return VersionStatus.Valid;
        });
    }
    runCommandWithProgress(packageName, title, args) {
        return vs.window.withProgress({
            location: vs.ProgressLocation.Notification,
            title,
        }, (_) => this.runCommand(packageName, args));
    }
    runCommand(packageName, args) {
        return new Promise((resolve, reject) => {
            const pubBinPath = path.join(this.sdks.dart, utils_2.pubPath);
            const proc = processes_1.safeSpawn(undefined, pubBinPath, args);
            const stdout = [];
            const stderr = [];
            proc.stdout.on("data", (data) => stdout.push(data.toString()));
            proc.stderr.on("data", (data) => stderr.push(data.toString()));
            proc.on("close", (code) => {
                if (!code) {
                    resolve(stdout.join(""));
                }
                else {
                    reject(`${packageName} exited with code ${code}.\n\n${stdout.join("")}\n\n${stderr.join("")}`);
                }
            });
        });
    }
}
exports.PubGlobal = PubGlobal;
var VersionStatus;
(function (VersionStatus) {
    VersionStatus[VersionStatus["NotInstalled"] = 0] = "NotInstalled";
    VersionStatus[VersionStatus["UpdateRequired"] = 1] = "UpdateRequired";
    VersionStatus[VersionStatus["UpdateAvailable"] = 2] = "UpdateAvailable";
    VersionStatus[VersionStatus["Valid"] = 3] = "Valid";
})(VersionStatus = exports.VersionStatus || (exports.VersionStatus = {}));
//# sourceMappingURL=global.js.map