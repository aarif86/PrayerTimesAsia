import Foundation

enum Geo {
    static let kaaba = Coordinates(latitude: 21.422487, longitude: 39.826206)
    static let earthRadiusKm = 6371.0088

    /// Initial great-circle bearing from `from` to the Kaaba, degrees clockwise from true north.
    static func qiblaBearing(from: Coordinates) -> Double {
        bearing(from: from, to: kaaba)
    }

    static func bearing(from a: Coordinates, to b: Coordinates) -> Double {
        let φ1 = a.latitude * .pi / 180, φ2 = b.latitude * .pi / 180
        let Δλ = (b.longitude - a.longitude) * .pi / 180
        let y = sin(Δλ) * cos(φ2)
        let x = cos(φ1) * sin(φ2) - sin(φ1) * cos(φ2) * cos(Δλ)
        return Astro.fix(atan2(y, x) * 180 / .pi, 360)
    }

    /// Haversine distance in kilometres.
    static func distanceKm(_ a: Coordinates, _ b: Coordinates) -> Double {
        let φ1 = a.latitude * .pi / 180, φ2 = b.latitude * .pi / 180
        let dφ = φ2 - φ1
        let dλ = (b.longitude - a.longitude) * .pi / 180
        let h = sin(dφ / 2) * sin(dφ / 2) + cos(φ1) * cos(φ2) * sin(dλ / 2) * sin(dλ / 2)
        return 2 * earthRadiusKm * asin(min(1, sqrt(h)))
    }

    /// "NW", "WNW"... for the compass caption.
    static func compassPoint(_ degrees: Double) -> String {
        let points = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
                      "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]
        return points[Int((Astro.fix(degrees, 360) + 11.25) / 22.5) % 16]
    }

    /// Signed smallest difference a - b in (-180, 180].
    static func angleDelta(_ a: Double, _ b: Double) -> Double {
        var d = Astro.fix(a - b, 360)
        if d > 180 { d -= 360 }
        return d
    }
}
