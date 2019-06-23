"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Context {
    constructor(context) {
        this.context = context;
    }
    static for(context) {
        return new Context(context);
    }
    get devToolsNotificationsShown() { return this.context.globalState.get("devToolsNotificationsShown") || 0; }
    set devToolsNotificationsShown(value) { this.context.globalState.update("devToolsNotificationsShown", value); }
    get devToolsNotificationLastShown() { return this.context.globalState.get("devToolsNotificationLastShown"); }
    set devToolsNotificationLastShown(value) { this.context.globalState.update("devToolsNotificationLastShown", value); }
    get devToolsNotificationDoNotShow() { return !!this.context.globalState.get("devToolsNotificationDoNotShowAgain"); }
    set devToolsNotificationDoNotShow(value) { this.context.globalState.update("devToolsNotificationDoNotShowAgain", value); }
    get flutterSurvey2019Q2NotificationLastShown() { return this.context.globalState.get("flutterSurvey2019Q2NotificationLastShown"); }
    set flutterSurvey2019Q2NotificationLastShown(value) { this.context.globalState.update("flutterSurvey2019Q2NotificationLastShown", value); }
    get flutterSurvey2019Q2NotificationDoNotShow() { return !!this.context.globalState.get("flutterSurvey2019Q2NotificationDoNotShowAgain"); }
    set flutterSurvey2019Q2NotificationDoNotShow(value) { this.context.globalState.update("flutterSurvey2019Q2NotificationDoNotShowAgain", value); }
    get hasWarnedAboutFormatterSyntaxLimitation() { return !!this.context.globalState.get("hasWarnedAboutFormatterSyntaxLimitation"); }
    set hasWarnedAboutFormatterSyntaxLimitation(value) { this.context.globalState.update("hasWarnedAboutFormatterSyntaxLimitation", value); }
    get lastSeenVersion() { return this.context.globalState.get("lastSeenVersion"); }
    set lastSeenVersion(value) { this.context.globalState.update("lastSeenVersion", value); }
    getPackageLastCheckedForUpdates(packageID) { return this.context.globalState.get(`packageLastCheckedForUpdates:${packageID}`); }
    setPackageLastCheckedForUpdates(packageID, value) { this.context.globalState.update(`packageLastCheckedForUpdates:${packageID}`, value); }
    update(key, value) {
        return this.context.globalState.update(key, value);
    }
    get(key) {
        return this.context.globalState.get(key);
    }
    get subscriptions() { return this.context.subscriptions; }
}
exports.Context = Context;
//# sourceMappingURL=context.js.map