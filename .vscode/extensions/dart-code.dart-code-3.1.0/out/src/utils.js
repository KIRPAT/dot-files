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
const fs = require("fs");
const glob = require("glob");
const https = require("https");
const os = require("os");
const path = require("path");
const semver = require("semver");
const vscode_1 = require("vscode");
const config_1 = require("./config");
const utils_1 = require("./debug/utils");
const project_1 = require("./project");
const utils_2 = require("./sdk/utils");
const fs_1 = require("./utils/fs");
const log_1 = require("./utils/log");
exports.extensionVersion = getExtensionVersion();
exports.vsCodeVersionConstraint = getVsCodeVersionConstraint();
exports.isDevExtension = checkIsDevExtension();
exports.hasFlutterExtension = checkHasFlutterExtension();
// TODO: Make these not .dart (and add to activationEvents).
exports.DART_STAGEHAND_PROJECT_TRIGGER_FILE = "dart.sh.create";
exports.FLUTTER_STAGEHAND_PROJECT_TRIGGER_FILE = "flutter.sh.create";
exports.FLUTTER_CREATE_PROJECT_TRIGGER_FILE = "flutter.create";
exports.showLogAction = "Show Log";
exports.resolvedPromise = Promise.resolve(true);
function fsPath(uri) {
    if (!config_1.config.normalizeWindowsDriveLetters)
        return uri instanceof vscode_1.Uri ? uri.fsPath : uri; // tslint:disable-line:disallow-fspath
    // tslint:disable-next-line:disallow-fspath
    return utils_1.forceWindowsDriveLetterToUppercase(uri instanceof vscode_1.Uri ? uri.fsPath : uri);
}
exports.fsPath = fsPath;
function isFlutterWorkspaceFolder(folder) {
    return !!(folder && isDartWorkspaceFolder(folder) && isFlutterProjectFolder(fsPath(folder.uri)));
}
exports.isFlutterWorkspaceFolder = isFlutterWorkspaceFolder;
function isFlutterWebWorkspaceFolder(folder) {
    return !!(folder && isDartWorkspaceFolder(folder) && isFlutterWebProjectFolder(fsPath(folder.uri)));
}
exports.isFlutterWebWorkspaceFolder = isFlutterWebWorkspaceFolder;
function isInsideFlutterProject(uri) {
    if (!uri)
        return false;
    const projectRoot = project_1.locateBestProjectRoot(fsPath(uri));
    if (projectRoot)
        return isFlutterProjectFolder(projectRoot);
    else
        return isFlutterWorkspaceFolder(vscode_1.workspace.getWorkspaceFolder(uri));
}
exports.isInsideFlutterProject = isInsideFlutterProject;
function isInsideFlutterWebProject(uri) {
    if (!uri)
        return false;
    const projectRoot = project_1.locateBestProjectRoot(fsPath(uri));
    if (projectRoot)
        return isFlutterWebProjectFolder(projectRoot);
    else
        return isFlutterWebWorkspaceFolder(vscode_1.workspace.getWorkspaceFolder(uri));
}
exports.isInsideFlutterWebProject = isInsideFlutterWebProject;
function isFlutterProjectFolder(folder) {
    return utils_2.referencesFlutterSdk(folder);
}
exports.isFlutterProjectFolder = isFlutterProjectFolder;
function isFlutterWebProjectFolder(folder) {
    return utils_2.referencesFlutterWeb(folder);
}
exports.isFlutterWebProjectFolder = isFlutterWebProjectFolder;
function getDartWorkspaceFolders() {
    if (!vscode_1.workspace.workspaceFolders)
        return [];
    return vscode_1.workspace.workspaceFolders.filter(isDartWorkspaceFolder);
}
exports.getDartWorkspaceFolders = getDartWorkspaceFolders;
function isDartWorkspaceFolder(folder) {
    if (!folder || folder.uri.scheme !== "file")
        return false;
    // Currently we don't have good logic to know what's a Dart folder.
    // We could require a pubspec, but it's valid to just write scripts without them.
    // For now, nothing calls this that will do bad things if the folder isn't a Dart
    // project so we can review amend this in future if required.
    return true;
}
exports.isDartWorkspaceFolder = isDartWorkspaceFolder;
function resolvePaths(p) {
    if (typeof p !== "string")
        return undefined;
    if (p.startsWith("~/"))
        return path.join(os.homedir(), p.substr(2));
    if (!path.isAbsolute(p) && vscode_1.workspace.workspaceFolders && vscode_1.workspace.workspaceFolders.length)
        return path.join(fsPath(vscode_1.workspace.workspaceFolders[0].uri), p);
    return p;
}
exports.resolvePaths = resolvePaths;
/// Shortens a path to use ~ if it's inside the home directory.
function homeRelativePath(p) {
    if (!p)
        return undefined;
    const homedir = os.homedir();
    if (utils_1.isWithinPath(p, homedir))
        return path.join("~", path.relative(homedir, p));
    return p;
}
exports.homeRelativePath = homeRelativePath;
function mkDirRecursive(folder) {
    const parent = path.dirname(folder);
    if (!fs.existsSync(parent))
        mkDirRecursive(parent);
    if (!fs.existsSync(folder))
        fs.mkdirSync(folder);
}
exports.mkDirRecursive = mkDirRecursive;
function createFolderForFile(file) {
    if (!file || !path.isAbsolute(file))
        return;
    const folder = path.dirname(file);
    if (!fs.existsSync(folder))
        mkDirRecursive(folder);
    return file;
}
exports.createFolderForFile = createFolderForFile;
function toRange(document, offset, length) {
    return new vscode_1.Range(document.positionAt(offset), document.positionAt(offset + length));
}
exports.toRange = toRange;
function toPosition(location) {
    return new vscode_1.Position(location.startLine - 1, location.startColumn - 1);
}
exports.toPosition = toPosition;
// Translates an offset/length to a Range.
// NOTE: Does not wrap lines because it does not have access to a TextDocument to know
// where the line ends.
function toRangeOnLine(location) {
    const startPos = toPosition(location);
    return new vscode_1.Range(startPos, startPos.translate(0, location.length));
}
exports.toRangeOnLine = toRangeOnLine;
function getSdkVersion(sdkRoot) {
    if (!sdkRoot)
        return undefined;
    const versionFile = path.join(sdkRoot, "version");
    if (!fs.existsSync(versionFile))
        return undefined;
    try {
        return fs
            .readFileSync(versionFile, "utf8")
            .trim()
            .split("\n")
            .filter((l) => l)
            .filter((l) => l.trim().substr(0, 1) !== "#")
            .join("\n")
            .trim();
    }
    catch (e) {
        log_1.logError(e);
        return undefined;
    }
}
exports.getSdkVersion = getSdkVersion;
function isAnalyzable(document) {
    if (document.isUntitled || !fsPath(document.uri) || document.uri.scheme !== "file")
        return false;
    const analyzableLanguages = ["dart", "html"];
    const analyzableFilenames = [".analysis_options", "analysis_options.yaml"];
    return analyzableLanguages.indexOf(document.languageId) >= 0
        || analyzableFilenames.indexOf(path.basename(fsPath(document.uri))) >= 0;
}
exports.isAnalyzable = isAnalyzable;
function isAnalyzableAndInWorkspace(document) {
    return isAnalyzable(document) && isWithinWorkspace(fsPath(document.uri));
}
exports.isAnalyzableAndInWorkspace = isAnalyzableAndInWorkspace;
function isWithinWorkspace(file) {
    return !!vscode_1.workspace.getWorkspaceFolder(vscode_1.Uri.file(file));
}
exports.isWithinWorkspace = isWithinWorkspace;
function isTestFileOrFolder(path) {
    return !!path && (isTestFile(path) || isTestFolder(path));
}
exports.isTestFileOrFolder = isTestFileOrFolder;
function isTestFile(file) {
    // If we're either in a top-level test folder or the file ends with _test.dart then
    // assume it's a test. We used to check for /test/ at any level, but sometimes people have
    // non-test files named test (https://github.com/Dart-Code/Dart-Code/issues/1165).
    return !!file && isDartFile(file) && (isInsideFolderNamed(file, "test") || file.toLowerCase().endsWith("_test.dart"));
}
exports.isTestFile = isTestFile;
// Similate to isTestFile, but requires that the file is _test.dart because it will be used as
// an entry point for pub test running.
function isPubRunnableTestFile(file) {
    return !!file && isDartFile(file) && file.toLowerCase().endsWith("_test.dart");
}
exports.isPubRunnableTestFile = isPubRunnableTestFile;
function isTestFolder(path) {
    return !!path && isInsideFolderNamed(path, "test") && fs.existsSync(path) && fs.statSync(path).isDirectory();
}
exports.isTestFolder = isTestFolder;
function checkProjectSupportsPubRunTest(folder) {
    return fs_1.hasPackagesFile(folder) && fs_1.hasPubspec(folder);
}
exports.checkProjectSupportsPubRunTest = checkProjectSupportsPubRunTest;
function isDartFile(file) {
    return !!file && path.extname(file.toLowerCase()) === ".dart" && fs.existsSync(file) && fs.statSync(file).isFile();
}
exports.isDartFile = isDartFile;
function isInsideFolderNamed(file, folderName) {
    if (!file)
        return false;
    const ws = vscode_1.workspace.getWorkspaceFolder(vscode_1.Uri.file(file));
    if (!ws)
        return false;
    const relPath = path.relative(fsPath(ws.uri), file).toLowerCase();
    return relPath === folderName || relPath.startsWith(`${folderName}${path.sep}`);
}
exports.isInsideFolderNamed = isInsideFolderNamed;
function getExtensionVersion() {
    const packageJson = require("../../package.json");
    return packageJson.version;
}
function getVsCodeVersionConstraint() {
    const packageJson = require("../../package.json");
    return packageJson.engines.vscode;
}
function versionIsAtLeast(inputVersion, requiredVersion) {
    return semver.gte(inputVersion, requiredVersion);
}
exports.versionIsAtLeast = versionIsAtLeast;
function checkIsDevExtension() {
    return exports.extensionVersion.endsWith("-dev");
}
function checkHasFlutterExtension() {
    return vscode_1.extensions.getExtension(utils_1.flutterExtensionIdentifier) !== undefined;
}
function isStableSdk(sdkVersion) {
    // We'll consider empty versions as dev; stable versions will likely always
    // be shipped with valid version files.
    return !!(sdkVersion && !semver.prerelease(sdkVersion));
}
exports.isStableSdk = isStableSdk;
function getLatestSdkVersion() {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: "storage.googleapis.com",
            method: "GET",
            path: "/dart-archive/channels/stable/release/latest/VERSION",
            port: 443,
        };
        const req = https.request(options, (resp) => {
            if (!resp || !resp.statusCode || resp.statusCode < 200 || resp.statusCode > 300) {
                reject({ message: `Failed to get Dart SDK Version ${resp && resp.statusCode}: ${resp && resp.statusMessage}` });
            }
            else {
                resp.on("data", (d) => {
                    resolve(JSON.parse(d.toString()).version);
                });
            }
        });
        req.end();
    });
}
exports.getLatestSdkVersion = getLatestSdkVersion;
// Escapes a set of command line arguments so that the escaped string is suitable for passing as an argument
// to another shell command.
// Implementation is taken from https://github.com/xxorax/node-shell-escape
function escapeShell(args) {
    const ret = [];
    args.forEach((arg) => {
        if (/[^A-Za-z0-9_\/:=-]/.test(arg)) {
            arg = "'" + arg.replace(/'/g, "'\\''") + "'";
            arg = arg.replace(/^(?:'')+/g, "") // unduplicate single-quote at the beginning
                .replace(/\\'''/g, "\\'"); // remove non-escaped single-quote if there are enclosed between 2 escaped
        }
        ret.push(arg);
    });
    return ret.join(" ");
}
exports.escapeShell = escapeShell;
function openInBrowser(url) {
    // Don't use vs.env.openExternal unless
    // https://github.com/Microsoft/vscode/issues/69608
    // is fixed, as it complicates testing.
    vscode_1.commands.executeCommand("vscode.open", vscode_1.Uri.parse(url));
}
exports.openInBrowser = openInBrowser;
class WorkspaceContext {
    // TODO: Move things from Sdks to this class that aren't related to the SDKs.
    constructor(sdks, hasAnyFlutterMobileProjects, hasAnyFlutterWebProjects, hasAnyStandardDartProjects, hasProjectsInFuchsiaTree) {
        this.sdks = sdks;
        this.hasAnyFlutterMobileProjects = hasAnyFlutterMobileProjects;
        this.hasAnyFlutterWebProjects = hasAnyFlutterWebProjects;
        this.hasAnyStandardDartProjects = hasAnyStandardDartProjects;
        this.hasProjectsInFuchsiaTree = hasProjectsInFuchsiaTree;
    }
    get hasOnlyDartProjects() { return !this.hasAnyFlutterProjects && !this.hasProjectsInFuchsiaTree; }
    get hasAnyFlutterProjects() { return this.hasAnyFlutterMobileProjects || this.hasAnyFlutterWebProjects; }
    get shouldLoadFlutterExtension() { return this.hasAnyFlutterProjects; }
    /// Used only for display (for ex stats), not behaviour.
    get workspaceTypeDescription() {
        const types = [];
        // Don't re-order these, else stats won't easily combine as we could have
        // Dart, Flutter and also Flutter, Dart.
        if (this.hasAnyStandardDartProjects)
            types.push("Dart");
        if (this.hasAnyFlutterMobileProjects)
            types.push("Flutter");
        if (this.hasAnyFlutterWebProjects)
            types.push("Flutter Web");
        if (this.hasProjectsInFuchsiaTree)
            types.push("Fuchsia");
        if (types.length === 0)
            types.push("Unknown");
        return types.join(", ");
    }
}
exports.WorkspaceContext = WorkspaceContext;
function reloadExtension(prompt, buttonText, offerLogFile = false) {
    return __awaiter(this, void 0, void 0, function* () {
        const restartAction = buttonText || "Restart";
        const actions = offerLogFile ? [restartAction, exports.showLogAction] : [restartAction];
        const chosenAction = prompt && (yield vscode_1.window.showInformationMessage(prompt, ...actions));
        if (chosenAction === exports.showLogAction) {
            openExtensionLogFile();
        }
        else if (!prompt || chosenAction === restartAction) {
            vscode_1.commands.executeCommand("_dart.reloadExtension");
        }
    });
}
exports.reloadExtension = reloadExtension;
function unique(items) {
    return Array.from(new Set(items));
}
exports.unique = unique;
const shouldLogTimings = false;
const start = process.hrtime();
let last = start;
function pad(str, length) {
    while (str.length < length)
        str = "0" + str;
    return str;
}
exports.logTime = (taskFinished) => {
    if (!shouldLogTimings)
        return;
    const diff = process.hrtime(start);
    console.log(`${pad((diff[0] - last[0]).toString(), 5)}.${pad((diff[1] - last[1]).toString(), 10)} ${taskFinished ? "<== " + taskFinished : ""}`);
    last = diff;
};
// Takes a path and resolves it to the real casing as it exists on the file
// system. Copied from https://stackoverflow.com/a/33139702.
function trueCasePathSync(fsPath) {
    // Normalize the path so as to resolve . and .. components.
    // !! As of Node v4.1.1, a path starting with ../ is NOT resolved relative
    // !! to the current dir, and glob.sync() below then fails.
    // !! When in doubt, resolve with fs.realPathSync() *beforehand*.
    let fsPathNormalized = path.normalize(fsPath);
    // OSX: HFS+ stores filenames in NFD (decomposed normal form) Unicode format,
    // so we must ensure that the input path is in that format first.
    if (process.platform === "darwin")
        fsPathNormalized = fsPathNormalized.normalize("NFD");
    // !! Windows: Curiously, the drive component mustn't be part of a glob,
    // !! otherwise glob.sync() will invariably match nothing.
    // !! Thus, we remove the drive component and instead pass it in as the 'cwd'
    // !! (working dir.) property below.
    const pathRoot = path.parse(fsPathNormalized).root;
    const noDrivePath = fsPathNormalized.slice(Math.max(pathRoot.length - 1, 0));
    // Perform case-insensitive globbing (on Windows, relative to the drive /
    // network share) and return the 1st match, if any.
    // Fortunately, glob() with nocase case-corrects the input even if it is
    // a *literal* path.
    return glob.sync(noDrivePath, { nocase: true, cwd: pathRoot })[0];
}
exports.trueCasePathSync = trueCasePathSync;
function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min;
}
exports.getRandomInt = getRandomInt;
function openExtensionLogFile() {
    vscode_1.workspace.openTextDocument(log_1.getExtensionLogPath()).then(vscode_1.window.showTextDocument);
}
exports.openExtensionLogFile = openExtensionLogFile;
function notUndefined(x) {
    return x !== undefined;
}
exports.notUndefined = notUndefined;
//# sourceMappingURL=utils.js.map