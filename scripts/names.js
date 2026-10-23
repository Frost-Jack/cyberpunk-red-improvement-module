// Original macro terminology, including Russian names by BarsiK.
export const names = Object.fromEntries(`
  Conceal/Reveal Object=Скрытие/Раскрытие предметов|Concentration=Концентрация|Lip Reading=Чтение по губам
  Perception=Внимательность|Tracking=Выслеживание|Athletics=Атлетика
  Contortionist=Акробатика|Dance=Танцы|Endurance=Выносливость
  Resist Torture/Drugs=Сопротивление пыткам и наркотикам|Stealth=Скрытность|Drive Land Vehicle=Управление: наземный транспорт
  Pilot Air Vehicle=Управление: воздушный транспорт|Pilot Sea Vehicle=Управление: водный транспорт|Riding=Верховная езда
  Accounting=Бухгалтерия|Animal Handling=Дрессировка|Bureaucracy=Бюрократия
  Business=Бизнес|Composition=Композиция|Criminology=Криминалистика
  Cryptography=Криптография|Deduction=Дедукция|Education=Образование
  Gamble=Азартные игры|Language (Streetslang)=Язык (уличный слэнг)|Language (Arabic)=Язык (арабский)
  Language (Bengali)=Язык (бенгальский)|Language (Berber)=Язык (берберский)|Language (Burmese)=Язык (бирманский)
  Language (Cantonese Chinese)=Язык (кантонский китайский)|Language (Cree)=Язык (кри)|Language (Creole)=Язык (креольский)
  Language (Dari)=Язык (дари)|Language (Dutch)=Язык (голландский)|Language (English)=Язык (английский)
  Language (Farsi)=Язык (фарси)|Language (Filipino)=Язык (филиппинский)|Language (Finnish)=Язык (финский)
  Language (French)=Язык (французский)|Language (German)=Язык (немецкий)|Language (Guarani)=Язык (гуарани)
  Language (Hausa)=Язык (хауса)|Language (Hawaiian)=Язык (гавайский)|Language (Hebrew)=Язык (иврит)
  Language (Hindi)=Язык (хинди)|Language (Indonesian)=Язык (индонезийский)|Language (Italian)=Язык (итальянский)
  Language (Japanese)=Язык (японский)|Language (Khmer)=Язык (кхмерский)|Language (Korean)=Язык (корейский)
  Language (Lingala)=Язык (лингала)|Language (Malayan)=Язык (малайский)|Language (Mandarin Chinese)=Язык (мандаринский китайский)
  Language (Maori)=Язык (маори)|Language (Mayan)=Язык (майя)|Language (Mongolian)=Язык (монгольский)
  Language (Navajo)=Язык (навахо)|Language (Nepali)=Язык (непальский)|Language (Norwegian)=Язык (норвежский)
  Language (Oromo)=Язык (оромо)|Language (Pama-Nyungan)=Язык (пама-ньюнган)|Language (Polish)=Язык (польский)
  Language (Portuguese)=Язык (португальский)|Language (Quechua)=Язык (кечуа)|Language (Romanian)=Язык (румынский)
  Language (Russian)=Язык (русский)|Language (Sinhalese)=Язык (сингальский)|Language (Spanish)=Язык (испанский)
  Language (Swahili)=Язык (суахили)|Language (Swedish)=Язык (шведский)|Language (Tahitian)=Язык (таитянский)
  Language (Tamil)=Язык (тамильский)|Language (Turkish)=Язык (турецкий)|Language (Twi)=Язык (тви)
  Language (Ukrainian)=Язык (украинский)|Language (Urdu)=Язык (урду)|Language (Vietnamese)=Язык (вьетнамский)
  Language (Yoruba)=Язык (йоруба)|Library Search=Библиотечный поиск|Local Expert=Местный эксперт
  Local Expert (Badlands)=Местный эксперт (Пустоши)|Local Expert (Charter Hill)=Местный эксперт (Чартер-Хилл)|Local Expert (Downtown)=Местный эксперт (Даунтаун)
  Local Expert (Executive Zone)=Местный эксперт (Исполнительная зона)|Local Expert (Glitch City)=Местный эксперт (Глитч-Сити)|Local Expert (Heywood Docks)=Местный эксперт (Доки Хейвуда)
  Local Expert (Heywood Industrial Zone)=Местный эксперт (Индустриальная зона Хейвуда)|Local Expert (Hot Zone)=Местный эксперт (Горячая зона)|Local Expert (Kabuki)=Местный эксперт (Кабуки)
  Local Expert (Little China)=Местный эксперт (Маленький Китай)|Local Expert (Little Europe)=Местный эксперт (Маленькая Европа)|Local Expert (Morro Rock)=Местный эксперт (Морро-Рок)
  Local Expert (New Westbrook)=Местный эксперт (Нью-Вестбрук)|Local Expert (NorCal Military Base)=Местный эксперт (Военная база NorCal)|Local Expert (North Heywood)=Местный эксперт (Северный Хейвуд)
  Local Expert (Old Combat Zone)=Местный эксперт (Старая Боевая зона)|Local Expert (Old Japantown)=Местный эксперт (Старый Джапантаун)|Local Expert (Pacifica Playground)=Местный эксперт (Игровая зона Пасифики)
  Local Expert (Port of Night City)=Местный эксперт (Порт Найт-Сити)|Local Expert (Rancho Coronado)=Местный эксперт (Ранчо Коронадо)|Local Expert (Reclamation Zone)=Местный эксперт (Зона восстановления)
  Local Expert (Santo Domingo)=Местный эксперт (Санто-Доминго)|Local Expert (South Night City)=Местный эксперт (Южный Найт-Сити)|Local Expert (The Glen)=Местный эксперт (Глен)
  Local Expert (University District)=Местный эксперт (Университетский район)|Local Expert (Upper Marina)=Местный эксперт (Верхняя Марина)|Local Expert (Watson)=Местный эксперт (Уотсон)
  Local Expert (Woodland Park)=Местный эксперт (Вудленд-Парк)|Science=Наука|Science (Biology)=Наука (Биология)
  Science (Biotechnology)=Наука (Биотехнология)|Science (Chemistry)=Наука (Химия)|Science (Computer Science)=Наука (Компьютерные науки)
  Science (Cybernetics)=Наука (Кибернетика)|Science (Economics)=Наука (Экономика)|Science (Forensics)=Наука (Криминалистика)
  Science (Mechanical Engineering)=Наука (Механическая инженерия)|Science (Nanotechnology)=Наука (Нанотехнологии)|Science (Pharmacology)=Наука (Фармакология)
  Science (Physics)=Наука (Физика)|Science (Psychology)=Наука (Психология)|Science (Robotics)=Наука (Робототехника)
  Science (Sociology)=Наука (Социология)|Tactics=Тактика|Wilderness Survival=Выживание в пустошах
  Brawling=Рукопашный бой|Evasion=Уклонение|Martial Arts=Боевые искусства
  Martial Arts (Aikido)=Боевые искусства (Айкидо)|Martial Arts (Arasaka-te)=Боевые искусства (Арасака-тэ)|Martial Arts (Arnis)=Боевые искусства (Арнис)
  Martial Arts (Boxing)=Боевые искусства (Бокс)|Martial Arts (Capoeira)=Боевые искусства (Капоэйра)|Martial Arts (Choy Li Fut)=Боевые искусства (Чой Ли Фут)
  Martial Arts (Drunken Fist)=Боевые искусства (Пьяный кулак)|Martial Arts (Gun Fu)=Боевые искусства (Ган-фу)|Martial Arts (Judo)=Боевые искусства (Дзюдо)
  Martial Arts (Jujutsu)=Боевые искусства (Дзюдзюцу)|Martial Arts (Karate)=Боевые искусства (Карате)|Martial Arts (Kendo)=Боевые искусства (Кендо)
  Martial Arts (Krav Maga)=Боевые искусства (Крав мага)|Martial Arts (Kung Fu)=Боевые искусства (Кунг-фу)|Martial Arts (Kyudo)=Боевые искусства (Кюдо)
  Martial Arts (Militech Commando Training)=Боевые искусства (Подготовка коммандос Militech)|Martial Arts (Muay Thai)=Боевые искусства (Муай тай)|Martial Arts (Multiarm Melee)=Боевые искусства (Мультиручный бой)
  Martial Arts (Panzer Faust)=Боевые искусства (Панцер фауст)|Martial Arts (Silat)=Боевые искусства (Силат)|Martial Arts (Sov-System)=Боевые искусства (Сов-система)
  Martial Arts (Sumo)=Боевые искусства (Сумо)|Martial Arts (Taekwondo)=Боевые искусства (Тхэквондо)|Martial Arts (Tai Chi)=Боевые искусства (Тай-чи)
  Martial Arts (Thamoc)=Боевые искусства (Тамок)|Martial Arts (Thrash Sambo)=Боевые искусства (Трэш-самбо)|Martial Arts (Wrestling)=Боевые искусства (Борьба)
  Melee Weapon=Оружие ближнего боя|Acting=Актёрская игра|Play Instrument=Игра на инструменте
  Play Instrument (Drums)=Игра на инструменте (Ударные)|Play Instrument (Guitar)=Игра на инструменте (Гитара)|Play Instrument (Harmonica)=Игра на инструменте (Губная гармошка)
  Play Instrument (Harp)=Игра на инструменте (Арфа)|Play Instrument (Piano)=Игра на инструменте (Пианино)|Play Instrument (Saxophone)=Игра на инструменте (Саксофон)
  Play Instrument (Singing)=Игра на инструменте (Вокал)|Play Instrument (Synthesizer)=Игра на инструменте (Синтезатор)|Play Instrument (Theramin)=Игра на инструменте (Терамин)
  Play Instrument (Turntable)=Игра на инструменте (Вертушки)|Play Instrument (Violin)=Игра на инструменте (Скрипка)|Archery=Стрельба из лука
  Autofire=Стрельба очередью|Handgun=Пистолеты|Heavy Weapons=Тяжёлое вооружение
  Shoulder Arms=Стрельба с плеча|Bribery=Подкуп|Conversation=Общение
  Human Perception=Проницательность|Interrogation=Допрос|Personal Grooming=Уход за внешностью
  Persuasion=Убеждение|Streetwise=Уличное чутьё|Trading=Торговля
  Wardrobe & Style=Гардероб и стиль|Air Vehicle Tech=Технология: воздушный транспорт|Basic Tech=Технология: базовая
  Cybertech=Кибертехнология|Demolitions=Взрывотехника|Electronics/Security Tech=Электроника/системы безопасности
  First Aid=Первая помощь|Forgery=Фальсификация|Land Vehicle Tech=Технология: наземный транспорт
  Paint/Draw/Sculpt=Рисование/Лепка|Paramedic=Парамедицина|Photography/Film=Фотография/Кинематограф
  Pick Lock=Взлом замков|Pick Pocket=Карманная кража|Sea Vehicle Tech=Технология: водный транспорт
  Weaponstech=Технология: оружие|Language=Язык|Language(s)=Язык(и)
  Teamwork=Командная работа|Operator=Оператор|Backup=Подмога
  Credibility=Достоверность|Medicine=Медицина|Interface=Интерфейс
  Moto=Мото|Charismatic Impact=Харизматичное влияние|Combat Awareness=Боевое чутьё
  Maker=Создатель|Haggle=Торг|Damage Deflection=Отклонение урона
  Fumble Recovery=Восстановление после промаха|Initiative Reaction=Реакция инициативы|Precision Attack=Точная атака
  Spot Weakness=Поиск слабости|Threat Detection=Обнаружение угроз|Field Expertise=Полевой опыт
  Upgrade Expertise=Опыт улучшения|Fabrication Expertise=Опыт изготовления|Invention Expertise=Опыт изобретения
  Surgery=Хирургия|Surgery Skill=Навык хирургии|Medical Tech=Медицинская техника
  Medical Tech Skill=Навык медицинской техники|Medical Tech (Pharmaceuticals)=Медицинская техника (Фармацевтика)|Medical Tech (Cryosystem Operation)=Медицинская техника (Криосистемы)
`.trim().split(/\n|\|/).map(s => s.trim().split("=")));
