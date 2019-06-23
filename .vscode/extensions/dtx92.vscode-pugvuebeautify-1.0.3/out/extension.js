'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const pugBeautify = require("pug-beautify");
function activate(context) {
    const disposable = vscode.commands.registerTextEditorCommand('pugvuebeautify.execute', (textEditor) => {
        if (textEditor.document.languageId !== 'jade' && textEditor.document.languageId !== 'vue') {
            return;
        }
        let isVue = textEditor.document.languageId === 'vue';
        const editorConfig = vscode.workspace.getConfiguration('pugvuebeautify');
        let text = textEditor.document.getText();
        let vueRes;
        if (isVue) {
            let re = /<template.*?pug.*?>([\s\S]*?)<\/template>/gm;
            vueRes = re.exec(text);
            if (!vueRes)
                return;
            text = vueRes[1];
        }
        const options = {
            fill_tab: editorConfig.fillTab || !textEditor.options.insertSpaces,
            omit_div: editorConfig.omitDiv,
            tab_size: editorConfig.tabSize || textEditor.options.tabSize,
        };
        let result = '';
        try {
            result = pugBeautify(text, options);
            if (isVue)
                result = '<template lang="pug">' + result + '</template>';
        }
        catch (err) {
            return vscode.window.showErrorMessage(err);
        }
        textEditor.edit((editBuilder) => {
            const document = textEditor.document;
            let end = new vscode.Position(0, 0);
            let start = new vscode.Position(0, 0);
            if (!isVue) {
                const lastLine = document.lineAt(document.lineCount - 1);
                start = new vscode.Position(0, 0);
                end = new vscode.Position(document.lineCount - 1, lastLine.text.length);
            }
            else {
                start = document.positionAt(vueRes.index);
                end = document.positionAt(vueRes.index + vueRes[0].length);
            }
            const range = new vscode.Range(start, end);
            editBuilder.replace(range, result);
        });
    });
    context.subscriptions.push(disposable);
}
exports.activate = activate;
//# sourceMappingURL=extension.js.map