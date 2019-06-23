"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const child_process = require("child_process");
const utils_1 = require("../debug/utils");
const log_1 = require("./log");
const misc_1 = require("./misc");
// Environment used when spawning Dart and Flutter processes.
exports.toolEnv = {};
exports.globalFlutterArgs = [];
function setupToolEnv(envOverrides) {
    exports.toolEnv = Object.create(process.env);
    exports.globalFlutterArgs = [];
    exports.toolEnv.FLUTTER_HOST = "VSCode";
    exports.toolEnv.PUB_ENVIRONMENT = (exports.toolEnv.PUB_ENVIRONMENT ? `${exports.toolEnv.PUB_ENVIRONMENT}:` : "") + "vscode.dart-code";
    if (process.env.DART_CODE_IS_TEST_RUN) {
        exports.toolEnv.PUB_ENVIRONMENT += ".test.bot";
        exports.globalFlutterArgs.push("--suppress-analytics");
    }
    // Add on any overrides.
    if (envOverrides)
        exports.toolEnv = Object.assign(Object.create(exports.toolEnv), envOverrides);
}
exports.setupToolEnv = setupToolEnv;
// TODO: Should we move this to extension activate?
setupToolEnv();
function safeSpawn(workingDirectory, binPath, args, envOverrides) {
    // Spawning processes on Windows with funny symbols in the path requires quoting. However if you quote an
    // executable with a space in its path and an argument also has a space, you have to then quote all of the
    // arguments too!\
    // https://github.com/nodejs/node/issues/7367
    const customEnv = envOverrides
        ? Object.assign(Object.create(exports.toolEnv), envOverrides) // Do it this way so we can override toolEnv if required.
        : exports.toolEnv;
    return child_process.spawn(`"${binPath}"`, args.map((a) => `"${a}"`), { cwd: workingDirectory, env: customEnv, shell: true });
}
exports.safeSpawn = safeSpawn;
/// Runs a process and returns the exit code, stdout, stderr. Always resolves even for non-zero exit codes.
function runProcess(workingDirectory, binPath, args, envOverrides) {
    return new Promise((resolve) => {
        const proc = safeSpawn(workingDirectory, binPath, args, envOverrides);
        log_1.logProcess(utils_1.LogCategory.CommandProcesses, proc);
        const out = [];
        const err = [];
        proc.stdout.on("data", (data) => out.push(data.toString()));
        proc.stderr.on("data", (data) => err.push(data.toString()));
        proc.on("exit", (code) => {
            resolve(new RunProcessResult(misc_1.nullToUndefined(code), out.join(""), err.join("")));
        });
    });
}
exports.runProcess = runProcess;
class RunProcessResult {
    constructor(exitCode, stdout, stderr) {
        this.exitCode = exitCode;
        this.stdout = stdout;
        this.stderr = stderr;
    }
}
exports.RunProcessResult = RunProcessResult;
//# sourceMappingURL=processes.js.map