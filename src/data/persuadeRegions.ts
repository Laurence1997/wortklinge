// 说服段 · 各区说服对象 (Lucas 2026-11-28「推荐」方案 1): every map region has 2–3 people to talk round in its own
// life situation; the five in core/persuade.ts stay as 通用. 1–3 区 get 2 each (the mode opens at 21), the others 3.
// 蚀变段 have no map of their own: you stand in an old region, so its people are the ones you meet (the old situation).
// `scene` goes to the model with the region's grammar added (controller.openPersuade), so keep it under ~280 chars
// (the cloud function clips the scene at 400).
import type { PersuadeScene } from '../core/persuade';

export const REGION_PERSUADE: Record<number, PersuadeScene[]> = {
  // 1 最后的营地 · 营地生活、吃的喝的
  1: [
    { id: 'r1-suppe', title: '伙房：多打一碗汤', npc: 'Frau Albers（伙房）', formal: true, scene: '人物是营地伙房的 Frau Albers，每人只能领一碗汤。玩家的同伴发烧躺在帐篷里起不来，玩家想替他多领一碗。', cares: '她怕有人冒领、汤不够分。玩家说出同伴的名字和帐篷、说明他病了，再主动提出待会儿帮忙洗锅，她就会多盛一碗。', intro: '同伴发烧起不来，你想替他多领一碗汤。说服伙房的 Frau Albers（用 Sie）。' },
    { id: 'r1-zelt', title: '帐篷邻居：换个位置', npc: 'Ben（帐篷邻居）', formal: false, scene: '人物是营地里的 Ben，他的帐篷在火堆旁边。玩家的帐篷昨晚漏雨，想和他换一晚位置。', cares: '他怕冷，火堆旁是他好不容易占到的。玩家帮他搬东西、答应夜里轮流添柴，或者只换一晚，他就会答应。', intro: '你的帐篷漏雨了。说服火堆旁的 Ben 和你换一晚位置（用 du）。' },
  ],
  // 2 面包集市 · 买东西、问价、付钱
  2: [
    { id: 'r2-fahrrad', title: '跳蚤市场：二手自行车讲价', npc: 'Frau Lindemann（摊主）', formal: true, scene: '人物是跳蚤市场的摊主 Frau Lindemann，她的二手自行车要价 80 欧，玩家身上只有 60 欧现金。', cares: '她今天就想卖掉，不想再把车搬回家。玩家指出车的毛病（车灯坏了、链条生锈）、马上付现金，或者顺便买她的车锁，她会降价。', intro: '一辆二手自行车要 80 欧，你只带了 60。跟摊主讲价（用 Sie）。' },
    { id: 'r2-pulli', title: '服装店：没小票换货', npc: 'Herr Roth（店员）', formal: true, scene: '人物是服装店店员 Herr Roth。玩家上周买的毛衣小了一号，想换大一号，可是小票丢了。', cares: '店里规定要小票。玩家说出哪天买的、用银行卡付的（可以查账）、吊牌还在也没穿过，他就会同意换货（但不退钱）。', intro: '毛衣小了，小票却丢了。说服店员给你换大一号（用 Sie）。' },
  ],
  // 3 铁轨镇 · 坐火车、时间和日程
  3: [
    { id: 'r3-ticket', title: '检票员：手机没电了', npc: 'Frau Schmitt（检票员）', formal: true, scene: '人物是火车检票员 Frau Schmitt。玩家买了电子车票，可手机没电打不开，她要按逃票罚 60 欧。', cares: '她每天都听到各种借口。玩家报出姓名和订单、拿出订票用的银行卡或证件，并答应下车后去服务中心补交证明，她就只记下信息、不当场罚款。', intro: '电子车票在手机里，手机却没电了。说服检票员别当场罚你（用 Sie）。' },
    { id: 'r3-anschluss', title: '服务台：误了换乘', npc: 'Herr Becker（服务台）', formal: true, scene: '人物是火车站服务台的 Herr Becker。玩家的车晚点，错过了换乘，想坐下一班 ICE，但车票只能坐指定车次。', cares: '只有晚点超过 20 分钟才能改坐别的车。玩家说出原来的车次、晚点了多少分钟、出示车票，他就会在票上盖章放行。', intro: '车晚点害你误了换乘。说服服务台让你坐下一班 ICE（用 Sie）。' },
  ],
  // 4 租屋城 · 住房、家具、办手续 (房东修暖气、合租厨房、楼上邻居在通用里)
  4: [
    { id: 'r4-besichtigung', title: '看房：把房子租给我', npc: 'Frau Hoffmann（房东）', formal: true, scene: '人物是房东 Frau Hoffmann，一套小公寓有二十多个人来看。玩家想说服她把房子租给自己。', cares: '她最怕房租拖欠、太吵、住几个月就走。玩家说清工作或奖学金、能提供收入证明和 SCHUFA、不抽烟、打算长住，她就会选玩家。', intro: '一套公寓二十多个人抢。说服房东把它租给你（用 Sie）。' },
    { id: 'r4-kaution', title: '旧房东：押金被扣', npc: 'Herr Krüger（旧房东）', formal: true, scene: '人物是玩家的旧房东 Herr Krüger。玩家搬走后，他说墙上有洞，要扣 300 欧押金。', cares: '他怕自己掏钱修墙。玩家指出入住交接单上本来就记着这些洞、有照片，或者提出自己补好，他就会退回大部分押金。', intro: '搬走后房东要扣 300 欧押金。说服他退钱（用 Sie）。' },
    { id: 'r4-wg', title: '合租面试：让我搬进来', npc: 'Lena（合租室友）', formal: false, scene: '人物是合租公寓的 Lena，她们在给空房间面试新室友。玩家想说服她选自己。', cares: '她们想找愿意一起做饭、打扫守规矩、不太吵的人。玩家讲讲自己的爱好、会做什么菜、愿意参加合租的聚会，她就会选玩家。', intro: '合租公寓在面试新室友。说服 Lena 选你（用 du）。' },
  ],
  // 5 泉疗镇 · 身体、健康、看医生
  5: [
    { id: 'r5-termin', title: '诊所前台：这周就要看', npc: 'Frau Demir（诊所前台）', formal: true, scene: '人物是诊所前台 Frau Demir，她说下一个预约在三周以后。玩家想这周就看医生。', cares: '只有急症才能插进来。玩家说清哪里不舒服、从什么时候开始、有多严重（发烧、疼得睡不着），并说什么时间都能来，她就会让玩家今天来急诊时段。', intro: '诊所说三周后才有号。说服前台这周就让你看（用 Sie）。' },
    { id: 'r5-arzt', title: '朋友：快去看医生', npc: 'Tim（朋友）', formal: false, scene: '人物是玩家的朋友 Tim，他已经咳嗽两个星期了，可就是不肯去看医生。', cares: '他觉得看医生麻烦，又怕请假被老板看不起。玩家说明咳两周不正常、可以帮他在网上约号、甚至陪他去，他就会答应。', intro: 'Tim 咳了两个星期还不去看医生。说服他（用 du）。' },
    { id: 'r5-apotheke', title: '药店：药缺货了', npc: 'Herr Schulz（药剂师）', formal: true, scene: '人物是药剂师 Herr Schulz。玩家每天要吃的药店里缺货，他说下周才到，可玩家的药明天就吃完了。', cares: '他很忙，不想为一个人专门订货。玩家说明这是每天都要吃的药、明天就断了、可以先付钱，他就会打电话让批发商明早送一盒来。', intro: '药明天就吃完了，药店却说下周才到。说服药剂师想想办法（用 Sie）。' },
  ],
  // 6 雾港 · 旅行、天气、度假
  6: [
    { id: 'r6-hotel', title: '酒店前台：换个房间', npc: 'Herr Lindner（酒店前台）', formal: true, scene: '人物是酒店前台 Herr Lindner。玩家的房间对着工地，早上七点就开始施工，浴室也没有热水。', cares: '酒店快住满了。玩家具体说出问题、拿出照片、态度客气，并且接受小一点的房间或别的补偿（比如免费早餐），他就会给换房或补偿。', intro: '房间对着工地，还没热水。说服前台给你换房或补偿（用 Sie）。' },
    { id: 'r6-koffer', title: '值机：行李超重', npc: 'Frau Jansen（值机柜台）', formal: true, scene: '人物是机场值机柜台的 Frau Jansen。玩家的箱子超重两公斤，她要收 50 欧超重费。', cares: '规定就是规定，但她不想让后面的队排太长。玩家提出马上把几样东西拿出来放进随身行李，她就会免费放行。', intro: '箱子超重两公斤，要交 50 欧。说服值机员别收这笔钱（用 Sie）。' },
    { id: 'r6-urlaub', title: '旅伴：改改度假计划', npc: 'Sophie（旅伴）', formal: false, scene: '人物是玩家的朋友 Sophie，你们一起去度假。她只想每天在海边躺着，玩家想去山里徒步。', cares: '她工作太累，只想休息。玩家提议各取所需（上午徒步、下午去海边）、指出预报说海边后几天下雨，她就会同意。', intro: '旅伴只想躺海边，你想去徒步。说服她改改计划（用 du）。' },
  ],
  // 7 印章城 · 银行、保险、合同 (市政厅晚交材料在通用里)
  7: [
    { id: 'r7-gebuehr', title: '银行：退回手续费', npc: 'Herr Engel（银行顾问）', formal: true, scene: '人物是银行顾问 Herr Engel。玩家的账户这个月被扣了 15 欧账户管理费。', cares: '他只能按账户类型收费。玩家说明自己是学生、出示学生证、要求改成免费的学生账户，并提到不行就换银行，他就会退钱并改账户。', intro: '银行扣了你 15 欧手续费。说服顾问退钱（用 Sie）。' },
    { id: 'r7-versicherung', title: '保险：打碎了朋友的手机', npc: 'Frau Meier（保险公司）', formal: true, scene: '人物是责任险公司的 Frau Meier。玩家不小心碰掉了朋友的手机，屏幕碎了，想让保险赔维修费。', cares: '她要确认是意外、不是自己的东西。玩家讲清经过（时间、地点、怎么掉的）、有照片和维修报价，她就会受理。', intro: '你碰掉了朋友的手机。说服保险公司赔维修费（用 Sie）。' },
    { id: 'r7-vertrag', title: '健身房：提前解约', npc: 'Herr Braun（健身房）', formal: true, scene: '人物是健身房的 Herr Braun。玩家下个月搬到别的城市，想提前解除还有一年的合同。', cares: '他怕会员找借口退卡。玩家出示新城市的住址登记、说明那里没有分店，他就会同意提前解约。', intro: '你要搬走，健身房合同还有一年。说服他让你提前解约（用 Sie）。' },
  ],
  // 9 工坊城 · 求职、职场
  9: [
    { id: 'r9-praktikum', title: '面试：给我一次机会', npc: 'Frau Albrecht（人事）', formal: true, scene: '人物是公司人事 Frau Albrecht。她担心玩家的德语还不够好，犹豫要不要给实习机会。', cares: '她在意沟通和能不能独立做事。玩家举出做过的具体项目、说明自己学得快，并提出先试一周，她就会给玩家第二轮面试。', intro: '人事担心你的德语。说服她给你实习机会（用 Sie）。' },
    { id: 'r9-homeoffice', title: '老板：每周在家办公一天', npc: 'Herr Hartmann（主管）', formal: true, scene: '人物是主管 Herr Hartmann。玩家每天通勤两小时，想每周在家办公一天。', cares: '他怕效率下降、团队找不到人。玩家提出固定周五、上班时间随时在线、先试三个月再看结果，他就会同意。', intro: '每天通勤两小时。说服主管让你每周在家办公一天（用 Sie）。' },
    { id: 'r9-projekt', title: '同事：分一下报告', npc: 'Tobias（同事）', formal: false, scene: '人物是同事 Tobias，你们一起做项目。报告全落在玩家身上，玩家想让他写一部分。', cares: '他怕写德语报告，写得慢。玩家提议他负责数据和图表部分、自己帮他看文字，他就会答应。', intro: '项目报告全落在你身上。说服同事 Tobias 分担一部分（用 du）。' },
  ],
  // 10 电波塔 · 媒体、新闻、科技
  10: [
    { id: 'r10-oma', title: '奶奶：学用视频电话', npc: 'Oma Gerda（奶奶）', formal: false, scene: '人物是玩家的奶奶 Oma Gerda。她有一部新手机，却一直不肯学视频电话。', cares: '她怕按错东西、觉得太复杂。玩家说这样就能天天看到孙子、会把步骤写在纸条上、只要记两个按钮，她就愿意试试。', intro: '奶奶有了新手机却不肯学视频电话。说服她试试（用 du）。' },
    { id: 'r10-zeitung', title: '报社：登我的稿子', npc: 'Herr Pohl（编辑）', formal: true, scene: '人物是本地报纸的编辑 Herr Pohl。玩家写了一篇稿子，讲街区的公园要被改成停车场，想让他登出来。', cares: '他在意有没有新闻价值、事实对不对。玩家给出具体数字、采访过的居民、为什么现在就得报道，他就会同意登。', intro: '你写了一篇关于街区公园的稿子。说服编辑登出来（用 Sie）。' },
    { id: 'r10-router', title: '客服：寄个新路由器', npc: 'Frau Peters（客服热线）', formal: true, scene: '人物是网络公司的客服 Frau Peters。玩家家里断网三天，她说技术员两周后才能上门。', cares: '流程上要先远程排查。玩家说明已经重启过、指示灯一直是红的、在家办公每天都要用网，她就会直接寄一个新路由器。', intro: '家里断网三天，技术员两周后才来。说服客服先寄个新路由器（用 Sie）。' },
  ],
  // 12 心巷 · 人际关系、情感
  12: [
    { id: 'r12-geburtstag', title: '朋友：忘了她的生日', npc: 'Lea（朋友）', formal: false, scene: '人物是玩家的好朋友 Lea。玩家忘了她的生日，她很失望。玩家想请她原谅、周末来家里吃饭。', cares: '她觉得自己被忽视了。玩家真诚道歉、不找借口、说出具体的补偿，她就会原谅并答应来。', intro: '你忘了好朋友的生日。说服 Lea 原谅你（用 du）。' },
    { id: 'r12-weihnachten', title: '伴侣：圣诞去哪家', npc: 'Nico（伴侣）', formal: false, scene: '人物是玩家的伴侣 Nico。他想圣诞节去他父母家，玩家已经两年没回家了。', cares: '他父母一直盼着他回去。玩家提议轮流（今年你家、明年他家），或者节后再一起去他家住几天，他就会同意。', intro: '圣诞节去谁家过？说服伴侣 Nico（用 du）。' },
    { id: 'r12-nachbarin', title: '老邻居：来参加聚会', npc: 'Frau Haas（老邻居）', formal: true, scene: '人物是楼里的老太太 Frau Haas，她一个人住，几乎不出门。玩家想请她来参加周六的邻居聚会。', cares: '她自尊心强，不想被可怜、不想麻烦别人。玩家说需要她帮忙（比如教大家烤她拿手的蛋糕），而不是去陪她，她就会来。', intro: '楼里的老太太总是一个人。说服她来参加邻居聚会（用 Sie）。' },
  ],
  // 13 议会堡 · 社会、政治、辩论
  13: [
    { id: 'r13-zebra', title: '区议员：街口装斑马线', npc: 'Frau Brenner（区议员）', formal: true, scene: '人物是区议员 Frau Brenner。玩家想让她在议会提议在学校门口的路口装斑马线、限速 30。', cares: '她在意预算和居民支持。玩家拿出事故数字、居民签名、说明附近有小学和幼儿园，她就会答应提交议案。', intro: '学校门口的路口很危险。说服区议员提议装斑马线（用 Sie）。' },
    { id: 'r13-wahl', title: '朋友：去投票', npc: 'Jan（朋友）', formal: false, scene: '人物是玩家的朋友 Jan，他说地方选举投不投都一样，周日不想去投票站。', cares: '他觉得一票没用，也不了解候选人。玩家举例地方选举有时只差几十票、建议用 Wahl-O-Mat 十分钟就能看清各党立场，他就会去。', intro: 'Jan 觉得投票没用。说服他周日去投票（用 du）。' },
    { id: 'r13-verein', title: '体育俱乐部：开新人训练', npc: 'Herr Graf（俱乐部主席）', formal: true, scene: '人物是足球俱乐部主席 Herr Graf。玩家想让俱乐部每周开一次给新来的移民的免费训练。', cares: '他担心场地、教练和保险。玩家提出自己当志愿者、已经找到一位教练、可以申请市里的融合资助，他就会同意试办。', intro: '你想让俱乐部开一个给新移民的免费训练。说服主席（用 Sie）。' },
  ],
  // 14 铸币场 · 经济、消费、环境
  14: [
    { id: 'r14-balkon', title: '物业：装阳台光伏', npc: 'Herr Ernst（物业）', formal: true, scene: '人物是物业管理的 Herr Ernst。玩家想在阳台上装一个小型插电式太阳能板。', cares: '他担心安全、外观和出了事谁负责。玩家说明这种小装置是合法的、会请专业人员固定、有责任险、颜色不显眼，他就会同意。', intro: '你想在阳台装小型太阳能板。说服物业同意（用 Sie）。' },
    { id: 'r14-kaffee', title: '电器店：咖啡机坏了', npc: 'Frau Krause（店长）', formal: true, scene: '人物是电器店店长 Frau Krause。玩家买的咖啡机用了两个星期就坏了，她说要先寄回厂家检测六周。', cares: '她怕顾客用坏了来退。玩家说明买了才两周、一直正常使用、有发票，并提到法定两年保修，她就会当场换一台新的。', intro: '新咖啡机两周就坏了。说服店长当场给你换新（用 Sie）。' },
    { id: 'r14-kantine', title: '食堂：每周一天素食', npc: 'Herr Wolff（食堂负责人）', formal: true, scene: '人物是公司食堂负责人 Herr Wolff。玩家想让食堂每周固定一天只做素菜。', cares: '他怕员工抱怨、剩菜变多。玩家拿出同事问卷结果、说明素菜成本更低，并提出先试一个月再看，他就会同意。', intro: '你想让食堂每周一天全素。说服负责人（用 Sie）。' },
  ],
  // 16 面具剧场 · 文化、艺术、科学、教育
  16: [
    { id: 'r16-frist', title: '教授：论文延期', npc: 'Prof. Lorenz（教授）', formal: true, scene: '人物是大学教授 Prof. Lorenz。玩家的课程论文下周五截止，可上个月病了两周，想延期一周。', cares: '她在意对别的学生公平、玩家是不是真的在写。玩家给出已完成的部分、生病的证明、具体的新日期，她就会同意延一周。', intro: '你病了两周，论文赶不上了。说服教授延期一周（用 Sie）。' },
    { id: 'r16-theater', title: '剧院：让我试演', npc: 'Frau Seidel（导演）', formal: true, scene: '人物是市立剧院的导演 Frau Seidel。业余剧团在招群演，她担心玩家的外国口音。', cares: '她怕口音让观众出戏。玩家指出有的角色正好是外地人、自己会额外练台词、每次排练都准时，她就会让玩家试演。', intro: '剧院在招群演，导演嫌你有口音。说服她让你试演（用 Sie）。' },
    { id: 'r16-camp', title: '家长：让孩子去科学营', npc: 'Herr Brück（家长）', formal: true, scene: '人物是学生家长 Herr Brück。玩家是课外班老师，想说服他让女儿参加三天的科学营。', cares: '他担心安全和费用。玩家说明有两位老师全程陪同、费用可以申请资助、女儿特别喜欢做实验，他就会同意。', intro: '你想让学生去三天的科学营。说服她的父亲（用 Sie）。' },
  ],
  // 17 档案深处 · 历史、记忆
  17: [
    { id: 'r17-akte', title: '档案馆：看一份旧档案', npc: 'Herr Lehmann（档案员）', formal: true, scene: '人物是市档案馆的 Herr Lehmann。玩家想看一份还没数字化的 1950 年代旧档案，查这座城市的老火车站。', cares: '文件很脆弱，他要知道研究目的。玩家说明研究课题、会戴手套、只拍照不翻折，他就会同意。', intro: '你想看一份没数字化的旧档案。说服档案员（用 Sie）。' },
    { id: 'r17-zeitzeuge', title: '老人：接受采访', npc: 'Herr Wendt（老人）', formal: true, scene: '人物是 90 岁的 Herr Wendt。玩家在给学校做「时代见证人」项目，想请他讲讲战后的童年。', cares: '他不想回忆痛苦的事，也怕自己的话被写歪。玩家承诺发表前给他看稿、他不想谈的可以不谈、这是为了年轻人记住，他就会答应。', intro: '学校在做时代见证人项目。说服 Herr Wendt 接受采访（用 Sie）。' },
    { id: 'r17-bahnhof', title: '城建局：别拆老车站', npc: 'Frau Oswald（城建局）', formal: true, scene: '人物是城建局的 Frau Oswald。老火车站下个月就要拆了盖写字楼，玩家想让她先暂停。', cares: '她要考虑开发计划和成本。玩家拿出历史资料、说明可以改成文化中心、已有几百个市民签名，她就会答应先做文物评估。', intro: '老火车站下个月就要拆。说服城建局先暂停（用 Sie）。' },
  ],
  // 18 天平庭 · 法律、论证、哲学
  18: [
    { id: 'r18-strafzettel', title: '秩序局：撤销罚单', npc: 'Herr Kurz（秩序局）', formal: true, scene: '人物是秩序局的 Herr Kurz。玩家收到一张停车罚单，可那里的禁停标志被树枝完全挡住了。', cares: '他只看证据。玩家说出时间地点、拿出标志被挡住的照片、指出标志必须看得见，他就会撤销罚单。', intro: '禁停标志被树挡住了，你却被罚了款。说服秩序局撤销罚单（用 Sie）。' },
    { id: 'r18-anwalt', title: '律师：接我的案子', npc: 'Frau Dr. Stein（律师）', formal: true, scene: '人物是律师 Frau Dr. Stein。旧房东一直不退玩家的押金，玩家想请她代理，但钱不多。', cares: '她看胜算和费用。玩家拿出租房合同、交接单和照片，并说明自己有法律咨询资助证明，她就会接案。', intro: '旧房东不退押金。说服律师接你的案子（用 Sie）。' },
    { id: 'r18-kommentar', title: '朋友：别发那条评论', npc: 'Finn（朋友）', formal: false, scene: '人物是玩家的朋友 Finn。他在网上和人吵架，气得要发一条骂人的评论，说这是言论自由。', cares: '他觉得自己没错。玩家承认他有权表达观点，但指出辱骂可能被告、言论自由也有界限，并帮他想一个有力但不骂人的说法，他就会改掉。', intro: 'Finn 要在网上发一条骂人的评论。说服他别发（用 du）。' },
  ],
  // 20 沉默之心 · 回顾、演讲
  20: [
    { id: 'r20-rede', title: '市长：让我上台发言', npc: 'Frau Kessler（市长）', formal: true, scene: '人物是市长 Frau Kessler。市民大会的发言名单已经排满，玩家想争取五分钟讲新移民的语言课。', cares: '她时间紧，只给有重点的人机会。玩家说清主题、三个要点、代表了哪些人，她就会给五分钟。', intro: '市民大会发言已排满。说服市长给你五分钟（用 Sie）。' },
    { id: 'r20-lehrerin', title: '老师：让我带新同学', npc: 'Frau Winter（德语老师）', formal: true, scene: '人物是语言学校的 Frau Winter。玩家想当新来学生的语伴，帮他们入门。', cares: '她要知道玩家能不能讲清楚、有没有耐心。玩家讲自己刚来时哪里最难、用了什么办法，她就会同意。', intro: '你想给语言学校的新同学当语伴。说服老师（用 Sie）。' },
    { id: 'r20-yuki', title: '新同学：别放弃', npc: 'Yuki（新同学）', formal: false, scene: '人物是刚到德国半年的 Yuki，她觉得德语一直没进步，想退掉语言课。', cares: '她太累了，也看不到进步。玩家讲自己的经历、帮她回头看半年前和现在的差别、提一个很小的下一步目标，她就会留下。', intro: 'Yuki 想退掉语言课。说服她别放弃（用 du）。' },
  ],
};

export function regionPersuade(region: number): PersuadeScene[] {
  return REGION_PERSUADE[region] ?? [];
}
