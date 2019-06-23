"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const vs = require("vscode");
const flutter_sample_handler_1 = require("./flutter_sample_handler");
class DartUriHandler {
    constructor(flutterCapabilities) {
        this.handlers = {
            "/flutter/sample/": new flutter_sample_handler_1.FlutterSampleUriHandler(flutterCapabilities),
        };
    }
    handleUri(uri) {
        return __awaiter(this, void 0, void 0, function* () {
            const handlerPrefix = Object.keys(this.handlers).find((key) => uri.path.startsWith(key));
            if (handlerPrefix) {
                yield this.handlers[handlerPrefix].handle(uri.path.substr(handlerPrefix.length));
            }
            else {
                vs.window.showErrorMessage(`No handler for '${uri.path}'. Check you have the latest version of the Dart plugin and try again.`);
            }
        });
    }
}
exports.DartUriHandler = DartUriHandler;
//# sourceMappingURL=uri_handler.js.map