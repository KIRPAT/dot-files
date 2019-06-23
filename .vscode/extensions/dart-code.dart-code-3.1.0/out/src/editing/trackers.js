"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vs = require("vscode");
class DocumentPositionTracker {
    constructor() {
        this.disposables = [];
        this.tracker = new DocumentOffsetTracker();
        this.positionMap = new Map();
        this.onPositionsChangedEmitter = new vs.EventEmitter();
        this.onPositionsChanged = this.onPositionsChangedEmitter.event;
        this.disposables.push(this.tracker);
        this.tracker.onOffsetsChanged(([doc, offsets]) => {
            // Map all our original positions onto new positions based on their
            // new offsets.
            const newPositions = new Map();
            for (const position of this.positionMap.keys()) {
                const currentOffset = this.positionMap.get(position);
                const newOffset = offsets.get(currentOffset);
                if (newOffset)
                    newPositions.set(position, doc.positionAt(newOffset));
            }
            this.onPositionsChangedEmitter.fire([doc, newPositions]);
        });
    }
    clear() {
        this.positionMap.clear();
        this.tracker.clear();
    }
    trackDoc(document, positions) {
        // Stash all positions as offsets.
        this.positionMap.clear();
        for (const position of positions)
            this.positionMap.set(position, document.offsetAt(position));
        // Track via the offset tracker.
        this.tracker.trackDoc(document, [...this.positionMap.values()]);
    }
    dispose() {
        this.disposables.forEach((s) => s.dispose());
    }
}
exports.DocumentPositionTracker = DocumentPositionTracker;
class DocumentOffsetTracker {
    constructor() {
        this.disposables = [];
        this.offsetMap = new Map();
        this.onOffsetsChangedEmitter = new vs.EventEmitter();
        this.onOffsetsChanged = this.onOffsetsChangedEmitter.event;
        this.disposables.push(vs.workspace.onDidChangeTextDocument((e) => this.handleUpdate(e)));
    }
    trackDoc(document, offsets) {
        this.document = document;
        // Set all offsets to just point to themeselves.
        this.offsetMap.clear();
        for (const offset of offsets)
            this.offsetMap.set(offset, offset);
    }
    clear() {
        this.document = undefined;
        this.offsetMap.clear();
    }
    handleUpdate(e) {
        if (e.document !== this.document)
            return;
        for (const offset of [...this.offsetMap.keys()]) {
            // The key (offset) is the original offset, which we must use in the
            // map to track the current offset.
            // updateOffset takes the *value*, since we need to map the "current" (not
            // original) value, and then updates the value in the map.
            const currentOffset = this.offsetMap.get(offset);
            const newOffset = this.updateOffset(currentOffset, e);
            this.offsetMap.set(offset, newOffset);
        }
        this.onOffsetsChangedEmitter.fire([e.document, this.offsetMap]);
    }
    updateOffset(offset, change) {
        // If any edit spans us, consider us deleted.
        if (change.contentChanges.find((edit) => edit.rangeOffset < offset && edit.rangeOffset + edit.rangeLength > offset)) {
            return undefined;
        }
        // Otherwise, shift us along to account for any edits before us.
        const totalDiff = change.contentChanges
            // Edits that end before us.
            .filter((edit) => edit.rangeOffset + edit.rangeLength <= offset)
            // Get the difference in lengths to know if we inserted or removed.
            .map((edit) => edit.text.length - edit.rangeLength)
            .reduce((total, n) => total + n, 0);
        return offset + totalDiff;
    }
    dispose() {
        this.disposables.forEach((s) => s.dispose());
    }
}
exports.DocumentOffsetTracker = DocumentOffsetTracker;
//# sourceMappingURL=trackers.js.map