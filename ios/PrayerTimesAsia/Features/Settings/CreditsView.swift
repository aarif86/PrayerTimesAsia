import SwiftUI

/// Every source, its licence and its attribution line (brief §5.4). Required by
/// the Singapore Open Data Licence and good manners for everything else.
struct CreditsView: View {
    private struct Credit: Identifiable {
        let id = UUID()
        let title: String
        let detail: String
        let url: String?
    }

    private let timetables: [Credit] = [
        Credit(title: "MUIS - Singapore",
               detail: "Contains information from the Muslim Prayer Timetable accessed from data.gov.sg, which is made available under the terms of the Singapore Open Data Licence version 1.0.",
               url: "https://data.gov.sg/open-data-licence"),
        Credit(title: "JAKIM e-Solat - Malaysia",
               detail: "Official prayer times by zone from Jabatan Kemajuan Islam Malaysia (e-solat.gov.my).",
               url: "https://www.e-solat.gov.my"),
        Credit(title: "Kemenag - Indonesia",
               detail: "Kementerian Agama (Bimas Islam) schedules via the myquran.com community API.",
               url: "https://api.myquran.com"),
        Credit(title: "KHEU - Brunei",
               detail: "Official prayer times by zone from the Ministry of Religious Affairs, Brunei (Kementerian Hal Ehwal Ugama), from its printed Taqwim.",
               url: "https://www.mora.gov.bn"),
        Credit(title: "Brunei timetable",
               detail: "The ministry's Taqwim, read and checked by Faruq Rasid's open prayertimes-database (GPL 3.0), with thanks.",
               url: "https://github.com/ruqqq/prayertimes-database"),
        Credit(title: "JAKIM zone boundaries",
               detail: "District-to-zone mapping from mptwaktusolat/malaysia.geojson; one reference point per district is used.",
               url: "https://github.com/mptwaktusolat/malaysia.geojson"),
    ]

    private let other: [Credit] = [
        Credit(title: W("settings.calculation"),
               detail: "On-device solar calculation after praytimes.org; method presets as published by MUIS, JAKIM, Kemenag, the Muslim World League, Karachi, Umm al-Qura, Diyanet and others.",
               url: "https://praytimes.org/wiki/Calculation_Methods"),
        Credit(title: "Maps and places",
               detail: "Apple Maps (MapKit) for search, nearby masjids and directions. Nearby masjids also from OpenStreetMap (© OpenStreetMap contributors, ODbL) via the Overpass API.",
               url: "https://www.openstreetmap.org/copyright"),
        Credit(title: "Prayer rooms",
               detail: "The musolla database on GitHub (LGPL 3.0), started by the KalamApps and PrayerTime.SG teams and kept by volunteers, for prayer rooms in malls, schools and sports centres. Our copy and fixes are shared back in the open.",
               url: "https://github.com/aarif86/musolla-database"),
        Credit(title: "Community data",
               detail: "Masjid timetables and method confirmations from contributors, shared under CC-BY 4.0.",
               url: "https://prayertimes.asia/verify.html"),
        Credit(title: W("all.azanName"),
               detail: "The azan voices are Asim Javed, from the ICR masjid's own collection on the Internet Archive (public domain, CC0), Ahmed Khalaf, his own recordings (CC BY 4.0), and the Makkah azan as recorded at Masjid al-Haram by Seyfula Islam (CC BY 3.0, Wikimedia Commons). The Al-Aqsa azan is \"Masjidul Aqsa Athan, Pt. 1\" from Athans from the Holy Lands (2018), courtesy of SIMTECHCDS (Simtech Productions, Durban), used with their kind permission. With thanks to them all.",
               url: "https://archive.org/details/icr-friday-prayer-2nd-adhan-17th-may-2024-9th-dhul-qadah-1445-by-asim-javed"),
        Credit(title: "Design",
               detail: "The Colour Bands look and the prayer colours are inspired by prayertimes.sg & my by Awsam Tech LLP, the Singapore and Malaysia app. It was built by a team at Awsam Tech LLP and redesigned by Ustaz Shahib Amin Syukran, with thanks to them both.",
               url: "https://www.awsamtech.com/"),
        Credit(title: "This app",
               detail: "Open source under the GNU AGPL 3.0 licence. Made by Aarif Raziff.",
               url: "https://github.com/aarif86/PrayerTimesAsia"),
    ]

    var body: some View {
        List {
            Section(W("phone.officialTimetables")) { ForEach(timetables) { row($0) } }
            Section(W("phone.credits.also")) { ForEach(other) { row($0) } }
        }
        .navigationTitle(W("settings.sources"))
    }

    @ViewBuilder
    private func row(_ c: Credit) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(c.title).font(.subheadline.weight(.semibold))
            Text(c.detail).font(.footnote).foregroundStyle(.secondary)
            if let s = c.url, let url = URL(string: s) {
                Link(s.replacingOccurrences(of: "https://", with: ""), destination: url).font(.footnote)
            }
        }
        .padding(.vertical, 2)
    }
}
