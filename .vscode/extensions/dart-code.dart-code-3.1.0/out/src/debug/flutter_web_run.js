"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const flutter_run_base_1 = require("./flutter_run_base");
class FlutterWebRun extends flutter_run_base_1.FlutterRunBase {
    constructor(mode, pubBinPath, projectFolder, args, envOverrides, logFile, logger, maxLogLineLength) {
        super(mode, () => logFile, logger, maxLogLineLength, true, true);
        this.createProcess(projectFolder, pubBinPath, ["global", "run", "webdev", "daemon"].concat(args), envOverrides);
    }
}
exports.FlutterWebRun = FlutterWebRun;
//# sourceMappingURL=flutter_web_run.js.map