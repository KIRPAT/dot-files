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
const path = require("path");
const vscode_1 = require("vscode");
const analyzer_1 = require("../analysis/analyzer");
const utils_1 = require("../debug/utils");
const utils_2 = require("../utils");
class DartWorkspaceSymbolProvider {
    constructor(analyzer) {
        this.analyzer = analyzer;
        this.badChars = new RegExp("[^0-9a-z\-]", "gi");
    }
    provideWorkspaceSymbols(query, token) {
        return __awaiter(this, void 0, void 0, function* () {
            if (query.length === 0)
                return undefined;
            // Turn query into a case-insensitive fuzzy search.
            const pattern = ".*" + query.replace(this.badChars, "").split("").map((c) => `[${c.toUpperCase()}${c.toLowerCase()}]`).join(".*") + ".*";
            const results = yield this.analyzer.searchGetElementDeclarations({ pattern, maxResults: 500 });
            return results.declarations.map((d) => this.convertWorkspaceResult(d, results.files[d.fileIndex]));
        });
    }
    resolveWorkspaceSymbol(symbol, token) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(symbol instanceof PartialSymbolInformation))
                return undefined;
            const document = yield vscode_1.workspace.openTextDocument(vscode_1.Uri.file(symbol.locationData.file));
            symbol.location = new vscode_1.Location(document.uri, utils_2.toRange(document, symbol.locationData.offset, symbol.locationData.length));
            return symbol;
        });
    }
    convertWorkspaceResult(result, file) {
        const names = this.getNames(result, true, file);
        const symbol = new PartialSymbolInformation(names.name, analyzer_1.getSymbolKindForElementKind(result.kind), names.containerName, new vscode_1.Location(vscode_1.Uri.file(file), undefined));
        symbol.locationData = {
            file,
            length: result.codeLength,
            offset: result.codeOffset,
        };
        return symbol;
    }
    getNames(result, includeFilename, file) {
        let name = result.name;
        // Constructors don't come prefixed with class name, so add them for a nice display:
        //    () => MyClass()
        //    named() => MyClass.named()
        let nameIsPrefixedWithClass = false;
        if (result.kind === "CONSTRUCTOR" && result.className) {
            if (name) {
                nameIsPrefixedWithClass = true;
                name = `${result.className}.${name}`;
            }
            else {
                name = result.className;
            }
        }
        if (result.parameters && result.kind !== "SETTER")
            name += result.parameters;
        let containerName;
        if (includeFilename) {
            containerName = this.createDisplayPath(file);
            if (result.className && !nameIsPrefixedWithClass)
                name = `${result.className}.${name}`;
        }
        else {
            containerName = result.className;
        }
        return { name, containerName };
    }
    createDisplayPath(inputPath) {
        // HACK: The AS returns paths to the PUB_CACHE folder, which Code can't
        // convert to relative paths (so they look terrible). If the file exists in
        // workspace.rootPath we rewrite the path to there which gives us a nice
        // relative path.
        const root = vscode_1.workspace.getWorkspaceFolder(vscode_1.Uri.file(inputPath));
        if (root) {
            inputPath = root && path.relative(utils_2.fsPath(root.uri), inputPath);
        }
        else {
            const pathSlash = utils_1.escapeRegExp(path.sep);
            const notSlashes = `[^${pathSlash}]+`;
            const pattern = new RegExp(`.*${pathSlash}(?:hosted${pathSlash}${notSlashes}|git)${pathSlash}(${notSlashes})${pathSlash}(.*)`);
            const matches = pattern.exec(inputPath);
            if (matches && matches.length === 3) {
                // Packages in pubcache are versioned so trim the "-x.x.x" off the end of the foldername.
                const packageName = matches[1].split("-")[0];
                // Trim off anything up to lib/ to make it more like the uri you'd import.
                const libPrefix = `lib${path.sep}`;
                const libIndex = matches[2].indexOf(libPrefix);
                const filePath = libIndex !== -1
                    ? matches[2].substr(libIndex + libPrefix.length)
                    : matches[2];
                // Return 'package:foo/bar.dart'.
                inputPath = `package:${packageName}/${filePath.replace(/\\/g, "/")}`;
            }
            else {
                return undefined;
            }
        }
        return inputPath;
    }
}
exports.DartWorkspaceSymbolProvider = DartWorkspaceSymbolProvider;
class PartialSymbolInformation extends vscode_1.SymbolInformation {
}
//# sourceMappingURL=dart_workspace_symbol_provider.js.map