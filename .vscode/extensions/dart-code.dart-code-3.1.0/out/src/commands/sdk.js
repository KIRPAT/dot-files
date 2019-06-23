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
const os = require("os");
const path = require("path");
const vs = require("vscode");
const vscode_1 = require("vscode");
const config_1 = require("../config");
const dartdocs_1 = require("../dartdocs");
const utils_1 = require("../debug/utils");
const project_1 = require("../project");
const dart_hover_provider_1 = require("../providers/dart_hover_provider");
const pub_1 = require("../pub/pub");
const stagehand_1 = require("../pub/stagehand");
const flutter_docs_snippets_1 = require("../sdk/flutter_docs_snippets");
const flutter_samples_1 = require("../sdk/flutter_samples");
const sdk_manager_1 = require("../sdk/sdk_manager");
const utils_2 = require("../sdk/utils");
const util = require("../utils");
const utils_3 = require("../utils");
const array_1 = require("../utils/array");
const fs_1 = require("../utils/fs");
const log_1 = require("../utils/log");
const processes_1 = require("../utils/processes");
const channels = require("./channels");
const packageNameRegex = new RegExp("^[a-z][a-z0-9_]*$");
let runPubGetDelayTimer;
let lastPubspecSaveReason;
let numProjectCreationsInProgress = 0;
class SdkCommands {
    constructor(context, workspace, pubGlobal, flutterCapabilities, deviceManager) {
        this.workspace = workspace;
        this.pubGlobal = pubGlobal;
        this.flutterCapabilities = flutterCapabilities;
        this.deviceManager = deviceManager;
        // A map of any in-progress commands so we can terminate them if we want to run another.
        this.runningCommands = {};
        this.sdks = workspace.sdks;
        const dartSdkManager = new sdk_manager_1.DartSdkManager(this.sdks);
        context.subscriptions.push(vs.commands.registerCommand("dart.changeSdk", () => dartSdkManager.changeSdk()));
        if (workspace.hasAnyFlutterProjects) {
            const flutterSdkManager = new sdk_manager_1.FlutterSdkManager(workspace.sdks);
            context.subscriptions.push(vs.commands.registerCommand("dart.changeFlutterSdk", () => flutterSdkManager.changeSdk()));
        }
        context.subscriptions.push(vs.commands.registerCommand("dart.getPackages", (uri) => __awaiter(this, void 0, void 0, function* () {
            if (!uri || !(uri instanceof vscode_1.Uri)) {
                uri = yield this.getFolderToRunCommandIn("Select which folder to get packages for");
                // If the user cancelled, bail out (otherwise we'll prompt them again below).
                if (!uri)
                    return;
            }
            if (typeof uri === "string")
                uri = vs.Uri.file(uri);
            try {
                if (util.isInsideFlutterProject(uri))
                    return this.runFlutter(["packages", "get"], uri);
                else
                    return this.runPub(["get"], uri);
            }
            finally {
                // TODO: Move this to a reusable event.
                dart_hover_provider_1.DartHoverProvider.clearPackageMapCaches();
            }
        })));
        context.subscriptions.push(vs.commands.registerCommand("dart.upgradePackages", (uri) => __awaiter(this, void 0, void 0, function* () {
            // TODO: Doesn't this instanceof mean passing a string can't work?
            if (!uri || !(uri instanceof vscode_1.Uri))
                uri = yield this.getFolderToRunCommandIn("Select which folder to upgrade packages in");
            if (typeof uri === "string")
                uri = vs.Uri.file(uri);
            if (util.isInsideFlutterProject(uri))
                return this.runFlutter(["packages", "upgrade"], uri);
            else
                return this.runPub(["upgrade"], uri);
        })));
        // Pub commands.
        context.subscriptions.push(vs.commands.registerCommand("pub.get", (selection) => {
            return vs.commands.executeCommand("dart.getPackages", selection);
        }));
        context.subscriptions.push(vs.commands.registerCommand("pub.upgrade", (selection) => {
            return vs.commands.executeCommand("dart.upgradePackages", selection);
        }));
        // Flutter commands.
        context.subscriptions.push(vs.commands.registerCommand("flutter.packages.get", (selection) => __awaiter(this, void 0, void 0, function* () {
            if (!selection) {
                const path = yield this.getFolderToRunCommandIn(`Select the folder to run "flutter packages get" in`, selection);
                if (!path)
                    return;
                selection = vs.Uri.file(path);
            }
            // If we're working on the flutter repository, map this on to update-packages.
            if (selection && utils_3.fsPath(selection) === workspace.sdks.flutter) {
                return this.runFlutter(["update-packages"], selection);
            }
            try {
                return this.runFlutter(["packages", "get"], selection);
            }
            finally {
                // TODO: Move this to a reusable event.
                dart_hover_provider_1.DartHoverProvider.clearPackageMapCaches();
            }
        })));
        context.subscriptions.push(vs.commands.registerCommand("flutter.clean", (selection) => __awaiter(this, void 0, void 0, function* () {
            if (!selection) {
                const path = yield this.getFolderToRunCommandIn(`Select the folder to run "flutter clean" in`, selection, true);
                if (!path)
                    return;
                selection = vs.Uri.file(path);
            }
            return this.runFlutter(["clean"], selection);
        })));
        context.subscriptions.push(vs.commands.registerCommand("_flutter.screenshot.touchBar", (args) => vs.commands.executeCommand("flutter.screenshot", args)));
        context.subscriptions.push(vs.commands.registerCommand("flutter.screenshot", () => __awaiter(this, void 0, void 0, function* () {
            let shouldNotify = false;
            // If there is no path for this session, or it differs from config, use the one from config.
            if (!this.flutterScreenshotPath ||
                (config_1.config.flutterScreenshotPath && this.flutterScreenshotPath !== config_1.config.flutterScreenshotPath)) {
                this.flutterScreenshotPath = config_1.config.flutterScreenshotPath;
                shouldNotify = true;
            }
            // If path is still empty, bring up the folder selector.
            if (!this.flutterScreenshotPath) {
                const selectedFolder = yield vscode_1.window.showOpenDialog({ canSelectFolders: true, openLabel: "Set screenshots folder" });
                if (selectedFolder && selectedFolder.length > 0) {
                    // Set variable to selected path. This allows prompting the user only once.
                    this.flutterScreenshotPath = selectedFolder[0].path;
                    shouldNotify = true;
                }
                else {
                    // Do nothing if the user cancelled the folder selection.
                    return;
                }
            }
            // Ensure folder exists.
            util.mkDirRecursive(this.flutterScreenshotPath);
            const deviceId = this.deviceManager && this.deviceManager.currentDevice ? this.deviceManager.currentDevice.id : undefined;
            const args = deviceId ? ["screenshot", "-d", deviceId] : ["screenshot"];
            yield this.runFlutterInFolder(this.flutterScreenshotPath, args, "screenshot");
            if (shouldNotify) {
                const res = yield vs.window.showInformationMessage(`Screenshots will be saved to ${this.flutterScreenshotPath}`, "Show Folder");
                if (res)
                    yield vs.commands.executeCommand("revealFileInOS", vscode_1.Uri.file(this.flutterScreenshotPath));
            }
        })));
        context.subscriptions.push(vs.commands.registerCommand("flutter.packages.upgrade", (selection) => {
            return vs.commands.executeCommand("dart.upgradePackages", selection);
        }));
        context.subscriptions.push(vs.commands.registerCommand("flutter.doctor", (selection) => {
            if (!workspace.sdks.flutter) {
                utils_2.showFlutterActivationFailure("flutter.doctor");
                return;
            }
            const tempDir = path.join(os.tmpdir(), "dart-code-cmd-run");
            if (!fs.existsSync(tempDir))
                fs.mkdirSync(tempDir);
            return this.runFlutterInFolder(tempDir, ["doctor"], "flutter");
        }));
        context.subscriptions.push(vs.commands.registerCommand("flutter.upgrade", (selection) => __awaiter(this, void 0, void 0, function* () {
            if (!workspace.sdks.flutter) {
                utils_2.showFlutterActivationFailure("flutter.upgrade");
                return;
            }
            const tempDir = path.join(os.tmpdir(), "dart-code-cmd-run");
            if (!fs.existsSync(tempDir))
                fs.mkdirSync(tempDir);
            yield this.runFlutterInFolder(tempDir, ["upgrade"], "flutter");
            yield util.reloadExtension();
        })));
        context.subscriptions.push(vs.commands.registerCommand("flutter.createProject", (_) => this.createFlutterProject()));
        context.subscriptions.push(vs.commands.registerCommand("_dart.flutter.createSampleProject", (_) => this.createFlutterSampleProject()));
        // TODO: Move this to Flutter extension, and bounce it through to a hidden command here
        // (update package.json activation events too!).
        context.subscriptions.push(vs.commands.registerCommand("flutter.createWebProject", (_) => this.createFlutterWebProject()));
        context.subscriptions.push(vs.commands.registerCommand("dart.createProject", (_) => this.createDartProject()));
        context.subscriptions.push(vs.commands.registerCommand("_dart.create", (projectPath, templateName) => {
            const args = ["global", "run", "stagehand", templateName];
            return this.runPubInFolder(projectPath, args, templateName);
        }));
        context.subscriptions.push(vs.commands.registerCommand("_flutter.create", (projectPath, projectName, sampleID) => {
            const args = ["create"];
            if (projectName) {
                args.push("--project-name");
                args.push(projectName);
            }
            if (config_1.config.flutterCreateOrganization) {
                args.push("--org");
                args.push(config_1.config.flutterCreateOrganization);
            }
            if (config_1.config.flutterCreateIOSLanguage) {
                args.push("--ios-language");
                args.push(config_1.config.flutterCreateIOSLanguage);
            }
            if (config_1.config.flutterCreateAndroidLanguage) {
                args.push("--android-language");
                args.push(config_1.config.flutterCreateAndroidLanguage);
            }
            if (sampleID) {
                args.push("--sample");
                args.push(sampleID);
                args.push("--overwrite");
            }
            args.push(".");
            return this.runFlutterInFolder(projectPath, args, projectName);
        }));
        context.subscriptions.push(vs.commands.registerCommand("_flutter.clean", (projectPath, projectName) => {
            projectName = projectName || path.basename(projectPath);
            const args = ["clean"];
            return this.runFlutterInFolder(projectPath, args, projectName);
        }));
        // Hook saving pubspec to run pub.get.
        this.setupPubspecWatcher(context);
    }
    setupPubspecWatcher(context) {
        context.subscriptions.push(vs.workspace.onWillSaveTextDocument((e) => {
            if (path.basename(utils_3.fsPath(e.document.uri)).toLowerCase() === "pubspec.yaml")
                lastPubspecSaveReason = e.reason;
        }));
        const watcher = vs.workspace.createFileSystemWatcher("**/pubspec.yaml");
        context.subscriptions.push(watcher);
        watcher.onDidChange(this.handlePubspecChange, this);
        watcher.onDidCreate(this.handlePubspecChange, this);
    }
    handlePubspecChange(uri) {
        const conf = config_1.config.for(uri);
        // Don't do anything if we're disabled.
        if (!conf.runPubGetOnPubspecChanges)
            return;
        // Don't do anything if we're in the middle of creating projects, as packages
        // may  be fetched automatically.
        if (numProjectCreationsInProgress > 0) {
            log_1.log("Skipping package fetch because project creation is in progress");
            return;
        }
        // If we're in Fuchsia, we don't want to `pub get` by default but we do want to allow
        // it to be overridden, so only read the setting if it's been declared explicitly.
        // TODO: This should be handled per-project for a multi-root workspace.
        if (this.workspace.hasProjectsInFuchsiaTree && !conf.runPubGetOnPubspecChangesIsConfiguredExplicitly)
            return;
        // Cancel any existing delayed timer.
        if (runPubGetDelayTimer) {
            clearTimeout(runPubGetDelayTimer);
        }
        // If the save was triggered by one of the auto-save options, then debounce longer.
        const debounceDuration = lastPubspecSaveReason === vs.TextDocumentSaveReason.FocusOut
            || lastPubspecSaveReason === vs.TextDocumentSaveReason.AfterDelay
            ? 10000
            : 1000;
        runPubGetDelayTimer = setTimeout(() => {
            runPubGetDelayTimer = undefined;
            lastPubspecSaveReason = undefined;
            this.fetchPackagesOrPrompt(uri);
        }, debounceDuration); // TODO: Does this need to be configurable?
    }
    fetchPackagesOrPrompt(uri) {
        // We debounced so we might get here and have multiple projects to fetch for
        // for ex. when we change Git branch we might change many files at once. So
        // check how many there are, and if there are:
        //   0 - then just use Uri
        //   1 - then just do that one
        //   more than 1 - prompt to do all
        const folders = project_1.getWorkspaceProjectFolders();
        const foldersRequiringPackageGet = folders
            .map(vs.Uri.file)
            .filter((uri) => config_1.config.for(uri).promptToGetPackages)
            .filter(pub_1.isPubGetProbablyRequired);
        if (foldersRequiringPackageGet.length === 0)
            vs.commands.executeCommand("dart.getPackages", uri);
        else if (foldersRequiringPackageGet.length === 1)
            vs.commands.executeCommand("dart.getPackages", foldersRequiringPackageGet[0]);
        else
            pub_1.promptToRunPubGet(foldersRequiringPackageGet);
    }
    runCommandForWorkspace(handler, placeHolder, args, selection) {
        return __awaiter(this, void 0, void 0, function* () {
            const folderToRunCommandIn = yield this.getFolderToRunCommandIn(placeHolder, selection);
            if (!folderToRunCommandIn)
                return;
            const containingWorkspace = vs.workspace.getWorkspaceFolder(vs.Uri.file(folderToRunCommandIn));
            if (!containingWorkspace) {
                throw new Error(log_1.logError(`Failed to get workspace folder for ${folderToRunCommandIn}`));
            }
            const containingWorkspacePath = utils_3.fsPath(containingWorkspace.uri);
            // Display the relative path from the workspace root to the folder we're running, or if they're
            // the same then the folder name we're running in.
            const shortPath = path.relative(containingWorkspacePath, folderToRunCommandIn)
                || path.basename(folderToRunCommandIn);
            return handler(folderToRunCommandIn, args, shortPath);
        });
    }
    getFolderToRunCommandIn(placeHolder, selection, flutterOnly = false) {
        return __awaiter(this, void 0, void 0, function* () {
            // Attempt to find a project based on the supplied folder of active file.
            let file = selection && utils_3.fsPath(selection);
            file = file || (vs.window.activeTextEditor && utils_3.fsPath(vs.window.activeTextEditor.document.uri));
            const folder = file && project_1.locateBestProjectRoot(file);
            if (folder)
                return folder;
            // Otherwise look for what projects we have.
            const rootFolders = util.getDartWorkspaceFolders().map((wf) => utils_3.fsPath(wf.uri));
            // TODO: getChildProjects?
            const nestedProjectFolders = utils_1.flatMap(rootFolders, fs_1.getChildFolders);
            const selectableFolders = rootFolders.concat(nestedProjectFolders)
                .filter(fs_1.hasPubspec)
                .filter(flutterOnly ? util.isFlutterProjectFolder : () => true);
            if (!selectableFolders || !selectableFolders.length) {
                const projectTypes = flutterOnly ? "Flutter" : "Dart/Flutter";
                vs.window.showWarningMessage(`No ${projectTypes} projects were found.`);
                return undefined;
            }
            return this.showFolderPicker(selectableFolders, placeHolder); // TODO: What if the user didn't pick anything?
        });
    }
    showFolderPicker(folders, placeHolder) {
        return __awaiter(this, void 0, void 0, function* () {
            // No point asking the user if there's only one.
            if (folders.length === 1) {
                return folders[0];
            }
            const items = folders.map((f) => {
                const workspaceFolder = vs.workspace.getWorkspaceFolder(vscode_1.Uri.file(f));
                if (!workspaceFolder)
                    return undefined;
                const workspacePathParent = path.dirname(utils_3.fsPath(workspaceFolder.uri));
                return {
                    description: util.homeRelativePath(workspacePathParent),
                    label: path.relative(workspacePathParent, f),
                    path: f,
                };
            }).filter(util.notUndefined);
            const selectedFolder = yield vs.window.showQuickPick(items, { placeHolder });
            return selectedFolder && selectedFolder.path;
        });
    }
    runFlutter(args, selection) {
        return this.runCommandForWorkspace(this.runFlutterInFolder.bind(this), `Select the folder to run "flutter ${args.join(" ")}" in`, args, selection);
    }
    runFlutterInFolder(folder, args, shortPath) {
        if (!this.sdks.flutter)
            throw new Error("Flutter SDK not available");
        const binPath = path.join(this.sdks.flutter, utils_2.flutterPath);
        return this.runCommandInFolder(shortPath, "flutter", folder, binPath, processes_1.globalFlutterArgs.concat(args));
    }
    runPub(args, selection) {
        return this.runCommandForWorkspace(this.runPubInFolder.bind(this), `Select the folder to run "pub ${args.join(" ")}" in`, args, selection);
    }
    runPubInFolder(folder, args, shortPath) {
        if (!this.sdks.dart)
            throw new Error("Flutter SDK not available");
        const binPath = path.join(this.sdks.dart, utils_2.pubPath);
        args = args.concat(...config_1.config.for(vs.Uri.file(folder)).pubAdditionalArgs);
        return this.runCommandInFolder(shortPath, "pub", folder, binPath, args);
    }
    runCommandInFolder(shortPath, commandName, folder, binPath, args, isStartingBecauseOfTermination = false) {
        const channelName = commandName.substr(0, 1).toUpperCase() + commandName.substr(1);
        const channel = channels.createChannel(channelName);
        channel.show(true);
        // Figure out if there's already one of this command running, in which case we'll chain off the
        // end of it.
        const commandId = `${folder}|${commandName}|${args}`;
        const existingProcess = this.runningCommands[commandId];
        if (existingProcess && !existingProcess.hasStarted) {
            // We already have a queued version of this command so there's no value in queueing another
            // just bail.
            return Promise.resolve(undefined);
        }
        return vs.window.withProgress({
            cancellable: true,
            location: vscode_1.ProgressLocation.Notification,
            title: `${commandName} ${args.join(" ")}`,
        }, (progress, token) => {
            if (existingProcess) {
                progress.report({ message: "terminating previous command..." });
                existingProcess.cancel();
            }
            else {
                channel.clear();
            }
            const process = new ChainedProcess(() => {
                channel.appendLine(`[${shortPath}] ${commandName} ${args.join(" ")}`);
                progress.report({ message: "running..." });
                const proc = processes_1.safeSpawn(folder, binPath, args);
                channels.runProcessInChannel(proc, channel);
                log_1.log(`(PROC ${proc.pid}) Spawned ${binPath} ${args.join(" ")} in ${folder}`, utils_1.LogSeverity.Info, utils_1.LogCategory.CommandProcesses);
                log_1.logProcess(utils_1.LogCategory.CommandProcesses, proc);
                return proc;
            }, existingProcess);
            this.runningCommands[commandId] = process;
            token.onCancellationRequested(() => process.cancel());
            return process.completed;
        });
    }
    isFlutterWebTemplate(t) {
        return t.categories != null && t.categories.indexOf("flutter") !== -1 && t.categories.indexOf("web") !== -1;
    }
    createDartProject() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.createStagehandProject("dart.createProject", util.DART_STAGEHAND_PROJECT_TRIGGER_FILE, false, (t) => !this.isFlutterWebTemplate(t));
        });
    }
    createFlutterWebProject() {
        return __awaiter(this, void 0, void 0, function* () {
            // TODO: auto-select if only one
            // TODO: tests!
            // TODO: Should it use flutter trigger file??
            return this.createStagehandProject("flutter.createWebProject", util.FLUTTER_STAGEHAND_PROJECT_TRIGGER_FILE, true, (t) => this.isFlutterWebTemplate(t));
        });
    }
    createStagehandProject(command, triggerFilename, autoPickIfSingleItem, filter) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.sdks || !this.sdks.dart) {
                utils_2.showDartActivationFailure(command);
                return;
            }
            // Get the JSON for the available templates by calling stagehand.
            const stagehand = new stagehand_1.Stagehand(this.sdks, this.pubGlobal);
            const isAvailable = yield stagehand.promptToInstallIfRequired();
            if (!isAvailable) {
                return;
            }
            let templates;
            try {
                templates = yield stagehand.getTemplates();
            }
            catch (e) {
                vs.window.showErrorMessage(`Unable to execute Stagehand. ${e}`);
                return;
            }
            const filteredTemplate = templates.filter(filter);
            const sortedTemplates = array_1.sortBy(filteredTemplate, (s) => s.label);
            const pickItems = sortedTemplates.map((t) => ({
                description: t.name,
                detail: t.description,
                label: t.label,
                template: t,
            }));
            // Get the user to pick a template (but pick for them if there's only one
            // and autoPickIfSingleItem).
            const selectedTemplate = autoPickIfSingleItem && pickItems.length === 1
                ? pickItems[0]
                : yield vs.window.showQuickPick(pickItems, {
                    matchOnDescription: true,
                    placeHolder: "Which Dart template?",
                });
            if (!selectedTemplate)
                return;
            const name = yield vs.window.showInputBox({ prompt: "Enter a name for your new project", placeHolder: "hello_world", validateInput: this.validateDartProjectName });
            if (!name)
                return;
            // If already in a workspace, set the default folder to something nearby.
            const folders = yield vs.window.showOpenDialog({ canSelectFolders: true, openLabel: "Select a folder to create the project in" });
            if (!folders || folders.length !== 1)
                return;
            const folderUri = folders[0];
            const projectFolderUri = vscode_1.Uri.file(path.join(utils_3.fsPath(folderUri), name));
            if (fs.existsSync(utils_3.fsPath(projectFolderUri))) {
                vs.window.showErrorMessage(`A folder named ${name} already exists in ${utils_3.fsPath(folderUri)}`);
                return;
            }
            // Create the empty folder so we can open it.
            fs.mkdirSync(utils_3.fsPath(projectFolderUri));
            // Create a temp dart file to force extension to load when we open this folder.
            fs.writeFileSync(path.join(utils_3.fsPath(projectFolderUri), triggerFilename), JSON.stringify(selectedTemplate.template));
            const hasFoldersOpen = !!(vs.workspace.workspaceFolders && vs.workspace.workspaceFolders.length);
            const openInNewWindow = hasFoldersOpen;
            vs.commands.executeCommand("vscode.openFolder", projectFolderUri, openInNewWindow);
        });
    }
    createFlutterProject() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.sdks || !this.sdks.flutter) {
                utils_2.showFlutterActivationFailure("flutter.createProject");
                return;
            }
            const name = yield vs.window.showInputBox({ prompt: "Enter a name for your new project", placeHolder: "hello_world", validateInput: this.validateFlutterProjectName });
            if (!name)
                return;
            // If already in a workspace, set the default folder to something nearby.
            const folders = yield vs.window.showOpenDialog({ canSelectFolders: true, openLabel: "Select a folder to create the project in" });
            if (!folders || folders.length !== 1)
                return;
            const folderUri = folders[0];
            const projectFolderUri = vscode_1.Uri.file(path.join(utils_3.fsPath(folderUri), name));
            if (fs.existsSync(utils_3.fsPath(projectFolderUri))) {
                vs.window.showErrorMessage(`A folder named ${name} already exists in ${utils_3.fsPath(folderUri)}`);
                return;
            }
            // Create the empty folder so we can open it.
            fs.mkdirSync(utils_3.fsPath(projectFolderUri));
            // Create a temp dart file to force extension to load when we open this folder.
            fs.writeFileSync(path.join(utils_3.fsPath(projectFolderUri), util.FLUTTER_CREATE_PROJECT_TRIGGER_FILE), "");
            const hasFoldersOpen = !!(vs.workspace.workspaceFolders && vs.workspace.workspaceFolders.length);
            const openInNewWindow = hasFoldersOpen;
            vs.commands.executeCommand("vscode.openFolder", projectFolderUri, openInNewWindow);
        });
    }
    createFlutterSampleProject() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.sdks || !this.sdks.flutter) {
                utils_2.showFlutterActivationFailure("_dart.flutter.createSampleProject");
                return;
            }
            // Fetch the JSON for the available samples.
            let snippets;
            try {
                snippets = yield flutter_docs_snippets_1.getFlutterSnippets(this.sdks, this.flutterCapabilities);
            }
            catch (_a) {
                vs.window.showErrorMessage("Unable to retrieve Flutter documentation snippets");
                return;
            }
            const sortedSnippets = array_1.sortBy(snippets, (s) => s.element);
            const selectedSnippet = yield vs.window.showQuickPick(sortedSnippets.map((s) => ({
                description: `${s.package}/${s.library}`,
                detail: dartdocs_1.stripMarkdown(s.description),
                label: s.element,
                snippet: s,
            })), {
                matchOnDescription: true,
                placeHolder: "Which Flutter sample?",
            });
            if (!selectedSnippet)
                return;
            return flutter_samples_1.createFlutterSampleInTempFolder(this.flutterCapabilities, selectedSnippet.snippet.id);
        });
    }
    validateDartProjectName(input) {
        if (!packageNameRegex.test(input))
            return "Dart project names should be all lowercase, with underscores to separate words";
        const bannedNames = ["dart", "test"];
        if (bannedNames.indexOf(input) !== -1)
            return `You may not use ${input} as the name for a dart project`;
    }
    validateFlutterProjectName(input) {
        if (!packageNameRegex.test(input))
            return "Flutter project names should be all lowercase, with underscores to separate words";
        const bannedNames = ["flutter", "flutter_test", "test"];
        if (bannedNames.indexOf(input) !== -1)
            return `You may not use ${input} as the name for a flutter project`;
    }
}
exports.SdkCommands = SdkCommands;
function markProjectCreationStarted() {
    numProjectCreationsInProgress++;
}
exports.markProjectCreationStarted = markProjectCreationStarted;
function markProjectCreationEnded() {
    numProjectCreationsInProgress--;
}
exports.markProjectCreationEnded = markProjectCreationEnded;
class ChainedProcess {
    constructor(spawn, parent) {
        this.spawn = spawn;
        this.processNumber = ChainedProcess.processNumber++;
        this.completer = new utils_1.PromiseCompleter();
        this.completed = this.completer.promise;
        this.isCancelled = false;
        // We'll either start immediately, or if given a parent process only when it completes.
        if (parent) {
            parent.completed.then(() => this.start());
        }
        else {
            this.start();
        }
    }
    get hasStarted() { return this.process !== undefined; }
    start() {
        if (this.process)
            throw new Error(`${this.processNumber} Can't start an already started process!`);
        if (this.isCancelled) {
            this.completer.resolve(undefined);
            return;
        }
        this.process = this.spawn();
        this.process.on("close", (code) => this.completer.resolve(code));
    }
    cancel() {
        this.isCancelled = true;
    }
}
ChainedProcess.processNumber = 1;
//# sourceMappingURL=sdk.js.map