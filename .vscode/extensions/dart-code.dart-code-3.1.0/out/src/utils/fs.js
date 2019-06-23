"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const path = require("path");
function getChildFolders(parent) {
    if (!fs.existsSync(parent))
        return [];
    return fs.readdirSync(parent)
        .map((item) => path.join(parent, item))
        .filter((item) => fs.existsSync(item) && fs.statSync(item).isDirectory());
}
exports.getChildFolders = getChildFolders;
function hasPackagesFile(folder) {
    return fs.existsSync(path.join(folder, ".packages"));
}
exports.hasPackagesFile = hasPackagesFile;
function hasPubspec(folder) {
    return fs.existsSync(path.join(folder, "pubspec.yaml"));
}
exports.hasPubspec = hasPubspec;
function tryDeleteFile(filePath) {
    if (fs.existsSync(filePath)) {
        try {
            fs.unlinkSync(filePath);
        }
        catch (_a) {
            console.warn(`Failed to delete file $path.`);
        }
    }
}
exports.tryDeleteFile = tryDeleteFile;
//# sourceMappingURL=fs.js.map