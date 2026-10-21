import CoreLocation
import Foundation
import Observation

/// GPS position and compass heading. When-in-use only: prayer times are
/// recomputed whenever the app opens, which is when a traveller looks.
@Observable
final class LocationService: NSObject, CLLocationManagerDelegate {
    private(set) var authorization: CLAuthorizationStatus = .notDetermined
    private(set) var location: CLLocation?
    /// Degrees clockwise from true north (magnetic if true north is unavailable).
    private(set) var heading: Double?
    /// Negative means invalid; large values mean the compass needs calibrating.
    private(set) var headingAccuracy: Double = -1

    var headingAvailable: Bool { CLLocationManager.headingAvailable() }
    var isAuthorized: Bool { authorization == .authorizedWhenInUse || authorization == .authorizedAlways }
    var isDenied: Bool { authorization == .denied || authorization == .restricted }

    @ObservationIgnored private let manager = CLLocationManager()
    @ObservationIgnored private var headingClients = 0

    override init() {
        super.init()
        authorization = manager.authorizationStatus
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
        manager.distanceFilter = 500
        manager.headingFilter = 1
    }

    func requestPermission() {
        manager.requestWhenInUseAuthorization()
    }

    func refresh() {
        guard isAuthorized else { return }
        manager.startUpdatingLocation()
    }

    func beginHeading() {
        headingClients += 1
        if headingClients == 1, headingAvailable { manager.startUpdatingHeading() }
    }

    func endHeading() {
        headingClients = max(0, headingClients - 1)
        if headingClients == 0 { manager.stopUpdatingHeading() }
    }

    // MARK: CLLocationManagerDelegate

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        authorization = manager.authorizationStatus
        if isAuthorized { manager.startUpdatingLocation() }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let latest = locations.last, latest.horizontalAccuracy >= 0 else { return }
        location = latest
        // One good fix is enough for prayer times; stop to save battery.
        if latest.horizontalAccuracy < 1000 { manager.stopUpdatingLocation() }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateHeading newHeading: CLHeading) {
        heading = newHeading.trueHeading >= 0 ? newHeading.trueHeading : newHeading.magneticHeading
        headingAccuracy = newHeading.headingAccuracy
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        // Transient (no fix yet) - keep the last known location.
    }

    func locationManagerShouldDisplayHeadingCalibration(_ manager: CLLocationManager) -> Bool { true }
}
