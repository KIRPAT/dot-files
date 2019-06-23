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
const project_1 = require("../project");
const util = require("../utils");
const utils_1 = require("../utils");
const log_1 = require("../utils/log");
const outlines = {};
const flutterOutlines = {};
const occurrences = {};
const folding = {};
const pubRunTestSupport = {};
let lastPriorityFiles = [];
let lastSubscribedFiles = [];
class OpenFileTracker {
    constructor(analyzer, wsContext) {
        this.analyzer = analyzer;
        this.wsContext = wsContext;
        this.disposables = [];
        // Reset these, since they're state from the last analysis server
        // (when we change SDK and thus change this).
        lastPriorityFiles = [];
        lastSubscribedFiles = [];
        this.disposables.push(vscode_1.workspace.onDidOpenTextDocument((td) => {
            this.updateSubscriptions();
        }));
        this.disposables.push(vscode_1.workspace.onDidCloseTextDocument((td) => {
            const path = utils_1.fsPath(td.uri);
            delete outlines[path];
            delete flutterOutlines[path];
            delete occurrences[path];
            delete folding[path];
            delete pubRunTestSupport[path];
            this.updateSubscriptions();
        }));
        this.disposables.push(vscode_1.window.onDidChangeVisibleTextEditors((e) => this.updatePriorityFiles()));
        this.disposables.push(this.analyzer.registerForAnalysisOutline((o) => outlines[o.file] = o.outline));
        this.disposables.push(this.analyzer.registerForFlutterOutline((o) => flutterOutlines[o.file] = o.outline));
        this.disposables.push(this.analyzer.registerForAnalysisOccurrences((o) => occurrences[o.file] = o.occurrences));
        this.disposables.push(this.analyzer.registerForAnalysisFolding((f) => folding[f.file] = f.regions));
        // Handle already-open files.
        this.updatePriorityFiles();
        this.updateSubscriptions();
    }
    updatePriorityFiles() {
        return __awaiter(this, void 0, void 0, function* () {
            const visibleFiles = this.validPathsFor(vscode_1.window.visibleTextEditors.map((editor) => editor.document));
            if (!this.pathsHaveChanged(lastPriorityFiles, visibleFiles))
                return;
            // Keep track of files to compare next time.
            lastPriorityFiles = visibleFiles;
            // Set priority files.
            try {
                yield this.analyzer.analysisSetPriorityFiles({ files: visibleFiles });
            }
            catch (e) {
                log_1.logError(e);
            }
        });
    }
    updateSubscriptions() {
        return __awaiter(this, void 0, void 0, function* () {
            const openFiles = this.validPathsFor(vscode_1.workspace.textDocuments);
            if (!this.pathsHaveChanged(lastSubscribedFiles, openFiles))
                return;
            // Keep track of files to compare next time.
            lastSubscribedFiles = openFiles;
            // Set subscriptions.
            try {
                yield this.analyzer.analysisSetSubscriptions({
                    subscriptions: {
                        CLOSING_LABELS: this.analyzer.capabilities.supportsClosingLabels ? openFiles : undefined,
                        FOLDING: openFiles,
                        OCCURRENCES: openFiles,
                        OUTLINE: openFiles,
                    },
                });
            }
            catch (e) {
                log_1.logError(e);
            }
            // Set subscriptions.
            if (this.wsContext.hasAnyFlutterProjects && this.analyzer.capabilities.supportsFlutterOutline) {
                try {
                    yield this.analyzer.flutterSetSubscriptions({
                        subscriptions: {
                            OUTLINE: openFiles,
                        },
                    });
                }
                catch (e) {
                    log_1.logError(e);
                }
            }
        });
    }
    pathsHaveChanged(last, current) {
        return last.length !== current.length
            || last.some((f, i) => f !== current[i]);
    }
    validPathsFor(paths) {
        const isAnalyzeable = this.analyzer.capabilities.supportsPriorityFilesOutsideAnalysisRoots
            ? util.isAnalyzable
            : util.isAnalyzableAndInWorkspace;
        return paths
            .filter((doc) => !doc.isClosed && isAnalyzeable(doc))
            .map((doc) => utils_1.fsPath(doc.uri))
            .sort((path1, path2) => path1.localeCompare(path2));
    }
    static getOutlineFor(file) {
        return outlines[utils_1.fsPath(file)];
    }
    static getFlutterOutlineFor(file) {
        return flutterOutlines[utils_1.fsPath(file)];
    }
    static getOccurrencesFor(file) {
        return occurrences[utils_1.fsPath(file)];
    }
    static supportsPubRunTest(file) {
        const path = utils_1.fsPath(file);
        if (!util.isPubRunnableTestFile(path))
            return false;
        if (pubRunTestSupport[path] === undefined) {
            const projectRoot = project_1.locateBestProjectRoot(path);
            pubRunTestSupport[path] = !!(projectRoot && util.checkProjectSupportsPubRunTest(projectRoot));
        }
        return pubRunTestSupport[utils_1.fsPath(file)];
    }
    static getFoldingRegionsFor(file) {
        return folding[utils_1.fsPath(file)];
    }
    static getLastPriorityFiles() {
        return lastPriorityFiles.slice();
    }
    static getLastSubscribedFiles() {
        return lastSubscribedFiles.slice();
    }
    dispose() {
        // TODO: This (and others) should probably await, in case thye're promises.
        // And also not fail on first error.
        this.disposables.forEach((d) => d.dispose());
    }
}
exports.OpenFileTracker = OpenFileTracker;
//# sourceMappingURL=open_file_tracker.js.map