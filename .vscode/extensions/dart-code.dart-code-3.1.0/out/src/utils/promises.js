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
function waitFor(action, checkEveryMilliseconds = 500, tryForMilliseconds = 10000, token) {
    return __awaiter(this, void 0, void 0, function* () {
        let timeRemaining = tryForMilliseconds;
        while (timeRemaining > 0 && !(token && token.isCancellationRequested)) {
            const res = action();
            if (res)
                return res;
            yield new Promise((resolve) => setTimeout(resolve, checkEveryMilliseconds));
            timeRemaining -= checkEveryMilliseconds;
        }
    });
}
exports.waitFor = waitFor;
//# sourceMappingURL=promises.js.map