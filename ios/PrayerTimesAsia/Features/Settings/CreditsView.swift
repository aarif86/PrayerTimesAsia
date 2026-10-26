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
        Credit(title: "JAKIM zone boundaries",
               detail: "District-to-zone mapping from mptwaktusolat/malaysia.geojson; one reference point per district is used.",
               url: "https://github.com/mptwaktusolat/malaysia.geojson"),
    ]

    private let other: [Credit] = [
        Credit(title: "Calculation",
               detail: "On-device solar calculation after praytimes.org; method presets as published by MUIS, JAKIM, Kemenag, the Muslim World League, Karachi, Umm al-Qura, Diyanet and others.",
               url: "https://praytimes.org/wiki/Calculation_Methods"),
        Credit(title: "Maps and places",
               detail: "Apple Maps (MapKit) for search, nearby masjids and directions.",
               url: nil),
        Credit(title: "Community data",
               detail: "Masjid timetables and method confirmations from contributors, shared under CC-BY 4.0.",
               url: "https://github.com/aarif86/PrayerTimesAsia/blob/main/CONTRIBUTING.md"),
        Credit(title: "This app",
               detail: "Open source under the MIT licence. Made by Aarif Raziff.",
               url: "https://github.com/aarif86/PrayerTimesAsia"),
    ]

    var body: some View {
        List {
            Section("Official timetables") { ForEach(timetables) { row($0) } }
            Section("Also") { ForEach(other) { row($0) } }
        }
        .navigationTitle("Sources & credits")
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
