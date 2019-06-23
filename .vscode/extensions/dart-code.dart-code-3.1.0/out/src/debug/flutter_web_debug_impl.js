"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const flutter_debug_impl_1 = require("./flutter_debug_impl");
const flutter_run_base_1 = require("./flutter_run_base");
const flutter_web_run_1 = require("./flutter_web_run");
const utils_1 = require("./utils");
class FlutterWebDebugSession extends flutter_debug_impl_1.FlutterDebugSession {
    constructor() {
        super();
        // There is no observatory web app, so we shouldn't send an ObservatoryURI
        // back to the editor, since that enables "Dart: Open Observatory" and friends.
        this.supportsObservatory = false;
        this.logCategory = utils_1.LogCategory.WebDaemon;
    }
    spawnRunDaemon(isAttach, args, logger) {
        let appArgs = [];
        // TODO: Is any of this relevant?
        // if (!isAttach) {
        // 	if (args.flutterMode === "profile") {
        // 		appArgs.push("--profile");
        // 	} else if (args.flutterMode === "release") {
        // 		appArgs.push("--release");
        // 	} else {
        // 		// Debug mode
        // 		if (this.flutterTrackWidgetCreation) {
        // 			appArgs.push("--track-widget-creation");
        // 		}
        // 	}
        // 	if (this.shouldConnectDebugger) {
        // 		appArgs.push("--start-paused");
        // 	}
        // }
        if (args.args) {
            appArgs = appArgs.concat(args.args);
        }
        // TODO: Attach?
        return new flutter_web_run_1.FlutterWebRun(isAttach ? flutter_run_base_1.RunMode.Attach : flutter_run_base_1.RunMode.Run, args.pubPath, args.cwd, appArgs, args.env, args.webDaemonLogFile, logger, this.maxLogLineLength);
    }
}
exports.FlutterWebDebugSession = FlutterWebDebugSession;
//# sourceMappingURL=flutter_web_debug_impl.js.map