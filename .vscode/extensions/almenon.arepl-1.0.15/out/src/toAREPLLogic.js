"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pyGuiLibraryIsPresent_1 = require("./pyGuiLibraryIsPresent");
/**
 * formats text for passing into AREPL backend
 * Along the way decides whether backend needs restarting
 */
class ToAREPLLogic {
    constructor(pythonEvaluator, previewContainer) {
        this.pythonEvaluator = pythonEvaluator;
        this.previewContainer = previewContainer;
        this.restartedLastTime = false;
        this.lastSavedSection = "";
        this.lastCodeSection = "";
        this.lastEndSection = "";
    }
    onUserInput(text, filePath, eol, showGlobalVars = true) {
        let codeLines = text.split(eol);
        let savedLines = [];
        let startLineNum = 0;
        let endLineNum = codeLines.length;
        codeLines.forEach((line, i) => {
            if (line.trimRight().endsWith("#$save")) {
                savedLines = codeLines.slice(0, i + 1);
                startLineNum = i + 1;
            }
            if (line.trimRight().endsWith("#$end")) {
                endLineNum = i + 1;
                return;
            }
        });
        const endSection = codeLines.slice(endLineNum).join(eol);
        codeLines = codeLines.slice(startLineNum, endLineNum);
        const data = {
            evalCode: codeLines.join(eol),
            filePath,
            savedCode: savedLines.join(eol),
            usePreviousVariables: false,
            showGlobalVars
        };
        // user should be able to rerun code without changing anything
        // only scenario where we dont re-run is if just end section is changed
        if (endSection != this.lastEndSection && data.savedCode == this.lastSavedSection && data.evalCode == this.lastCodeSection) {
            return false;
        }
        this.lastCodeSection = data.evalCode;
        this.lastSavedSection = data.savedCode;
        this.lastEndSection = endSection;
        this.restartMode = pyGuiLibraryIsPresent_1.default(text);
        if (this.restartMode) {
            this.checkSyntaxAndRestart(data);
        }
        else if (this.restartedLastTime) { // if GUI code is gone need one last restart to get rid of GUI
            this.restartPython(data);
            this.restartedLastTime = false;
        }
        else {
            this.pythonEvaluator.execCode(data);
        }
        return true;
    }
    /**
     * checks syntax before restarting - if syntax error it doesnt bother restarting but instead just shows syntax error
     * This is useful because we want to restart as little as possible
     */
    checkSyntaxAndRestart(data) {
        let syntaxPromise;
        // #22 it might be faster to use checkSyntaxFile but this is simpler
        syntaxPromise = this.pythonEvaluator.checkSyntax(data.savedCode + data.evalCode);
        syntaxPromise.then(() => {
            this.restartPython(data);
            this.restartedLastTime = true;
        })
            .catch((error) => {
            // an ErrnoException is a bad internal error
            let internalErr = "";
            if (typeof (error) != "string") {
                internalErr = error.message + '\n\n' + error.stack;
                error = "";
            }
            this.previewContainer.handleResult({ userVariables: {}, userError: error, execTime: 0, totalPyTime: 0, totalTime: 0, internalError: internalErr, caller: "", lineno: -1, done: true, });
        });
    }
    restartPython(data) {
        this.previewContainer.clearStoredData();
        this.pythonEvaluator.restart(this.pythonEvaluator.execCode.bind(this.pythonEvaluator, data));
    }
}
exports.ToAREPLLogic = ToAREPLLogic;
//# sourceMappingURL=toAREPLLogic.js.map