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
const arepl_backend_1 = require("arepl-backend");
const os_1 = require("os");
const path_1 = require("path");
const vscode = require("vscode");
const previewContainer_1 = require("./previewContainer");
const telemetry_1 = require("./telemetry");
const toAREPLLogic_1 = require("./toAREPLLogic");
const vscodeUtilities_1 = require("./vscodeUtilities");
const python_shell_1 = require("python-shell");
const settings_1 = require("./settings");
/**
 * class with logic for starting arepl and arepl preview
 */
class PreviewManager {
    /**
     * assumes a text editor is already open - if not will error out
     */
    constructor(context) {
        this.subscriptions = [];
        this.runningStatus = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.runningStatus.text = "Running python...";
        this.runningStatus.tooltip = "AREPL is currently running your python file.  Close the AREPL preview to stop";
        this.reporter = new telemetry_1.default(settings_1.settings().get("telemetry"));
        this.previewContainer = new previewContainer_1.PreviewContainer(this.reporter, context);
        this.highlightDecorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: 'yellow'
        });
    }
    startArepl() {
        return __awaiter(this, void 0, void 0, function* () {
            // see https://github.com/Microsoft/vscode/issues/46445
            vscode.commands.executeCommand("setContext", "arepl", true);
            // reload reporter (its disposed when arepl is closed)
            this.reporter = new telemetry_1.default(settings_1.settings().get("telemetry"));
            if (!vscode.window.activeTextEditor) {
                vscode.window.showErrorMessage("no active text editor open");
                return;
            }
            this.pythonEditor = vscode.window.activeTextEditor;
            this.pythonEditorDoc = this.pythonEditor.document;
            let panel = this.previewContainer.start();
            panel.onDidDispose(() => this.dispose(), this, this.subscriptions);
            this.subscriptions.push(panel);
            this.startAndBindPython();
            if (this.pythonEditorDoc.isUntitled && this.pythonEditorDoc.getText() == "") {
                yield this.insertDefaultImports(this.pythonEditor);
                // waiting for this to complete so i dont accidentily trigger
                // the edit doc handler when i insert imports
            }
            this.subscribeHandlersToDoc();
            return panel;
        });
    }
    runArepl() {
        this.onAnyDocChange(this.pythonEditorDoc);
    }
    runAreplBlock() {
        const editor = vscode.window.activeTextEditor;
        const selection = editor.selection;
        let block = null;
        if (selection.isEmpty) { // just a cursor
            block = vscodeUtilities_1.default.getBlockOfText(editor, selection.start.line);
        }
        else {
            block = new vscode.Range(selection.start, selection.end);
        }
        let codeLines = editor.document.getText(block);
        // hack: we want accurate line # info
        // so we prepend lines to put codeLines in right spot
        codeLines = vscodeUtilities_1.default.eol(editor.document).repeat(block.start.line) + codeLines;
        const filePath = editor.document.isUntitled ? "" : editor.document.fileName;
        const data = {
            evalCode: codeLines,
            filePath,
            savedCode: '',
            usePreviousVariables: true,
            showGlobalVars: settings_1.settings().get('showGlobalVars')
        };
        this.pythonEvaluator.execCode(data);
        this.runningStatus.show();
        if (editor) {
            editor.setDecorations(this.highlightDecorationType, [block]);
        }
        setTimeout(() => {
            // clear decorations
            editor.setDecorations(this.highlightDecorationType, []);
        }, 100);
    }
    dispose() {
        vscode.commands.executeCommand("setContext", "arepl", false);
        if (this.pythonEvaluator.pyshell != null && this.pythonEvaluator.pyshell.childProcess != null) {
            this.pythonEvaluator.stop();
        }
        this.disposable = vscode.Disposable.from(...this.subscriptions);
        this.disposable.dispose();
        this.runningStatus.dispose();
        this.reporter.sendFinishedEvent(settings_1.settings());
        this.reporter.dispose();
        if (vscode.window.activeTextEditor) {
            vscode.window.activeTextEditor.setDecorations(this.previewContainer.errorDecorationType, []);
        }
    }
    getPythonPath() {
        let pythonPath = settings_1.settings().get("pythonPath");
        const pythonExtSettings = vscode.workspace.getConfiguration("python", null);
        const pythonExtPythonPath = pythonExtSettings.get('pythonPath');
        if (pythonExtPythonPath && !pythonPath)
            pythonPath = pythonExtPythonPath;
        if (pythonPath) {
            pythonPath = pythonPath.replace("${workspaceFolder}", vscodeUtilities_1.default.getCurrentWorkspaceFolder());
            let envVar = pythonPath.match(/\${env:([^}]+)}/);
            if (envVar) {
                pythonPath = pythonPath.replace(envVar[1], process.env[envVar[1]]);
            }
            // not needed anymore but here for backwards compatability. Remove in 2020
            pythonPath = pythonPath.replace("${python.pythonPath}", pythonExtSettings.get('pythonPath'));
            // if its a relative path, make it absolute
            if (pythonPath.includes(path_1.sep) && !path_1.isAbsolute(pythonPath)) {
                pythonPath = vscodeUtilities_1.default.getCurrentWorkspaceFolder() + path_1.sep + pythonPath;
            }
        }
        else {
            pythonPath = python_shell_1.PythonShell.defaultPythonPath;
        }
        return pythonPath;
    }
    /**
     * starts AREPL python backend and binds print&result output to the handlers
     */
    startAndBindPython() {
        const pythonPath = this.getPythonPath();
        const pythonOptions = settings_1.settings().get("pythonOptions");
        python_shell_1.PythonShell.getVersion(`"${pythonPath}"`).then((out) => {
            if (out.stdout) {
                if (out.stdout.includes("Python 2.")) {
                    vscode.window.showErrorMessage("AREPL does not support python 2!");
                }
            }
        }).catch((s) => {
            // if we get spawn error here thats already reported by telemetry
            // so we skip telemetry reporting for this error
            console.error(s);
        });
        this.pythonEvaluator = new arepl_backend_1.PythonEvaluator(pythonPath, pythonOptions);
        try {
            this.pythonEvaluator.start();
        }
        catch (err) {
            if (err instanceof Error) {
                const error = `Error running python with command: ${pythonPath} ${pythonOptions.join(' ')}\n${err.stack}`;
                this.previewContainer.displayProcessError(error);
                // @ts-ignore 
                this.reporter.sendError(err.name + ' ' + err.message, err.stack, error.errno, 'spawn');
            }
            else {
                console.error(err);
            }
        }
        this.pythonEvaluator.pyshell.childProcess.on("error", err => {
            /* The 'error' event is emitted whenever:
            The process could not be spawned, or
            The process could not be killed, or
            Sending a message to the child process failed.
            */
            // @ts-ignore err is actually SystemError but node does not type it
            const error = `Error running python with command: ${err.path} ${err.spawnargs.join(' ')}\n${err.stack}`;
            this.previewContainer.displayProcessError(error);
            // @ts-ignore 
            this.reporter.sendError(err.code, err.stack, error.errno, 'spawn');
        });
        this.pythonEvaluator.pyshell.childProcess.on("exit", err => {
            /* The 'exit' event is emitted after the child process ends */
            // that's what node doc CLAIMS ..... 
            // but when i debug this never gets called unless there's a unexpected error :/
            if (!err)
                return; // normal exit
            const error = `AREPL crashed unexpectedly! Are you using python 3? err: ${err}`;
            this.previewContainer.displayProcessError(error);
            this.reporter.sendError('exit', null, err, 'spawn');
        });
        this.toAREPLLogic = new toAREPLLogic_1.ToAREPLLogic(this.pythonEvaluator, this.previewContainer);
        // binding this to the class so it doesn't get overwritten by PythonEvaluator
        this.pythonEvaluator.onPrint = this.previewContainer.handlePrint.bind(this.previewContainer);
        // this is bad - stderr should be handled seperately so user is aware its different
        // but better than not showing stderr at all, so for now printing it out and ill fix later
        this.pythonEvaluator.onStderr = this.previewContainer.handlePrint.bind(this.previewContainer);
        this.pythonEvaluator.onResult = result => {
            this.runningStatus.hide();
            this.previewContainer.handleResult(result);
        };
    }
    /**
     * binds various funcs to activate upon edit of document / switching of active doc / etc...
     */
    subscribeHandlersToDoc() {
        if (settings_1.settings().get("skipLandingPage")) {
            this.onAnyDocChange(this.pythonEditorDoc);
        }
        vscode.workspace.onDidSaveTextDocument((e) => {
            if (settings_1.settings().get("whenToExecute") == "onSave") {
                this.onAnyDocChange(e);
            }
        }, this, this.subscriptions);
        vscode.workspace.onDidChangeTextDocument((e) => {
            if (settings_1.settings().get("whenToExecute") == "afterDelay") {
                let delay = settings_1.settings().get("delay");
                const restartExtraDelay = settings_1.settings().get("restartDelay");
                delay += this.toAREPLLogic.restartMode ? restartExtraDelay : 0;
                this.pythonEvaluator.debounce(this.onAnyDocChange.bind(this, e.document), delay);
            }
        }, this, this.subscriptions);
        vscode.workspace.onDidCloseTextDocument((e) => {
            if (e == this.pythonEditorDoc)
                this.dispose();
        }, this, this.subscriptions);
    }
    insertDefaultImports(editor) {
        return editor.edit((editBuilder) => {
            let imports = settings_1.settings().get("defaultImports");
            imports = imports.filter(i => i.trim() != "");
            if (imports.length == 0)
                return;
            imports = imports.map(i => {
                const words = i.split(" ");
                // python import syntax: "import library" or "from library import method"
                // so if user didnt specify import we will do that for them :)
                if (words[0] != "import" && words[0] != "from" && words[0].length > 0) {
                    i = "import " + i;
                }
                return i;
            });
            editBuilder.insert(new vscode.Position(0, 0), imports.join(os_1.EOL) + os_1.EOL);
        });
    }
    onAnyDocChange(event) {
        if (event == this.pythonEditorDoc) {
            this.reporter.numRuns += 1;
            if (this.pythonEvaluator.evaling) {
                this.reporter.numInterruptedRuns += 1;
            }
            const text = event.getText();
            const filePath = this.pythonEditorDoc.isUntitled ? "" : this.pythonEditorDoc.fileName;
            const codeRan = this.toAREPLLogic.onUserInput(text, filePath, vscodeUtilities_1.default.eol(event), settings_1.settings().get('showGlobalVars'));
            if (codeRan)
                this.runningStatus.show();
        }
    }
}
exports.default = PreviewManager;
//# sourceMappingURL=PreviewManager.js.map