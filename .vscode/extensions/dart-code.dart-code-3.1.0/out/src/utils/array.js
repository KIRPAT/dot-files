"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function sortBy(items, f) {
    return items.sort((item1, item2) => {
        const r1 = f(item1);
        const r2 = f(item2);
        if (r1 < r2)
            return -1;
        if (r1 > r2)
            return 1;
        return 0;
    });
}
exports.sortBy = sortBy;
function not(f) {
    return (x) => !f(x);
}
exports.not = not;
//# sourceMappingURL=array.js.map