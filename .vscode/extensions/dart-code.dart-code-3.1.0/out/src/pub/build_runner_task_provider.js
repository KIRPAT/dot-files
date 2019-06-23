"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const vs = require("vscode");
const config_1 = require("../config");
const utils_1 = require("../sdk/utils");
const util = require("../utils");
const utils_2 = require("../utils");
const processes_1 = require("../utils/processes");
class PubBuildRunnerTaskProvider {
    constructor(sdks) {
        this.sdks = sdks;
    }
    provideTasks(token) {
        const dartProjects = util.getDartWorkspaceFolders();
        const tasks = [];
        dartProjects.forEach((folder) => {
            if (utils_1.referencesBuildRunner(utils_2.fsPath(folder.uri))) {
                tasks.push(this.createBuildRunnerCommandBackgroundTask(folder, "watch", vs.TaskGroup.Build));
                tasks.push(this.createBuildRunnerCommandBackgroundTask(folder, "build", vs.TaskGroup.Build));
                tasks.push(this.createBuildRunnerCommandBackgroundTask(folder, "serve", vs.TaskGroup.Build));
                tasks.push(this.createBuildRunnerCommandBackgroundTask(folder, "test", vs.TaskGroup.Test));
            }
        });
        return tasks;
    }
    createBuildRunnerCommandBackgroundTask(folder, subCommand, group) {
        const isFlutter = util.isFlutterWorkspaceFolder(folder) && this.sdks.flutter;
        const type = isFlutter ? "flutter" : "pub";
        const program = isFlutter ? path.join(this.sdks.flutter, utils_1.flutterPath) : path.join(this.sdks.dart, utils_1.pubPath);
        const args = isFlutter ? ["packages", "pub", "run", "build_runner", subCommand] : ["run", "build_runner", subCommand];
        if (config_1.config.buildRunnerAdditionalArgs) {
            args.push(...config_1.config.buildRunnerAdditionalArgs);
        }
        const task = new vs.Task({
            command: subCommand,
            type,
        }, folder, `build_runner ${subCommand}`, type, new vs.ProcessExecution(program, args, { cwd: utils_2.fsPath(folder.uri), env: processes_1.toolEnv }), "$dart-pub-build_runner");
        task.group = group;
        task.isBackground = true;
        task.name = `build_runner ${subCommand}`;
        return task;
    }
    resolveTask(task, token) {
        return undefined;
    }
}
exports.PubBuildRunnerTaskProvider = PubBuildRunnerTaskProvider;
//# sourceMappingURL=build_runner_task_provider.js.map