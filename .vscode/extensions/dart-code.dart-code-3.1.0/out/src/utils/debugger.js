"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const knownInfrastructureThreadPrefixes = ["pub.dart.snapshot", "test.dart.snapshot"];
function isKnownInfrastructureThread(thread) {
    return thread && thread.name && !!knownInfrastructureThreadPrefixes.find((p) => thread.name.startsWith(p));
}
exports.isKnownInfrastructureThread = isKnownInfrastructureThread;
//# sourceMappingURL=debugger.js.map