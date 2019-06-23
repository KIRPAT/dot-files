"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_1 = require("vscode");
const decorators_1 = require("../utils/decorators");
const cacheDuration = 60 * 60 * 1000;
class EnvironmentVariablesProvider {
    constructor(envVarsService, disposableRegistry, platformService, workspaceService, configurationService, process) {
        this.envVarsService = envVarsService;
        this.platformService = platformService;
        this.workspaceService = workspaceService;
        this.configurationService = configurationService;
        this.process = process;
        this.trackedWorkspaceFolders = new Set();
        this.fileWatchers = new Map();
        this.disposables = [];
        disposableRegistry.push(this);
        this.changeEventEmitter = new vscode_1.EventEmitter();
        const disposable = this.workspaceService.onDidChangeConfiguration(this.configurationChanged, this);
        this.disposables.push(disposable);
    }
    get onDidEnvironmentVariablesChange() {
        return this.changeEventEmitter.event;
    }
    dispose() {
        this.changeEventEmitter.dispose();
        this.fileWatchers.forEach(watcher => {
            if (watcher) {
                watcher.dispose();
            }
        });
    }
    getEnvironmentVariables(resource) {
        return __awaiter(this, void 0, void 0, function* () {
            const settings = this.configurationService.getSettings(resource);
            const workspaceFolderUri = this.getWorkspaceFolderUri(resource);
            this.trackedWorkspaceFolders.add(workspaceFolderUri ? workspaceFolderUri.fsPath : '');
            this.createFileWatcher(settings.envFile, workspaceFolderUri);
            let mergedVars = yield this.envVarsService.parseFile(settings.envFile, this.process.env);
            if (!mergedVars) {
                mergedVars = {};
            }
            this.envVarsService.mergeVariables(this.process.env, mergedVars);
            const pathVariable = this.platformService.pathVariableName;
            const pathValue = this.process.env[pathVariable];
            if (pathValue) {
                this.envVarsService.appendPath(mergedVars, pathValue);
            }
            if (this.process.env.PYTHONPATH) {
                this.envVarsService.appendPythonPath(mergedVars, this.process.env.PYTHONPATH);
            }
            return mergedVars;
        });
    }
    configurationChanged(e) {
        this.trackedWorkspaceFolders.forEach(item => {
            const uri = item && item.length > 0 ? vscode_1.Uri.file(item) : undefined;
            if (e.affectsConfiguration('python.envFile', uri)) {
                this.onEnvironmentFileChanged(uri);
            }
        });
    }
    createFileWatcher(envFile, workspaceFolderUri) {
        if (this.fileWatchers.has(envFile)) {
            return;
        }
        const envFileWatcher = this.workspaceService.createFileSystemWatcher(envFile);
        this.fileWatchers.set(envFile, envFileWatcher);
        if (envFileWatcher) {
            this.disposables.push(envFileWatcher.onDidChange(() => this.onEnvironmentFileChanged(workspaceFolderUri)));
            this.disposables.push(envFileWatcher.onDidCreate(() => this.onEnvironmentFileChanged(workspaceFolderUri)));
            this.disposables.push(envFileWatcher.onDidDelete(() => this.onEnvironmentFileChanged(workspaceFolderUri)));
        }
    }
    getWorkspaceFolderUri(resource) {
        if (!resource) {
            return;
        }
        const workspaceFolder = this.workspaceService.getWorkspaceFolder(resource);
        return workspaceFolder ? workspaceFolder.uri : undefined;
    }
    onEnvironmentFileChanged(workspaceFolderUri) {
        decorators_1.clearCachedResourceSpecificIngterpreterData('getEnvironmentVariables', workspaceFolderUri);
        decorators_1.clearCachedResourceSpecificIngterpreterData('CustomEnvironmentVariables', workspaceFolderUri);
        this.changeEventEmitter.fire(workspaceFolderUri);
    }
}
__decorate([
    decorators_1.cacheResourceSpecificInterpreterData('getEnvironmentVariables', cacheDuration)
], EnvironmentVariablesProvider.prototype, "getEnvironmentVariables", null);
exports.EnvironmentVariablesProvider = EnvironmentVariablesProvider;
//# sourceMappingURL=environmentVariablesProvider.js.map