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
const fs = require("fs");
const https = require("https");
const os = require("os");
const path = require("path");
const utils_1 = require("../utils");
const fs_1 = require("../utils/fs");
const processes_1 = require("../utils/processes");
const utils_2 = require("./utils");
function getFlutterSnippets(sdks, capabilities) {
    if (capabilities.supportsFlutterCreateListSamples)
        return getFlutterSnippetsFromSdk(sdks);
    return getFlutterSnippetsFromWeb();
}
exports.getFlutterSnippets = getFlutterSnippets;
function getFlutterSnippetsFromSdk(sdks) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!sdks.flutter)
            throw new Error("Flutter SDK not available");
        const binPath = path.join(sdks.flutter, utils_2.flutterPath);
        const fileName = `flutter-samples-${utils_1.getRandomInt(0x1000, 0x10000).toString(16)}.txt`;
        const tempPath = path.join(os.tmpdir(), fileName);
        try {
            const res = yield processes_1.runProcess(undefined, binPath, ["create", "--list-samples", tempPath]);
            if (res.exitCode !== 0)
                throw new Error(`Failed to get Flutter samples from SDK (${res.exitCode})\n\n${res.stderr}\n\n${res.stdout}`);
            const json = fs.readFileSync(tempPath, { encoding: "utf8" });
            return JSON.parse(json);
        }
        finally {
            fs_1.tryDeleteFile(tempPath);
        }
    });
}
function getFlutterSnippetsFromWeb() {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: "api.flutter.dev",
            method: "GET",
            path: "/snippets/index.json",
            port: 443,
        };
        const req = https.request(options, (resp) => {
            if (!resp || !resp.statusCode || resp.statusCode < 200 || resp.statusCode > 300) {
                reject({ message: `Failed to get Flutter samples ${resp && resp.statusCode}: ${resp && resp.statusMessage}` });
            }
            else {
                const chunks = [];
                resp.on("data", (b) => chunks.push(b.toString()));
                resp.on("end", () => {
                    const json = chunks.join("");
                    resolve(JSON.parse(json));
                });
            }
        });
        req.end();
    });
}
//# sourceMappingURL=flutter_docs_snippets.js.map