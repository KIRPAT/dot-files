'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vs = require("vscode");
const pug2html = 'pug2html';
const pug2htmlUri = vs.Uri.parse(`${pug2html}://preview.html`);
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
function activate(context) {
    let provider = new Pug2HtmlContentProvider();
    let registration = vs.workspace.registerTextDocumentContentProvider(pug2html, provider);
    vs.workspace.onDidChangeTextDocument((e) => {
        let doc = vs.window.activeTextEditor.document;
        if (e.document !== doc)
            return;
        if (doc.uri.scheme === pug2html)
            return;
        if (["", "pug", "jade"].indexOf(doc.languageId) == -1)
            return;
        provider.update(pug2htmlUri);
    });
    vs.window.onDidChangeTextEditorSelection((e) => {
        let doc = vs.window.activeTextEditor.document;
        if (e.textEditor !== vs.window.activeTextEditor)
            return;
        if (doc.uri.scheme === pug2html)
            return;
        if (["", "pug", "jade"].indexOf(doc.languageId) == -1)
            return;
        provider.update(pug2htmlUri);
    });
    let disposable = vs.commands.registerCommand('extension.execute', () => {
        vs.commands.executeCommand('vscode.open', pug2htmlUri, getPreviewColumn(), 'preview.html').then(() => {
            // OK
        }, (reason) => {
            vs.window.showErrorMessage(reason);
        });
    });
    context.subscriptions.push(disposable, registration);
}
exports.activate = activate;
function deactivate() {
}
exports.deactivate = deactivate;
function getPreviewColumn() {
    let displayColumn;
    let currentColumn = vs.window.activeTextEditor.viewColumn;
    if (currentColumn === vs.ViewColumn.One) {
        return vs.ViewColumn.Two;
    }
    return vs.ViewColumn.Three;
}
class Pug2HtmlContentProvider {
    constructor() {
        this.didChange = new vs.EventEmitter();
    }
    provideTextDocumentContent(uri) {
        return this.compileContent();
    }
    get onDidChange() {
        return this.didChange.event;
    }
    update(uri) {
        this.didChange.fire(uri);
    }
    compileContent() {
        let doc = vs.window.activeTextEditor.document;
        let text = doc.getText();
        let pug = this.findPug();
        if (!pug) {
            vs.window.showErrorMessage("Pug ist not installed.");
            return "";
        }
        try {
            let co = this.compileOptions(doc.fileName);
            co.filename = co.filename || doc.fileName;
            return pug.compile(text, co)({});
        }
        catch (error) {
            return error.message;
        }
    }
    findPug() {
        try {
            let pugPath = path.join(vs.workspace.rootPath, "node_modules", "pug");
            return require(pugPath);
        }
        catch (error) {
        }
        try {
            return require("pug");
        }
        catch (error) {
        }
        return null;
    }
    compileOptions(fileName) {
        const settings = vs.workspace.getConfiguration(pug2html);
        let options = settings.get("compileOptions", {
            doctype: "html",
            pretty: true
        });
        let optionsPath = settings.get("compileOptionsPath", null);
        if (optionsPath) {
            if (!path.isAbsolute(optionsPath)) {
                optionsPath = path.join(vs.workspace.rootPath, optionsPath);
            }
            try {
                options = require(optionsPath);
                if (typeof options === "function") {
                    options = options(fileName);
                }
            }
            catch (error) {
                console.log(error.message);
            }
        }
        return options;
    }
}
//# sourceMappingURL=extension.js.map