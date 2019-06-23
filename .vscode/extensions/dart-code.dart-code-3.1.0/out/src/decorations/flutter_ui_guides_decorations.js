"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vs = require("vscode");
const open_file_tracker_1 = require("../analysis/open_file_tracker");
const config_1 = require("../config");
const utils_1 = require("../debug/utils");
const trackers_1 = require("../editing/trackers");
const utils_2 = require("../utils");
const nonBreakingSpace = "\xa0";
const verticalLine = "│";
const horizontalLine = "─";
const bottomCorner = "└";
const middleCorner = "├";
class FlutterUiGuideDecorations {
    constructor(analyzer) {
        this.analyzer = analyzer;
        this.disposables = [];
        this.borderDecoration = vs.window.createTextEditorDecorationType({
            rangeBehavior: vs.DecorationRangeBehavior.OpenOpen,
        });
        // Update any editor that becomes active.
        this.disposables.push(vs.window.onDidChangeActiveTextEditor((e) => this.buildForTextEditor(e)));
        if (config_1.config.previewFlutterUiGuidesCustomTracking) {
            this.tracker = new WidgetGuideTracker();
            this.disposables.push(this.tracker);
            // Subscribe to updates from the tracker so we can update on keypress without
            // waiting for new Outlines.
            this.tracker.onGuidesChanged(([doc, guides]) => this.buildFromUpdatedGuides(doc, guides));
        }
        // Update the current visible editor when we were registered.
        if (vs.window.activeTextEditor)
            this.buildForTextEditor(vs.window.activeTextEditor);
        // Whenever we get a new Flutter Outline, if it's for the active document,
        // update that too.
        this.disposables.push(this.analyzer.registerForFlutterOutline((on) => {
            const editor = vs.window.activeTextEditor;
            if (editor && editor.document && utils_2.fsPath(editor.document.uri) === on.file)
                this.buildFromOutline(editor, on.outline);
        }));
    }
    buildForTextEditor(editor) {
        if (editor && editor.document)
            this.buildFromOutline(editor, open_file_tracker_1.OpenFileTracker.getFlutterOutlineFor(editor.document.uri));
    }
    buildFromOutline(editor, outline) {
        if (this.tracker)
            this.tracker.clear();
        if (!editor || !editor.document || !outline)
            return;
        // Check that the outline we got looks like it still matches the document.
        // If the lengths are different, just bail without doing anything since
        // there have probably been new edits and we'll get a new outline soon.
        if (editor.document.getText().length !== outline.length)
            return;
        const guides = this.extractGuides(editor.document, outline);
        if (this.tracker)
            this.tracker.trackDoc(editor.document, guides);
        this.renderGuides(editor, guides, "#A3A3A3");
    }
    buildFromUpdatedGuides(doc, guides) {
        if (vs.window.activeTextEditor && vs.window.activeTextEditor.document === doc)
            this.renderGuides(vs.window.activeTextEditor, guides, "#A3A3A3" /*"#FFA3A3"*/);
    }
    renderGuides(editor, guides, color) {
        const guidesByLine = {};
        for (const guide of guides) {
            for (let line = guide.start.line; line <= guide.end.line; line++) {
                guidesByLine[line] = guidesByLine[line] || [];
                guidesByLine[line].push(guide);
            }
        }
        const decorations = this.buildDecorations(editor.document, guidesByLine, color);
        editor.setDecorations(this.borderDecoration, decorations);
    }
    buildDecorations(doc, guidesByLine, color) {
        const decorations = [];
        for (const line of Object.keys(guidesByLine).map((k) => parseInt(k, 10))) {
            const lineInfo = doc.lineAt(line);
            const firstGuideChar = Math.min(...guidesByLine[line].map((g) => Math.min(g.start.character, g.end.character)));
            const lastGuideChar = Math.max(...guidesByLine[line].map((g) => Math.max(g.start.character, g.end.character)));
            const lastLineCharacter = lineInfo.range.end.character;
            const anchorPoint = lastLineCharacter < firstGuideChar ? 0 : firstGuideChar;
            const decorationString = new Array(lastGuideChar).fill(nonBreakingSpace);
            for (const guide of guidesByLine[line]) {
                if (line !== guide.end.line) {
                    decorationString[guide.start.character] = verticalLine;
                }
                else {
                    for (let c = guide.start.character; c <= guide.end.character; c++) {
                        if (guide.isLast && c === guide.start.character) {
                            decorationString[c] = bottomCorner;
                        }
                        else if (!guide.isLast && c === guide.start.character) {
                            decorationString[c] = middleCorner;
                        }
                        else if (c === guide.start.character) {
                            decorationString[c] = verticalLine;
                        }
                        else {
                            decorationString[c] = horizontalLine;
                        }
                    }
                }
            }
            // For any characters that have users text in them, we should not
            // render any guides.
            decorationString.fill(nonBreakingSpace, lineInfo.firstNonWhitespaceCharacterIndex, lineInfo.range.end.character);
            decorations.push({
                range: new vs.Range(new vs.Position(line, Math.max(anchorPoint, 0)), new vs.Position(line, Math.max(anchorPoint, 0))),
                renderOptions: {
                    before: {
                        color,
                        contentText: decorationString.join("").substring(Math.max(anchorPoint, 0)),
                        margin: "0 3px 0 -3px",
                        width: "0",
                    },
                },
            });
        }
        return decorations;
    }
    firstNonWhitespace(document, lineNumber) {
        return new vs.Position(lineNumber, document.lineAt(lineNumber).firstNonWhitespaceCharacterIndex);
    }
    extractGuides(document, node) {
        let guides = [];
        if (node.kind === "NEW_INSTANCE") {
            const parentLine = document.positionAt(node.offset).line;
            const childLines = node.children && node.children
                .map((c) => document.positionAt(c.offset).line)
                .filter((cl) => cl > parentLine);
            if (childLines) {
                const startPos = this
                    .firstNonWhitespace(document, parentLine);
                childLines.forEach((childLine, i) => {
                    const isLast = i === childLines.length - 1;
                    const firstCodeChar = this.firstNonWhitespace(document, childLine);
                    guides.push(new WidgetGuide(startPos, firstCodeChar, isLast));
                });
            }
        }
        // Recurse down the tree to include childrens (and they'll include their
        // childrens, etc.).
        if (node.children)
            guides = guides.concat(utils_1.flatMap(node.children, (c) => this.extractGuides(document, c)));
        return guides;
    }
    dispose() {
        this.disposables.forEach((s) => s.dispose());
    }
}
exports.FlutterUiGuideDecorations = FlutterUiGuideDecorations;
class WidgetGuide {
    constructor(start, end, isLast) {
        this.start = start;
        this.end = end;
        this.isLast = isLast;
    }
}
exports.WidgetGuide = WidgetGuide;
class WidgetGuideTracker {
    constructor() {
        this.disposables = [];
        this.tracker = new trackers_1.DocumentPositionTracker();
        this.guideMap = new Map();
        this.onGuidesChangedEmitter = new vs.EventEmitter();
        this.onGuidesChanged = this.onGuidesChangedEmitter.event;
        this.disposables.push(this.tracker);
        this.tracker.onPositionsChanged(([doc, positions]) => {
            // Map all our original positions onto new positions based on their
            // new offsets.
            const newGuides = [];
            for (const guide of this.guideMap.keys()) {
                const data = this.guideMap.get(guide);
                const currentStartPos = data[0];
                const currentEndPos = data[1];
                const isLast = data[2];
                const newStartPos = positions.get(currentStartPos);
                const newEndPos = positions.get(currentEndPos);
                if (newStartPos && newEndPos)
                    newGuides.push(new WidgetGuide(newStartPos, newEndPos, isLast));
            }
            this.onGuidesChangedEmitter.fire([doc, newGuides]);
        });
    }
    clear() {
        this.guideMap.clear();
        this.tracker.clear();
    }
    trackDoc(document, guides) {
        // Stash all guides as tuples containing their positions.
        this.guideMap.clear();
        for (const guide of guides)
            this.guideMap.set(guide, [guide.start, guide.end, guide.isLast]);
        // Extract a flat list of positions to track.
        const positions = utils_1.flatMap([...this.guideMap.values()], (g) => [g[0], g[1]]);
        this.tracker.trackDoc(document, positions);
    }
    dispose() {
        this.disposables.forEach((s) => s.dispose());
    }
}
//# sourceMappingURL=flutter_ui_guides_decorations.js.map