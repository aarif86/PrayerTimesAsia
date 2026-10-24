package com.prayertimesasia.app.data

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Address
import android.location.Geocoder
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Looper
import androidx.core.content.ContextCompat
import com.prayertimesasia.core.AsiaRegions
import com.prayertimesasia.core.Cities
import com.prayertimesasia.core.Coordinates
import com.prayertimesasia.core.Place
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import java.util.Locale
import java.util.TimeZone
import kotlin.coroutines.resume

/**
 * GPS position through the platform LocationManager - no Google Play services,
 * so it works on any Android. One good fix is enough for prayer times; the
 * position never leaves the phone.
 */
class LocationService(private val context: Context) {
    private val manager = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager?
    private var listener: LocationListener? = null

    val hasPermission: Boolean
        get() = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED

    /** Starts listening (if allowed) and reports the last known fix straight away. */
    @SuppressLint("MissingPermission")
    fun refresh(onLocation: (Location) -> Unit) {
        val lm = manager ?: return
        if (!hasPermission) return
        stop()
        val providers = runCatching { lm.getProviders(true) }.getOrDefault(emptyList())
        providers.mapNotNull { runCatching { lm.getLastKnownLocation(it) }.getOrNull() }
            .maxByOrNull { it.time }?.let(onLocation)
        val l = object : LocationListener {
            override fun onLocationChanged(location: Location) {
                onLocation(location)
                if (location.hasAccuracy() && location.accuracy < 1000) stop()
            }

            @Deprecated("Deprecated in Java")
            override fun onStatusChanged(provider: String?, status: Int, extras: android.os.Bundle?) {}
            override fun onProviderEnabled(provider: String) {}
            override fun onProviderDisabled(provider: String) {}
        }
        listener = l
        for (p in listOf(LocationManager.NETWORK_PROVIDER, LocationManager.GPS_PROVIDER)) {
            if (p in providers) runCatching { lm.requestLocationUpdates(p, 10_000L, 500f, l, Looper.getMainLooper()) }
        }
    }

    fun stop() {
        listener?.let { l -> runCatching { manager?.removeUpdates(l) } }
        listener = null
    }

    /** A place for a fix: reverse-geocoded when a geocoder is available, else a guess from the phone's time zone. */
    suspend fun place(location: Location): Place {
        val coords = Coordinates(location.latitude, location.longitude)
        val tz = TimeZone.getDefault().id
        val guess = AsiaRegions.countryCode(tz)
        val offline = Place(name = "Current location", countryCode = guess, countryName = AsiaRegions.profile(guess)?.name,
            timeZoneId = tz, coordinates = coords)
        val address = reverse(location.latitude, location.longitude) ?: return offline
        val code = address.countryCode
        return Place(
            name = address.subLocality ?: address.locality ?: address.adminArea ?: address.countryName ?: "Current location",
            region = if (address.subLocality != null) address.locality else address.adminArea,
            countryCode = code,
            countryName = AsiaRegions.profile(code)?.name ?: address.countryName,
            timeZoneId = tz,
            coordinates = coords,
            district = address.subAdminArea,
        )
    }

    private suspend fun reverse(lat: Double, lng: Double): Address? {
        if (!Geocoder.isPresent()) return null
        val geocoder = Geocoder(context, Locale.ENGLISH)
        return if (Build.VERSION.SDK_INT >= 33) {
            suspendCancellableCoroutine { cont ->
                runCatching {
                    geocoder.getFromLocation(lat, lng, 1, object : Geocoder.GeocodeListener {
                        override fun onGeocode(addresses: MutableList<Address>) { if (cont.isActive) cont.resume(addresses.firstOrNull()) }
                        override fun onError(errorMessage: String?) { if (cont.isActive) cont.resume(null) }
                    })
                }.onFailure { if (cont.isActive) cont.resume(null) }
            }
        } else {
            withContext(Dispatchers.IO) {
                @Suppress("DEPRECATION")
                runCatching { geocoder.getFromLocation(lat, lng, 1)?.firstOrNull() }.getOrNull()
            }
        }
    }

    /**
     * City search for planning a trip or when GPS is off: the built-in list of
     * Asian cities first (works offline), then the phone's own geocoder if it has one.
     */
    suspend fun search(query: String): List<Place> {
        val local = Cities.search(query).map { it.place() }
        if (query.trim().length < 3 || !Geocoder.isPresent()) return local
        val geocoder = Geocoder(context, Locale.ENGLISH)
        val found: List<Address> = if (Build.VERSION.SDK_INT >= 33) {
            suspendCancellableCoroutine { cont ->
                runCatching {
                    geocoder.getFromLocationName(query, 6, object : Geocoder.GeocodeListener {
                        override fun onGeocode(addresses: MutableList<Address>) { if (cont.isActive) cont.resume(addresses.toList()) }
                        override fun onError(errorMessage: String?) { if (cont.isActive) cont.resume(emptyList()) }
                    })
                }.onFailure { if (cont.isActive) cont.resume(emptyList()) }
            }
        } else {
            withContext(Dispatchers.IO) {
                @Suppress("DEPRECATION")
                runCatching { geocoder.getFromLocationName(query, 6) ?: emptyList() }.getOrDefault(emptyList())
            }
        }
        val geocoded = found.filter { it.hasLatitude() && it.hasLongitude() }.map { a ->
            val coords = Coordinates(a.latitude, a.longitude)
            val code = a.countryCode
            Place(
                name = a.featureName?.takeIf { it.any(Char::isLetter) } ?: a.locality ?: a.adminArea ?: query,
                region = a.adminArea,
                countryCode = code,
                countryName = AsiaRegions.profile(code)?.name ?: a.countryName,
                timeZoneId = Cities.zoneFor(coords, code) ?: TimeZone.getDefault().id,
                coordinates = coords,
                district = a.subAdminArea,
            )
        }
        return (local + geocoded.filter { g -> local.none { it.isNear(g) } }).take(12)
    }
}
