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
const log_1 = require("../utils/log");
const processes_1 = require("../utils/processes");
const packageName = "Stagehand";
const packageID = "stagehand";
class Stagehand {
    constructor(sdks, pubGlobal) {
        this.sdks = sdks;
        this.pubGlobal = pubGlobal;
    }
    promptToInstallIfRequired() {
        return this.pubGlobal.promptToInstallIfRequired(packageName, packageID, constants_1.stagehandInstallationInstructionsUrl, "3.3.0");
    }
    getTemplates() {
        return __awaiter(this, void 0, void 0, function* () {
            const json = yield this.getTemplateJson();
            return JSON.parse(json);
        });
    }
    getTemplateJson() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.runCommandWithProgress("Fetching Stagehand templates...", ["global", "run", "stagehand", "--machine"]);
        });
    }
    runCommandWithProgress(title, args) {
        return vs.window.withProgress({
            location: vs.ProgressLocation.Notification,
            title,
        }, (_) => this.runCommand(args));
    }
    runCommand(args) {
        return new Promise((resolve, reject) => {
            const pubBinPath = path.join(this.sdks.dart, utils_2.pubPath);
            const proc = processes_1.safeSpawn(undefined, pubBinPath, args);
            log_1.logProcess(utils_1.LogCategory.CommandProcesses, proc);
            const stdout = [];
            const stderr = [];
            proc.stdout.on("data", (data) => stdout.push(data.toString()));
            proc.stderr.on("data", (data) => stderr.push(data.toString()));
            proc.on("close", (code) => {
                if (!code) {
                    resolve(stdout.join(""));
                }
                else {
                    reject(`Stagehand exited with code ${code}.\n\n${stdout.join("")}\n\n${stderr.join("")}`);
                }
            });
        });
    }
}
exports.Stagehand = Stagehand;
//# sourceMappingURL=stagehand.js.map