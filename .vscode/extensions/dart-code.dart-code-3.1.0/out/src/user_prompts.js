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
const sdk_1 = require("./commands/sdk");
const constants_1 = require("./constants");
const utils_1 = require("./debug/utils");
const utils_2 = require("./utils");
const log_1 = require("./utils/log");
const promptPrefix = "hasPrompted.";
const installFlutterExtensionPromptKey = "install_flutter_extension_3";
function showUserPrompts(context, workspaceContext) {
    handleNewProjects(context);
    function shouldSuppress(key) {
        const stateKey = `${promptPrefix}${key}`;
        return context.get(stateKey) === true;
    }
    /// Shows a prompt and stores the return value. Prompt should return `true` to mark
    /// this extension as seen-forever and it won't be shown again. Returning anything
    /// else will allow the prompt to appear again next time.
    function showPrompt(key, prompt) {
        const stateKey = `${promptPrefix}${key}`;
        prompt().then((res) => context.update(stateKey, res), error);
    }
    if (workspaceContext.hasAnyFlutterProjects && !utils_2.hasFlutterExtension && !shouldSuppress(installFlutterExtensionPromptKey))
        return showPrompt(installFlutterExtensionPromptKey, promptToInstallFlutterExtension);
    const lastSeenVersionNotification = context.lastSeenVersion;
    if (!lastSeenVersionNotification) {
        // If we've not got a stored version, this is the first install, so just
        // stash the current version and don't show anything.
        context.lastSeenVersion = utils_2.extensionVersion;
    }
    else if (!utils_2.isDevExtension && lastSeenVersionNotification !== utils_2.extensionVersion) {
        const versionLink = utils_2.extensionVersion.split(".").slice(0, 2).join(".").replace(".", "-");
        promptToShowReleaseNotes(utils_2.extensionVersion, versionLink).then(() => context.lastSeenVersion = utils_2.extensionVersion);
        return;
    }
    if (workspaceContext.hasAnyFlutterProjects) {
        if (showFlutter2019Q2SurveyNotificationIfAppropriate(context, Date.now()))
            return; // Bail if we showed it, so we won't show any other notifications.
    }
    // (though, there are no other notifications right now...)
}
exports.showUserPrompts = showUserPrompts;
// Mon May 13 2019 20:00:00 GMT+0100 (BST) = noon PDT on 13th May
exports.surveyStart = Date.UTC(2019, 4 /* Month is 0-based!! */, 13, 19, 0);
// Mon May 27 2019 08:00:00 GMT+0100 (BST) = midnight PDT between 26th/27th may.
exports.surveyEnd = Date.UTC(2019, 4 /* Month is 0-based!! */, 27, 7, 0);
/// Shows Survey notification if appropriate. Returns whether a notification was shown
/// (not whether it was clicked/opened).
function showFlutter2019Q2SurveyNotificationIfAppropriate(context, now) {
    if (now <= exports.surveyStart || now >= exports.surveyEnd)
        return false;
    const lastShown = context.flutterSurvey2019Q2NotificationLastShown;
    const doNotShow = context.flutterSurvey2019Q2NotificationDoNotShow;
    // Don't show this notification if user previously said not to.
    if (doNotShow)
        return false;
    // Don't show this notification if we've shown it in the last 40 hours.
    if (lastShown && now - lastShown < constants_1.longRepeatPromptThreshold)
        return false;
    // Work out the URL and prompt to show.
    let clientID;
    try {
        const flutterSettingsFolder = utils_1.isWin ?
            process.env.APPDATA || os.homedir()
            : os.homedir();
        const flutterSettingsPath = path.join(flutterSettingsFolder, ".flutter");
        if (fs.existsSync(flutterSettingsPath)) {
            const json = fs.readFileSync(flutterSettingsPath).toString();
            const settings = JSON.parse(json);
            if (settings.enabled) {
                clientID = settings.clientId;
            }
        }
    }
    catch (_a) {
        log_1.logWarn("Unable to read Flutter settings for preparing survey link");
    }
    const prompt = clientID ? constants_1.flutterSurvey2019Q2PromptWithAnalytics : constants_1.flutterSurvey2019Q2PromptWithoutAnalytics;
    const surveyUrl = "https://google.qualtrics.com/jfe/form/SV_3W3aVD2y9CoAe6V?Source=VSCode"
        + (clientID ? `&ClientID=${encodeURIComponent(clientID)}` : "");
    // Mark the last time we've shown it (now) so we can avoid showing again for
    // 40 hours.
    context.flutterSurvey2019Q2NotificationLastShown = Date.now();
    // Prompt to show and handle response.
    vs.window.showInformationMessage(prompt, constants_1.takeSurveyAction, constants_1.doNotAskAgainAction).then((choice) => {
        if (choice === constants_1.doNotAskAgainAction) {
            context.flutterSurvey2019Q2NotificationDoNotShow = true;
        }
        else if (choice === constants_1.takeSurveyAction) {
            // Mark as do-not-show-again if they answer it, since it seems silly
            // to show them again if they already completed it.
            context.flutterSurvey2019Q2NotificationDoNotShow = true;
            utils_2.openInBrowser(surveyUrl);
        }
    });
    // Return true because we showed the notification and don't want to cause more
    // than one notification per activation.
    return true;
}
exports.showFlutter2019Q2SurveyNotificationIfAppropriate = showFlutter2019Q2SurveyNotificationIfAppropriate;
function showDevToolsNotificationIfAppropriate(context) {
    return __awaiter(this, void 0, void 0, function* () {
        const lastShown = context.devToolsNotificationLastShown;
        const timesShown = context.devToolsNotificationsShown || 0;
        const doNotShow = context.devToolsNotificationDoNotShow;
        // Don't show this notification more than 10 times or if user said not to.
        if (doNotShow || timesShown >= 10)
            return false;
        // Don't show this notification if we've shown it in the last 20 hours.
        if (lastShown && Date.now() - lastShown < constants_1.noRepeatPromptThreshold)
            return false;
        context.devToolsNotificationsShown = timesShown + 1;
        context.devToolsNotificationLastShown = Date.now();
        const choice = yield vs.window.showInformationMessage(constants_1.wantToTryDevToolsPrompt, constants_1.openDevToolsAction, constants_1.noThanksAction, constants_1.doNotAskAgainAction);
        if (choice === constants_1.doNotAskAgainAction) {
            context.devToolsNotificationDoNotShow = true;
            return false;
        }
        else if (choice === constants_1.openDevToolsAction) {
            vs.commands.executeCommand("dart.openDevTools");
            return true;
        }
        else {
            // No thanks.
            return false;
        }
    });
}
exports.showDevToolsNotificationIfAppropriate = showDevToolsNotificationIfAppropriate;
function promptToInstallFlutterExtension() {
    return __awaiter(this, void 0, void 0, function* () {
        const installExtension = "Install Flutter Extension";
        const res = yield vs.window.showInformationMessage("The Flutter extension is required to work with Flutter projects.", installExtension);
        if (res === installExtension) {
            yield vs.window.withProgress({ location: vs.ProgressLocation.Notification }, (progress) => {
                progress.report({ message: "Installing Flutter extension" });
                return new Promise((resolve) => {
                    vs.extensions.onDidChange((e) => resolve());
                    vs.commands.executeCommand("workbench.extensions.installExtension", utils_1.flutterExtensionIdentifier);
                });
            });
            utils_2.reloadExtension();
        }
        return false;
    });
}
function promptToShowReleaseNotes(versionDisplay, versionLink) {
    return __awaiter(this, void 0, void 0, function* () {
        const res = yield vs.window.showInformationMessage(`Dart Code has been updated to v${versionDisplay}`, `Show Release Notes`);
        if (res) {
            utils_2.openInBrowser(`https://dartcode.org/releases/v${versionLink}/`);
        }
        return true; // Always mark this as done; we don't want to prompt the user multiple times.
    });
}
function error(err) {
    vs.window.showErrorMessage(err.message);
}
function handleNewProjects(context) {
    utils_2.getDartWorkspaceFolders().forEach((wf) => {
        handleStagehandTrigger(wf, utils_2.DART_STAGEHAND_PROJECT_TRIGGER_FILE);
        handleStagehandTrigger(wf, utils_2.FLUTTER_STAGEHAND_PROJECT_TRIGGER_FILE);
        handleFlutterCreateTrigger(wf);
    });
}
function handleStagehandTrigger(wf, triggerFilename) {
    return __awaiter(this, void 0, void 0, function* () {
        const triggerFile = path.join(utils_2.fsPath(wf.uri), triggerFilename);
        if (fs.existsSync(triggerFile)) {
            const templateJson = fs.readFileSync(triggerFile).toString().trim();
            let template;
            try {
                template = JSON.parse(templateJson);
            }
            catch (e) {
                vs.window.showErrorMessage("Failed to run Stagehand to create project");
                return;
            }
            fs.unlinkSync(triggerFile);
            log_1.log(`Creating Dart project for ${utils_2.fsPath(wf.uri)}`, utils_1.LogSeverity.Info, utils_1.LogCategory.CommandProcesses);
            try {
                sdk_1.markProjectCreationStarted();
                const success = yield createDartProject(utils_2.fsPath(wf.uri), template.name);
                if (success) {
                    log_1.log(`Fetching packages for newly-created project`, utils_1.LogSeverity.Info, utils_1.LogCategory.CommandProcesses);
                    yield vs.commands.executeCommand("dart.getPackages", wf.uri);
                    handleDartWelcome(wf, template);
                    log_1.log(`Finished creating new project!`, utils_1.LogSeverity.Info, utils_1.LogCategory.CommandProcesses);
                }
                else {
                    log_1.log(`Failed to create new project`, utils_1.LogSeverity.Info, utils_1.LogCategory.CommandProcesses);
                }
            }
            finally {
                sdk_1.markProjectCreationEnded();
            }
        }
    });
}
function handleFlutterCreateTrigger(wf) {
    return __awaiter(this, void 0, void 0, function* () {
        const flutterTriggerFile = path.join(utils_2.fsPath(wf.uri), utils_2.FLUTTER_CREATE_PROJECT_TRIGGER_FILE);
        if (fs.existsSync(flutterTriggerFile)) {
            let sampleID = fs.readFileSync(flutterTriggerFile).toString().trim();
            sampleID = sampleID ? sampleID : undefined;
            fs.unlinkSync(flutterTriggerFile);
            try {
                sdk_1.markProjectCreationStarted();
                const success = yield createFlutterProject(utils_2.fsPath(wf.uri), sampleID);
                if (success)
                    handleFlutterWelcome(wf, sampleID);
            }
            finally {
                sdk_1.markProjectCreationEnded();
            }
        }
    });
}
function createDartProject(projectPath, templateName) {
    return __awaiter(this, void 0, void 0, function* () {
        const code = yield vs.commands.executeCommand("_dart.create", projectPath, templateName);
        return code === 0;
    });
}
function createFlutterProject(projectPath, sampleID) {
    return __awaiter(this, void 0, void 0, function* () {
        const projectName = sampleID ? "sample" : undefined;
        const code = yield vs.commands.executeCommand("_flutter.create", projectPath, projectName, sampleID);
        return code === 0;
    });
}
function handleFlutterWelcome(workspaceFolder, sampleID) {
    const entryFile = path.join(utils_2.fsPath(workspaceFolder.uri), "lib/main.dart");
    openFile(entryFile);
    if (sampleID)
        vs.window.showInformationMessage(`${sampleID} sample ready! Connect a device and press F5 to run.`);
    else
        vs.window.showInformationMessage("Your Flutter project is ready! Connect a device and press F5 to start running.");
}
function handleDartWelcome(workspaceFolder, template) {
    const workspacePath = utils_2.fsPath(workspaceFolder.uri);
    const projectName = path.basename(workspacePath);
    const entryFile = path.join(workspacePath, template.entrypoint.replace("__projectName__", projectName));
    openFile(entryFile);
    vs.window.showInformationMessage(`${template.label} project ready!`);
}
/// Opens a file, but does it in a setTimeout to work around VS Code reveal bug
/// https://github.com/Microsoft/vscode/issues/71588#event-2252962973
function openFile(entryFile) {
    if (!fs.existsSync(entryFile))
        return;
    // TODO: Remove this setTimeout when it's no longer required.
    setTimeout(() => {
        vs.commands.executeCommand("vscode.open", vs.Uri.file(entryFile));
    }, 100);
}
//# sourceMappingURL=user_prompts.js.map