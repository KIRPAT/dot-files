"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const path = require("path");
const vs = require("vscode");
const package_map_1 = require("../debug/package_map");
const project_1 = require("../project");
const utils_1 = require("../utils");
const array_1 = require("../utils/array");
const log_1 = require("../utils/log");
class DartPackagesProvider {
    constructor() {
        this.onDidChangeTreeDataEmitter = new vs.EventEmitter();
        this.onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;
        this.watcher = vs.workspace.createFileSystemWatcher("**/.packages");
        this.watcher.onDidChange(this.refresh, this);
        this.watcher.onDidCreate(this.refresh, this);
        this.watcher.onDidDelete(this.refresh, this);
    }
    refresh() {
        this.onDidChangeTreeDataEmitter.fire();
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (!element) {
            const allProjects = project_1.getWorkspaceProjectFolders();
            const nodes = allProjects.map((folder) => new PackageDepProject(vs.Uri.file(folder)));
            // If there's only one, just skip over to the deps.
            return nodes.length === 1
                ? this.getChildren(nodes[0])
                : nodes;
        }
        else if (element instanceof PackageDepProject) {
            return this.getPackages(element);
        }
        else if (element instanceof PackageDepPackage) {
            return this.getFilesAndFolders(element);
        }
        else if (element instanceof PackageDepFolder) {
            return this.getFilesAndFolders(element);
        }
        else if (element instanceof PackageDepFile) {
            return [];
        }
        else {
            log_1.logWarn(`Don't know how to show children of ${element.label}/${element.resourceUri}`);
            return [];
        }
    }
    getPackages(project) {
        const map = new package_map_1.PackageMap(path.join(utils_1.fsPath(project.resourceUri), ".packages"));
        const packages = map.packages;
        const packageNames = array_1.sortBy(Object.keys(packages), (s) => s.toLowerCase());
        return packageNames.filter((name) => name !== map.localPackageName).map((name) => {
            const path = packages[name];
            return new PackageDepPackage(`${name}`, vs.Uri.file(path));
        });
    }
    getFilesAndFolders(folder) {
        const childNames = array_1.sortBy(fs.readdirSync(utils_1.fsPath(folder.resourceUri)), (s) => s.toLowerCase());
        const folders = [];
        const files = [];
        childNames.forEach((name) => {
            const filePath = path.join(utils_1.fsPath(folder.resourceUri), name);
            const stat = fs.statSync(filePath);
            if (stat.isFile()) {
                files.push(new PackageDepFile(vs.Uri.file(filePath)));
            }
            else if (stat.isDirectory()) {
                folders.push(new PackageDepFolder(vs.Uri.file(filePath)));
            }
        });
        return [...folders, ...files];
    }
    dispose() {
        this.watcher.dispose();
    }
}
exports.DartPackagesProvider = DartPackagesProvider;
class PackageDep extends vs.TreeItem {
    constructor(label, resourceUri, collapsibleState) {
        super(label, collapsibleState);
        this.resourceUri = resourceUri;
        this.contextValue = "dependency";
    }
}
exports.PackageDep = PackageDep;
class PackageDepFile extends PackageDep {
    constructor(resourceUri) {
        super(undefined, resourceUri, vs.TreeItemCollapsibleState.None);
        this.command = {
            arguments: [resourceUri],
            command: "dart.package.openFile",
            title: "Open File",
        };
    }
}
exports.PackageDepFile = PackageDepFile;
class PackageDepFolder extends PackageDep {
    constructor(resourceUri) {
        super(undefined, resourceUri, vs.TreeItemCollapsibleState.Collapsed);
    }
}
exports.PackageDepFolder = PackageDepFolder;
class PackageDepProject extends PackageDep {
    constructor(resourceUri) {
        const projectFolder = utils_1.fsPath(resourceUri);
        super(path.basename(projectFolder), resourceUri, vs.TreeItemCollapsibleState.Collapsed);
        // Calculate relative path to the folder for the description.
        const wf = vs.workspace.getWorkspaceFolder(resourceUri);
        const workspaceFolder = utils_1.fsPath(wf.uri);
        this.description = path.relative(path.dirname(workspaceFolder), path.dirname(projectFolder));
    }
}
exports.PackageDepProject = PackageDepProject;
class PackageDepPackage extends PackageDep {
    constructor(label, resourceUri) {
        super(label, resourceUri, vs.TreeItemCollapsibleState.Collapsed);
    }
}
exports.PackageDepPackage = PackageDepPackage;
//# sourceMappingURL=packages_view.js.map