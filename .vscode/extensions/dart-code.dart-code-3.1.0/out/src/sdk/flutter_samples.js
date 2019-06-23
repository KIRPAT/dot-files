"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const os = require("os");
const path = require("path");
const vs = require("vscode");
const utils_1 = require("../debug/utils");
const util = require("../utils");
function createFlutterSampleInTempFolder(flutterCapabilities, sampleID) {
    // Ensure we're on at least Flutter v1 so we know creating samples works.
    if (!flutterCapabilities.supportsCreatingSamples) {
        vs.window.showErrorMessage("Opening sample projects requires Flutter v1.0 or later");
        return;
    }
    // Create a temp folder for the sample.
    const tempSamplePath = path.join(os.tmpdir(), utils_1.dartCodeExtensionIdentifier, "flutter", "sample", sampleID, util.getRandomInt(0x1000, 0x10000).toString(16));
    // Create the empty folder so we can open it.
    util.mkDirRecursive(tempSamplePath);
    // Create a temp dart file to force extension to load when we open this folder.
    fs.writeFileSync(path.join(tempSamplePath, util.FLUTTER_CREATE_PROJECT_TRIGGER_FILE), sampleID);
    const hasFoldersOpen = !!(vs.workspace.workspaceFolders && vs.workspace.workspaceFolders.length);
    const openInNewWindow = hasFoldersOpen;
    const folderUri = vs.Uri.file(tempSamplePath);
    vs.commands.executeCommand("vscode.openFolder", folderUri, openInNewWindow);
    return folderUri;
}
exports.createFlutterSampleInTempFolder = createFlutterSampleInTempFolder;
//# sourceMappingURL=flutter_samples.js.map