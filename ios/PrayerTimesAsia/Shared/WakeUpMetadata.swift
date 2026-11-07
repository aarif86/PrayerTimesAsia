#if canImport(AlarmKit)
import AlarmKit

/// What the prayer alarms carry (nothing extra). Shared with the widgets, which
/// show the snooze countdown on the Lock Screen and in the Dynamic Island.
@available(iOS 26.0, *)
struct WakeUpMetadata: AlarmMetadata {}
#endif
