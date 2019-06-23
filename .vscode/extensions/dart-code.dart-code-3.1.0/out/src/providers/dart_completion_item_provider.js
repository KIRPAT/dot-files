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
const vs = require("vscode");
const vscode_1 = require("vscode");
const edit_1 = require("../commands/edit");
const config_1 = require("../config");
const dartdocs_1 = require("../dartdocs");
const utils_1 = require("../debug/utils");
const utils_2 = require("../utils");
const log_1 = require("../utils/log");
// TODO: This code has become messy with the SuggestionSet changes. It could do with some refactoring
// (such as creating a mapping from CompletionSuggestion -> x and SuggestionSet -> x, and then x -> CompletionItem).
class DartCompletionItemProvider {
    constructor(analyzer) {
        this.analyzer = analyzer;
        this.disposables = [];
        this.cachedCompletions = {};
        this.disposables.push(analyzer.registerForCompletionAvailableSuggestions((n) => this.storeCompletionSuggestions(n)));
    }
    provideCompletionItems(document, position, token, context) {
        return __awaiter(this, void 0, void 0, function* () {
            const line = document.lineAt(position.line).text.slice(0, position.character);
            const nextCharacter = document.getText(new vscode_1.Range(position, position.translate({ characterDelta: 200 }))).trim().substr(0, 1);
            const conf = config_1.config.for(document.uri);
            const enableCommitCharacters = conf.enableCompletionCommitCharacters;
            const insertArgumentPlaceholders = !enableCommitCharacters && conf.insertArgumentPlaceholders && this.shouldAllowArgPlaceholders(line);
            if (!this.shouldAllowCompletion(line, context))
                return;
            const resp = yield this.analyzer.completionGetSuggestionsResults({
                file: utils_2.fsPath(document.uri),
                offset: document.offsetAt(position),
            });
            if (token.isCancellationRequested) {
                return undefined;
            }
            const includedResults = resp.results.map((r) => this.convertResult(document, nextCharacter, enableCommitCharacters, insertArgumentPlaceholders, resp, r));
            const cachedResults = yield this.getCachedResults(document, token, nextCharacter, enableCommitCharacters, insertArgumentPlaceholders, document.offsetAt(position), resp);
            yield utils_2.resolvedPromise;
            if (token.isCancellationRequested) {
                return undefined;
            }
            const allResults = [...includedResults, ...cachedResults];
            return new vscode_1.CompletionList(allResults);
        });
    }
    shouldAllowCompletion(line, context) {
        line = line.trim();
        // Filter out auto triggered completions on certain characters based on the previous
        // characters (eg. to allow completion on " if it's part of an import).
        if (context.triggerKind === vscode_1.CompletionTriggerKind.TriggerCharacter) {
            switch (context.triggerCharacter) {
                case "{":
                    return line.endsWith("${");
                case "'":
                    return line.endsWith("import '") || line.endsWith("export '");
                case "\"":
                    return line.endsWith("import \"") || line.endsWith("export \"");
                case "/":
                case "\\":
                    return line.startsWith("import \"") || line.startsWith("export \"")
                        || line.startsWith("import '") || line.startsWith("export '");
            }
        }
        // Otherwise, allow through.
        return true;
    }
    shouldAllowArgPlaceholders(line) {
        line = line.trim();
        // Disallow args on imports/exports since they're likely show/hide and
        // we only want the function name. This doesn't catch all cases (for ex.
        // where a show/hide is split across multiple lines) but it's better than
        // nothing. We'd need more semantic info to handle this better, and probably
        // this will go away if commit characters is fixed properly.
        if (line.startsWith("import \"") || line.startsWith("export \"")
            || line.startsWith("import '") || line.startsWith("export '")) {
            return false;
        }
        return true;
    }
    storeCompletionSuggestions(notification) {
        if (notification.changedLibraries) {
            for (const completionSet of notification.changedLibraries) {
                this.cachedCompletions[completionSet.id] = completionSet;
            }
        }
        if (notification.removedLibraries) {
            for (const completionSetID of notification.removedLibraries) {
                delete this.cachedCompletions[completionSetID];
            }
        }
    }
    resolveCompletionItem(item, token) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!item.suggestion)
                return;
            const res = yield this.analyzer.completionGetSuggestionDetails({
                file: item.filePath,
                id: item.suggestionSetID,
                label: item.suggestion.label,
                offset: item.offset,
            });
            if (token.isCancellationRequested) {
                return;
            }
            // Rebuild the completion using the additional resolved info.
            return this.createCompletionItemFromSuggestion(item.document, item.nextCharacter, item.enableCommitCharacters, item.insertArgumentPlaceholders, item.replacementOffset, item.replacementLength, item.autoImportUri, item.relevance, item.suggestion, res);
        });
    }
    createCompletionItemFromSuggestion(document, nextCharacter, enableCommitCharacters, insertArgumentPlaceholders, replacementOffset, replacementLength, displayUri, relevance, suggestion, resolvedResult) {
        const completionItem = this.makeCompletion(document, nextCharacter, enableCommitCharacters, insertArgumentPlaceholders, {
            autoImportUri: displayUri,
            completionText: (resolvedResult && resolvedResult.completion) || suggestion.label,
            displayText: undefined,
            docSummary: suggestion.docSummary,
            elementKind: suggestion.element ? suggestion.element.kind : undefined,
            isDeprecated: false,
            kind: undefined,
            parameterNames: suggestion.parameterNames,
            parameterType: undefined,
            parameters: suggestion.element ? suggestion.element.parameters : undefined,
            relevance,
            replacementLength,
            replacementOffset,
            requiredParameterCount: suggestion.requiredParameterCount,
            returnType: suggestion.element ? suggestion.element.returnType : undefined,
            selectionLength: resolvedResult && resolvedResult.change && resolvedResult.change.selection ? 0 : undefined,
            selectionOffset: resolvedResult && resolvedResult.change && resolvedResult.change.selection ? resolvedResult.change.selection.offset : undefined,
        });
        // Additional edits for the imports.
        if (resolvedResult && resolvedResult.change && resolvedResult.change.edits && resolvedResult.change.edits.length) {
            appendAdditionalEdits(completionItem, document, resolvedResult.change);
            if (displayUri)
                completionItem.detail = `Auto import from '${displayUri}'` + (completionItem.detail ? `\n\n${completionItem.detail}` : "");
        }
        return completionItem;
    }
    getCachedResults(document, token, nextCharacter, enableCommitCharacters, insertArgumentPlaceholders, offset, resp) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!resp.includedSuggestionSets || !resp.includedElementKinds)
                return [];
            // Create a fast lookup for which kinds to include.
            const elementKinds = {};
            resp.includedElementKinds.forEach((k) => elementKinds[k] = true);
            // Create a fast lookup for relevance boosts based on tag string.
            const tagBoosts = {};
            resp.includedSuggestionRelevanceTags.forEach((r) => tagBoosts[r.tag] = r.relevanceBoost);
            const filePath = utils_2.fsPath(document.uri);
            const suggestionSetResults = [];
            for (const includedSuggestionSet of resp.includedSuggestionSets) {
                // Because this work is expensive, we periodically (per suggestion
                // set) yield and check whether cancellation is pending and if so
                // stop and bail out to avoid doing redundant work.
                yield utils_2.resolvedPromise;
                if (token.isCancellationRequested) {
                    return undefined;
                }
                const suggestionSet = this.cachedCompletions[includedSuggestionSet.id];
                if (!suggestionSet) {
                    log_1.logWarn(`Suggestion set ${includedSuggestionSet.id} was not available and therefore not included in the completion results`);
                    return [];
                }
                const unresolvedItems = suggestionSet.items
                    .filter((r) => elementKinds[r.element.kind])
                    .map((suggestion) => {
                    // Calculate the relevance for this item.
                    let relevance = includedSuggestionSet.relevance;
                    if (suggestion.relevanceTags)
                        suggestion.relevanceTags.forEach((t) => relevance += (tagBoosts[t] || 0));
                    const completionItem = this.createCompletionItemFromSuggestion(document, nextCharacter, enableCommitCharacters, insertArgumentPlaceholders, resp.replacementOffset, resp.replacementLength, undefined, relevance, suggestion, undefined);
                    // Attach additional info that resolve will need.
                    const delayedCompletionItem = Object.assign({ autoImportUri: includedSuggestionSet.displayUri || suggestionSet.uri, document,
                        enableCommitCharacters,
                        filePath,
                        insertArgumentPlaceholders,
                        nextCharacter,
                        offset,
                        relevance, replacementLength: resp.replacementLength, replacementOffset: resp.replacementOffset, suggestion, suggestionSetID: includedSuggestionSet.id }, completionItem);
                    return delayedCompletionItem;
                });
                suggestionSetResults.push(unresolvedItems);
            }
            return [].concat(...suggestionSetResults);
        });
    }
    convertResult(document, nextCharacter, enableCommitCharacters, insertArgumentPlaceholders, notification, suggestion) {
        return this.makeCompletion(document, nextCharacter, enableCommitCharacters, insertArgumentPlaceholders, {
            completionText: suggestion.completion,
            displayText: suggestion.displayText,
            docSummary: suggestion.docSummary,
            elementKind: suggestion.element ? suggestion.element.kind : undefined,
            isDeprecated: suggestion.isDeprecated,
            kind: suggestion.kind,
            parameterNames: suggestion.parameterNames,
            parameterType: suggestion.parameterType,
            parameters: suggestion.element ? suggestion.element.parameters : undefined,
            relevance: suggestion.relevance,
            replacementLength: notification.replacementLength,
            replacementOffset: notification.replacementOffset,
            requiredParameterCount: suggestion.requiredParameterCount,
            returnType: suggestion.returnType,
            selectionLength: suggestion.selectionLength,
            selectionOffset: suggestion.selectionOffset,
        });
    }
    makeCompletion(document, nextCharacter, enableCommitCharacters, insertArgumentPlaceholders, suggestion) {
        const completionItemKind = suggestion.elementKind ? this.getElementKind(suggestion.elementKind) : undefined;
        let label = suggestion.displayText || suggestion.completionText;
        let detail = "";
        const completionText = new vscode_1.SnippetString();
        let triggerCompletion = false;
        const nextCharacterIsOpenParen = nextCharacter === "(";
        // If element has parameters (METHOD/CONSTRUCTOR/FUNCTION), show its parameters.
        if (suggestion.parameters && completionItemKind !== vscode_1.CompletionItemKind.Property && suggestion.kind !== "OVERRIDE"
            // Don't ever show if there is already a paren! (#969).
            && label.indexOf("(") === -1) {
            label += suggestion.parameters.length === 2 ? "()" : "(…)";
            detail = suggestion.parameters;
            const hasParams = suggestion.parameterNames && suggestion.parameterNames.length > 0;
            // Add placeholders for params to the completion.
            if (insertArgumentPlaceholders && hasParams && !nextCharacterIsOpenParen) {
                completionText.appendText(suggestion.completionText);
                const args = suggestion.parameterNames.slice(0, suggestion.requiredParameterCount);
                completionText.appendText("(");
                if (args.length) {
                    completionText.appendPlaceholder(args[0]);
                    for (const arg of args.slice(1)) {
                        completionText.appendText(", ");
                        completionText.appendPlaceholder(arg);
                    }
                }
                else
                    completionText.appendTabstop(0); // Put a tap stop between parens since there are optional args.
                completionText.appendText(")");
            }
            else if (insertArgumentPlaceholders && !nextCharacterIsOpenParen) {
                completionText.appendText(suggestion.completionText);
                completionText.appendText("(");
                if (hasParams)
                    completionText.appendTabstop(0);
                completionText.appendText(")");
            }
            else {
                completionText.appendText(suggestion.completionText);
            }
        }
        else if (suggestion.selectionOffset > 0) {
            const before = suggestion.completionText.slice(0, suggestion.selectionOffset);
            const selection = suggestion.completionText.slice(suggestion.selectionOffset, suggestion.selectionOffset + suggestion.selectionLength);
            // If we have a selection offset (eg. a place to put the cursor) but not any text to pre-select then
            // pop open the completion to help the user type the value.
            // Only do this if it ends with a space (argument completion), see #730.
            if (!selection && suggestion.completionText.slice(suggestion.selectionOffset - 1, suggestion.selectionOffset) === " ")
                triggerCompletion = true;
            const after = suggestion.completionText.slice(suggestion.selectionOffset + suggestion.selectionLength);
            completionText.appendText(before);
            if (selection)
                completionText.appendPlaceholder(selection);
            else
                completionText.appendTabstop(0);
            completionText.appendText(after);
        }
        else {
            completionText.appendText(suggestion.completionText);
        }
        // If we're a property, work out the type.
        if (completionItemKind === vscode_1.CompletionItemKind.Property) {
            // Setters appear as methods with one arg (and cause getters to not appear),
            // so treat them both the same and just display with the properties type.
            detail = suggestion.elementKind === "GETTER"
                ? suggestion.returnType
                // See https://github.com/dart-lang/sdk/issues/27747
                : suggestion.parameters ? suggestion.parameters.substring(1, suggestion.parameters.lastIndexOf(" ")) : "";
            // Otherwise, get return type from method.
        }
        else if (suggestion.returnType) {
            detail =
                detail === ""
                    ? suggestion.returnType
                    : detail + " → " + suggestion.returnType;
        }
        else if (suggestion.parameterType) {
            detail = suggestion.parameterType;
        }
        // If we have trailing commas (flutter) they look weird in the list, so trim the off (for display label only).
        if (label.endsWith(","))
            label = label.substr(0, label.length - 1).trim();
        // If we didnt have a CompletionItemKind from our element, base it on the CompletionSuggestionKind.
        // This covers things like Keywords that don't have elements.
        const kind = completionItemKind || (suggestion.kind ? this.getSuggestionKind(suggestion.kind, label) : undefined);
        const completion = new vscode_1.CompletionItem(label, kind);
        completion.label = label;
        completion.filterText = label.split("(")[0]; // Don't ever include anything after a ( in filtering.
        completion.kind = kind;
        completion.detail = (suggestion.isDeprecated ? "(deprecated) " : "") + detail;
        completion.documentation = new vscode_1.MarkdownString(dartdocs_1.cleanDartdoc(suggestion.docSummary));
        completion.insertText = completionText;
        completion.keepWhitespace = true;
        completion.range = new vscode_1.Range(document.positionAt(suggestion.replacementOffset), document.positionAt(suggestion.replacementOffset + suggestion.replacementLength));
        if (enableCommitCharacters)
            completion.commitCharacters = this.getCommitCharacters(suggestion.kind);
        const triggerCompletionsFor = ["import '';"];
        if (triggerCompletionsFor.indexOf(label) !== -1)
            triggerCompletion = true;
        // Handle folders in imports better.
        if (suggestion.kind === "IMPORT" && label.endsWith("/"))
            triggerCompletion = true;
        if (triggerCompletion) {
            completion.command = {
                command: "editor.action.triggerSuggest",
                title: "Suggest",
            };
        }
        // Relevance is a number, highest being best. Code sorts by text, so subtract from a large number so that
        // a text sort will result in the correct order.
        // 555 -> 999455
        //  10 -> 999990
        //   1 -> 999999
        completion.sortText = (1000000 - suggestion.relevance).toString() + label.trim();
        return completion;
    }
    getSuggestionKind(kind, label) {
        switch (kind) {
            case "ARGUMENT_LIST":
                return vscode_1.CompletionItemKind.Variable;
            case "IMPORT":
                return label.startsWith("dart:")
                    ? vscode_1.CompletionItemKind.Module
                    : path.extname(label.toLowerCase()) === ".dart"
                        ? vscode_1.CompletionItemKind.File
                        : vscode_1.CompletionItemKind.Folder;
            case "IDENTIFIER":
                return vscode_1.CompletionItemKind.Variable;
            case "INVOCATION":
                return vscode_1.CompletionItemKind.Method;
            case "KEYWORD":
                return vscode_1.CompletionItemKind.Keyword;
            case "NAMED_ARGUMENT":
                return vscode_1.CompletionItemKind.Variable;
            case "OPTIONAL_ARGUMENT":
                return vscode_1.CompletionItemKind.Variable;
            case "PARAMETER":
                return vscode_1.CompletionItemKind.Value;
        }
    }
    getElementKind(kind) {
        switch (kind) {
            case "CLASS":
            case "CLASS_TYPE_ALIAS":
                return vscode_1.CompletionItemKind.Class;
            case "COMPILATION_UNIT":
                return vscode_1.CompletionItemKind.Module;
            case "CONSTRUCTOR":
            case "CONSTRUCTOR_INVOCATION":
                return vscode_1.CompletionItemKind.Constructor;
            case "ENUM":
                return vscode_1.CompletionItemKind.Enum;
            case "ENUM_CONSTANT":
                return vscode_1.CompletionItemKind.EnumMember;
            case "FIELD":
                return vscode_1.CompletionItemKind.Field;
            case "FILE":
                return vscode_1.CompletionItemKind.File;
            case "FUNCTION":
            case "FUNCTION_TYPE_ALIAS":
                return vscode_1.CompletionItemKind.Function;
            case "GETTER":
                return vscode_1.CompletionItemKind.Property;
            case "LABEL":
            case "LIBRARY":
                return vscode_1.CompletionItemKind.Module;
            case "LOCAL_VARIABLE":
                return vscode_1.CompletionItemKind.Variable;
            case "METHOD":
                return vscode_1.CompletionItemKind.Method;
            case "PARAMETER":
            case "PREFIX":
                return vscode_1.CompletionItemKind.Variable;
            case "SETTER":
                return vscode_1.CompletionItemKind.Property;
            case "TOP_LEVEL_VARIABLE":
            case "TYPE_PARAMETER":
                return vscode_1.CompletionItemKind.Variable;
            case "UNIT_TEST_GROUP":
                return vscode_1.CompletionItemKind.Module;
            case "UNIT_TEST_TEST":
                return vscode_1.CompletionItemKind.Method;
            case "UNKNOWN":
                return vscode_1.CompletionItemKind.Value;
        }
    }
    getCommitCharacters(kind) {
        switch (kind) {
            case "IDENTIFIER":
            case "INVOCATION":
                return [".", ",", "(", "["];
        }
    }
    dispose() {
        this.disposables.forEach((d) => d.dispose());
    }
}
exports.DartCompletionItemProvider = DartCompletionItemProvider;
function appendAdditionalEdits(completionItem, document, change) {
    if (!change)
        return undefined;
    // VS Code expects offsets to be based on the original document, but the analysis server provides
    // them assuming all previous edits have already been made. This means if the server provides us a
    // set of edits where any edits offset is *equal to or greater than* a previous edit, it will do the wrong thing.
    // If this happens; we will fall back to sequential edits and write a warning.
    const hasProblematicEdits = edit_1.hasOverlappingEdits(change);
    if (hasProblematicEdits) {
        log_1.logError("Unable to insert imports because of overlapping edits from the server.");
        vs.window.showErrorMessage(`Unable to insert imports because of overlapping edits from the server`);
        return undefined;
    }
    const filePath = utils_2.fsPath(document.uri);
    const thisFilesEdits = change.edits.filter((e) => e.file === filePath);
    const otherFilesEdits = change.edits.filter((e) => e.file !== filePath);
    if (thisFilesEdits.length) {
        completionItem.additionalTextEdits = utils_1.flatMap(thisFilesEdits, (edit) => {
            return edit.edits.map((edit) => {
                const range = new vs.Range(document.positionAt(edit.offset), document.positionAt(edit.offset + edit.length));
                return new vs.TextEdit(range, edit.replacement);
            });
        });
    }
    if (otherFilesEdits.length) {
        const filteredSourceChange = {
            edits: otherFilesEdits,
            id: change.id,
            linkedEditGroups: undefined,
            message: change.message,
            selection: change.selection,
        };
        completionItem.command = {
            arguments: [document, filteredSourceChange],
            command: "_dart.applySourceChange",
            title: "Automatically add imports",
        };
    }
}
//# sourceMappingURL=dart_completion_item_provider.js.map