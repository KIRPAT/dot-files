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
const flutter_samples_1 = require("../sdk/flutter_samples");
class FlutterSampleUriHandler {
    constructor(flutterCapabilities) {
        this.flutterCapabilities = flutterCapabilities;
        this.validSampleIdentifierPattern = new RegExp("^[\\w\\.]+$");
    }
    handle(sampleID) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.isValidSampleName(sampleID)) {
                vs.window.showErrorMessage(`${sampleID} is not a valid Flutter sample identifier`);
                return;
            }
            flutter_samples_1.createFlutterSampleInTempFolder(this.flutterCapabilities, sampleID);
        });
    }
    isValidSampleName(name) {
        return this.validSampleIdentifierPattern.test(name);
    }
}
exports.FlutterSampleUriHandler = FlutterSampleUriHandler;
//# sourceMappingURL=flutter_sample_handler.js.map