'use strict';
var vscode = require('vscode');
var pugBeautify = require('pug-beautify');
function beautify(text, options) {
    var result = '';
    try {
        result = pugBeautify(text, options);
    }
    catch (err) {
        vscode.window.showErrorMessage(err);
    }
    return result || text;
}
function getOptions(activeTextEditor) {
    var editorConfig = vscode.workspace.getConfiguration('formatter-pug');
    var options = {
        fill_tab: editorConfig.fillTab || !activeTextEditor.options.insertSpaces,
        omit_div: editorConfig.omitDiv,
        tab_size: editorConfig.tabSize || activeTextEditor.options.tabSize
    };
    return options;
}
function getRange(document) {
    var lastLine = document.lineAt(document.lineCount - 1);
    var start = new vscode.Position(0, 0);
    var end = new vscode.Position(document.lineCount - 1, lastLine.text.length);
    var range = new vscode.Range(start, end);
    return range;
}
function activate(context) {
    // 👎 formatter implemented as separate command
    vscode.commands.registerCommand('extension.format-pug', function () {
        var activeTextEditor = vscode.window.activeTextEditor;
        var document = activeTextEditor.document;
        if (!activeTextEditor || activeTextEditor.document.languageId !== 'pug')
            return;
        var text = activeTextEditor.document.getText();
        var options = getOptions(activeTextEditor);
        var result = beautify(text, options);
        var range = getRange(document);
        var edit = new vscode.WorkspaceEdit();
        edit.replace(document.uri, range, result);
        return vscode.workspace.applyEdit(edit);
    });
    // 👍 formatter implemented using API
    vscode.languages.registerDocumentFormattingEditProvider({ scheme: 'file', language: 'pug' }, {
        provideDocumentFormattingEdits: function (document) {
            var activeTextEditor = vscode.window.activeTextEditor;
            var text = document.getText();
            var options = getOptions(activeTextEditor);
            var result = beautify(text, options);
            var range = getRange(document);
            return [vscode.TextEdit.replace(range, result)];
        }
    });
}
exports.activate = activate;
//# sourceMappingURL=extension.js.map