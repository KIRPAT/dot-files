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
const vscode_1 = require("vscode");
const utils_1 = require("./utils");
const misc_1 = require("./utils/misc");
const processes_1 = require("./utils/processes");
class Config {
    constructor() {
        vscode_1.workspace.onDidChangeConfiguration((e) => this.reloadConfig());
        this.config = vscode_1.workspace.getConfiguration("dart");
        processes_1.setupToolEnv(this.env);
    }
    reloadConfig() {
        this.config = vscode_1.workspace.getConfiguration("dart");
        processes_1.setupToolEnv(this.env);
    }
    getConfig(key, defaultValue) {
        return misc_1.nullToUndefined(this.config.get(key, defaultValue));
    }
    setConfig(key, value, target) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.config.update(key, value, target);
        });
    }
    get allowAnalytics() { return this.getConfig("allowAnalytics", true); }
    get analysisServerFolding() { return this.getConfig("analysisServerFolding", true); }
    get analyzeAngularTemplates() { return this.getConfig("analyzeAngularTemplates", true); }
    get analyzerAdditionalArgs() { return this.getConfig("analyzerAdditionalArgs", []); }
    get analyzerDiagnosticsPort() { return this.getConfig("analyzerDiagnosticsPort", null); }
    get analyzerInstrumentationLogFile() { return utils_1.createFolderForFile(utils_1.resolvePaths(this.getConfig("analyzerInstrumentationLogFile", null))); }
    get analyzerLogFile() { return utils_1.createFolderForFile(utils_1.resolvePaths(this.getConfig("analyzerLogFile", null))); }
    get analyzerObservatoryPort() { return this.getConfig("analyzerObservatoryPort", null); }
    get analyzerPath() { return utils_1.resolvePaths(this.getConfig("analyzerPath", null)); }
    get analyzerSshHost() { return this.getConfig("analyzerSshHost", null); }
    get autoImportCompletions() { return this.getConfig("autoImportCompletions", true); }
    get buildRunnerAdditionalArgs() { return this.getConfig("buildRunnerAdditionalArgs", []); }
    get checkForSdkUpdates() { return this.getConfig("checkForSdkUpdates", true); }
    get closingLabels() { return this.getConfig("closingLabels", true); }
    get devToolsLogFile() { return utils_1.createFolderForFile(utils_1.resolvePaths(this.getConfig("devToolsLogFile", null))); }
    get devToolsPort() { return this.getConfig("devToolsPort", null); }
    get devToolsTheme() { return this.getConfig("devToolsTheme", "dark"); }
    get enableSdkFormatter() { return this.getConfig("enableSdkFormatter", true); }
    get env() { return this.getConfig("env", {}); }
    get extensionLogFile() { return utils_1.createFolderForFile(utils_1.resolvePaths(this.getConfig("extensionLogFile", null))); }
    get flutterAdbConnectOnChromeOs() { return this.getConfig("flutterAdbConnectOnChromeOs", false); }
    get flutterCreateAndroidLanguage() { return this.getConfig("flutterCreateAndroidLanguage", "java"); }
    get flutterCreateIOSLanguage() { return this.getConfig("flutterCreateIOSLanguage", "objc"); }
    get flutterCreateOrganization() { return this.getConfig("flutterCreateOrganization", null); }
    get flutterDaemonLogFile() { return utils_1.createFolderForFile(utils_1.resolvePaths(this.getConfig("flutterDaemonLogFile", null))); }
    get flutterHotReloadOnSave() { return this.getConfig("flutterHotReloadOnSave", true); }
    get flutterHotRestartOnSave() { return this.getConfig("flutterHotRestartOnSave", false); }
    get flutterScreenshotPath() { return utils_1.resolvePaths(this.getConfig("flutterScreenshotPath", null)); }
    get flutterSdkPath() { return utils_1.resolvePaths(this.getConfig("flutterSdkPath", null)); }
    get flutterSdkPaths() { return this.getConfig("flutterSdkPaths", []).map(utils_1.resolvePaths); }
    get flutterSelectDeviceWhenConnected() { return this.getConfig("flutterSelectDeviceWhenConnected", true); }
    get maxLogLineLength() { return this.getConfig("maxLogLineLength", 2000); }
    get normalizeWindowsDriveLetters() { return this.getConfig("normalizeWindowsDriveLetters", true); }
    get openTestView() { return this.getConfig("openTestView", ["testRunStart"]); }
    get previewBuildRunnerTasks() { return this.getConfig("previewBuildRunnerTasks", false); }
    get previewFlutterUiGuides() { return this.getConfig("previewFlutterUiGuides", false); }
    get previewFlutterUiGuidesCustomTracking() { return this.getConfig("previewFlutterUiGuidesCustomTracking", false); }
    get previewToStringInDebugViews() { return this.getConfig("previewToStringInDebugViews", false); }
    get promptToRunIfErrors() { return this.getConfig("promptToRunIfErrors", true); }
    get reportAnalyzerErrors() { return this.getConfig("reportAnalyzerErrors", true); }
    get sdkPath() { return utils_1.resolvePaths(this.getConfig("sdkPath", null)); }
    get sdkPaths() { return this.getConfig("sdkPaths", []).map(utils_1.resolvePaths); }
    get showIgnoreQuickFixes() { return this.getConfig("showIgnoreQuickFixes", false); }
    get showTestCodeLens() { return this.getConfig("showTestCodeLens", true); }
    get showTodos() { return this.getConfig("showTodos", true); }
    get triggerSignatureHelpAutomatically() { return this.getConfig("triggerSignatureHelpAutomatically", false); }
    get useKnownChromeOSPorts() { return this.getConfig("useKnownChromeOSPorts", true); }
    get warnWhenEditingFilesOutsideWorkspace() { return this.getConfig("warnWhenEditingFilesOutsideWorkspace", true); }
    // Hidden settings
    // TODO: Remove this?
    get previewHotReloadCoverageMarkers() { return this.getConfig("previewHotReloadCoverageMarkers", false); }
    // Helpers
    get useDevToolsDarkTheme() { return this.devToolsTheme === "dark"; }
    get openTestViewOnFailure() { return this.openTestView.indexOf("testFailure") !== -1; }
    get openTestViewOnStart() { return this.openTestView.indexOf("testRunStart") !== -1; }
    // Options that can be set programatically.
    setCheckForSdkUpdates(value) { return this.setConfig("checkForSdkUpdates", value, vscode_1.ConfigurationTarget.Global); }
    setFlutterSdkPath(value) { return this.setConfig("flutterSdkPath", value, vscode_1.ConfigurationTarget.Workspace); }
    setGlobalDartSdkPath(value) { return this.setConfig("sdkPath", value, vscode_1.ConfigurationTarget.Global); }
    setGlobalFlutterSdkPath(value) { return this.setConfig("flutterSdkPath", value, vscode_1.ConfigurationTarget.Global); }
    setSdkPath(value) { return this.setConfig("sdkPath", value, vscode_1.ConfigurationTarget.Workspace); }
    setWarnWhenEditingFilesOutsideWorkspace(value) { return this.setConfig("warnWhenEditingFilesOutsideWorkspace", value, vscode_1.ConfigurationTarget.Global); }
    for(uri) {
        return new ResourceConfig(uri);
    }
}
class ResourceConfig {
    constructor(uri) {
        this.uri = uri;
        this.config = vscode_1.workspace.getConfiguration("dart", this.uri);
    }
    getConfig(key, defaultValue) {
        return misc_1.nullToUndefined(this.config.get(key, defaultValue));
    }
    get analysisExcludedFolders() { return this.getConfig("analysisExcludedFolders", []); }
    get debugExternalLibraries() { return this.getConfig("debugExternalLibraries", false); }
    get debugSdkLibraries() { return this.getConfig("debugSdkLibraries", false); }
    get doNotFormat() { return this.getConfig("doNotFormat", []); }
    get enableCompletionCommitCharacters() { return this.getConfig("enableCompletionCommitCharacters", false); }
    get evaluateGettersInDebugViews() { return this.getConfig("evaluateGettersInDebugViews", true); }
    get flutterRunLogFile() { return utils_1.createFolderForFile(utils_1.resolvePaths(this.getConfig("flutterRunLogFile", null))); }
    get flutterTestLogFile() { return utils_1.createFolderForFile(utils_1.resolvePaths(this.getConfig("flutterTestLogFile", null))); }
    get flutterTrackWidgetCreation() { return this.getConfig("flutterTrackWidgetCreation", true); }
    get insertArgumentPlaceholders() { return this.getConfig("insertArgumentPlaceholders", true); }
    get lineLength() { return this.getConfig("lineLength", 80); }
    get observatoryLogFile() { return utils_1.createFolderForFile(utils_1.resolvePaths(this.getConfig("observatoryLogFile", null))); }
    get promptToGetPackages() { return this.getConfig("promptToGetPackages", true); }
    get pubAdditionalArgs() { return this.getConfig("pubAdditionalArgs", []); }
    get pubTestLogFile() { return utils_1.createFolderForFile(utils_1.resolvePaths(this.getConfig("pubTestLogFile", null))); }
    get runPubGetOnPubspecChanges() { return this.getConfig("runPubGetOnPubspecChanges", true); }
    get vmAdditionalArgs() { return this.getConfig("vmAdditionalArgs", []); }
    get webDaemonLogFile() { return utils_1.createFolderForFile(utils_1.resolvePaths(this.getConfig("webDaemonLogFile", null))); }
    get runPubGetOnPubspecChangesIsConfiguredExplicitly() {
        const runPubGet = this.config.inspect("runPubGetOnPubspecChanges");
        // Return whether any of them are explicitly set, in which case we'll then read normally from the settings.
        return runPubGet && (runPubGet.globalValue !== undefined || runPubGet.workspaceValue !== undefined || runPubGet.workspaceFolderValue !== undefined);
    }
}
class CodeCapabilities {
    constructor(version) {
        this.version = version;
    }
}
exports.CodeCapabilities = CodeCapabilities;
exports.config = new Config();
exports.vsCodeVersion = new CodeCapabilities(vscode_1.version);
//# sourceMappingURL=config.js.map