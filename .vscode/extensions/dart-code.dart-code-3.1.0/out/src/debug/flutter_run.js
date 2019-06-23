"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const processes_1 = require("../utils/processes");
const flutter_run_base_1 = require("./flutter_run_base");
class FlutterRun extends flutter_run_base_1.FlutterRunBase {
    constructor(mode, flutterBinPath, projectFolder, args, envOverrides, logFile, logger, maxLogLineLength) {
        super(mode, () => logFile, logger, maxLogLineLength, true, true);
        const command = mode === flutter_run_base_1.RunMode.Attach ? "attach" : "run";
        this.createProcess(projectFolder, flutterBinPath, processes_1.globalFlutterArgs.concat([command, "--machine"]).concat(args), envOverrides);
    }
}
exports.FlutterRun = FlutterRun;
//# sourceMappingURL=flutter_run.js.map