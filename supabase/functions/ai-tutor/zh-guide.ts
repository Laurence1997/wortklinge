// 中文翻译易错词对照表 (Lucas 2026-11-27: NPC 把 Termin 译成「约会」太影响体验).
// Appended to every system prompt whose JSON reply has a "zh" field (duel / argue / world chat), so the model's Chinese
// matches what a Chinese learner living in Germany needs. Keep the list short: only words models really get wrong.

export const ZH_GUIDE = `
写 "zh" 中文翻译时：按德国日常生活里的意思译，用中国大陆常用说法；不要按字面或英语去猜。下面这些词最容易译错（左边德语，右边正确译法，括号里是不要用的错译）：
- Termin：预约；约好的时间；（看医生、办事的）号（不要译成「约会」；只有约朋友/恋爱见面才叫约会）
- Verabredung / sich verabreden：约好见面；约（朋友）（恋爱语境才用「约会」）
- Chef / Chefin：老板；上司；领导（不是「厨师」，厨师是 Koch）
- eventuell：可能；也许（不是「最终」）
- aktuell：当前的；最新的（不是「实际的」）
- bekommen：得到；收到（不是「变成」，变成是 werden）
- also：所以；那么（不是「也」）
- fast：几乎；差不多（不是「快」）
- bald：很快；不久（不是「秃」）
- Stelle：职位；工作岗位；（某个）位置（招聘语境不要译「地方」）
- Kasse：收银台；收款处；Krankenkasse = 医保公司；医疗保险（不是「医院」「钱箱」）
- Rezept：处方（看病语境）；食谱（做饭语境）
- Quittung / Kassenbon：收据；小票
- Rechnung：账单；发票
- Miete：房租；Kaltmiete = 冷租（不含杂费）；Warmmiete = 暖租（含杂费）
- Nebenkosten：（房租）杂费；附加费用（不是「额外开销」「副作用」）
- Kaution：押金（不是「小心」）
- Vermieter / Vermieterin：房东；Mieter / Mieterin：租客；房客（别弄反）
- Hausverwaltung：物业；Hausmeister：（楼的）管理员；物业师傅
- Behörde / Amt：政府部门；机关；Bürgeramt：市民服务中心；Ausländerbehörde：外管局；Ordnungsamt：秩序局
- Anmeldung：登记；（住址）登记；报名（不是「通知」）
- Ausweis / Personalausweis：证件；身份证；Aufenthaltstitel：居留许可
- Antrag：申请（表）（求婚只在 Heiratsantrag 里）
- Bescheid：通知；（官方）决定书；Bescheid sagen = 告诉一声
- Frist：期限；截止日期
- Kündigung：解约；辞职；解雇（看主语）
- Überweisung：转账（银行）；转诊单（看病语境）
- Praxis：诊所（医生语境）；实践
- Hausarzt：家庭医生；Facharzt：专科医生；Notaufnahme：急诊
- Krankschreibung / krankgeschrieben：病假条；开了病假
- Feierabend：下班（后）（不是「节日」「晚会」）
- Gymnasium：文理中学（不是「体育馆」）；Hochschule：高等院校；大学（不是「高中」）
- Abitur：（德国）高中毕业考试
- Azubi / Ausbildung：学徒；职业培训
- Note：分数；成绩（学校语境）；Zeugnis：成绩单；证书
- Handy：手机；Beamer：投影仪；Tablett：托盘（平板电脑是 Tablet）
- Gift：毒药（不是「礼物」）；Art：种类；方式（不是「艺术」）
- sympathisch：讨人喜欢的；有好感的（不是「同情」）
- konsequent：一贯的；说到做到的（不是「结果」）
- Personal：员工；人员（不是「个人的」）
- Lokal：饭馆；酒馆（名词）
- Billion：万亿（不是十亿；十亿是 Milliarde）
- Bad：浴室；卫生间（不是「坏」）
- gemütlich：舒适；惬意
- pünktlich：准时
- Stock / Etage：楼层；im ersten Stock = 二楼（德国一楼是 Erdgeschoss）
- Gleis：站台；轨道；Bahnsteig：月台
- Kneipe：小酒馆；Imbiss：小吃店
- Pfand：（瓶子）押金
- Steuer-ID / Steuernummer：税号
- Wohnheim：（学生）宿舍；WG：合租公寓`;
