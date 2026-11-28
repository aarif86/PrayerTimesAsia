/**
 * The words for the city pages in each city's own local language, for the countries where the app's website does
 * not have that language yet: Thai, Burmese, Nepali, Chinese, Japanese, Korean, Vietnamese, Khmer, Filipino, Hindi
 * and Sinhala. Used by build-search-pages.ts.
 *
 * EVERY LINE HERE IS A DRAFT. None of it has been read by a native speaker. It needs a native read before release.
 * Public copy rule kept: plain sentences, no colons or dashes.
 */
import type { Prayer } from '../src/core/prayer'

export type NewLang = 'th' | 'my' | 'ne' | 'zh' | 'ja' | 'ko' | 'vi' | 'km' | 'fil' | 'hi' | 'si'

export interface Words {
  home: string; crumb: string; open: string; play: string; nasar: string
  title(n: string): string; descPre(n: string, d: string): string; h1(n: string): string
  stale: string; local(p: string): string; table(a: string): string; authority(a: string): string; none(note: string): string
  faqH(n: string): string; howH: string; source: string; methodLbl: string; placeLbl: string; moreAbout: string; caution: string
  ishaDeg(n: number): string; ishaMin(n: number): string; shafii: string; hanafi: string
  daysH(n: string): string; showDays: string; dateCol: string; othersH: string; built: string
  printH: string; printLead(n: string): string; btnMonthly: string; btnRamadan: string
  follow: string; about: string; sources: string; privacy: string; allCities: string
  ptTitle: string; ptDesc(n: number): string; ptH1: string; ptLead: string; ptFoot: string
  prTitle(n: string): string; prDesc(n: string): string; prH1(n: string): string; prLead(n: string): string
  prSource: string; prMonthly: string; prRamadan: string; prRamadanNote(d: string, y: number): string; prFastNote: string
  prPrint: string; prApp: string; prAppNote: string; day: string; fast: string; back: string; printBadge: string
  hubTitle: string; hubDesc(n: number): string; hubH1: string; hubLead: string; pick: string; cityBadge: string; theme: string
}

/** What the FAQ writer needs, already worked out by the page builder. */
export interface FaqInput {
  n: string; f: string; m: string; T: Record<Prayer, string>; allTxt: string
  methodName: string; fajr: number; ishaRule: string; asrName: string; official: string; qibla: number; dir: string
}

export interface Locale {
  html: string                       // the lang attribute and hreflang
  locale: string                     // for dates and country names (Gregorian calendar, western digits)
  native: string                     // label on the language switch
  dir: string; print: string         // folders under the site
  names: Record<Prayer, string>      // the five prayers and sunrise, as the community there writes them
  compass: string[]                  // north, north east, east ... north west
  list: string                       // joins the six prayers in the "all prayer times" answer, last joiner included
  listSep: string
  fastUnits: [string, string]
  clock: 'h24' | 'h12'
  w: Words
  faq(q: FaqInput): [string, string][]
}

export const LOCALES: Record<NewLang, Locale> = {
  // ---------------------------------------------------------------- Thai
  th: {
    html: 'th', locale: 'th-u-ca-gregory-nu-latn', native: 'ไทย', dir: 'th/prayer-times', print: 'th/printable-timetables',
    names: { fajr: 'ซุบฮิ', sunrise: 'พระอาทิตย์ขึ้น', dhuhr: 'ซุฮรี', asr: 'อัสรี', maghrib: 'มัฆริบ', isha: 'อีชา' },
    compass: ['ทิศเหนือ', 'ทิศตะวันออกเฉียงเหนือ', 'ทิศตะวันออก', 'ทิศตะวันออกเฉียงใต้', 'ทิศใต้', 'ทิศตะวันตกเฉียงใต้', 'ทิศตะวันตก', 'ทิศตะวันตกเฉียงเหนือ'],
    list: ' และ ', listSep: ' ', fastUnits: [' ชั่วโมง ', ' นาที'], clock: 'h24',
    w: {
      home: 'หน้าแรก', crumb: 'เวลาละหมาด', open: 'เปิดแอป', play: 'ดาวน์โหลดบน Google Play', nasar: 'สร้างเพื่ออัลลอฮ์ที่สิงคโปร์ โดย',
      title: (n) => `เวลาละหมาดวันนี้ใน${n} | ซุบฮิ ซุฮรี อัสรี มัฆริบ อีชา`,
      descPre: (n, d) => `เวลาละหมาดวันนี้ใน${n} ${d}`, h1: (n) => `เวลาละหมาดวันนี้ใน${n}`,
      stale: 'เวลาเหล่านี้เก่ากว่าหนึ่งเดือนแล้ว เปิดแอปเพื่อดูเวลาของวันนี้', local: (p) => `เวลาทั้งหมดเป็นเวลาท้องถิ่นใน${p}`,
      table: (a) => `ตารางเวลาทางการมาจาก ${a} เวลาในหน้านี้คำนวณด้วยวิธีเดียวกันและต่างจากตารางไม่เกินประมาณ 2 นาที และไม่เคยเร็วกว่า แอป Prayer Times Asia แสดงตารางทางการเองเมื่อคุณออนไลน์`,
      authority: (a) => `แอปทำตาม ${a} และคำนวณเวลาด้วยวิธีของหน่วยงานนั้นเอง`,
      none: () => 'ที่นี่ไม่มีหน่วยงานระดับชาติเพียงหนึ่งเดียวที่แอปอ่านตารางเวลาได้ แอปจึงใช้วิธีที่มัสยิดส่วนใหญ่ใช้',
      faqH: (n) => `คำถามเกี่ยวกับเวลาละหมาดใน${n}`, howH: 'เวลาเหล่านี้คำนวณอย่างไร', source: 'แหล่งที่มา', methodLbl: 'วิธีคำนวณ', placeLbl: 'สถานที่',
      moreAbout: 'อ่านเพิ่มเติมว่าเราคำนวณเวลาอย่างไร', caution: 'แต่ละมัสยิดอาจต่างกันไม่กี่นาที โปรดปฏิบัติตามหน่วยงานศาสนาในท้องถิ่นของคุณ',
      ishaDeg: (n) => `${n} องศา`, ishaMin: (n) => `${n} นาทีหลังมัฆริบ`, shafii: 'ชาฟิอี', hanafi: 'ฮะนะฟี',
      daysH: (n) => `เวลาละหมาดใน${n} ตลอด 30 วันข้างหน้า`, showDays: 'แสดงตารางเวลา 30 วัน', dateCol: 'วันที่', othersH: 'เมืองอื่น', built: 'สร้างหน้านี้เมื่อ',
      printH: 'พิมพ์ตารางเวลานี้', printLead: (n) => `ตารางเวลารายเดือนและตารางเวลารอมฎอนของ${n} พร้อมพิมพ์หรือบันทึกเป็น PDF`, btnMonthly: 'ตารางเวลาสำหรับพิมพ์', btnRamadan: 'ตารางเวลารอมฎอน',
      follow: 'โปรดปฏิบัติตามหน่วยงานศาสนาในท้องถิ่นของคุณเสมอ', about: 'เราคำนวณเวลาอย่างไร', sources: 'เวลาของเรามาจากไหน', privacy: 'ความเป็นส่วนตัว', allCities: 'ทุกเมือง',
      ptTitle: 'เวลาละหมาดแต่ละเมือง | Prayer Times Asia', ptDesc: (n) => `เวลาละหมาดวันนี้ของ ${n} เมืองในเอเชียและทั่วโลก พร้อมอธิบายวิธีคำนวณและแหล่งที่มาของแต่ละเมือง`,
      ptH1: 'เวลาละหมาดแต่ละเมือง', ptLead: 'เลือกเมืองเพื่อดูเวลาละหมาดวันนี้และ 30 วันข้างหน้า พร้อมวิธีคำนวณและแหล่งที่มา หากต้องการเวลาของจุดที่คุณอยู่จริง ให้เปิดแอปฟรีของเรา', ptFoot: 'แอปครอบคลุม 143 ประเทศและใช้งานแบบออฟไลน์ได้',
      prTitle: (n) => `ตารางเวลาละหมาดสำหรับพิมพ์ ${n} | รายเดือนและรอมฎอน`, prDesc: (n) => `ตารางเวลาละหมาดรายเดือนและรอมฎอนของ${n} ฟรีสำหรับพิมพ์ พร้อมแหล่งที่มา วิธีคำนวณ และความยาวของการถือศีลอด พิมพ์หรือบันทึกเป็น PDF`,
      prH1: (n) => `ตารางเวลาละหมาดสำหรับพิมพ์ ${n}`, prLead: (n) => `ตารางเวลารายเดือนและรอมฎอนของ${n} ฟรี พิมพ์หรือบันทึกเป็น PDF ทุกตารางบอกแหล่งที่มาของเวลา โปรดปฏิบัติตามหน่วยงานศาสนาในท้องถิ่นของคุณ`,
      prSource: 'เวลาเหล่านี้มาจากไหน', prMonthly: 'ตารางรายเดือน', prRamadan: 'ตารางรอมฎอน',
      prRamadanNote: (d, y) => `คาดว่ารอมฎอน ${y} จะเริ่มประมาณวันที่ ${d} คำนวณจากปฏิทินอุมมุลกุรอ หน่วยงานศาสนาในท้องถิ่นของคุณเป็นผู้ประกาศวันเริ่มจริง โปรดปฏิบัติตามประกาศนั้น`,
      prFastNote: 'ความยาวของการถือศีลอดนับจากซุบฮิถึงมัฆริบ', prPrint: 'พิมพ์หน้านี้', prApp: 'เปิดแอปเพื่อพิมพ์ตามจุดที่คุณอยู่จริง',
      prAppNote: 'ไม่ใช่เมืองของคุณหรือ แอปฟรีพิมพ์ตารางเวลาตามจุดที่คุณอยู่จริงได้', day: 'วัน', fast: 'ถือศีลอด', back: 'กลับไปหน้าเมือง', printBadge: 'สำหรับพิมพ์',
      hubTitle: 'ตารางเวลาละหมาดสำหรับพิมพ์แต่ละเมือง | Prayer Times Asia', hubDesc: (n) => `ตารางเวลาละหมาดรายเดือนและรอมฎอนฟรีสำหรับพิมพ์ ของ ${n} เมือง พร้อมแหล่งที่มา`,
      hubH1: 'ตารางเวลาละหมาดสำหรับพิมพ์', hubLead: 'ตารางรายเดือนและรอมฎอนฟรีที่พิมพ์หรือบันทึกเป็น PDF ได้ ทุกตารางบอกแหล่งที่มาของเวลา โปรดปฏิบัติตามหน่วยงานศาสนาในท้องถิ่นของคุณ',
      pick: 'เลือกเมืองของคุณ', cityBadge: 'เวลาละหมาด', theme: 'สลับโหมดสว่างและมืด',
    },
    faq: (q) => [
      [`เวลา${q.f}วันนี้ใน${q.n}คือกี่โมง`, `${q.f}วันนี้ใน${q.n}คือเวลา ${q.T.fajr} พระอาทิตย์ขึ้นเวลา ${q.T.sunrise} เวลา${q.f}จึงสิ้นสุดตอนนั้น`],
      [`เวลา${q.m}วันนี้ใน${q.n}คือกี่โมง`, `${q.m}วันนี้ใน${q.n}คือเวลา ${q.T.maghrib} นี่คือเวลาละศีลอดในเดือนรอมฎอนด้วย`],
      [`เวลาละหมาดทั้งหมดวันนี้ใน${q.n}คือเมื่อไหร่`, `${q.allTxt} เวลาทั้งหมดเป็นเวลาท้องถิ่นใน${q.n}`],
      [`เวลาละหมาดใน${q.n}คำนวณด้วยวิธีใด`, `${q.methodName} โดย${q.f}ที่ ${q.fajr} องศา และอีชาที่ ${q.ishaRule} อัสรีใช้มัซฮับ${q.asrName} ${q.official}`],
      [`ทิศกิบละฮ์จาก${q.n}ไปทางไหน`, `กิบละฮ์จาก${q.n}อยู่ประมาณ ${q.qibla} องศาตามเข็มนาฬิกาจากทิศเหนือ คือไปทาง${q.dir} แอปแสดงให้เห็นสดบนโทรศัพท์ของคุณ`],
    ],
  },

  // ---------------------------------------------------------------- Burmese
  my: {
    html: 'my', locale: 'my-u-nu-latn', native: 'မြန်မာ', dir: 'my/prayer-times', print: 'my/printable-timetables',
    names: { fajr: 'ဖဂျ်ရ်', sunrise: 'နေထွက်ချိန်', dhuhr: 'ဇုဟ်ရ်', asr: 'အဆ်ရ်', maghrib: 'မဂ်ရိဘ်', isha: 'အိရှာ' },
    compass: ['မြောက်', 'အရှေ့မြောက်', 'အရှေ့', 'အရှေ့တောင်', 'တောင်', 'အနောက်တောင်', 'အနောက်', 'အနောက်မြောက်'],
    list: ' နှင့် ', listSep: ' ', fastUnits: [' နာရီ ', ' မိနစ်'], clock: 'h12',
    w: {
      home: 'ပင်မစာမျက်နှာ', crumb: 'နမာဇ်ချိန်', open: 'အက်ပ်ကိုဖွင့်ပါ', play: 'Google Play တွင်ဒေါင်းလုဒ်လုပ်ပါ', nasar: 'အလ္လာဟ်အတွက် စင်ကာပူတွင်ပြုလုပ်ထားသည်။ ပြုလုပ်သူ',
      title: (n) => `ယနေ့ ${n} နမာဇ်ချိန် | ဖဂျ်ရ် ဇုဟ်ရ် အဆ်ရ် မဂ်ရိဘ် အိရှာ`,
      descPre: (n, d) => `ယနေ့ ${n} နမာဇ်ချိန် ${d}`, h1: (n) => `ယနေ့ ${n} နမာဇ်ချိန်`,
      stale: 'ဤအချိန်များသည် တစ်လကျော်ကြာပြီ။ ယနေ့အချိန်ကြည့်ရန် အက်ပ်ကိုဖွင့်ပါ။', local: (p) => `အချိန်အားလုံးသည် ${p} ၏ ဒေသစံတော်ချိန်ဖြစ်သည်။`,
      table: (a) => `တရားဝင်အချိန်ဇယားကို ${a} မှ ထုတ်ပြန်သည်။ ဤစာမျက်နှာရှိ အချိန်များကို တူညီသောနည်းဖြင့် တွက်ထားပြီး ဇယားနှင့် ၂ မိနစ်ခန့်အတွင်းသာ ကွာခြားကာ ပိုစောခြင်း မရှိပါ။ အွန်လိုင်းရှိသည့်အခါ Prayer Times Asia အက်ပ်က တရားဝင်ဇယားကို ကိုယ်တိုင်ပြပေးသည်။`,
      authority: (a) => `အက်ပ်သည် ${a} ကိုလိုက်နာပြီး ထိုအဖွဲ့အစည်း၏ နည်းလမ်းဖြင့် အချိန်များကို တွက်ချက်သည်။`,
      none: () => 'ဤနေရာတွင် အက်ပ်ဖတ်နိုင်သော အချိန်ဇယားထုတ်သည့် တစ်ခုတည်းသော နိုင်ငံတော်အဖွဲ့အစည်း မရှိသဖြင့် ဗလီအများစုသုံးသောနည်းကို သုံးသည်။',
      faqH: (n) => `${n} နမာဇ်ချိန်အကြောင်း မေးခွန်းများ`, howH: 'ဤအချိန်များကို မည်သို့တွက်သနည်း', source: 'ရင်းမြစ်', methodLbl: 'နည်းလမ်း', placeLbl: 'နေရာ',
      moreAbout: 'အချိန်များကို မည်သို့တွက်သည်ကို ပိုဖတ်ရန်', caution: 'ဗလီများအကြား မိနစ်အနည်းငယ် ကွာနိုင်သဖြင့် သင့်ဒေသရှိ ဘာသာရေးအာဏာပိုင်ကို လိုက်နာပါ။',
      ishaDeg: (n) => `${n} ဒီဂရီ`, ishaMin: (n) => `မဂ်ရိဘ်ပြီး ${n} မိနစ်`, shafii: 'ရှာဖီအီး', hanafi: 'ဟနဖီ',
      daysH: (n) => `လာမည့် ၃၀ ရက်အတွက် ${n} နမာဇ်ချိန်`, showDays: '၃၀ ရက်ဇယားကို ပြပါ', dateCol: 'ရက်စွဲ', othersH: 'အခြားမြို့များ', built: 'စာမျက်နှာပြုလုပ်သည့်ရက်',
      printH: 'ဤဇယားကို ပရင့်ထုတ်ပါ', printLead: (n) => `${n} အတွက် လစဉ်ဇယားနှင့် ရမဇာန်ဇယား။ ပရင့်ထုတ်ရန် သို့မဟုတ် PDF အဖြစ်သိမ်းရန် အသင့်ဖြစ်သည်။`, btnMonthly: 'ပရင့်ထုတ်ရန်ဇယား', btnRamadan: 'ရမဇာန်ဇယား',
      follow: 'သင့်ဒေသရှိ ဘာသာရေးအာဏာပိုင်ကို အမြဲလိုက်နာပါ။', about: 'အချိန်များကို မည်သို့တွက်သနည်း', sources: 'ကျွန်ုပ်တို့၏အချိန်များ မည်သည့်နေရာမှလာသနည်း', privacy: 'ကိုယ်ရေးကိုယ်တာ', allCities: 'မြို့အားလုံး',
      ptTitle: 'မြို့အလိုက် နမာဇ်ချိန် | Prayer Times Asia', ptDesc: (n) => `အာရှနှင့် ကမ္ဘာတစ်ဝန်းရှိ မြို့ ${n} မြို့၏ ယနေ့နမာဇ်ချိန်၊ မြို့တစ်မြို့စီအတွက် နည်းလမ်းနှင့် ရင်းမြစ်ပါရှိသည်။`,
      ptH1: 'မြို့အလိုက် နမာဇ်ချိန်', ptLead: 'ယနေ့နှင့် လာမည့် ၃၀ ရက်၏ နမာဇ်ချိန်ကို ကြည့်ရန် မြို့တစ်မြို့ကို ရွေးပါ။ နည်းလမ်းနှင့် ရင်းမြစ်ကိုလည်း ရေးထားသည်။ သင်ရှိသည့်နေရာအတိအကျအတွက် အခမဲ့အက်ပ်ကိုဖွင့်ပါ။', ptFoot: 'အက်ပ်သည် နိုင်ငံ ၁၄၃ နိုင်ငံကို ဖုံးလွှမ်းပြီး အော့ဖ်လိုင်းတွင်လည်း အလုပ်လုပ်သည်။',
      prTitle: (n) => `${n} ပရင့်ထုတ်ရန် နမာဇ်ဇယား | လစဉ်နှင့် ရမဇာန်`, prDesc: (n) => `${n} အတွက် ပရင့်ထုတ်ရန် အခမဲ့ လစဉ်နှင့် ရမဇာန်နမာဇ်ဇယား။ ရင်းမြစ်၊ နည်းလမ်းနှင့် ဖြစ်ချိန်ကာလပါရှိသည်။ ပရင့်ထုတ်ပါ သို့မဟုတ် PDF အဖြစ်သိမ်းပါ။`,
      prH1: (n) => `${n} ပရင့်ထုတ်ရန် နမာဇ်ဇယား`, prLead: (n) => `${n} အတွက် အခမဲ့ လစဉ်ဇယားနှင့် ရမဇာန်ဇယား။ ပရင့်ထုတ်ပါ သို့မဟုတ် PDF အဖြစ်သိမ်းပါ။ ဇယားတိုင်းတွင် အချိန်များ၏ ရင်းမြစ်ကို ဖော်ပြထားသည်။ သင့်ဒေသရှိ ဘာသာရေးအာဏာပိုင်ကို လိုက်နာပါ။`,
      prSource: 'ဤအချိန်များ၏ ရင်းမြစ်', prMonthly: 'လစဉ်ဇယား', prRamadan: 'ရမဇာန်ဇယား',
      prRamadanNote: (d, y) => `ရမဇာန် ${y} သည် ${d} ခန့်တွင် စတင်မည်ဟု မျှော်လင့်ရသည်။ ဥမ္မလ်ကုရာ ပြက္ခဒိန်အရ တွက်ထားခြင်းဖြစ်သည်။ အမှန်တကယ်စတင်သည့်ရက်ကို သင့်ဒေသရှိ အာဏာပိုင်က ကြေညာမည်ဖြစ်၍ ထိုကြေညာချက်ကို လိုက်နာပါ။`,
      prFastNote: 'ရိုဇာချိန်ကို ဖဂျ်ရ်မှ မဂ်ရိဘ်အထိ ရေတွက်သည်။', prPrint: 'ဤစာမျက်နှာကို ပရင့်ထုတ်ပါ', prApp: 'သင်ရှိသည့်နေရာအတွက် ပရင့်ထုတ်ရန် အက်ပ်ကိုဖွင့်ပါ',
      prAppNote: 'သင့်မြို့မဟုတ်ဘူးလား။ အခမဲ့အက်ပ်က သင်ရှိသည့်နေရာအတိအကျအတွက် ဇယားကို ပရင့်ထုတ်ပေးနိုင်သည်။', day: 'ရက်', fast: 'ရိုဇာ', back: 'မြို့စာမျက်နှာသို့ ပြန်သွားရန်', printBadge: 'ပရင့်ထုတ်ရန်',
      hubTitle: 'မြို့အလိုက် ပရင့်ထုတ်ရန် နမာဇ်ဇယားများ | Prayer Times Asia', hubDesc: (n) => `မြို့ ${n} မြို့အတွက် ပရင့်ထုတ်ရန် အခမဲ့ လစဉ်နှင့် ရမဇာန်နမာဇ်ဇယားများ၊ တစ်ခုစီတွင် ရင်းမြစ်ပါရှိသည်။`,
      hubH1: 'ပရင့်ထုတ်ရန် နမာဇ်ဇယားများ', hubLead: 'ပရင့်ထုတ်နိုင်သော သို့မဟုတ် PDF အဖြစ်သိမ်းနိုင်သော အခမဲ့ လစဉ်နှင့် ရမဇာန်ဇယားများ။ ဇယားတိုင်းတွင် အချိန်များ၏ ရင်းမြစ်ကို ဖော်ပြထားသည်။ သင့်ဒေသရှိ ဘာသာရေးအာဏာပိုင်ကို လိုက်နာပါ။',
      pick: 'သင့်မြို့ကို ရွေးပါ', cityBadge: 'နမာဇ်ချိန်', theme: 'အလင်းနှင့် အမှောင်ကို ပြောင်းပါ',
    },
    faq: (q) => [
      [`ယနေ့ ${q.n} တွင် ${q.f} ချိန်က ဘယ်အချိန်လဲ`, `ယနေ့ ${q.n} တွင် ${q.f} သည် ${q.T.fajr} ဖြစ်သည်။ နေထွက်ချိန်မှာ ${q.T.sunrise} ဖြစ်၍ ${q.f} ချိန်သည် ထိုအချိန်တွင် ပြီးဆုံးသည်။`],
      [`ယနေ့ ${q.n} တွင် ${q.m} ချိန်က ဘယ်အချိန်လဲ`, `ယနေ့ ${q.n} တွင် ${q.m} သည် ${q.T.maghrib} ဖြစ်သည်။ ရမဇာန်လတွင် ရိုဇာဖွင့်ချိန်လည်း ဖြစ်သည်။`],
      [`ယနေ့ ${q.n} ၏ နမာဇ်ချိန်အားလုံးက ဘာတွေလဲ`, `${q.allTxt} အချိန်အားလုံးသည် ${q.n} ၏ ဒေသစံတော်ချိန်ဖြစ်သည်။`],
      [`${q.n} နမာဇ်ချိန်ကို မည်သည့်နည်းဖြင့် တွက်သနည်း`, `${q.methodName}၊ ${q.f} ကို ${q.fajr} ဒီဂရီတွင်၊ အိရှာကို ${q.ishaRule} တွင် သတ်မှတ်သည်။ အဆ်ရ်သည် ${q.asrName} မဇ်ဟဗ်ကို သုံးသည်။ ${q.official}`],
      [`${q.n} မှ ကစ်ဘ်လဟ်က ဘယ်ဘက်လဲ`, `${q.n} မှ ကစ်ဘ်လဟ်သည် မြောက်ဘက်မှ နာရီလက်တံလှည့်ရာအတိုင်း ${q.qibla} ဒီဂရီခန့်ရှိပြီး ${q.dir} သို့ ဖြစ်သည်။ အက်ပ်က သင့်ဖုန်းပေါ်တွင် တိုက်ရိုက်ပြပေးသည်။`],
    ],
  },

  // ---------------------------------------------------------------- Nepali
  ne: {
    html: 'ne', locale: 'ne-u-nu-latn', native: 'नेपाली', dir: 'ne/prayer-times', print: 'ne/printable-timetables',
    names: { fajr: 'फज्र', sunrise: 'सूर्योदय', dhuhr: 'जुहर', asr: 'असर', maghrib: 'मगरिब', isha: 'इशा' },
    compass: ['उत्तर', 'उत्तरपूर्व', 'पूर्व', 'दक्षिणपूर्व', 'दक्षिण', 'दक्षिणपश्चिम', 'पश्चिम', 'उत्तरपश्चिम'],
    list: ' र ', listSep: ' ', fastUnits: [' घण्टा ', ' मिनेट'], clock: 'h12',
    w: {
      home: 'गृहपृष्ठ', crumb: 'नमाजको समय', open: 'एप खोल्नुहोस्', play: 'Google Play मा डाउनलोड गर्नुहोस्', nasar: 'अल्लाहका लागि सिंगापुरमा बनाइएको, निर्माता',
      title: (n) => `आज ${n} मा नमाजको समय | फज्र जुहर असर मगरिब इशा`,
      descPre: (n, d) => `आज ${n} मा नमाजको समय ${d}`, h1: (n) => `आज ${n} मा नमाजको समय`,
      stale: 'यी समय एक महिनाभन्दा पुराना छन्। आजको समयका लागि एप खोल्नुहोस्।', local: (p) => `सबै समय ${p} को स्थानीय समय हो।`,
      table: (a) => `आधिकारिक तालिका ${a} बाट आउँछ। यो पृष्ठका समय त्यही विधिले गणना गरिएका हुन् र तालिकाभन्दा करिब २ मिनेटभित्र मात्र फरक पर्छ, कहिल्यै अगाडि हुँदैन। अनलाइन हुँदा Prayer Times Asia एपले आधिकारिक तालिका आफैं देखाउँछ।`,
      authority: (a) => `एपले ${a} लाई पछ्याउँछ र त्यही निकायको आफ्नै विधिले समय गणना गर्छ।`,
      none: () => 'यहाँ एपले पढ्न सक्ने एउटै राष्ट्रिय निकाय छैन, त्यसैले धेरैजसो मस्जिदले प्रयोग गर्ने विधि प्रयोग गरिन्छ।',
      faqH: (n) => `${n} मा नमाजको समयबारे प्रश्नहरू`, howH: 'यी समय कसरी गणना गरिन्छ', source: 'स्रोत', methodLbl: 'विधि', placeLbl: 'स्थान',
      moreAbout: 'हामीले समय कसरी गणना गर्छौं भन्नेबारे थप पढ्नुहोस्', caution: 'मस्जिदहरूबीच केही मिनेटको फरक हुन सक्छ, त्यसैले कृपया आफ्नो स्थानीय धार्मिक निकायलाई पछ्याउनुहोस्।',
      ishaDeg: (n) => `${n} डिग्री`, ishaMin: (n) => `मगरिबपछि ${n} मिनेट`, shafii: 'शाफिई', hanafi: 'हनफी',
      daysH: (n) => `अबको ३० दिनका लागि ${n} मा नमाजको समय`, showDays: '३० दिनको तालिका देखाउनुहोस्', dateCol: 'मिति', othersH: 'अन्य सहरहरू', built: 'पृष्ठ बनाइएको मिति',
      printH: 'यो तालिका छाप्नुहोस्', printLead: (n) => `${n} का लागि मासिक र रमजानको तालिका, छाप्न वा PDF मा सुरक्षित गर्न तयार।`, btnMonthly: 'छाप्ने तालिका', btnRamadan: 'रमजानको तालिका',
      follow: 'सधैं आफ्नो स्थानीय धार्मिक निकायलाई पछ्याउनुहोस्।', about: 'हामी समय कसरी गणना गर्छौं', sources: 'हाम्रा समय कहाँबाट आउँछन्', privacy: 'गोपनीयता', allCities: 'सबै सहर',
      ptTitle: 'सहर अनुसार नमाजको समय | Prayer Times Asia', ptDesc: (n) => `एसिया र विश्वभरका ${n} सहरका लागि आजको नमाजको समय, प्रत्येकको विधि र स्रोतसहित।`,
      ptH1: 'सहर अनुसार नमाजको समय', ptLead: 'आजको र अबको ३० दिनको नमाजको समय हेर्न एउटा सहर छान्नुहोस्। विधि र स्रोत लेखिएको छ। तपाईंको ठ्याक्कै ठाउँका लागि निःशुल्क एप खोल्नुहोस्।', ptFoot: 'एपले १४३ देश समेट्छ र अफलाइन पनि चल्छ।',
      prTitle: (n) => `${n} को छाप्ने नमाज तालिका | मासिक र रमजान`, prDesc: (n) => `${n} का लागि निःशुल्क छाप्ने मासिक र रमजानको नमाज तालिका, स्रोत, विधि र रोजाको अवधिसहित। छाप्नुहोस् वा PDF मा सुरक्षित गर्नुहोस्।`,
      prH1: (n) => `${n} को छाप्ने नमाज तालिका`, prLead: (n) => `${n} का लागि निःशुल्क मासिक र रमजानको तालिका। छाप्नुहोस् वा PDF मा सुरक्षित गर्नुहोस्। प्रत्येक तालिकाले समय कहाँबाट आएको हो भन्ने बताउँछ। कृपया आफ्नो स्थानीय धार्मिक निकायलाई पछ्याउनुहोस्।`,
      prSource: 'यी समय कहाँबाट आएका हुन्', prMonthly: 'मासिक तालिका', prRamadan: 'रमजानको तालिका',
      prRamadanNote: (d, y) => `रमजान ${y} करिब ${d} मा सुरु हुने अपेक्षा छ, उम्मुल कुरा पात्रोका आधारमा गणना गरिएको। वास्तविक सुरु मिति तपाईंको स्थानीय निकायले घोषणा गर्छ, त्यसैले त्यसलाई पछ्याउनुहोस्।`,
      prFastNote: 'रोजाको अवधि फज्रदेखि मगरिबसम्म गनिन्छ।', prPrint: 'यो पृष्ठ छाप्नुहोस्', prApp: 'तपाईंको ठ्याक्कै ठाउँका लागि छाप्न एप खोल्नुहोस्',
      prAppNote: 'तपाईंको सहर होइन? निःशुल्क एपले तपाईंको ठ्याक्कै ठाउँका लागि तालिका छाप्न सक्छ।', day: 'दिन', fast: 'रोजा', back: 'सहरको पृष्ठमा फर्कनुहोस्', printBadge: 'छाप्न मिल्ने',
      hubTitle: 'सहर अनुसार छाप्ने नमाज तालिका | Prayer Times Asia', hubDesc: (n) => `${n} सहरका लागि निःशुल्क छाप्ने मासिक र रमजानको नमाज तालिका, प्रत्येकमा स्रोतसहित।`,
      hubH1: 'छाप्ने नमाज तालिका', hubLead: 'छाप्न वा PDF मा सुरक्षित गर्न मिल्ने निःशुल्क मासिक र रमजानको तालिका। प्रत्येक तालिकाले समय कहाँबाट आएको हो भन्ने बताउँछ। कृपया आफ्नो स्थानीय धार्मिक निकायलाई पछ्याउनुहोस्।',
      pick: 'आफ्नो सहर छान्नुहोस्', cityBadge: 'नमाजको समय', theme: 'उज्यालो र अँध्यारो मोड बदल्नुहोस्',
    },
    faq: (q) => [
      [`आज ${q.n} मा ${q.f}को समय कति बजे हो?`, `आज ${q.n} मा ${q.f}को समय ${q.T.fajr} हो। सूर्योदय ${q.T.sunrise} मा हुन्छ, त्यसैले ${q.f}को समय त्यतिबेला सकिन्छ।`],
      [`आज ${q.n} मा ${q.m}को समय कति बजे हो?`, `आज ${q.n} मा ${q.m}को समय ${q.T.maghrib} हो। रमजानमा यही इफ्तारको समय पनि हो।`],
      [`आज ${q.n} मा नमाजका सबै समय के हुन्?`, `${q.allTxt}। सबै समय ${q.n} को स्थानीय समय हो।`],
      [`${q.n} मा नमाजको समय कुन विधिमा आधारित छ?`, `${q.methodName}, ${q.f} ${q.fajr} डिग्रीमा र इशा ${q.ishaRule} मा। असरमा ${q.asrName} मजहब प्रयोग हुन्छ। ${q.official}`],
      [`${q.n} बाट किब्ला कुन दिशातिर छ?`, `${q.n} बाट किब्ला उत्तरबाट घडीको दिशामा करिब ${q.qibla} डिग्रीमा छ, अर्थात् ${q.dir} तिर। एपले यो तपाईंको फोनमा प्रत्यक्ष देखाउँछ।`],
    ],
  },

  // ---------------------------------------------------------------- Chinese (Traditional, for Hong Kong)
  zh: {
    html: 'zh-HK', locale: 'zh-HK-u-nu-latn', native: '中文', dir: 'zh/prayer-times', print: 'zh/printable-timetables',
    names: { fajr: '晨禮', sunrise: '日出', dhuhr: '晌禮', asr: '晡禮', maghrib: '昏禮', isha: '宵禮' },
    compass: ['北', '東北', '東', '東南', '南', '西南', '西', '西北'],
    list: '和', listSep: '', fastUnits: ['小時', '分鐘'], clock: 'h24',
    w: {
      home: '首頁', crumb: '禮拜時間', open: '開啟應用程式', play: '在 Google Play 下載', nasar: '為主而建於新加坡，製作',
      title: (n) => `${n}今日禮拜時間 | 晨禮、晌禮、晡禮、昏禮、宵禮`,
      descPre: (n, d) => `${n}今日禮拜時間，${d}。`, h1: (n) => `${n}今日禮拜時間`,
      stale: '這些時間已超過一個月。請開啟應用程式查看今日時間。', local: (p) => `所有時間均為${p}當地時間。`,
      table: (a) => `官方時間表由${a}發布。本頁時間以相同方法計算，與官方時間表相差約 2 分鐘以內，並且不會比它更早。連線時，Prayer Times Asia 應用程式會直接顯示官方時間表。`,
      authority: (a) => `應用程式依循${a}，並使用該機構自己的方法計算時間。`,
      none: () => '這裡沒有應用程式可讀取時間表的單一全國機構，所以採用大多數清真寺使用的方法。',
      faqH: (n) => `關於${n}禮拜時間的問題`, howH: '這些時間如何計算', source: '來源', methodLbl: '方法', placeLbl: '地點',
      moreAbout: '進一步了解我們如何計算時間', caution: '各清真寺之間可能相差幾分鐘，請依循你所在地的宗教機構。',
      ishaDeg: (n) => `${n} 度`, ishaMin: (n) => `昏禮後 ${n} 分鐘`, shafii: '沙斐儀', hanafi: '哈乃斐',
      daysH: (n) => `${n}未來 30 天的禮拜時間`, showDays: '顯示 30 天時間表', dateCol: '日期', othersH: '其他城市', built: '頁面建立日期',
      printH: '列印這份時間表', printLead: (n) => `${n}的每月及齋月時間表，可直接列印或儲存為 PDF。`, btnMonthly: '可列印時間表', btnRamadan: '齋月時間表',
      follow: '請務必依循你所在地的宗教機構。', about: '我們如何計算時間', sources: '我們的時間從哪裡來', privacy: '私隱', allCities: '所有城市',
      ptTitle: '各城市禮拜時間 | Prayer Times Asia', ptDesc: (n) => `亞洲及世界各地 ${n} 個城市今日的禮拜時間，並說明每個城市的方法和來源。`,
      ptH1: '各城市禮拜時間', ptLead: '選擇一個城市，查看今日及未來 30 天的禮拜時間，並列明方法和來源。如需你所在位置的準確時間，請開啟我們的免費應用程式。', ptFoot: '應用程式涵蓋 143 個國家，離線也能使用。',
      prTitle: (n) => `${n}可列印禮拜時間表 | 每月及齋月`, prDesc: (n) => `${n}免費可列印的每月及齋月禮拜時間表，附有來源、方法和齋戒時長。可列印或儲存為 PDF。`,
      prH1: (n) => `${n}可列印禮拜時間表`, prLead: (n) => `${n}免費的每月及齋月時間表。可列印或儲存為 PDF。每份時間表都註明時間的來源。請依循你所在地的宗教機構。`,
      prSource: '這些時間的來源', prMonthly: '每月時間表', prRamadan: '齋月時間表',
      prRamadanNote: (d, y) => `預計 ${y} 年齋月約在 ${d} 開始，依據烏姆庫拉曆計算。實際開始日期由你所在地的機構公布，請依循該公布。`,
      prFastNote: '齋戒時長由晨禮計至昏禮。', prPrint: '列印此頁', prApp: '開啟應用程式，按你的準確位置列印',
      prAppNote: '不是你的城市？免費應用程式可按你的準確位置列印時間表。', day: '日', fast: '齋戒', back: '返回城市頁面', printBadge: '可列印',
      hubTitle: '各城市可列印禮拜時間表 | Prayer Times Asia', hubDesc: (n) => `${n} 個城市免費可列印的每月及齋月禮拜時間表，每份均附來源。`,
      hubH1: '可列印禮拜時間表', hubLead: '免費的每月及齋月時間表，可列印或儲存為 PDF。每份時間表都註明時間的來源。請依循你所在地的宗教機構。',
      pick: '選擇你的城市', cityBadge: '禮拜時間', theme: '切換淺色和深色模式',
    },
    faq: (q) => [
      [`${q.n}今日${q.f}是幾點？`, `${q.n}今日${q.f}是 ${q.T.fajr}。日出是 ${q.T.sunrise}，所以${q.f}的時間在那時結束。`],
      [`${q.n}今日${q.m}是幾點？`, `${q.n}今日${q.m}是 ${q.T.maghrib}。齋月期間這也是開齋的時間。`],
      [`${q.n}今日所有禮拜時間是什麼？`, `${q.allTxt}。所有時間均為${q.n}當地時間。`],
      [`${q.n}的禮拜時間根據什麼方法計算？`, `${q.methodName}，${q.f}為 ${q.fajr} 度，宵禮為${q.ishaRule}。晡禮採用${q.asrName}學派。${q.official}`],
      [`從${q.n}看，朝向（克爾白）在哪個方向？`, `從${q.n}看，朝向約為由正北順時針 ${q.qibla} 度，即${q.dir}方向。應用程式會在你的手機上即時顯示。`],
    ],
  },

  // ---------------------------------------------------------------- Japanese
  ja: {
    html: 'ja', locale: 'ja-JP', native: '日本語', dir: 'ja/prayer-times', print: 'ja/printable-timetables',
    names: { fajr: 'ファジュル', sunrise: '日の出', dhuhr: 'ズフル', asr: 'アスル', maghrib: 'マグリブ', isha: 'イシャー' },
    compass: ['北', '北東', '東', '南東', '南', '南西', '西', '北西'],
    list: '、', listSep: '', fastUnits: ['時間', '分'], clock: 'h24',
    w: {
      home: 'ホーム', crumb: '礼拝時間', open: 'アプリを開く', play: 'Google Play で入手', nasar: 'アッラーのためにシンガポールで制作、制作者',
      title: (n) => `${n}の今日の礼拝時間 | ファジュル ズフル アスル マグリブ イシャー`,
      descPre: (n, d) => `${n}の今日の礼拝時間、${d}。`, h1: (n) => `${n}の今日の礼拝時間`,
      stale: 'この時間は一か月以上前のものです。今日の時間はアプリでご確認ください。', local: (p) => `時間はすべて${p}の現地時間です。`,
      table: (a) => `公式の時間表は${a}が発表しています。このページの時間は同じ方法で計算していて、公式の時間表との差は約2分以内で、早くなることはありません。オンラインのときは、Prayer Times Asia アプリが公式の時間表そのものを表示します。`,
      authority: (a) => `アプリは${a}に従い、その機関自身の方法で時間を計算します。`,
      none: () => 'ここにはアプリが読み取れる時間表を出す単一の国の機関がないため、多くのモスクが使う方法を使っています。',
      faqH: (n) => `${n}の礼拝時間についてのよくある質問`, howH: 'この時間の計算方法', source: '出典', methodLbl: '方法', placeLbl: '場所',
      moreAbout: '時間の計算方法をもっと読む', caution: 'モスクによって数分の違いがありますので、お住まいの地域の宗教機関に従ってください。',
      ishaDeg: (n) => `${n}度`, ishaMin: (n) => `マグリブの${n}分後`, shafii: 'シャーフィイー派', hanafi: 'ハナフィー派',
      daysH: (n) => `${n}の今後30日間の礼拝時間`, showDays: '30日間の時間表を表示', dateCol: '日付', othersH: 'ほかの都市', built: 'ページ作成日',
      printH: 'この時間表を印刷', printLead: (n) => `${n}の月間時間表とラマダン時間表。印刷またはPDF保存ができます。`, btnMonthly: '印刷用の時間表', btnRamadan: 'ラマダンの時間表',
      follow: '常にお住まいの地域の宗教機関に従ってください。', about: '時間の計算方法', sources: '時間の出どころ', privacy: 'プライバシー', allCities: 'すべての都市',
      ptTitle: '都市別の礼拝時間 | Prayer Times Asia', ptDesc: (n) => `アジアと世界の${n}都市の今日の礼拝時間。都市ごとに方法と出典を説明しています。`,
      ptH1: '都市別の礼拝時間', ptLead: '都市を選ぶと、今日と今後30日間の礼拝時間を、方法と出典とともに見られます。お住まいの場所ぴったりの時間は無料のアプリでご確認ください。', ptFoot: 'アプリは143か国に対応し、オフラインでも使えます。',
      prTitle: (n) => `${n}の印刷用礼拝時間表 | 月間とラマダン`, prDesc: (n) => `${n}の無料の印刷用礼拝時間表。月間とラマダンの両方があり、出典、方法、断食の長さを記載しています。印刷またはPDF保存ができます。`,
      prH1: (n) => `${n}の印刷用礼拝時間表`, prLead: (n) => `${n}の無料の月間時間表とラマダン時間表です。印刷またはPDF保存ができます。どの時間表にも時間の出典を記載しています。お住まいの地域の宗教機関に従ってください。`,
      prSource: 'この時間の出典', prMonthly: '月間時間表', prRamadan: 'ラマダン時間表',
      prRamadanNote: (d, y) => `${y}年のラマダンは、ウンム・アル＝クラー暦による計算で${d}ごろに始まる見込みです。実際の開始日はお住まいの地域の機関が発表しますので、その発表に従ってください。`,
      prFastNote: '断食の長さはファジュルからマグリブまでで数えています。', prPrint: 'このページを印刷', prApp: 'アプリを開いて、お住まいの場所ぴったりで印刷',
      prAppNote: 'お住まいの都市ではありませんか。無料のアプリなら、場所ぴったりの時間表を印刷できます。', day: '日', fast: '断食', back: '都市のページに戻る', printBadge: '印刷用',
      hubTitle: '都市別の印刷用礼拝時間表 | Prayer Times Asia', hubDesc: (n) => `${n}都市の無料の印刷用礼拝時間表。月間とラマダンがあり、どれにも出典を記載しています。`,
      hubH1: '印刷用の礼拝時間表', hubLead: '印刷またはPDF保存ができる無料の月間時間表とラマダン時間表です。どの時間表にも時間の出典を記載しています。お住まいの地域の宗教機関に従ってください。',
      pick: 'お住まいの都市を選ぶ', cityBadge: '礼拝時間', theme: 'ライトとダークを切り替え',
    },
    faq: (q) => [
      [`今日の${q.n}の${q.f}は何時ですか。`, `今日の${q.n}の${q.f}は${q.T.fajr}です。日の出は${q.T.sunrise}なので、${q.f}の時間はそのときに終わります。`],
      [`今日の${q.n}の${q.m}は何時ですか。`, `今日の${q.n}の${q.m}は${q.T.maghrib}です。ラマダン中は断食明けの時間でもあります。`],
      [`今日の${q.n}の礼拝時間をすべて教えてください。`, `${q.allTxt}。時間はすべて${q.n}の現地時間です。`],
      [`${q.n}の礼拝時間はどの方法で計算していますか。`, `${q.methodName}で、${q.f}は${q.fajr}度、イシャーは${q.ishaRule}です。アスルは${q.asrName}を使います。${q.official}`],
      [`${q.n}から見たキブラはどの方向ですか。`, `${q.n}から見たキブラは、北から時計回りに約${q.qibla}度で、${q.dir}の方向です。アプリでは携帯の画面にリアルタイムで表示されます。`],
    ],
  },

  // ---------------------------------------------------------------- Korean
  ko: {
    html: 'ko', locale: 'ko-KR', native: '한국어', dir: 'ko/prayer-times', print: 'ko/printable-timetables',
    names: { fajr: '파즈르', sunrise: '일출', dhuhr: '두후르', asr: '아스르', maghrib: '마그립', isha: '이샤' },
    compass: ['북쪽', '북동쪽', '동쪽', '남동쪽', '남쪽', '남서쪽', '서쪽', '북서쪽'],
    list: ' 그리고 ', listSep: ' ', fastUnits: ['시간 ', '분'], clock: 'h24',
    w: {
      home: '홈', crumb: '예배 시간', open: '앱 열기', play: 'Google Play에서 받기', nasar: '알라를 위해 싱가포르에서 만들었습니다. 제작',
      title: (n) => `오늘 ${n} 예배 시간 | 파즈르 두후르 아스르 마그립 이샤`,
      descPre: (n, d) => `오늘 ${n} 예배 시간, ${d}.`, h1: (n) => `오늘 ${n} 예배 시간`,
      stale: '이 시간은 한 달이 넘었습니다. 오늘 시간은 앱에서 확인하세요.', local: (p) => `모든 시간은 ${p} 현지 시간입니다.`,
      table: (a) => `공식 시간표는 ${a}에서 나옵니다. 이 페이지의 시간은 같은 방법으로 계산했으며 공식 시간표와 약 2분 안팎으로만 차이가 나고 더 빠른 적은 없습니다. 온라인일 때 Prayer Times Asia 앱이 공식 시간표를 그대로 보여 줍니다.`,
      authority: (a) => `앱은 ${a}을 따르며 그 기관의 방법으로 시간을 계산합니다.`,
      none: () => '이곳에는 앱이 읽을 수 있는 시간표를 내는 단일 국가 기관이 없어서, 대부분의 사원이 쓰는 방법을 사용합니다.',
      faqH: (n) => `${n} 예배 시간에 대한 질문`, howH: '이 시간은 어떻게 계산하나요', source: '출처', methodLbl: '방법', placeLbl: '장소',
      moreAbout: '시간을 계산하는 방법 더 알아보기', caution: '사원마다 몇 분씩 다를 수 있으니 거주 지역의 종교 기관을 따라 주세요.',
      ishaDeg: (n) => `${n}도`, ishaMin: (n) => `마그립 ${n}분 뒤`, shafii: '샤피이', hanafi: '하나피',
      daysH: (n) => `${n} 앞으로 30일 예배 시간`, showDays: '30일 시간표 보기', dateCol: '날짜', othersH: '다른 도시', built: '페이지 생성일',
      printH: '이 시간표 인쇄하기', printLead: (n) => `${n}의 월간 시간표와 라마단 시간표입니다. 바로 인쇄하거나 PDF로 저장할 수 있습니다.`, btnMonthly: '인쇄용 시간표', btnRamadan: '라마단 시간표',
      follow: '언제나 거주 지역의 종교 기관을 따르세요.', about: '시간을 계산하는 방법', sources: '시간의 출처', privacy: '개인정보', allCities: '모든 도시',
      ptTitle: '도시별 예배 시간 | Prayer Times Asia', ptDesc: (n) => `아시아와 전 세계 ${n}개 도시의 오늘 예배 시간과 도시별 방법 및 출처 설명.`,
      ptH1: '도시별 예배 시간', ptLead: '도시를 고르면 오늘과 앞으로 30일의 예배 시간을 방법과 출처와 함께 볼 수 있습니다. 정확한 내 위치의 시간은 무료 앱에서 확인하세요.', ptFoot: '앱은 143개국을 지원하고 오프라인에서도 작동합니다.',
      prTitle: (n) => `${n} 인쇄용 예배 시간표 | 월간과 라마단`, prDesc: (n) => `${n}의 무료 인쇄용 월간 및 라마단 예배 시간표. 출처, 방법, 단식 시간이 적혀 있습니다. 인쇄하거나 PDF로 저장하세요.`,
      prH1: (n) => `${n} 인쇄용 예배 시간표`, prLead: (n) => `${n}의 무료 월간 및 라마단 시간표입니다. 인쇄하거나 PDF로 저장하세요. 모든 시간표에 시간의 출처가 적혀 있습니다. 거주 지역의 종교 기관을 따라 주세요.`,
      prSource: '이 시간의 출처', prMonthly: '월간 시간표', prRamadan: '라마단 시간표',
      prRamadanNote: (d, y) => `${y}년 라마단은 움 알쿠라 달력으로 계산해 ${d}쯤 시작할 것으로 예상됩니다. 실제 시작일은 거주 지역의 기관이 발표하므로 그 발표를 따라 주세요.`,
      prFastNote: '단식 시간은 파즈르부터 마그립까지로 셉니다.', prPrint: '이 페이지 인쇄', prApp: '앱을 열어 내 정확한 위치로 인쇄하기',
      prAppNote: '내 도시가 아닌가요? 무료 앱에서 내 정확한 위치의 시간표를 인쇄할 수 있습니다.', day: '일', fast: '단식', back: '도시 페이지로 돌아가기', printBadge: '인쇄용',
      hubTitle: '도시별 인쇄용 예배 시간표 | Prayer Times Asia', hubDesc: (n) => `${n}개 도시의 무료 인쇄용 월간 및 라마단 예배 시간표. 모두 출처가 적혀 있습니다.`,
      hubH1: '인쇄용 예배 시간표', hubLead: '인쇄하거나 PDF로 저장할 수 있는 무료 월간 및 라마단 시간표입니다. 모든 시간표에 시간의 출처가 적혀 있습니다. 거주 지역의 종교 기관을 따라 주세요.',
      pick: '내 도시 고르기', cityBadge: '예배 시간', theme: '밝은 모드와 어두운 모드 바꾸기',
    },
    faq: (q) => [
      [`오늘 ${q.n}의 ${q.f} 시간은 몇 시인가요?`, `오늘 ${q.n}의 ${q.f}는 ${q.T.fajr}입니다. 일출은 ${q.T.sunrise}이므로 ${q.f} 시간은 그때 끝납니다.`],
      [`오늘 ${q.n}의 ${q.m} 시간은 몇 시인가요?`, `오늘 ${q.n}의 ${q.m}는 ${q.T.maghrib}입니다. 라마단 중에는 단식을 마치는 시간이기도 합니다.`],
      [`오늘 ${q.n}의 모든 예배 시간은 언제인가요?`, `${q.allTxt}. 모든 시간은 ${q.n} 현지 시간입니다.`],
      [`${q.n}의 예배 시간은 어떤 방법으로 계산하나요?`, `${q.methodName}, ${q.f}는 ${q.fajr}도, 이샤는 ${q.ishaRule}입니다. 아스르는 ${q.asrName}를 사용합니다. ${q.official}`],
      [`${q.n}에서 키블라는 어느 방향인가요?`, `${q.n}에서 키블라는 북쪽에서 시계 방향으로 약 ${q.qibla}도, 즉 ${q.dir} 방향입니다. 앱이 휴대폰에서 실시간으로 보여 줍니다.`],
    ],
  },

  // ---------------------------------------------------------------- Vietnamese
  vi: {
    html: 'vi', locale: 'vi-VN', native: 'Tiếng Việt', dir: 'vi/prayer-times', print: 'vi/printable-timetables',
    names: { fajr: 'Fajr', sunrise: 'Mặt trời mọc', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' },
    compass: ['bắc', 'đông bắc', 'đông', 'đông nam', 'nam', 'tây nam', 'tây', 'tây bắc'],
    list: ' và ', listSep: ' ', fastUnits: [' giờ ', ' phút'], clock: 'h24',
    w: {
      home: 'Trang chủ', crumb: 'Giờ cầu nguyện', open: 'Mở ứng dụng', play: 'Tải trên Google Play', nasar: 'Được làm vì Allah tại Singapore bởi',
      title: (n) => `Giờ cầu nguyện hôm nay ở ${n} | Fajr, Dhuhr, Asr, Maghrib, Isha`,
      descPre: (n, d) => `Giờ cầu nguyện hôm nay ở ${n}, ${d}.`, h1: (n) => `Giờ cầu nguyện hôm nay ở ${n}`,
      stale: 'Những giờ này đã cũ hơn một tháng. Hãy mở ứng dụng để xem giờ hôm nay.', local: (p) => `Tất cả giờ đều là giờ địa phương ở ${p}.`,
      table: (a) => `Bảng giờ chính thức do ${a} công bố. Giờ trên trang này được tính bằng cùng phương pháp và chỉ lệch khoảng 2 phút so với bảng, không bao giờ sớm hơn. Khi có mạng, ứng dụng Prayer Times Asia hiển thị chính bảng giờ chính thức.`,
      authority: (a) => `Ứng dụng theo ${a} và tính giờ bằng chính phương pháp của cơ quan đó.`,
      none: () => 'Ở đây không có một cơ quan quốc gia duy nhất công bố bảng giờ mà ứng dụng đọc được, nên ứng dụng dùng phương pháp mà phần lớn các thánh đường dùng.',
      faqH: (n) => `Câu hỏi về giờ cầu nguyện ở ${n}`, howH: 'Các giờ này được tính thế nào', source: 'Nguồn', methodLbl: 'Phương pháp', placeLbl: 'Địa điểm',
      moreAbout: 'Đọc thêm về cách chúng tôi tính giờ', caution: 'Các thánh đường có thể lệch nhau vài phút, vì vậy xin hãy theo cơ quan tôn giáo tại địa phương của bạn.',
      ishaDeg: (n) => `${n} độ`, ishaMin: (n) => `${n} phút sau Maghrib`, shafii: "Shafi'i", hanafi: 'Hanafi',
      daysH: (n) => `Giờ cầu nguyện ở ${n} trong 30 ngày tới`, showDays: 'Xem bảng giờ 30 ngày', dateCol: 'Ngày', othersH: 'Các thành phố khác', built: 'Trang được tạo ngày',
      printH: 'In bảng giờ này', printLead: (n) => `Bảng giờ theo tháng và bảng giờ Ramadan cho ${n}, sẵn sàng để in hoặc lưu thành PDF.`, btnMonthly: 'Bảng giờ để in', btnRamadan: 'Bảng giờ Ramadan',
      follow: 'Luôn theo cơ quan tôn giáo tại địa phương của bạn.', about: 'Cách chúng tôi tính giờ', sources: 'Giờ của chúng tôi đến từ đâu', privacy: 'Quyền riêng tư', allCities: 'Tất cả thành phố',
      ptTitle: 'Giờ cầu nguyện theo thành phố | Prayer Times Asia', ptDesc: (n) => `Giờ cầu nguyện hôm nay của ${n} thành phố ở châu Á và trên thế giới, kèm phương pháp và nguồn của từng nơi.`,
      ptH1: 'Giờ cầu nguyện theo thành phố', ptLead: 'Chọn một thành phố để xem giờ cầu nguyện hôm nay và 30 ngày tới, có ghi rõ phương pháp và nguồn. Muốn có giờ chính xác tại nơi bạn ở, hãy mở ứng dụng miễn phí của chúng tôi.', ptFoot: 'Ứng dụng bao phủ 143 quốc gia và dùng được khi không có mạng.',
      prTitle: (n) => `Bảng giờ cầu nguyện để in ở ${n} | Theo tháng và Ramadan`, prDesc: (n) => `Bảng giờ cầu nguyện miễn phí để in ở ${n}, theo tháng và Ramadan, có ghi nguồn, phương pháp và độ dài ngày nhịn ăn. In hoặc lưu thành PDF.`,
      prH1: (n) => `Bảng giờ cầu nguyện để in ở ${n}`, prLead: (n) => `Bảng giờ theo tháng và Ramadan miễn phí cho ${n}. In hoặc lưu thành PDF. Mỗi bảng đều ghi giờ lấy từ đâu. Xin hãy theo cơ quan tôn giáo tại địa phương của bạn.`,
      prSource: 'Các giờ này lấy từ đâu', prMonthly: 'Bảng giờ theo tháng', prRamadan: 'Bảng giờ Ramadan',
      prRamadanNote: (d, y) => `Ramadan ${y} dự kiến bắt đầu vào khoảng ${d}, tính theo lịch Umm al-Qura. Cơ quan tôn giáo tại địa phương của bạn sẽ công bố ngày bắt đầu thật sự, vì vậy xin hãy theo thông báo đó.`,
      prFastNote: 'Độ dài ngày nhịn ăn được tính từ Fajr đến Maghrib.', prPrint: 'In trang này', prApp: 'Mở ứng dụng để in theo đúng vị trí của bạn',
      prAppNote: 'Không phải thành phố của bạn? Ứng dụng miễn phí có thể in bảng giờ theo đúng vị trí của bạn.', day: 'Ngày', fast: 'Nhịn ăn', back: 'Quay lại trang thành phố', printBadge: 'Để in',
      hubTitle: 'Bảng giờ cầu nguyện để in theo thành phố | Prayer Times Asia', hubDesc: (n) => `Bảng giờ cầu nguyện miễn phí để in, theo tháng và Ramadan, cho ${n} thành phố, mỗi bảng đều ghi nguồn.`,
      hubH1: 'Bảng giờ cầu nguyện để in', hubLead: 'Bảng giờ theo tháng và Ramadan miễn phí, bạn có thể in hoặc lưu thành PDF. Mỗi bảng đều ghi giờ lấy từ đâu. Xin hãy theo cơ quan tôn giáo tại địa phương của bạn.',
      pick: 'Chọn thành phố của bạn', cityBadge: 'Giờ cầu nguyện', theme: 'Chuyển giữa chế độ sáng và tối',
    },
    faq: (q) => [
      [`${q.f} hôm nay ở ${q.n} lúc mấy giờ?`, `${q.f} hôm nay ở ${q.n} vào lúc ${q.T.fajr}. Mặt trời mọc lúc ${q.T.sunrise}, nên giờ ${q.f} kết thúc khi đó.`],
      [`${q.m} hôm nay ở ${q.n} lúc mấy giờ?`, `${q.m} hôm nay ở ${q.n} vào lúc ${q.T.maghrib}. Trong tháng Ramadan, đây cũng là giờ mở chay.`],
      [`Tất cả giờ cầu nguyện hôm nay ở ${q.n} là gì?`, `${q.allTxt}. Tất cả giờ đều là giờ địa phương ở ${q.n}.`],
      [`Giờ cầu nguyện ở ${q.n} dựa trên phương pháp nào?`, `${q.methodName}, với ${q.f} ở ${q.fajr} độ và Isha ở ${q.ishaRule}. Asr theo trường phái ${q.asrName}. ${q.official}`],
      [`Hướng qibla từ ${q.n} là hướng nào?`, `Qibla từ ${q.n} khoảng ${q.qibla} độ theo chiều kim đồng hồ tính từ hướng bắc, tức là về phía ${q.dir}. Ứng dụng hiển thị trực tiếp trên điện thoại của bạn.`],
    ],
  },

  // ---------------------------------------------------------------- Khmer
  km: {
    html: 'km', locale: 'km-u-nu-latn', native: 'ខ្មែរ', dir: 'km/prayer-times', print: 'km/printable-timetables',
    names: { fajr: 'ហ្វាជ្រ', sunrise: 'ថ្ងៃរះ', dhuhr: 'ឌូហ៍រ', asr: 'អាសរ', maghrib: 'ម៉ាហ្គ្រីប', isha: 'អ៊ីសា' },
    compass: ['ខាងជើង', 'ឦសាន', 'ខាងកើត', 'អាគ្នេយ៍', 'ខាងត្បូង', 'នៃរតី', 'ខាងលិច', 'ពាយ័ព្យ'],
    list: ' និង ', listSep: ' ', fastUnits: [' ម៉ោង ', ' នាទី'], clock: 'h12',
    w: {
      home: 'ទំព័រដើម', crumb: 'ម៉ោងសឡាត', open: 'បើកកម្មវិធី', play: 'ទាញយកនៅ Google Play', nasar: 'បង្កើតដើម្បីអល់ឡោះនៅសិង្ហបុរី ដោយ',
      title: (n) => `ម៉ោងសឡាតថ្ងៃនេះនៅ ${n} | ហ្វាជ្រ ឌូហ៍រ អាសរ ម៉ាហ្គ្រីប អ៊ីសា`,
      descPre: (n, d) => `ម៉ោងសឡាតថ្ងៃនេះនៅ ${n} ${d}`, h1: (n) => `ម៉ោងសឡាតថ្ងៃនេះនៅ ${n}`,
      stale: 'ម៉ោងទាំងនេះចាស់ជាងមួយខែហើយ។ សូមបើកកម្មវិធីដើម្បីមើលម៉ោងថ្ងៃនេះ។', local: (p) => `ម៉ោងទាំងអស់ជាម៉ោងក្នុងស្រុកនៅ ${p}។`,
      table: (a) => `តារាងផ្លូវការចេញពី ${a}។ ម៉ោងនៅទំព័រនេះគណនាដោយវិធីតែមួយ ហើយខុសពីតារាងមិនលើសប្រហែល ២ នាទី ហើយមិនដែលមុនជាងនោះទេ។ កម្មវិធី Prayer Times Asia បង្ហាញតារាងផ្លូវការដោយខ្លួនឯងពេលអ្នកមានអ៊ីនធឺណិត។`,
      authority: (a) => `កម្មវិធីធ្វើតាម ${a} ហើយគណនាម៉ោងដោយវិធីរបស់ស្ថាប័ននោះផ្ទាល់។`,
      none: () => 'នៅទីនេះមិនមានស្ថាប័នជាតិតែមួយដែលកម្មវិធីអាចអានតារាងបានទេ ដូច្នេះកម្មវិធីប្រើវិធីដែលវិហារឥស្លាមភាគច្រើនប្រើ។',
      faqH: (n) => `សំណួរអំពីម៉ោងសឡាតនៅ ${n}`, howH: 'ម៉ោងទាំងនេះគណនាដោយរបៀបណា', source: 'ប្រភព', methodLbl: 'វិធី', placeLbl: 'ទីកន្លែង',
      moreAbout: 'អានបន្ថែមអំពីរបៀបដែលយើងគណនាម៉ោង', caution: 'វិហារឥស្លាមអាចខុសគ្នាប៉ុន្មាននាទី ដូច្នេះសូមធ្វើតាមអាជ្ញាធរសាសនានៅមូលដ្ឋានរបស់អ្នក។',
      ishaDeg: (n) => `${n} ដឺក្រេ`, ishaMin: (n) => `${n} នាទីក្រោយម៉ាហ្គ្រីប`, shafii: 'សាហ្វីអី', hanafi: 'ហាណាហ្វី',
      daysH: (n) => `ម៉ោងសឡាតនៅ ${n} សម្រាប់ ៣០ ថ្ងៃខាងមុខ`, showDays: 'បង្ហាញតារាង ៣០ ថ្ងៃ', dateCol: 'កាលបរិច្ឆេទ', othersH: 'ទីក្រុងផ្សេងទៀត', built: 'ទំព័រត្រូវបានបង្កើតនៅ',
      printH: 'បោះពុម្ពតារាងនេះ', printLead: (n) => `តារាងប្រចាំខែ និងតារាងរ៉ាម៉ាដនសម្រាប់ ${n} រួចរាល់សម្រាប់បោះពុម្ព ឬរក្សាទុកជា PDF។`, btnMonthly: 'តារាងសម្រាប់បោះពុម្ព', btnRamadan: 'តារាងរ៉ាម៉ាដន',
      follow: 'សូមធ្វើតាមអាជ្ញាធរសាសនានៅមូលដ្ឋានរបស់អ្នកជានិច្ច។', about: 'របៀបដែលយើងគណនាម៉ោង', sources: 'ម៉ោងរបស់យើងមកពីណា', privacy: 'ឯកជនភាព', allCities: 'ទីក្រុងទាំងអស់',
      ptTitle: 'ម៉ោងសឡាតតាមទីក្រុង | Prayer Times Asia', ptDesc: (n) => `ម៉ោងសឡាតថ្ងៃនេះសម្រាប់ ${n} ទីក្រុងនៅអាស៊ី និងទូទាំងពិភពលោក ព្រមទាំងពន្យល់វិធី និងប្រភពរបស់ទីក្រុងនីមួយៗ។`,
      ptH1: 'ម៉ោងសឡាតតាមទីក្រុង', ptLead: 'ជ្រើសរើសទីក្រុងដើម្បីមើលម៉ោងសឡាតថ្ងៃនេះ និង ៣០ ថ្ងៃខាងមុខ ដោយមានសរសេរវិធី និងប្រភព។ សម្រាប់ទីតាំងពិតប្រាកដរបស់អ្នក សូមបើកកម្មវិធីឥតគិតថ្លៃរបស់យើង។', ptFoot: 'កម្មវិធីគ្របដណ្តប់ ១៤៣ ប្រទេស ហើយប្រើបានដោយគ្មានអ៊ីនធឺណិត។',
      prTitle: (n) => `តារាងសឡាតសម្រាប់បោះពុម្ពនៅ ${n} | ប្រចាំខែ និងរ៉ាម៉ាដន`, prDesc: (n) => `តារាងសឡាតប្រចាំខែ និងរ៉ាម៉ាដនឥតគិតថ្លៃសម្រាប់បោះពុម្ពនៅ ${n} មានប្រភព វិធី និងរយៈពេលតមអាហារ។ បោះពុម្ព ឬរក្សាទុកជា PDF។`,
      prH1: (n) => `តារាងសឡាតសម្រាប់បោះពុម្ពនៅ ${n}`, prLead: (n) => `តារាងប្រចាំខែ និងតារាងរ៉ាម៉ាដនឥតគិតថ្លៃសម្រាប់ ${n}។ បោះពុម្ព ឬរក្សាទុកជា PDF។ តារាងនីមួយៗប្រាប់ថាម៉ោងមកពីណា។ សូមធ្វើតាមអាជ្ញាធរសាសនានៅមូលដ្ឋានរបស់អ្នក។`,
      prSource: 'ម៉ោងទាំងនេះមកពីណា', prMonthly: 'តារាងប្រចាំខែ', prRamadan: 'តារាងរ៉ាម៉ាដន',
      prRamadanNote: (d, y) => `រ៉ាម៉ាដន ${y} រំពឹងថានឹងចាប់ផ្តើមប្រហែលថ្ងៃទី ${d} គណនាតាមប្រតិទិនអ៊ុមម៉ុលគូរ៉ា។ អាជ្ញាធរសាសនានៅមូលដ្ឋានរបស់អ្នកប្រកាសថ្ងៃចាប់ផ្តើមពិតប្រាកដ ដូច្នេះសូមធ្វើតាមការប្រកាសនោះ។`,
      prFastNote: 'រយៈពេលតមអាហាររាប់ពីហ្វាជ្រដល់ម៉ាហ្គ្រីប។', prPrint: 'បោះពុម្ពទំព័រនេះ', prApp: 'បើកកម្មវិធីដើម្បីបោះពុម្ពតាមទីតាំងពិតប្រាកដរបស់អ្នក',
      prAppNote: 'មិនមែនទីក្រុងរបស់អ្នកទេ? កម្មវិធីឥតគិតថ្លៃអាចបោះពុម្ពតារាងតាមទីតាំងពិតប្រាកដរបស់អ្នក។', day: 'ថ្ងៃ', fast: 'តមអាហារ', back: 'ត្រឡប់ទៅទំព័រទីក្រុង', printBadge: 'សម្រាប់បោះពុម្ព',
      hubTitle: 'តារាងសឡាតសម្រាប់បោះពុម្ពតាមទីក្រុង | Prayer Times Asia', hubDesc: (n) => `តារាងសឡាតប្រចាំខែ និងរ៉ាម៉ាដនឥតគិតថ្លៃសម្រាប់បោះពុម្ពនៅ ${n} ទីក្រុង ដែលមានប្រភពក្នុងតារាងនីមួយៗ។`,
      hubH1: 'តារាងសឡាតសម្រាប់បោះពុម្ព', hubLead: 'តារាងប្រចាំខែ និងរ៉ាម៉ាដនឥតគិតថ្លៃដែលអ្នកអាចបោះពុម្ព ឬរក្សាទុកជា PDF។ តារាងនីមួយៗប្រាប់ថាម៉ោងមកពីណា។ សូមធ្វើតាមអាជ្ញាធរសាសនានៅមូលដ្ឋានរបស់អ្នក។',
      pick: 'ជ្រើសរើសទីក្រុងរបស់អ្នក', cityBadge: 'ម៉ោងសឡាត', theme: 'ប្តូររវាងម៉ូតភ្លឺ និងងងឹត',
    },
    faq: (q) => [
      [`ម៉ោង ${q.f} ថ្ងៃនេះនៅ ${q.n} គឺម៉ោងប៉ុន្មាន?`, `${q.f} ថ្ងៃនេះនៅ ${q.n} គឺម៉ោង ${q.T.fajr}។ ថ្ងៃរះនៅម៉ោង ${q.T.sunrise} ដូច្នេះពេល ${q.f} ចប់នៅពេលនោះ។`],
      [`ម៉ោង ${q.m} ថ្ងៃនេះនៅ ${q.n} គឺម៉ោងប៉ុន្មាន?`, `${q.m} ថ្ងៃនេះនៅ ${q.n} គឺម៉ោង ${q.T.maghrib}។ ក្នុងខែរ៉ាម៉ាដន នេះក៏ជាម៉ោងបួសផងដែរ។`],
      [`ម៉ោងសឡាតទាំងអស់ថ្ងៃនេះនៅ ${q.n} គឺអ្វីខ្លះ?`, `${q.allTxt}។ ម៉ោងទាំងអស់ជាម៉ោងក្នុងស្រុកនៅ ${q.n}។`],
      [`ម៉ោងសឡាតនៅ ${q.n} ផ្អែកលើវិធីអ្វី?`, `${q.methodName} ដោយ ${q.f} នៅ ${q.fajr} ដឺក្រេ និងអ៊ីសានៅ ${q.ishaRule}។ អាសរប្រើមជ្ឈិម ${q.asrName}។ ${q.official}`],
      [`ទិសគីប្លាត់ពី ${q.n} ទៅទិសណា?`, `គីប្លាត់ពី ${q.n} ប្រហែល ${q.qibla} ដឺក្រេតាមទិសនាឡិកាពីទិសខាងជើង គឺទៅទិស${q.dir}។ កម្មវិធីបង្ហាញវាផ្ទាល់នៅលើទូរស័ព្ទរបស់អ្នក។`],
    ],
  },

  // ---------------------------------------------------------------- Filipino
  fil: {
    html: 'fil', locale: 'fil-PH', native: 'Filipino', dir: 'fil/prayer-times', print: 'fil/printable-timetables',
    names: { fajr: 'Fajr', sunrise: 'Pagsikat ng araw', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' },
    compass: ['hilaga', 'hilagang-silangan', 'silangan', 'timog-silangan', 'timog', 'timog-kanluran', 'kanluran', 'hilagang-kanluran'],
    list: ' at ', listSep: ' ', fastUnits: [' oras ', ' minuto'], clock: 'h12',
    w: {
      home: 'Home', crumb: 'Oras ng dasal', open: 'Buksan ang app', play: 'Kunin sa Google Play', nasar: 'Ginawa para sa Allah sa Singapore ng',
      title: (n) => `Oras ng dasal ngayon sa ${n} | Fajr, Dhuhr, Asr, Maghrib, Isha`,
      descPre: (n, d) => `Oras ng dasal ngayon sa ${n}, ${d}.`, h1: (n) => `Oras ng dasal ngayon sa ${n}`,
      stale: 'Mahigit isang buwan na ang mga oras na ito. Buksan ang app para sa oras ngayon.', local: (p) => `Lahat ng oras ay lokal na oras sa ${p}.`,
      table: (a) => `Ang opisyal na talaan ay mula sa ${a}. Ang mga oras sa pahinang ito ay kinukuwenta sa parehong paraan at hindi lalampas sa mga 2 minuto ang agwat sa talaan, at hindi kailanman mas maaga. Ipinapakita mismo ng Prayer Times Asia app ang opisyal na talaan kapag online ka.`,
      authority: (a) => `Sumusunod ang app sa ${a} at kinukuwenta ang mga oras gamit ang sariling paraan ng awtoridad na iyon.`,
      none: () => 'Walang iisang pambansang awtoridad dito na ang talaan ay mababasa ng app, kaya ginagamit nito ang paraang ginagamit ng karamihan ng mga masjid.',
      faqH: (n) => `Mga tanong tungkol sa oras ng dasal sa ${n}`, howH: 'Paano kinukuwenta ang mga oras na ito', source: 'Pinagmulan', methodLbl: 'Paraan', placeLbl: 'Lugar',
      moreAbout: 'Basahin pa kung paano namin kinukuwenta ang mga oras', caution: 'Maaaring magkaiba ng ilang minuto ang mga masjid, kaya mangyaring sundin ang inyong lokal na awtoridad sa relihiyon.',
      ishaDeg: (n) => `${n} digri`, ishaMin: (n) => `${n} minuto pagkatapos ng Maghrib`, shafii: "Shafi'i", hanafi: 'Hanafi',
      daysH: (n) => `Oras ng dasal sa ${n} para sa susunod na 30 araw`, showDays: 'Ipakita ang talaan para sa 30 araw', dateCol: 'Petsa', othersH: 'Iba pang lungsod', built: 'Ginawa ang pahina noong',
      printH: 'I-print ang talaang ito', printLead: (n) => `Buwanang talaan at talaan ng Ramadan para sa ${n}, handa nang i-print o i-save bilang PDF.`, btnMonthly: 'Talaang ipi-print', btnRamadan: 'Talaan ng Ramadan',
      follow: 'Laging sundin ang inyong lokal na awtoridad sa relihiyon.', about: 'Paano namin kinukuwenta ang mga oras', sources: 'Saan galing ang aming mga oras', privacy: 'Privacy', allCities: 'Lahat ng lungsod',
      ptTitle: 'Oras ng dasal ayon sa lungsod | Prayer Times Asia', ptDesc: (n) => `Oras ng dasal ngayon para sa ${n} lungsod sa Asya at sa buong mundo, may paliwanag sa paraan at pinagmulan ng bawat isa.`,
      ptH1: 'Oras ng dasal ayon sa lungsod', ptLead: 'Pumili ng lungsod para makita ang oras ng dasal ngayon at sa susunod na 30 araw, kasama ang paraan at pinagmulan. Para sa eksaktong lugar ninyo, buksan ang libreng app.', ptFoot: 'Sakop ng app ang 143 bansa at gumagana kahit offline.',
      prTitle: (n) => `Talaan ng oras ng dasal na ipi-print sa ${n} | Buwanan at Ramadan`, prDesc: (n) => `Libreng talaan ng oras ng dasal na ipi-print, buwanan at Ramadan, para sa ${n}, kasama ang pinagmulan, paraan at haba ng pag-aayuno. I-print o i-save bilang PDF.`,
      prH1: (n) => `Talaan ng oras ng dasal na ipi-print sa ${n}`, prLead: (n) => `Libreng buwanang talaan at talaan ng Ramadan para sa ${n}. I-print o i-save bilang PDF. Sinasabi ng bawat talaan kung saan galing ang mga oras. Mangyaring sundin ang inyong lokal na awtoridad sa relihiyon.`,
      prSource: 'Saan galing ang mga oras na ito', prMonthly: 'Buwanang talaan', prRamadan: 'Talaan ng Ramadan',
      prRamadanNote: (d, y) => `Inaasahang magsisimula ang Ramadan ${y} sa mga ${d}, kinuwenta mula sa kalendaryong Umm al-Qura. Ang lokal na awtoridad ninyo ang magpapahayag ng tunay na simula, kaya mangyaring sundin ang anunsyong iyon.`,
      prFastNote: 'Binibilang ang haba ng pag-aayuno mula Fajr hanggang Maghrib.', prPrint: 'I-print ang pahinang ito', prApp: 'Buksan ang app para mag-print para sa eksaktong lugar ninyo',
      prAppNote: 'Hindi ninyo lungsod? Kayang mag-print ng libreng app ng talaan para sa eksaktong lugar ninyo.', day: 'Araw', fast: 'Pag-aayuno', back: 'Bumalik sa pahina ng lungsod', printBadge: 'Ipi-print',
      hubTitle: 'Mga talaan ng oras ng dasal na ipi-print ayon sa lungsod | Prayer Times Asia', hubDesc: (n) => `Libreng buwanan at Ramadan na talaan ng oras ng dasal na ipi-print para sa ${n} lungsod, may nakasulat na pinagmulan ang bawat isa.`,
      hubH1: 'Mga talaan ng oras ng dasal na ipi-print', hubLead: 'Libreng buwanan at Ramadan na talaan na maaaring i-print o i-save bilang PDF. Sinasabi ng bawat talaan kung saan galing ang mga oras. Mangyaring sundin ang inyong lokal na awtoridad sa relihiyon.',
      pick: 'Piliin ang inyong lungsod', cityBadge: 'Oras ng dasal', theme: 'Magpalit sa pagitan ng maliwanag at madilim',
    },
    faq: (q) => [
      [`Anong oras ang ${q.f} ngayon sa ${q.n}?`, `Ang ${q.f} ngayon sa ${q.n} ay sa ${q.T.fajr}. Sumisikat ang araw sa ${q.T.sunrise}, kaya doon nagtatapos ang oras ng ${q.f}.`],
      [`Anong oras ang ${q.m} ngayon sa ${q.n}?`, `Ang ${q.m} ngayon sa ${q.n} ay sa ${q.T.maghrib}. Ito rin ang oras ng pagbubukas ng pag-aayuno tuwing Ramadan.`],
      [`Ano ang lahat ng oras ng dasal ngayon sa ${q.n}?`, `${q.allTxt}. Lahat ng oras ay lokal na oras sa ${q.n}.`],
      [`Anong paraan ang batayan ng oras ng dasal sa ${q.n}?`, `${q.methodName}, kung saan ang ${q.f} ay sa ${q.fajr} digri at ang Isha ay sa ${q.ishaRule}. Ang Asr ay ayon sa paaralang ${q.asrName}. ${q.official}`],
      [`Saang direksyon ang qibla mula sa ${q.n}?`, `Ang qibla mula sa ${q.n} ay mga ${q.qibla} digri pakanan mula sa hilaga, papunta sa ${q.dir}. Ipinapakita ito ng app nang live sa inyong telepono.`],
    ],
  },

  // ---------------------------------------------------------------- Hindi
  hi: {
    html: 'hi', locale: 'hi-IN', native: 'हिन्दी', dir: 'hi/prayer-times', print: 'hi/printable-timetables',
    names: { fajr: 'फ़ज्र', sunrise: 'सूर्योदय', dhuhr: 'ज़ुहर', asr: 'अस्र', maghrib: 'मग़रिब', isha: 'इशा' },
    compass: ['उत्तर', 'उत्तर पूर्व', 'पूर्व', 'दक्षिण पूर्व', 'दक्षिण', 'दक्षिण पश्चिम', 'पश्चिम', 'उत्तर पश्चिम'],
    list: ' और ', listSep: ' ', fastUnits: [' घंटे ', ' मिनट'], clock: 'h12',
    w: {
      home: 'होम', crumb: 'नमाज़ का समय', open: 'ऐप खोलें', play: 'Google Play पर पाएँ', nasar: 'अल्लाह के लिए सिंगापुर में बनाया गया, निर्माता',
      title: (n) => `${n} में आज नमाज़ का समय | फ़ज्र ज़ुहर अस्र मग़रिब इशा`,
      descPre: (n, d) => `${n} में आज नमाज़ का समय, ${d}।`, h1: (n) => `${n} में आज नमाज़ का समय`,
      stale: 'ये समय एक महीने से ज़्यादा पुराने हैं। आज के समय के लिए ऐप खोलें।', local: (p) => `सभी समय ${p} के स्थानीय समय हैं।`,
      table: (a) => `आधिकारिक तालिका ${a} से आती है। इस पन्ने के समय उसी तरीके से निकाले गए हैं और तालिका से लगभग 2 मिनट के भीतर ही अलग होते हैं, कभी पहले नहीं। ऑनलाइन होने पर Prayer Times Asia ऐप आधिकारिक तालिका खुद दिखाता है।`,
      authority: (a) => `ऐप ${a} का पालन करता है और उसी संस्था के अपने तरीके से समय निकालता है।`,
      none: () => 'यहाँ कोई एक राष्ट्रीय संस्था नहीं है जिसकी तालिका ऐप पढ़ सके, इसलिए ऐप वह तरीका इस्तेमाल करता है जो ज़्यादातर मस्जिदें करती हैं।',
      faqH: (n) => `${n} में नमाज़ के समय के बारे में सवाल`, howH: 'ये समय कैसे निकाले जाते हैं', source: 'स्रोत', methodLbl: 'तरीका', placeLbl: 'जगह',
      moreAbout: 'हम समय कैसे निकालते हैं, इसके बारे में और पढ़ें', caution: 'मस्जिदों में कुछ मिनट का फ़र्क हो सकता है, इसलिए कृपया अपने स्थानीय धार्मिक अधिकारी की बात मानें।',
      ishaDeg: (n) => `${n} डिग्री`, ishaMin: (n) => `मग़रिब के ${n} मिनट बाद`, shafii: 'शाफ़िई', hanafi: 'हनफ़ी',
      daysH: (n) => `${n} में अगले 30 दिनों की नमाज़ का समय`, showDays: '30 दिन की तालिका दिखाएँ', dateCol: 'तारीख़', othersH: 'दूसरे शहर', built: 'पन्ना बनाया गया',
      printH: 'यह तालिका प्रिंट करें', printLead: (n) => `${n} के लिए महीने की और रमज़ान की तालिका, प्रिंट करने या PDF में सहेजने के लिए तैयार।`, btnMonthly: 'प्रिंट वाली तालिका', btnRamadan: 'रमज़ान की तालिका',
      follow: 'हमेशा अपने स्थानीय धार्मिक अधिकारी की बात मानें।', about: 'हम समय कैसे निकालते हैं', sources: 'हमारे समय कहाँ से आते हैं', privacy: 'गोपनीयता', allCities: 'सभी शहर',
      ptTitle: 'शहर के हिसाब से नमाज़ का समय | Prayer Times Asia', ptDesc: (n) => `एशिया और दुनिया भर के ${n} शहरों में आज नमाज़ का समय, हर शहर के तरीके और स्रोत के साथ।`,
      ptH1: 'शहर के हिसाब से नमाज़ का समय', ptLead: 'आज और अगले 30 दिनों का नमाज़ का समय देखने के लिए एक शहर चुनें। तरीका और स्रोत लिखा है। आपकी सटीक जगह के लिए हमारा मुफ़्त ऐप खोलें।', ptFoot: 'ऐप 143 देशों को कवर करता है और ऑफ़लाइन भी चलता है।',
      prTitle: (n) => `${n} की प्रिंट वाली नमाज़ तालिका | महीना और रमज़ान`, prDesc: (n) => `${n} के लिए मुफ़्त प्रिंट वाली महीने की और रमज़ान की नमाज़ तालिका, स्रोत, तरीके और रोज़े की लंबाई के साथ। प्रिंट करें या PDF में सहेजें।`,
      prH1: (n) => `${n} की प्रिंट वाली नमाज़ तालिका`, prLead: (n) => `${n} के लिए मुफ़्त महीने की और रमज़ान की तालिका। प्रिंट करें या PDF में सहेजें। हर तालिका बताती है कि समय कहाँ से आए हैं। कृपया अपने स्थानीय धार्मिक अधिकारी की बात मानें।`,
      prSource: 'ये समय कहाँ से आए हैं', prMonthly: 'महीने की तालिका', prRamadan: 'रमज़ान की तालिका',
      prRamadanNote: (d, y) => `रमज़ान ${y} लगभग ${d} को शुरू होने की उम्मीद है, उम्मुल क़ुरा कैलेंडर से निकाला गया। असली शुरुआत का ऐलान आपके स्थानीय अधिकारी करते हैं, इसलिए उसी की बात मानें।`,
      prFastNote: 'रोज़े की लंबाई फ़ज्र से मग़रिब तक गिनी जाती है।', prPrint: 'यह पन्ना प्रिंट करें', prApp: 'अपनी सटीक जगह के लिए प्रिंट करने हेतु ऐप खोलें',
      prAppNote: 'आपका शहर नहीं है? मुफ़्त ऐप आपकी सटीक जगह के लिए तालिका प्रिंट कर सकता है।', day: 'दिन', fast: 'रोज़ा', back: 'शहर के पन्ने पर वापस जाएँ', printBadge: 'प्रिंट के लिए',
      hubTitle: 'शहर के हिसाब से प्रिंट वाली नमाज़ तालिकाएँ | Prayer Times Asia', hubDesc: (n) => `${n} शहरों के लिए मुफ़्त प्रिंट वाली महीने की और रमज़ान की नमाज़ तालिकाएँ, हर एक पर स्रोत लिखा है।`,
      hubH1: 'प्रिंट वाली नमाज़ तालिकाएँ', hubLead: 'मुफ़्त महीने की और रमज़ान की तालिकाएँ जिन्हें आप प्रिंट कर सकते हैं या PDF में सहेज सकते हैं। हर तालिका बताती है कि समय कहाँ से आए हैं। कृपया अपने स्थानीय धार्मिक अधिकारी की बात मानें।',
      pick: 'अपना शहर चुनें', cityBadge: 'नमाज़ का समय', theme: 'हल्के और गहरे रंग के बीच बदलें',
    },
    faq: (q) => [
      [`आज ${q.n} में ${q.f} का समय क्या है?`, `आज ${q.n} में ${q.f} का समय ${q.T.fajr} है। सूर्योदय ${q.T.sunrise} पर होता है, इसलिए ${q.f} का समय तभी ख़त्म हो जाता है।`],
      [`आज ${q.n} में ${q.m} का समय क्या है?`, `आज ${q.n} में ${q.m} का समय ${q.T.maghrib} है। रमज़ान में यही इफ़्तार का समय भी है।`],
      [`आज ${q.n} में नमाज़ के सारे समय क्या हैं?`, `${q.allTxt}। सभी समय ${q.n} के स्थानीय समय हैं।`],
      [`${q.n} में नमाज़ के समय किस तरीके पर आधारित हैं?`, `${q.methodName}, जिसमें ${q.f} ${q.fajr} डिग्री पर और इशा ${q.ishaRule} पर है। अस्र में ${q.asrName} मसलक इस्तेमाल होता है। ${q.official}`],
      [`${q.n} से क़िबला किस दिशा में है?`, `${q.n} से क़िबला उत्तर से घड़ी की दिशा में लगभग ${q.qibla} डिग्री पर है, यानी ${q.dir} की ओर। ऐप इसे आपके फ़ोन पर सीधे दिखाता है।`],
    ],
  },

  // ---------------------------------------------------------------- Sinhala
  si: {
    html: 'si', locale: 'si-LK', native: 'සිංහල', dir: 'si/prayer-times', print: 'si/printable-timetables',
    names: { fajr: 'ෆජ්ර්', sunrise: 'හිරු උදාව', dhuhr: 'ලුහර්', asr: 'අස්ර්', maghrib: 'මග්රිබ්', isha: 'ඉෂා' },
    compass: ['උතුර', 'ඊසාන', 'නැගෙනහිර', 'ගිනිකොන', 'දකුණ', 'නිරිත', 'බටහිර', 'වයඹ'],
    list: ' සහ ', listSep: ' ', fastUnits: [' පැය ', ' මිනිත්තු'], clock: 'h12',
    w: {
      home: 'මුල් පිටුව', crumb: 'සලාත් වේලාවන්', open: 'යෙදුම විවෘත කරන්න', play: 'Google Play හි ලබාගන්න', nasar: 'අල්ලාහ් වෙනුවෙන් සිංගප්පූරුවේ නිර්මාණය කළේ',
      title: (n) => `අද ${n} සලාත් වේලාවන් | ෆජ්ර් ලුහර් අස්ර් මග්රිබ් ඉෂා`,
      descPre: (n, d) => `අද ${n} සලාත් වේලාවන්, ${d}.`, h1: (n) => `අද ${n} සලාත් වේලාවන්`,
      stale: 'මෙම වේලාවන් මාසයකට වඩා පැරණියි. අද වේලාවන් සඳහා යෙදුම විවෘත කරන්න.', local: (p) => `සියලු වේලාවන් ${p} දේශීය වේලාවෙනි.`,
      table: (a) => `නිල වේලා සටහන ${a} මගින් නිකුත් කෙරේ. මෙම පිටුවේ වේලාවන් එම ක්රමයෙන්ම ගණනය කර ඇති අතර සටහනට මිනිත්තු 2ක් පමණ ඇතුළත පමණක් වෙනස් වන අතර කිසිවිටෙකත් ඊට වඩා කලින් නොවේ. ඔබ සබැඳිව සිටින විට Prayer Times Asia යෙදුම නිල සටහනම පෙන්වයි.`,
      authority: (a) => `යෙදුම ${a} අනුගමනය කරන අතර එම ආයතනයේම ක්රමයෙන් වේලාවන් ගණනය කරයි.`,
      none: () => 'යෙදුමට කියවිය හැකි වේලා සටහනක් නිකුත් කරන තනි ජාතික ආයතනයක් මෙහි නොමැති බැවින්, බොහෝ පල්ලි භාවිතා කරන ක්රමය භාවිතා කරයි.',
      faqH: (n) => `${n} සලාත් වේලාවන් ගැන ප්රශ්න`, howH: 'මෙම වේලාවන් ගණනය කරන්නේ කෙසේද', source: 'මූලාශ්රය', methodLbl: 'ක්රමය', placeLbl: 'ස්ථානය',
      moreAbout: 'අපි වේලාවන් ගණනය කරන ආකාරය ගැන තවත් කියවන්න', caution: 'පල්ලි අතර මිනිත්තු කිහිපයක වෙනසක් තිබිය හැකි බැවින් ඔබේ ප්රදේශයේ ආගමික අධිකාරියට අනුව ක්රියා කරන්න.',
      ishaDeg: (n) => `අංශක ${n}`, ishaMin: (n) => `මග්රිබ්ට මිනිත්තු ${n}කට පසු`, shafii: 'ෂාෆි', hanafi: 'හනෆි',
      daysH: (n) => `ඉදිරි දින 30 සඳහා ${n} සලාත් වේලාවන්`, showDays: 'දින 30 සටහන පෙන්වන්න', dateCol: 'දිනය', othersH: 'වෙනත් නගර', built: 'පිටුව සාදන ලද දිනය',
      printH: 'මෙම සටහන මුද්රණය කරන්න', printLead: (n) => `${n} සඳහා මාසික සහ රමසාන් සටහන්, මුද්රණයට හෝ PDF ලෙස සුරැකීමට සූදානම්.`, btnMonthly: 'මුද්රණය සඳහා සටහන', btnRamadan: 'රමසාන් සටහන',
      follow: 'සෑම විටම ඔබේ ප්රදේශයේ ආගමික අධිකාරියට අනුව ක්රියා කරන්න.', about: 'අපි වේලාවන් ගණනය කරන ආකාරය', sources: 'අපගේ වේලාවන් ලැබෙන්නේ කොහින්ද', privacy: 'පෞද්ගලිකත්වය', allCities: 'සියලු නගර',
      ptTitle: 'නගරය අනුව සලාත් වේලාවන් | Prayer Times Asia', ptDesc: (n) => `ආසියාවේ සහ ලොව පුරා නගර ${n}ක අද සලාත් වේලාවන්, එක් එක් නගරයේ ක්රමය සහ මූලාශ්රය සමඟ.`,
      ptH1: 'නගරය අනුව සලාත් වේලාවන්', ptLead: 'අද සහ ඉදිරි දින 30 සඳහා සලාත් වේලාවන් බැලීමට නගරයක් තෝරන්න. ක්රමය සහ මූලාශ්රය ලියා ඇත. ඔබ සිටින නිශ්චිත ස්ථානය සඳහා අපගේ නොමිලේ යෙදුම විවෘත කරන්න.', ptFoot: 'යෙදුම රටවල් 143ක් ආවරණය කරන අතර අන්තර්ජාලය නැතිවත් ක්රියා කරයි.',
      prTitle: (n) => `${n} මුද්රණය සඳහා සලාත් සටහන | මාසික සහ රමසාන්`, prDesc: (n) => `${n} සඳහා නොමිලේ මුද්රණය කළ හැකි මාසික සහ රමසාන් සලාත් සටහන, මූලාශ්රය, ක්රමය සහ සෝදන කාලය සමඟ. මුද්රණය කරන්න හෝ PDF ලෙස සුරකින්න.`,
      prH1: (n) => `${n} මුද්රණය සඳහා සලාත් සටහන`, prLead: (n) => `${n} සඳහා නොමිලේ මාසික සහ රමසාන් සටහන්. මුද්රණය කරන්න හෝ PDF ලෙස සුරකින්න. සෑම සටහනක්ම වේලාවන් ලැබුණු තැන කියයි. ඔබේ ප්රදේශයේ ආගමික අධිකාරියට අනුව ක්රියා කරන්න.`,
      prSource: 'මෙම වේලාවන් ලැබුණු තැන', prMonthly: 'මාසික සටහන', prRamadan: 'රමසාන් සටහන',
      prRamadanNote: (d, y) => `රමසාන් ${y} ${d} පමණ ආරම්භ වේ යැයි අපේක්ෂා කෙරේ, උම්මුල් කුරා දින දර්ශනයෙන් ගණනය කර ඇත. සැබෑ ආරම්භය ඔබේ ප්රදේශයේ අධිකාරිය නිවේදනය කරන බැවින් එම නිවේදනයට අනුව ක්රියා කරන්න.`,
      prFastNote: 'උපවාස කාලය ගණනය කරන්නේ ෆජ්ර් සිට මග්රිබ් දක්වාය.', prPrint: 'මෙම පිටුව මුද්රණය කරන්න', prApp: 'ඔබ සිටින නිශ්චිත ස්ථානයට මුද්රණය කිරීමට යෙදුම විවෘත කරන්න',
      prAppNote: 'ඔබේ නගරය නොවේද? නොමිලේ යෙදුමට ඔබ සිටින නිශ්චිත ස්ථානය සඳහා සටහන මුද්රණය කළ හැක.', day: 'දිනය', fast: 'උපවාසය', back: 'නගර පිටුවට ආපසු', printBadge: 'මුද්රණය සඳහා',
      hubTitle: 'නගරය අනුව මුද්රණය සඳහා සලාත් සටහන් | Prayer Times Asia', hubDesc: (n) => `නගර ${n}ක් සඳහා නොමිලේ මුද්රණය කළ හැකි මාසික සහ රමසාන් සලාත් සටහන්, සෑම එකකම මූලාශ්රය සමඟ.`,
      hubH1: 'මුද්රණය සඳහා සලාත් සටහන්', hubLead: 'මුද්රණය කළ හැකි හෝ PDF ලෙස සුරැකිය හැකි නොමිලේ මාසික සහ රමසාන් සටහන්. සෑම සටහනක්ම වේලාවන් ලැබුණු තැන කියයි. ඔබේ ප්රදේශයේ ආගමික අධිකාරියට අනුව ක්රියා කරන්න.',
      pick: 'ඔබේ නගරය තෝරන්න', cityBadge: 'සලාත් වේලාවන්', theme: 'ආලෝක සහ අඳුරු මාදිලි අතර මාරු වන්න',
    },
    faq: (q) => [
      [`අද ${q.n} හි ${q.f} වේලාව කීයද?`, `අද ${q.n} හි ${q.f} වේලාව ${q.T.fajr} වේ. හිරු උදාව ${q.T.sunrise} වන බැවින් ${q.f} කාලය එවිට අවසන් වේ.`],
      [`අද ${q.n} හි ${q.m} වේලාව කීයද?`, `අද ${q.n} හි ${q.m} වේලාව ${q.T.maghrib} වේ. රමසාන් කාලයේ මෙය උපවාසය නිම කරන වේලාවද වේ.`],
      [`අද ${q.n} හි සියලු සලාත් වේලාවන් මොනවාද?`, `${q.allTxt}. සියලු වේලාවන් ${q.n} දේශීය වේලාවෙනි.`],
      [`${q.n} හි සලාත් වේලාවන් පදනම් වී ඇත්තේ කුමන ක්රමයටද?`, `${q.methodName}, ${q.f} අංශක ${q.fajr}ට සහ ඉෂා ${q.ishaRule}ට. අස්ර් සඳහා ${q.asrName} මද්හබ් භාවිතා කරයි. ${q.official}`],
      [`${q.n} සිට කිබ්ලාව ඇත්තේ කුමන දිශාවටද?`, `${q.n} සිට කිබ්ලාව උතුරෙන් ඔරලෝසු දිශාවට අංශක ${q.qibla}ක් පමණ වන අතර ${q.dir} දිශාවට වේ. යෙදුම මෙය ඔබේ දුරකථනයේ සජීවීව පෙන්වයි.`],
    ],
  },
}

/** "Most masjids in the region", for the Source line where no authority publishes a timetable. */
export const NO_AUTH_NEW: Record<NewLang, string> = {
  th: 'มัสยิดส่วนใหญ่ในภูมิภาคนี้', my: 'ဒေသတွင်းရှိ ဗလီအများစု', ne: 'यस क्षेत्रका धेरैजसो मस्जिद', zh: '本地區大多數清真寺', ja: 'この地域のほとんどのモスク',
  ko: '이 지역 대부분의 사원', vi: 'Phần lớn các thánh đường trong khu vực', km: 'វិហារឥស្លាមភាគច្រើនក្នុងតំបន់', fil: 'Karamihan ng mga masjid sa rehiyon',
  hi: 'इस इलाके की ज़्यादातर मस्जिदें', si: 'කලාපයේ බොහෝ පල්ලි',
}

/** City names in the local language and script. */
export const LOCAL_CITY_NAMES: Record<string, Partial<Record<NewLang, string>>> = {
  bangkok: { th: 'กรุงเทพมหานคร' }, 'chiang-mai': { th: 'เชียงใหม่' }, yangon: { my: 'ရန်ကုန်' }, kathmandu: { ne: 'काठमाडौं' },
  manila: { fil: 'Maynila' }, hanoi: { vi: 'Hà Nội' }, 'ho-chi-minh-city': { vi: 'Thành phố Hồ Chí Minh' }, 'phnom-penh': { km: 'ភ្នំពេញ' },
  mumbai: { hi: 'मुंबई' }, delhi: { hi: 'दिल्ली' }, colombo: { si: 'කොළඹ' }, tokyo: { ja: '東京' }, seoul: { ko: '서울' }, 'hong-kong': { zh: '香港' },
  'hat-yai': { th: 'หาดใหญ่' }, pattani: { th: 'ปัตตานี' }, yala: { th: 'ยะลา' }, narathiwat: { th: 'นราธิวาส' }, phuket: { th: 'ภูเก็ต' },
  'da-nang': { vi: 'Đà Nẵng' }, 'chau-doc': { vi: 'Châu Đốc' }, 'siem-reap': { km: 'សៀមរាប' }, mandalay: { my: 'မန္တလေး' },
  hyderabad: { hi: 'हैदराबाद' }, bengaluru: { hi: 'बेंगलुरु' }, chennai: { hi: 'चेन्नई' }, kolkata: { hi: 'कोलकाता' },
  kandy: { si: 'මහනුවර' }, osaka: { ja: '大阪' }, busan: { ko: '부산' },
}
