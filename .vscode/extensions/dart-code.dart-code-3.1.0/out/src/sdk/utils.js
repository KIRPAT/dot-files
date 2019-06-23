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
const path = require("path");
const vscode_1 = require("vscode");
const config_1 = require("../config");
const package_map_1 = require("../debug/package_map");
const utils_1 = require("../debug/utils");
const utils_2 = require("../utils");
const fs_1 = require("../utils/fs");
const log_1 = require("../utils/log");
const dartExecutableName = utils_1.isWin ? "dart.exe" : "dart";
const pubExecutableName = utils_1.isWin ? "pub.bat" : "pub";
const flutterExecutableName = utils_1.isWin ? "flutter.bat" : "flutter";
const androidStudioExecutableName = utils_1.isWin ? "studio64.exe" : "studio.sh";
exports.dartVMPath = "bin/" + dartExecutableName;
exports.pubPath = "bin/" + pubExecutableName;
exports.pubSnapshotPath = "bin/snapshots/pub.dart.snapshot";
exports.analyzerSnapshotPath = "bin/snapshots/analysis_server.dart.snapshot";
exports.flutterPath = "bin/" + flutterExecutableName;
exports.androidStudioPath = "bin/" + androidStudioExecutableName;
exports.DART_DOWNLOAD_URL = "https://dart.dev/get-dart";
exports.FLUTTER_DOWNLOAD_URL = "https://flutter.io/setup/";
function handleMissingSdks(context, analytics, workspaceContext) {
    // HACK: In order to provide a more useful message if the user was trying to fun flutter.createProject
    // we need to hook the command and force the project type to Flutter to get the correct error message.
    // This can be reverted and improved if Code adds support for providing activation context:
    //     https://github.com/Microsoft/vscode/issues/44711
    let commandToReRun;
    let attemptedToUseFlutter = false;
    // Note: This code only runs if we fail to find the Dart SDK, or fail to find the Flutter SDK
    // and are in a Flutter project. In the case where we fail to find the Flutter SDK but are not
    // in a Flutter project (eg. we ran Flutter Doctor without the extension activated) then
    // this code will not be run as the extension will activate normally, and then the command-handling
    // code for each command will detect the missing Flutter SDK and respond appropriately.
    context.subscriptions.push(vscode_1.commands.registerCommand("flutter.createProject", (_) => {
        attemptedToUseFlutter = true;
        commandToReRun = "flutter.createProject";
    }));
    context.subscriptions.push(vscode_1.commands.registerCommand("flutter.createWebProject", (_) => {
        commandToReRun = "dart.createProject";
    }));
    context.subscriptions.push(vscode_1.commands.registerCommand("dart.createProject", (_) => {
        commandToReRun = "dart.createProject";
    }));
    context.subscriptions.push(vscode_1.commands.registerCommand("_dart.flutter.createSampleProject", (_) => {
        attemptedToUseFlutter = true;
        commandToReRun = "_dart.flutter.createSampleProject";
    }));
    context.subscriptions.push(vscode_1.commands.registerCommand("flutter.doctor", (_) => {
        attemptedToUseFlutter = true;
        commandToReRun = "flutter.doctor";
    }));
    context.subscriptions.push(vscode_1.commands.registerCommand("flutter.upgrade", (_) => {
        attemptedToUseFlutter = true;
        commandToReRun = "flutter.upgrade";
    }));
    // Wait a while before showing the error to allow the code above to have run.
    setTimeout(() => {
        if (workspaceContext.hasAnyFlutterProjects || attemptedToUseFlutter) {
            if (workspaceContext.sdks.flutter && !workspaceContext.sdks.dart) {
                showFluttersDartSdkActivationFailure();
            }
            else {
                showFlutterActivationFailure(commandToReRun);
            }
        }
        else {
            showDartActivationFailure();
        }
        analytics.logSdkDetectionFailure();
    }, 500);
    return;
}
exports.handleMissingSdks = handleMissingSdks;
function showFluttersDartSdkActivationFailure() {
    utils_2.reloadExtension("Could not find Dart in your Flutter SDK. " +
        "Please run 'flutter doctor' in the terminal then reload the project once all issues are resolved.", "Reload", true);
}
exports.showFluttersDartSdkActivationFailure = showFluttersDartSdkActivationFailure;
function showFlutterActivationFailure(commandToReRun) {
    showSdkActivationFailure("Flutter", findFlutterSdk, exports.FLUTTER_DOWNLOAD_URL, (p) => config_1.config.setGlobalFlutterSdkPath(p), commandToReRun);
}
exports.showFlutterActivationFailure = showFlutterActivationFailure;
function showDartActivationFailure(commandToReRun) {
    showSdkActivationFailure("Dart", findDartSdk, exports.DART_DOWNLOAD_URL, (p) => config_1.config.setGlobalDartSdkPath(p), commandToReRun);
}
exports.showDartActivationFailure = showDartActivationFailure;
function showSdkActivationFailure(sdkType, search, downloadUrl, saveSdkPath, commandToReRun) {
    return __awaiter(this, void 0, void 0, function* () {
        const locateAction = "Locate SDK";
        const downloadAction = "Download SDK";
        let displayMessage = `Could not find a ${sdkType} SDK. ` +
            `Please ensure ${sdkType.toLowerCase()} is installed and in your PATH (you may need to restart).`;
        while (true) {
            const selectedItem = yield vscode_1.window.showErrorMessage(displayMessage, locateAction, downloadAction, utils_2.showLogAction);
            // TODO: Refactor/reformat/comment this code - it's messy and hard to understand!
            if (selectedItem === locateAction) {
                const selectedFolders = yield vscode_1.window.showOpenDialog({ canSelectFolders: true, openLabel: `Set ${sdkType} SDK folder` });
                if (selectedFolders && selectedFolders.length > 0) {
                    const matchingSdkFolder = search(selectedFolders.map(utils_2.fsPath));
                    if (matchingSdkFolder) {
                        yield saveSdkPath(matchingSdkFolder);
                        yield utils_2.reloadExtension();
                        if (commandToReRun) {
                            vscode_1.commands.executeCommand(commandToReRun);
                        }
                        break;
                    }
                    else {
                        displayMessage = `That folder does not appear to be a ${sdkType} SDK.`;
                    }
                }
            }
            else if (selectedItem === downloadAction) {
                utils_2.openInBrowser(downloadUrl);
                break;
            }
            else if (selectedItem === utils_2.showLogAction) {
                utils_2.openExtensionLogFile();
                break;
            }
            else {
                break;
            }
        }
    });
}
exports.showSdkActivationFailure = showSdkActivationFailure;
function initWorkspace() {
    log_1.log("Searching for SDKs...");
    const folders = utils_2.getDartWorkspaceFolders()
        .map((w) => utils_2.fsPath(w.uri));
    const pathOverride = process.env.DART_PATH_OVERRIDE || "";
    const normalPath = process.env.PATH || "";
    const paths = (pathOverride + path.delimiter + normalPath).split(path.delimiter).filter((p) => p);
    log_1.log("Environment PATH:");
    for (const p of paths)
        log_1.log(`    ${p}`);
    // If we are running the analyzer remotely over SSH, we only support an analyzer, since none
    // of the other SDKs will work remotely. Also, there is no need to validate the sdk path,
    // since that file will exist on a remote machine.
    if (config_1.config.analyzerSshHost) {
        return new utils_2.WorkspaceContext({
            dart: config_1.config.sdkPath,
            dartSdkIsFromFlutter: false,
            flutter: undefined,
        }, false, false, false, false);
    }
    // TODO: This has gotten very messy and needs tidying up...
    let fuchsiaRoot;
    let firstFlutterMobileProject;
    let hasAnyFlutterProject = false;
    let hasAnyFlutterMobileProject = false;
    let hasAnyFlutterWebProject = false;
    let hasAnyStandardDartProject = false;
    // Search for a Fuchsia root.
    folders.forEach((folder) => fuchsiaRoot = fuchsiaRoot || findFuchsiaRoot(folder));
    // Collect a list of all workspace folders and their immediate children, since it's common
    // to open folders that contain multiple projects.
    const childFolders = utils_1.flatMap(folders, fs_1.getChildFolders);
    const allPossibleProjectFolders = folders.concat(childFolders);
    // Scan through them all to figure out what type of projects we have.
    allPossibleProjectFolders.forEach((folder) => {
        const hasPubspecFile = fs_1.hasPubspec(folder);
        const refsFlutter = hasPubspecFile && referencesFlutterSdk(folder);
        const refsFlutterWeb = hasPubspecFile && referencesFlutterWeb(folder);
        const hasFlutterCreateProjectTriggerFile = fs.existsSync(path.join(folder, utils_2.FLUTTER_CREATE_PROJECT_TRIGGER_FILE));
        const hasFlutterStagehandProjectTriggerFile = fs.existsSync(path.join(folder, utils_2.FLUTTER_STAGEHAND_PROJECT_TRIGGER_FILE));
        // Special case to detect the Flutter repo root, so we always consider it a Flutter project and will use the local SDK
        const isFlutterRepo = fs.existsSync(path.join(folder, "bin/flutter")) && fs.existsSync(path.join(folder, "bin/cache/dart-sdk"));
        const isSomethingFlutter = refsFlutter || refsFlutterWeb || hasFlutterCreateProjectTriggerFile || hasFlutterStagehandProjectTriggerFile || isFlutterRepo;
        if (isSomethingFlutter) {
            log_1.log(`Found Flutter project at ${folder}:
			Mobile? ${refsFlutter}
			Web? ${refsFlutterWeb}
			Create Trigger? ${hasFlutterCreateProjectTriggerFile}
			Stagehand Trigger? ${hasFlutterStagehandProjectTriggerFile}
			Flutter Repo? ${isFlutterRepo}`);
        }
        // Track the first Flutter Project so we can try finding the Flutter SDK from its packages file.
        firstFlutterMobileProject = firstFlutterMobileProject || (isSomethingFlutter ? folder : undefined);
        // Set some flags we'll use to construct the workspace, so we know what things we need to light up.
        hasAnyFlutterProject = hasAnyFlutterProject || isSomethingFlutter;
        hasAnyFlutterMobileProject = hasAnyFlutterMobileProject || (refsFlutter && !refsFlutterWeb) || hasFlutterCreateProjectTriggerFile;
        hasAnyFlutterWebProject = hasAnyFlutterWebProject || refsFlutterWeb || hasFlutterStagehandProjectTriggerFile;
        hasAnyStandardDartProject = hasAnyStandardDartProject || (!isSomethingFlutter && hasPubspecFile);
    });
    if (fuchsiaRoot) {
        log_1.log(`Found Fuchsia root at ${fuchsiaRoot}`);
        if (hasAnyStandardDartProject)
            log_1.log(`Found Fuchsia project that is not vanilla Flutter`);
    }
    const flutterSdkSearchPaths = [
        config_1.config.flutterSdkPath,
        fuchsiaRoot && path.join(fuchsiaRoot, "lib/flutter"),
        fuchsiaRoot && path.join(fuchsiaRoot, "third_party/dart-pkg/git/flutter"),
        firstFlutterMobileProject,
        firstFlutterMobileProject && extractFlutterSdkPathFromPackagesFile(path.join(firstFlutterMobileProject, ".packages")),
        process.env.FLUTTER_ROOT,
    ].concat(paths).filter(utils_2.notUndefined);
    const flutterSdkPath = findFlutterSdk(flutterSdkSearchPaths);
    const dartSdkSearchPaths = [
        fuchsiaRoot && path.join(fuchsiaRoot, "topaz/tools/prebuilt-dart-sdk", `${utils_1.dartPlatformName}-x64`),
        fuchsiaRoot && path.join(fuchsiaRoot, "third_party/dart/tools/sdks/dart-sdk"),
        fuchsiaRoot && path.join(fuchsiaRoot, "third_party/dart/tools/sdks", utils_1.dartPlatformName, "dart-sdk"),
        fuchsiaRoot && path.join(fuchsiaRoot, "dart/tools/sdks", utils_1.dartPlatformName, "dart-sdk"),
        firstFlutterMobileProject && flutterSdkPath && path.join(flutterSdkPath, "bin/cache/dart-sdk"),
        config_1.config.sdkPath,
    ].concat(paths)
        // The above array only has the Flutter SDK	in the search path if we KNOW it's a flutter
        // project, however this doesn't cover the activating-to-run-flutter.createProject so
        // we need to always look in the flutter SDK, but only AFTER the users PATH so that
        // we don't prioritise it over any real Dart versions.
        .concat([flutterSdkPath && path.join(flutterSdkPath, "bin/cache/dart-sdk")])
        .filter(utils_2.notUndefined);
    const dartSdkPath = findDartSdk(dartSdkSearchPaths);
    return new utils_2.WorkspaceContext({
        dart: dartSdkPath,
        dartSdkIsFromFlutter: !!dartSdkPath && isDartSdkFromFlutter(dartSdkPath),
        dartVersion: utils_2.getSdkVersion(dartSdkPath),
        flutter: flutterSdkPath,
        flutterVersion: utils_2.getSdkVersion(flutterSdkPath),
    }, hasAnyFlutterMobileProject, hasAnyFlutterWebProject, hasAnyStandardDartProject, !!fuchsiaRoot && hasAnyStandardDartProject);
}
exports.initWorkspace = initWorkspace;
function referencesFlutterSdk(folder) {
    if (folder && fs_1.hasPubspec(folder)) {
        const regex = new RegExp("sdk\\s*:\\s*flutter", "i");
        return regex.test(fs.readFileSync(path.join(folder, "pubspec.yaml")).toString());
    }
    return false;
}
exports.referencesFlutterSdk = referencesFlutterSdk;
function referencesFlutterWeb(folder) {
    if (folder && fs_1.hasPubspec(folder)) {
        const regex = new RegExp("\\s*flutter_web\\s*:", "i");
        return regex.test(fs.readFileSync(path.join(folder, "pubspec.yaml")).toString());
    }
    return false;
}
exports.referencesFlutterWeb = referencesFlutterWeb;
function referencesBuildRunner(folder) {
    if (folder && fs_1.hasPubspec(folder)) {
        const regex = new RegExp("build_runner\\s*:", "i");
        return regex.test(fs.readFileSync(path.join(folder, "pubspec.yaml")).toString());
    }
    return false;
}
exports.referencesBuildRunner = referencesBuildRunner;
function extractFlutterSdkPathFromPackagesFile(file) {
    if (!fs.existsSync(file))
        return undefined;
    let packagePath = new package_map_1.PackageMap(file).getPackagePath("flutter");
    if (!packagePath)
        return undefined;
    // Set windows slashes to / while manipulating.
    if (utils_1.isWin) {
        packagePath = packagePath.replace(/\\/g, "/");
    }
    // Trim suffix we don't need.
    const pathSuffix = "/packages/flutter/lib/";
    if (packagePath.endsWith(pathSuffix)) {
        packagePath = packagePath.substr(0, packagePath.length - pathSuffix.length);
    }
    // Make sure ends with a slash.
    if (!packagePath.endsWith("/"))
        packagePath = packagePath + "/";
    // Append bin if required.
    if (!packagePath.endsWith("/bin/")) {
        packagePath = packagePath + "bin/";
    }
    // Set windows paths back.
    if (utils_1.isWin) {
        packagePath = packagePath.replace(/\//g, "\\");
        if (packagePath[0] === "\\")
            packagePath = packagePath.substring(1);
    }
    return packagePath;
}
function findFuchsiaRoot(folder) {
    if (folder) {
        // Walk up the directories from the workspace root, and see if there
        // exists a directory which has ".jiri_root" directory as a child.
        // If such directory is found, that is our fuchsia root.
        let dir = folder;
        while (dir) {
            try {
                if (fs.statSync(path.join(dir, ".jiri_root")).isDirectory()) {
                    return dir;
                }
            }
            catch (_a) { }
            const parentDir = path.dirname(dir);
            if (dir === parentDir)
                break;
            dir = parentDir;
        }
    }
    return undefined;
}
function findDartSdk(folders) {
    return searchPaths(folders, dartExecutableName, (p) => hasExecutable(p, exports.dartVMPath) && exports.hasDartAnalysisServer(p));
}
function findFlutterSdk(folders) {
    return searchPaths(folders, flutterExecutableName, (p) => hasExecutable(p, exports.flutterPath));
}
function hasExecutable(folder, executablePath) {
    const fullPath = path.join(folder, executablePath);
    return fs.existsSync(fullPath) && fs.statSync(fullPath).isFile();
}
exports.hasDartAnalysisServer = (folder) => fs.existsSync(path.join(folder, exports.analyzerSnapshotPath));
function searchPaths(paths, executableFilename, postFilter) {
    log_1.log(`Searching for ${executableFilename}`);
    let sdkPaths = paths
        .filter((p) => p)
        .map(utils_2.resolvePaths)
        .filter(utils_2.notUndefined);
    // Any that don't end with bin, add it on (as an extra path) since some of our
    // paths may come from places that don't already include it (for ex. the
    // user config.sdkPath).
    const isBinFolder = (f) => ["bin", "sbin"].indexOf(path.basename(f)) !== -1;
    sdkPaths = utils_1.flatMap(sdkPaths, (p) => isBinFolder(p) ? [p] : [p, path.join(p, "bin")]);
    // Add on the executable name, as we need to do filtering based on the resolve path.
    // TODO: Make the list unique, but preserve the order of the first occurrences. We currently
    // have uniq() and unique(), so also consolidate them.
    log_1.log(`    Looking for ${executableFilename} in:`);
    for (const p of sdkPaths)
        log_1.log(`        ${p}`);
    // Restrict only to the paths that have the executable.
    sdkPaths = sdkPaths.filter((p) => fs.existsSync(path.join(p, executableFilename)));
    log_1.log(`    Found at:`);
    for (const p of sdkPaths)
        log_1.log(`        ${p}`);
    // Convert all the paths to their resolved locations.
    sdkPaths = sdkPaths.map((p) => {
        const fullPath = path.join(p, executableFilename);
        // In order to handle symlinks on the binary (not folder), we need to add the executableName before calling realpath.
        const realExecutableLocation = p && fs.realpathSync(fullPath);
        if (realExecutableLocation.toLowerCase() !== fullPath.toLowerCase())
            log_1.log(`Following symlink: ${fullPath} ==> ${realExecutableLocation}`);
        // Then we need to take the executable name and /bin back off
        return path.dirname(path.dirname(realExecutableLocation));
    });
    // Now apply any post-filters.
    log_1.log("    Candidate paths to be post-filtered:");
    for (const p of sdkPaths)
        log_1.log(`        ${p}`);
    const sdkPath = sdkPaths.find(postFilter || ((_) => true));
    if (sdkPath)
        log_1.log(`    Found at ${sdkPath}`);
    log_1.log(`    Returning SDK path ${sdkPath} for ${executableFilename}`);
    return sdkPath;
}
exports.searchPaths = searchPaths;
function isDartSdkFromFlutter(dartSdkPath) {
    const possibleFlutterSdkPath = path.join(path.dirname(path.dirname(path.dirname(dartSdkPath))), "bin");
    return fs.existsSync(path.join(possibleFlutterSdkPath, flutterExecutableName));
}
exports.isDartSdkFromFlutter = isDartSdkFromFlutter;
//# sourceMappingURL=utils.js.map