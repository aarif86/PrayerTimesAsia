import SwiftUI

/// Falak for everyone (Nov 2026). A calm home that tells the story in four
/// parts: the Sky (slide the sun), Then (how Muslims read the sky), Now (try it
/// yourself) and Why it helps. The detailed tools from Falak Mode F1 stay, one
/// tap away under Expert tools. Everything here is Grade F, for learning, and
/// never in place of the authority's times.
struct FalakView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @Environment(\.look) private var look
    /// A main tab (no Done button) or a sheet.
    var isTab = false
    @State private var tab: Part = .sky
    @State private var showAR = false
    @State private var showLevel = false
    @State private var showExpert = false
    @State private var showSteps = false
    @State private var showCamera = false

    enum Part: String, CaseIterable, Identifiable {
        case sky = "Sky", then = "Then", now = "Now", why = "Why"
        var id: String { rawValue }
        var title: String {
            switch self {
            case .sky: W("falak.tabSky")
            case .then: W("falak.tabThen")
            case .now: W("common.now")
            case .why: W("falak.tabWhy")
            }
        }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                SkyNow()
                if let place = model.activePlace {
                    TimelineView(.periodic(from: .now, by: 30)) { context in
                        ScrollView {
                            VStack(spacing: 16) {
                                header
                                partPicker
                                switch tab {
                                case .sky:
                                    SkySliderCard(place: place, now: context.date)
                                    toolRows(place: place, now: context.date, full: false)
                                case .then: ThenStory()
                                case .now:
                                    toolRows(place: place, now: context.date, full: true)
                                    SunSafetyCard()
                                case .why: WhyItHelps()
                                }
                                Text(W("falak.footer"))
                                    .lookFont(12)
                                    .foregroundStyle(look.palette.tx2)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .padding(.horizontal, 18)
                            }
                            .padding(.horizontal, Theme.gutter)
                            .padding(.bottom, 32)
                            .animation(.smooth, value: tab)
                        }
                    }
                } else {
                    Text(W("falak.choosePlace")).font(.headline)
                }
            }
            .foregroundStyle(look.palette.tx)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                if !isTab { ToolbarItem(placement: .confirmationAction) { Button(W("common.done")) { dismiss() } } }
            }
            .toolbar(isTab ? .hidden : .automatic, for: .navigationBar)
            .fullScreenCover(isPresented: $showAR) { FalakARScreen() }
            .fullScreenCover(isPresented: $showCamera) { ShadowCameraView() }
            .sheet(isPresented: $showLevel) { LevelView() }
            .sheet(isPresented: $showSteps) { ShadowStepsView() }
            .sheet(isPresented: $showExpert) { FalakExpertView() }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(W("tab.falak"))
                .font(Theme.display(look == .simple ? 38 : 34, .bold))
                .foregroundStyle(look.palette.tx)
                .accessibilityAddTraits(.isHeader)
            Text(W("falak.lede"))
                .lookFont(15).foregroundStyle(look.palette.tx2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, 4)
    }

    /// Sky, Then, Now, Why: the web's segmented control (square in Colour Bands).
    private var partPicker: some View {
        let p = look.palette
        let r: CGFloat = look == .bands ? 0 : 10
        return HStack(spacing: 0) {
            ForEach(Part.allCases) { part in
                let on = part == tab
                Button { tab = part } label: {
                    Text(part.title)
                        .lookFont(14, .semibold)
                        .foregroundStyle(on ? p.tx : p.tx2)
                        .frame(maxWidth: .infinity, minHeight: 40)
                        .background(on ? Color.dyn(Color.white, p.card) : Color.clear,
                                    in: RoundedRectangle(cornerRadius: look == .bands ? 0 : 8, style: .continuous))
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(part.title)
                .accessibilityAddTraits(on ? AccessibilityTraits.isSelected : AccessibilityTraits())
            }
        }
        .padding(2)
        .frame(minHeight: 44)
        .background(p.sep, in: RoundedRectangle(cornerRadius: r, style: .continuous))
    }

    private func toolRows(place: Place, now: Date, full: Bool) -> some View {
        let ymd = model.ymd(now)
        let plan = Falak.shadowDay(year: ymd.0, month: ymd.1, day: ymd.2, coordinates: place.coordinates)
        let asr = Prayer.asr.name(model.naming)
        let today = Falak.rashdulQiblat(year: ymd.0, month: ymd.1, day: ymd.2, timeZone: model.timeZone, coordinates: place.coordinates)
        let qiblaLine = qiblaSub(place: place, now: now, today: today)
        let rows: [ToolItem] = toolItems(asr: asr, plan: plan, qiblaLine: qiblaLine, now: now, full: full)
        return VStack(spacing: 0) {
            ForEach(Array(rows.enumerated()), id: \.offset) { index, row in
                if index > 0 && look != .bands {
                    Rectangle().fill(look.palette.sep).frame(height: 1).padding(.leading, 66)
                }
                ToolRow(index: index, symbol: row.symbol, title: row.title, subtitle: row.subtitle,
                        trailing: row.trailing, action: row.action)
            }
        }
        .modifier(ToolGroupStyle())
    }

    private func toolItems(asr: String, plan: Falak.ShadowDay, qiblaLine: String, now: Date, full: Bool) -> [ToolItem] {
        var rows: [ToolItem] = [
            ToolItem(symbol: "figure.walk", title: W("falak.stepsTitle"), subtitle: W("falak.stepsSub", ["name": asr]),
                     trailing: Falak.stepsText(Falak.asrSteps(plan, school: model.asrSchool)), action: { showSteps = true }),
            ToolItem(symbol: "camera.viewfinder", title: W("falak.cameraTitle"), subtitle: W("falak.cameraTitleSub"), trailing: nil,
                     action: { showCamera = true }),
            ToolItem(symbol: "location.north.line.fill", title: W("falak.qiblaSunTitle"), subtitle: qiblaLine, trailing: nil,
                     action: { showExpert = true })
        ]
        if full {
            rows.append(ToolItem(symbol: "sun.max.circle.fill", title: W("falak.sunOverKaaba"),
                                 subtitle: model.longDate(Falak.nextQiblaDay(after: now)), trailing: nil, action: { showExpert = true }))
            rows.append(ToolItem(symbol: "arkit", title: W("falak.camera"), subtitle: W("falak.cameraSub"), trailing: nil,
                                 action: { showAR = true }))
            rows.append(ToolItem(symbol: "level", title: W("falak.level"), subtitle: W("falak.levelSub"), trailing: nil,
                                 action: { showLevel = true }))
            rows.append(ToolItem(symbol: "slider.horizontal.3", title: W("falak.expert"),
                                 subtitle: W("falak.expertSub"), trailing: nil, action: { showExpert = true }))
        }
        return rows
    }
}

private struct ToolItem {
    let symbol: String
    let title: String
    let subtitle: String
    let trailing: String?
    let action: () -> Void
}

/// The card around the tool rows. In Colour Bands the rows are full width colour bands, no card.
private struct ToolGroupStyle: ViewModifier {
    @Environment(\.look) private var look

    func body(content: Content) -> some View {
        let p = look.palette
        if look == .bands {
            content.padding(.horizontal, -Theme.gutter)
        } else {
            content
                .background {
                    let shape = RoundedRectangle(cornerRadius: p.radius, style: .continuous)
                    if look == .gold { shape.fill(p.card) } else { ZStack { shape.fill(.ultraThinMaterial); shape.fill(p.card) } }
                }
                .overlay(RoundedRectangle(cornerRadius: p.radius, style: .continuous).strokeBorder(p.stroke, lineWidth: 1))
                .clipShape(RoundedRectangle(cornerRadius: p.radius, style: .continuous))
        }
    }
}

extension FalakView {
    /// When the sun next lines up with the qibla: later today, or the next day it does.
    func qiblaSub(place: Place, now: Date, today: [Falak.Alignment]) -> String {
        if let next = today.first(where: { $0.time > now }) { return W("falak.qiblaSunToday", ["time": model.formatted(next.time)]) }
        for offset in 1...60 {
            let ymd = model.ymd(model.noon(now, plus: offset))
            if let first = Falak.rashdulQiblat(year: ymd.0, month: ymd.1, day: ymd.2, timeZone: model.timeZone,
                                               coordinates: place.coordinates).first {
                var style = Date.FormatStyle().day().month(.wide)
                style.timeZone = model.timeZone
                return W("falak.qiblaSunNext", ["date": first.time.formatted(style)])
            }
        }
        return W("falak.qiblaSunNone")
    }
}

/// One row in the tools list: a tonal icon in the look's accent, or a full colour band in Colour Bands.
private struct ToolRow: View {
    @Environment(\.look) private var look
    let index: Int
    let symbol: String
    let title: String
    let subtitle: String
    var trailing: String? = nil
    let action: () -> Void

    private static let bandColors: [Color] = [
        Color(hex: 0x3A6F63), Color(hex: 0xCD7D38), Color(hex: 0xC9565D),
        Color(hex: 0x8A9A52), Color(hex: 0xAB8D3A), Color(hex: 0xD3705C)
    ]

    private var bands: Bool { look == .bands }

    var body: some View {
        let p = look.palette
        let main: Color = bands ? .white : p.tx
        let second: Color = bands ? .white : p.tx2
        return Button(action: action) {
            HStack(spacing: 14) {
                icon(p)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).lookFont(bands ? 19 : (look == .simple ? 21 : 17), bands ? .bold : .semibold)
                        .foregroundStyle(main)
                    Text(subtitle).lookFont(bands ? 15 : 13, bands ? .semibold : .regular)
                        .foregroundStyle(second).lineLimit(2)
                }
                Spacer(minLength: 8)
                if let trailing {
                    Text(trailing).lookFont(15, bands ? .semibold : .regular).monospacedDigit()
                        .foregroundStyle(second)
                }
                Image(systemName: "chevron.right").font(.footnote.weight(.semibold))
                    .foregroundStyle(bands ? Color.white : p.tx3)
            }
            .padding(.horizontal, bands ? 24 : 18)
            .padding(.vertical, 8)
            .frame(minHeight: bands ? 64 : (look == .simple ? 72 : 58))
            .background(bands ? ToolRow.bandColors[index % 6] : Color.clear)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private func icon(_ p: LookPalette) -> some View {
        if bands {
            Image(systemName: symbol).font(.system(size: 17, weight: .semibold)).foregroundStyle(.white)
                .frame(width: 24, height: 34).accessibilityHidden(true)
        } else {
            Image(systemName: symbol).font(.system(size: 17, weight: .semibold)).foregroundStyle(p.actx)
                .frame(width: 34, height: 34)
                .background(p.tint, in: RoundedRectangle(cornerRadius: 9, style: .continuous))
                .accessibilityHidden(true)
        }
    }
}

/// The detailed F1 tools, unchanged, for people who want the numbers.
struct FalakExpertView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ZStack {
                SkyNow()
                if let place = model.activePlace {
                    TimelineView(.periodic(from: .now, by: 30)) { context in
                        ScrollView {
                            VStack(spacing: 16) {
                                HStack(spacing: 8) {
                                    Chip(text: W("falak.grade"), systemImage: SourceGrade.falak.symbol)
                                    Chip(text: W("falak.pendingReview"), systemImage: "hourglass")
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)
                                SunSafetyCard()
                                ShadowCompassCard(place: place, now: context.date)
                                QiblaDayCard(place: place, now: context.date)
                                RashdulCard(place: place, now: context.date)
                                ShadowStickCard(place: place)
                                SkySignsCard(now: context.date)
                                Text(Falak.reviewNote)
                                    .font(.footnote).opacity(0.75)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }
                            .padding(.horizontal, Theme.gutter)
                            .padding(.bottom, 32)
                        }
                    }
                }
            }
            .navigationTitle(W("falak.expert"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button(W("common.done")) { dismiss() } } }
        }
    }
}

// MARK: - Shared bits

private struct CardTitle: View {
    let title: String
    let symbol: String
    var body: some View {
        Label(title, systemImage: symbol).font(.headline)
    }
}

extension AppModel {
    var placeCalendar: Calendar {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = timeZone
        return cal
    }

    func ymd(_ date: Date) -> (Int, Int, Int) {
        let c = placeCalendar.dateComponents([.year, .month, .day], from: date)
        return (c.year!, c.month!, c.day!)
    }

    func longDate(_ date: Date) -> String {
        var style = Date.FormatStyle(date: .complete, time: .omitted)
        style.timeZone = timeZone
        style.locale = AppWords.formatLocale
        return date.formatted(style)
    }
}

private func minutesText(_ m: Double) -> String {
    let r = Int(m.rounded())
    return W("falak.minutes", ["n": abs(r)])
}

struct SunSafetyCard: View {
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "eye.trianglebadge.exclamationmark.fill")
                .font(.title2).foregroundStyle(Theme.warning)
                .accessibilityHidden(true)
            Text(W("falak.neverLook"))
                .font(.footnote.weight(.semibold))
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.warning.opacity(0.22), in: RoundedRectangle(cornerRadius: Theme.corner, style: .continuous))
    }
}

// MARK: - Live shadow compass

/// Where an upright stick's shadow points right now, against the qibla line.
private struct ShadowCompassCard: View {
    @Environment(AppModel.self) private var model
    let place: Place
    let now: Date

    var body: some View {
        let sun = Falak.sunPosition(at: now, coordinates: place.coordinates)
        let qibla = Geo.qiblaBearing(from: place.coordinates)
        let shadowBearing = Astro.fix(sun.azimuth + 180, 360)
        GlassCard {
            VStack(alignment: .leading, spacing: 12) {
                CardTitle(title: W("falak.shadowNow"), symbol: "sun.max.fill")
                HStack(spacing: 16) {
                    ShadowDial(qibla: qibla, shadowBearing: shadowBearing, altitude: sun.altitude)
                        .frame(width: 140, height: 140)
                    VStack(alignment: .leading, spacing: 6) {
                        if sun.altitude > 0 {
                            Text(W("falak.sunUp", ["deg": Int(sun.altitude.rounded()), "point": Geo.compassPoint(sun.azimuth)]))
                                .font(.subheadline.weight(.semibold))
                            Text(W("falak.stickShadow", ["deg": Int(shadowBearing.rounded()), "point": Geo.compassPoint(shadowBearing), "x": String(format: "%.1f", Falak.shadowLength(height: 1, altitude: max(sun.altitude, 0.5)))]))
                                .font(.footnote).opacity(0.85)
                        } else {
                            Text(W("falak.sunBelow")).font(.subheadline.weight(.semibold))
                            Text(W("falak.afterSunrise")).font(.footnote).opacity(0.85)
                        }
                        Label(W("falak.qiblaBearing", ["deg": Int(qibla.rounded()), "point": Geo.compassPoint(qibla)]), systemImage: "location.north.line.fill")
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(Theme.gold)
                    }
                }
            }
        }
    }
}

private struct ShadowDial: View {
    let qibla: Double
    let shadowBearing: Double
    let altitude: Double

    var body: some View {
        Canvas { ctx, size in
            let r = min(size.width, size.height) / 2
            let c = CGPoint(x: size.width / 2, y: size.height / 2)
            func point(_ bearing: Double, _ length: Double) -> CGPoint {
                let a = (bearing - 90) * .pi / 180
                return CGPoint(x: c.x + cos(a) * length, y: c.y + sin(a) * length)
            }
            ctx.fill(Path(ellipseIn: CGRect(x: c.x - r, y: c.y - r, width: 2 * r, height: 2 * r)), with: .color(Color.primary.opacity(0.08)))
            ctx.stroke(Path(ellipseIn: CGRect(x: c.x - r + 0.5, y: c.y - r + 0.5, width: 2 * r - 1, height: 2 * r - 1)), with: .color(Color.primary.opacity(0.3)))
            for i in 0..<4 {
                var tick = Path()
                tick.move(to: point(Double(i) * 90, r - 8)); tick.addLine(to: point(Double(i) * 90, r - 1))
                ctx.stroke(tick, with: .color(Color.primary.opacity(0.6)), lineWidth: 1.5)
            }
            ctx.draw(Text("N").font(.caption2.weight(.heavy)).foregroundStyle(Theme.north), at: point(0, r - 16))
            // Qibla line, dashed, through the stick.
            var q = Path()
            q.move(to: point(qibla + 180, r - 6)); q.addLine(to: point(qibla, r - 6))
            ctx.stroke(q, with: .color(Theme.gold.opacity(0.9)), style: StrokeStyle(lineWidth: 2, dash: [4, 4]))
            ctx.fill(Path(ellipseIn: CGRect(origin: point(qibla, r - 6), size: .zero).insetBy(dx: -5, dy: -5)), with: .color(Theme.gold))
            // The shadow: longer when the sun is low.
            if altitude > 0 {
                let len = min(r - 10, max(r * 0.3, (r - 10) * 0.25 * Falak.shadowLength(height: 1, altitude: altitude)))
                var s = Path()
                s.move(to: c); s.addLine(to: point(shadowBearing, len))
                ctx.stroke(s, with: .color(.black.opacity(0.75)), style: StrokeStyle(lineWidth: 8, lineCap: .round))
            }
            ctx.fill(Path(ellipseIn: CGRect(x: c.x - 5, y: c.y - 5, width: 10, height: 10)), with: .color(Color.primary))
        }
        .accessibilityLabel(W("falak.qiblaVsShadow", ["a": Int(shadowBearing.rounded()), "b": Int(qibla.rounded())]))
    }
}

// MARK: - Qibla Day

private struct QiblaDayCard: View {
    @Environment(AppModel.self) private var model
    let place: Place
    let now: Date

    var body: some View {
        let day = Falak.nextQiblaDay(after: now)
        let sun = Falak.sunPosition(at: day, coordinates: place.coordinates)
        let days = model.placeCalendar.dateComponents([.day], from: model.placeCalendar.startOfDay(for: now),
                                                       to: model.placeCalendar.startOfDay(for: day)).day ?? 0
        GlassCard {
            VStack(alignment: .leading, spacing: 10) {
                CardTitle(title: W("falak.qiblaDay"), symbol: "sun.max.circle.fill")
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(days <= 0 ? W("common.today") : "\(days)")
                        .font(Theme.display(44, .bold)).monospacedDigit()
                    if days > 0 { Text(days == 1 ? W("phone.falak.dayToGo") : W("phone.falak.daysToGo")).font(.headline).opacity(0.85) }
                }
                Text(W("falak.dateAtYourTime", ["date": model.longDate(day), "time": model.formatted(day)]))
                    .font(.subheadline.weight(.semibold))
                Text(W("phone.falak.rashdul"))
                    .font(.footnote).opacity(0.85)
                if sun.altitude > 3 {
                    Label(W("falak.qiblaDayVisible", ["deg": Int(sun.altitude.rounded())]), systemImage: "checkmark.circle.fill")
                        .font(.footnote)
                } else {
                    Label(W("falak.qiblaDayDown"), systemImage: "moon.fill")
                        .font(.footnote)
                }
            }
        }
    }
}

// MARK: - Daily rashdul qiblat

private struct RashdulCard: View {
    @Environment(AppModel.self) private var model
    let place: Place
    let now: Date

    var body: some View {
        let ymd = model.ymd(now)
        let today = Falak.rashdulQiblat(year: ymd.0, month: ymd.1, day: ymd.2, timeZone: model.timeZone, coordinates: place.coordinates)
        GlassCard {
            VStack(alignment: .leading, spacing: 10) {
                CardTitle(title: W("falak.rashdulToday"), symbol: "arrow.up.and.down.and.sparkles")
                Text(W("falak.rashdulExplain"))
                    .font(.footnote).opacity(0.85)
                if today.isEmpty {
                    if let next = nextAlignment(after: now) {
                        Text(W("phone.falak.noAlignment", ["date": model.longDate(next.time), "time": model.formatted(next.time)]))
                            .font(.subheadline.weight(.semibold))
                    } else {
                        Text(W("falak.rashdulNever"))
                            .font(.subheadline.weight(.semibold))
                    }
                } else {
                    ForEach(Array(today.enumerated()), id: \.offset) { _, a in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(model.formatted(a.time)).font(Theme.display(24, .bold)).monospacedDigit()
                                if a.time < now { Text(W("falak.passed")).font(.caption.weight(.semibold)).opacity(0.6) }
                                Spacer()
                                Text(W("phone.falak.sunUp", ["deg": Int(a.altitude.rounded())])).font(.caption).opacity(0.75)
                            }
                            Text(a.shadowNote).font(.footnote)
                        }
                        .opacity(a.time < now ? 0.6 : 1)
                    }
                    Text(W("falak.rashdulGood"))
                        .font(.caption).opacity(0.7)
                }
            }
        }
    }

    private func nextAlignment(after date: Date) -> Falak.Alignment? {
        for offset in 1...60 {
            let ymd = model.ymd(model.noon(date, plus: offset))
            if let first = Falak.rashdulQiblat(year: ymd.0, month: ymd.1, day: ymd.2, timeZone: model.timeZone,
                                               coordinates: place.coordinates).first {
                return first
            }
        }
        return nil
    }
}

// MARK: - Tongkat istiwa'

private struct ShadowStickCard: View {
    @Environment(AppModel.self) private var model
    let place: Place
    @AppStorage("falak.stickHeight") private var height: Double = 100
    @State private var shadow: Double?
    @State private var measuredAt = Date.now

    var body: some View {
        let ymd = model.ymd(measuredAt)
        let plan = Falak.shadowDay(year: ymd.0, month: ymd.1, day: ymd.2, coordinates: place.coordinates)
        let school = model.asrSchool
        let official = model.day(containing: measuredAt)
        GlassCard {
            VStack(alignment: .leading, spacing: 12) {
                CardTitle(title: W("falak.stickTitle"), symbol: "ruler.fill")
                Text(W("falak.stickHow"))
                    .font(.footnote).opacity(0.85)

                LabeledContent(W("falak.stickHeight")) {
                    TextField(W("phone.cm"), value: $height, format: .number.precision(.fractionLength(0...1)))
                        .keyboardType(.decimalPad).multilineTextAlignment(.trailing).frame(width: 90)
                }
                .font(.subheadline)

                VStack(alignment: .leading, spacing: 6) {
                    Text(W("falak.forStick")).font(.subheadline.weight(.semibold))
                    row(W("falak.zawal"), model.formatted(plan.noon),
                        W("falak.pointing", ["length": cm(plan.noonShadow(height: height)), "point": Geo.compassPoint(plan.noonShadowBearing)]))
                    if let t = plan.asrShafii {
                        row(W("falak.asrShafii"), model.formatted(t), cm(plan.asrShadow(height: height, school: .standard)))
                    }
                    if let t = plan.asrHanafi {
                        row(W("falak.asrHanafi"), model.formatted(t), cm(plan.asrShadow(height: height, school: .hanafi)))
                    }
                    Text(W("falak.zawalExplain", ["name": Prayer.dhuhr.name(model.naming)]))
                        .font(.caption).opacity(0.75)
                    if let official {
                        Text(W("phone.falak.yourTimetable", ["name": Prayer.dhuhr.name(model.naming), "time": model.formatted(official.time(.dhuhr)), "asr": model.formatted(official.time(.asr))]))
                            .font(.caption).opacity(0.75)
                    }
                }

                Divider().overlay(Color.primary.opacity(0.3))

                Text(W("falak.checkReading")).font(.subheadline.weight(.semibold))
                LabeledContent(W("falak.shadowLength")) {
                    TextField(W("phone.cm"), value: $shadow, format: .number.precision(.fractionLength(0...1)))
                        .keyboardType(.decimalPad).multilineTextAlignment(.trailing).frame(width: 90)
                }
                .font(.subheadline)
                HStack {
                    DatePicker(W("falak.measuredAt"), selection: $measuredAt, displayedComponents: .hourAndMinute)
                        .environment(\.timeZone, model.timeZone)
                    Button(W("common.now")) { measuredAt = .now }.buttonStyle(.bordered)
                }
                .font(.subheadline)

                if let shadow, let r = Falak.reading(height: height, shadow: shadow, at: measuredAt,
                                                     coordinates: place.coordinates, timeZone: model.timeZone, school: school) {
                    result(r, shadow: shadow, plan: plan, school: school)
                }
            }
        }
    }

    @ViewBuilder
    private func result(_ r: Falak.Reading, shadow: Double, plan: Falak.ShadowDay, school: AsrSchool) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Chip(text: W("falak.gradeObservation"), systemImage: SourceGrade.falak.symbol)
            Text(W("falak.sunByShadow", ["deg": String(format: "%.1f", r.altitude)])).font(.subheadline.weight(.semibold))
            if let t = r.sunTime, let off = r.offsetMinutes, let pm = r.uncertaintyMinutes {
                let side = abs(off) <= pm ? W("falak.matches") :
                    (off > 0 ? W("falak.ahead", ["time": minutesText(off)]) : W("falak.behind", ["time": minutesText(off)]))
                Text(W("phone.falak.putsSun", ["time": model.formatted(t), "n": Int(pm.rounded(.up)), "side": side]))
                    .font(.footnote)
                if abs(off) > pm {
                    Text(W("phone.falak.usualCauses"))
                        .font(.caption).opacity(0.75)
                }
            } else {
                Text(W("phone.falak.tooLow"))
                    .font(.footnote)
            }
            if let reached = r.asrReached {
                let target = plan.asrShadow(height: height, school: school)
                Text(reached
                     ? W("falak.asrBegun", ["school": school == .hanafi ? W("settings.hanafi") : W("settings.shafii"), "length": cm(target)])
                     : W("falak.asrNotBegun", ["school": school == .hanafi ? W("settings.hanafi") : W("settings.shafii"), "length": cm(target)]))
                    .font(.footnote.weight(.semibold))
            } else {
                Text(W("falak.morning", ["name": Prayer.dhuhr.name(model.naming)])).font(.footnote.weight(.semibold))
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.accent.opacity(0.18), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private func cm(_ v: Double) -> String {
        v.isFinite ? String(format: "%.1f cm", v) : "-"
    }

    private func row(_ label: String, _ time: String, _ detail: String) -> some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 1) {
                Text(label).font(.footnote)
                Text(detail).font(.caption).opacity(0.75)
            }
            Spacer()
            Text(time).font(.subheadline.weight(.semibold)).monospacedDigit()
        }
    }
}

// MARK: - Sky signs

private struct SkySignsCard: View {
    @Environment(AppModel.self) private var model
    let now: Date

    var body: some View {
        let day = model.day(containing: now)
        GlassCard {
            VStack(alignment: .leading, spacing: 14) {
                CardTitle(title: W("falak.skySigns"), symbol: "sparkles")
                Text(W("phone.falak.signsHelp"))
                    .font(.footnote).opacity(0.85)
                sign("Maghrib", .maghrib, day, "sunset",
                     "The whole disc of the sun has gone below the horizon - its upper edge has disappeared. Best seen over the sea or open land; behind hills or buildings it vanishes early, so don't pray by that.")
                sign("Isha", .isha, day, "moon.stars",
                     "The red glow (shafaq ahmar) has gone from the western sky - the view of the Shafi'i, Maliki and Hanbali schools. Imam Abu Hanifah held it is the white glow that follows it. Timetables use the sun's depth below the horizon (about 17°-18°) instead.")
                sign("Fajr", .fajr, day, "sunrise",
                     "True dawn (fajr sadiq): a thin whiteness spreading sideways along the eastern horizon, growing steadily. Not the false dawn (fajr kazib) before it: a faint upright column of light that fades again. Researchers still debate the exact depth of the sun at true dawn, so this stays informational.")
            }
        }
    }

    private func sign(_ title: String, _ prayer: Prayer, _ day: PrayerDay?, _ symbol: String, _ text: String) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: symbol).font(.title3).frame(width: 28)
            VStack(alignment: .leading, spacing: 3) {
                HStack {
                    Text(prayer.name(model.naming)).font(.subheadline.weight(.semibold))
                    Spacer()
                    if let day { Text(W("falak.todayAt", ["time": model.formatted(day.time(prayer))])).font(.caption).opacity(0.75) }
                }
                Text(text).font(.footnote).opacity(0.9)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(title). \(text)")
    }
}
