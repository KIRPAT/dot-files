"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const path = require("path");
const utils_1 = require("./debug/utils");
const utils_2 = require("./utils");
const array_1 = require("./utils/array");
const fs_1 = require("./utils/fs");
exports.UPGRADE_TO_WORKSPACE_FOLDERS = "Mark Projects as Workspace Folders";
function locateBestProjectRoot(folder) {
    if (!folder || !utils_2.isWithinWorkspace(folder))
        return undefined;
    let dir = folder;
    while (dir !== path.dirname(dir)) {
        if (fs_1.hasPubspec(dir) || fs_1.hasPackagesFile(dir))
            return dir;
        dir = path.dirname(dir);
    }
    return undefined;
}
exports.locateBestProjectRoot = locateBestProjectRoot;
function getChildProjects(folder, levelsToGo) {
    const children = fs
        .readdirSync(folder)
        .filter((f) => f !== "bin") // Don't look in bin folders
        .filter((f) => f !== "cache") // Don't look in cache folders
        .map((f) => path.join(folder, f))
        .filter((d) => fs.existsSync(d) && fs.statSync(d).isDirectory());
    let projects = [];
    for (const dir of children) {
        if (fs_1.hasPubspec(dir)) {
            projects.push(dir);
        }
        if (levelsToGo > 0)
            projects = projects.concat(getChildProjects(dir, levelsToGo - 1));
    }
    return projects;
}
exports.getChildProjects = getChildProjects;
function getWorkspaceProjectFolders() {
    const topLevelDartProjects = utils_2.getDartWorkspaceFolders().map((wf) => utils_2.fsPath(wf.uri));
    const childProjects = utils_1.flatMap(topLevelDartProjects, (f) => getChildProjects(f, 1));
    const allProjects = topLevelDartProjects.concat(childProjects).filter(fs_1.hasPubspec);
    array_1.sortBy(allProjects, (p) => path.basename(p).toLowerCase());
    return allProjects;
}
exports.getWorkspaceProjectFolders = getWorkspaceProjectFolders;
//# sourceMappingURL=project.js.map