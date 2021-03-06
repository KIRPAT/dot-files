"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const vscode = require("vscode");
const throttle_1 = require("./throttle");
const utilities_1 = require("./utilities");
const settings_1 = require("./settings");
/**
 * shows AREPL output (variables, errors, timing, and stdout/stderr)
 * https://code.visualstudio.com/docs/extensions/webview
 */
class PythonPreview {
    constructor(context, htmlUpdateFrequency = 50) {
        this.context = context;
        this.lastTime = 999999999;
        this.landingPage = `
    <br>
    <p style="font-size:14px">Start typing or make a change and your code will be evaluated.</p>
    
    <p style="font-size:14px">⚠ <b style="color:red">WARNING:</b> code is evaluated WHILE YOU TYPE - don't try deleting files/folders! ⚠</p>
    <p>evaluation while you type can be turned off or adjusted in the settings</p>
    <br>
    <h3>AREPL 1.0.15 🚀 🐛 - Thanks to @m3thr1l and @nbahmanyar for their feedback</h3>
    <ul>
        <li>🚀 Added icon to launch arepl. Click on the cat to open arepl on the current document. Click on the cat again to close. If you highlight a piece of code arepl will be opened on a new doc with that code. If you don't like the icon you can turn it off in the settings. I am clearly not a artist so if you can make a better icon please let me know.</li>
        <li>🚀 Added customCSS setting for custom styling of arepl. For example, <code>span { font-size: 40px; }</code> would increase the font-size</li>
        <li>🐛 Fixed arepl failing on linux</li>
    </ul>
    <br>
    
    <h3>Examples</h3>
    
<h4>Simple List</h4>
<code style="white-space:pre-wrap">
x = [1,2,3]
y = [num*2 for num in x]
print(y)
</code>

<h4>Dumping</h4>
<code style="white-space:pre-wrap">
from arepldump import dump 

def milesToKilometers(miles):
    kilometers = miles*1.60934
    dump() # dumps all the vars in your function

    # or dump when function is called for a second time
    dump(None,1) 

milesToKilometers(2*2)
milesToKilometers(3*3)

for char in ['a','b','c']:
    dump(char,2) # dump a var at a specific iteration

a=1
dump(a) # dump specific vars at any point in your program
a=2
</code>

<h4>Turtle</h4>
<code style="white-space:pre-wrap">
import turtle

# window in right hand side of screen
turtle.setup(500,500,-1,0)

# you can comment this out to keep state inbetween runs
turtle.reset()

turtle.forward(100)
turtle.left(90)
</code>

<h4>Web call</h4>
<code style="white-space:pre-wrap">
import requests
import datetime as dt

r = requests.get("https://api.github.com")

#$save
# #$save saves state so request is not re-executed when modifying below

now = dt.datetime.now()
if r.status_code == 200:
    print("API up at " + str(now))

</code>`;
        this.footer = `<br><br>
        <div id="footer">
        <p style="margin:0px;">
            report an <a href="https://github.com/almenon/arepl-vscode/issues">issue</a>  |
            ⭐ <a href="https://marketplace.visualstudio.com/items?itemName=almenon.arepl#review-details">rate me</a> ⭐ |
            talk on <a href="https://gitter.im/arepl/lobby">gitter</a> |
                <a href="https://twitter.com/intent/tweet?button_hashtag=arepl" id="twitterButton">
                    <i id="twitterIcon"></i>Tweet #arepl</a>
        </p>
        </div>`;
        this.errorContainer = "";
        this.jsonRendererCode = `<script></script>`;
        this.emptyPrint = `<br><b>Print Output:</b><div id="print"></div>`;
        this.printContainer = this.emptyPrint;
        this.timeContainer = "";
        this.customCSS = "";
        this._onDidChange = new vscode.EventEmitter();
        this.css = `<link rel="stylesheet" type="text/css" href="${this.getMediaPath("pythonPreview.css")}">`;
        this.jsonRendererScript = `<script src="${this.getMediaPath("jsonRenderer.js")}"></script>`;
        if (htmlUpdateFrequency != 0) {
            // refreshing html too much can freeze vscode... lets avoid that
            const l = new throttle_1.Limit();
            this.throttledUpdate = l.throttledUpdate(this.updateContent, htmlUpdateFrequency);
        }
        else
            this.throttledUpdate = this.updateContent;
    }
    start() {
        this.panel = vscode.window.createWebviewPanel("arepl", "AREPL", vscode.ViewColumn.Two, {
            enableScripts: true
        });
        this.panel.webview.html = this.landingPage;
        return this.panel;
    }
    updateVars(vars) {
        let userVarsCode = `userVars = ${JSON.stringify(vars)};`;
        // escape end script tag or else the content will escape its container and WREAK HAVOC
        userVarsCode = userVarsCode.replace(/<\/script>/g, "<\\/script>");
        this.jsonRendererCode = `<script>
            window.onload = function(){
                ${userVarsCode}
                let jsonRenderer = renderjson.set_icons('+', '-') // default icons look a bit wierd, overriding
                    .set_show_to_level(${settings_1.settings().get("show_to_level")}) 
                    .set_max_string_length(${settings_1.settings().get("max_string_length")});
                document.getElementById("results").appendChild(jsonRenderer(userVars));
            }
            </script>`;
    }
    updateTime(time) {
        let color;
        time = Math.floor(time); // we dont care about anything smaller than ms
        if (time > this.lastTime)
            color = "red";
        else
            color = "green";
        this.lastTime = time;
        this.timeContainer = `<p style="position:fixed;left:90%;top:90%;color:${color};">${time} ms</p>`;
    }
    /**
     * @param refresh if true updates page immediately.  otherwise error will show up whenever updateContent is called
     */
    updateError(err, refresh = false) {
        // escape the <module>
        err = utilities_1.default.escapeHtml(err);
        err = this.makeErrorGoogleable(err);
        this.errorContainer = `<div id="error">${err}</div>`;
        if (refresh)
            this.throttledUpdate();
    }
    injectCustomCSS(css, refresh = false) {
        this.customCSS = css;
        if (refresh)
            this.throttledUpdate();
    }
    handlePrint(printResults) {
        // escape any accidental html
        printResults = utilities_1.default.escapeHtml(printResults);
        this.printContainer = `<br><b>Print Output:</b><div id="print">${printResults}</div>`;
        this.throttledUpdate();
    }
    clearPrint() {
        this.printContainer = this.emptyPrint;
    }
    displayProcessError(err) {
        let errMsg = `Error in the AREPL extension!\n${err}`;
        if (err.includes("ENOENT")) { // NO SUCH FILE OR DIRECTORY
            // user probably just doesn't have python installed
            errMsg = errMsg + `\n\nAre you sure you have installed python 3 and it is in your PATH?
            You can download python here: https://www.python.org/downloads/`;
        }
        this.updateError(errMsg);
        this.throttledUpdate();
    }
    makeErrorGoogleable(err) {
        if (err && err.trim().length > 0) {
            let errLines = err.split("\n");
            // exception usually on last line so start from bottom
            for (let i = errLines.length - 1; i >= 0; i--) {
                // most exceptions follow format ERROR: explanation
                // ex: json.decoder.JSONDecodeError: Expecting value: line 1 column 1 (char 0)
                // so we can identify them by a single word at start followed by colon
                const errRegex = /(^[\w\.]+): /;
                if (errLines[i].match(errRegex)) {
                    const googleLink = "https://www.google.com/search?q=python ";
                    errLines[i] = errLines[i].link(googleLink + errLines[i]);
                }
            }
            return errLines.join("\n");
        }
        else
            return err;
    }
    get onDidChange() {
        return this._onDidChange.event;
    }
    getMediaPath(mediaFile) {
        const onDiskPath = vscode.Uri.file(path.join(this.context.extensionPath, "media", mediaFile));
        return onDiskPath.with({ scheme: "vscode-resource" });
    }
    updateContent() {
        const printPlacement = settings_1.settings().get("printResultPlacement");
        const showFooter = settings_1.settings().get("showFooter");
        // todo: handle different themes.  check body class: https://code.visualstudio.com/updates/June_2016
        this.html = `<!doctype html>
        <html lang="en">
        <head>
            <title>AREPL</title>
            ${this.css}
            <style>${this.customCSS}</style>
            ${this.jsonRendererScript}
            ${this.jsonRendererCode}
        </head>
        <body>
            ${this.errorContainer}
            ${printPlacement == "bottom" ?
            '<div id="results"></div>' + this.printContainer :
            this.printContainer + '<div id="results"></div>'}
            ${this.timeContainer}
            ${showFooter ? this.footer : ""}
            <div id="${Math.random()}" style="display:none"></div>
        </body>
        </html>`;
        // the weird div with a random id above is necessary
        // if not there weird issues appear
        try {
            this.panel.webview.html = this.html;
        }
        catch (error) {
            if (error instanceof Error && error.message.includes("disposed")) {
                // swallow - user probably just got rid of webview inbetween throttled update call
                console.warn(error);
            }
            else
                throw error;
        }
        this._onDidChange.fire(vscode.Uri.parse(PythonPreview.PREVIEW_URI));
    }
}
PythonPreview.scheme = "pythonPreview";
PythonPreview.PREVIEW_URI = PythonPreview.scheme + "://authority/preview";
exports.default = PythonPreview;
//# sourceMappingURL=pythonPreview.js.map