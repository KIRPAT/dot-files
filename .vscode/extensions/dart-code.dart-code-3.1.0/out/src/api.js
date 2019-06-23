"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vs = require("vscode");
class DartExtensionApi {
    constructor() {
        this.version = 1;
        this.flutterCreateSampleProject = () => vs.commands.executeCommand("_dart.flutter.createSampleProject");
    }
}
exports.DartExtensionApi = DartExtensionApi;
//# sourceMappingURL=api.js.map