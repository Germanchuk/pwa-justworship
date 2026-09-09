import { Link } from "react-router-dom";
import {
  MusicalNoteIcon,
  SpeakerWaveIcon,
  AdjustmentsHorizontalIcon,
  EyeSlashIcon,
  ChatBubbleLeftRightIcon,
  ChevronUpDownIcon,
  CalendarDaysIcon,
  UsersIcon,
  ArrowsRightLeftIcon,
  DocumentArrowDownIcon,
  ClockIcon,
  ArrowRightIcon,
  PaperAirplaneIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { SUPPORT_TELEGRAM_URL } from "#components";

/** Персональний шар показу — перше ядро. */
const personalFeatures = [
  {
    icon: AdjustmentsHorizontalIcon,
    title: "Своє капо",
    description:
      "Аркуш у D, а ти граєш форми C з капо на другому ладу. Акорди перемальовуються тільки тобі — решта гурту бачить пісню незмінною.",
  },
  {
    icon: ChevronUpDownIcon,
    title: "Згорнуті секції",
    description:
      "Те, що знаєш напам’ять, не займає екран. Кожен згортає своє — приспів, який усі й так пам’ятають, або куплет, який співає не він.",
  },
  {
    icon: EyeSlashIcon,
    title: "Слова або акорди",
    description:
      "Вокалістці не потрібні акорди, гітаристу не потрібен третій куплет цілком. Ховається окремо в кожного, аркуш лишається спільним.",
  },
  {
    icon: ChatBubbleLeftRightIcon,
    title: "Примітки на тексті",
    description:
      "Особиста позначка «тут вступаю» бачиш тільки ти. Коментар для гурту бачать усі. Одне й друге живе прямо на рядку, а не в чаті.",
  },
];

/** Звук під живу гру — друге ядро. */
const soundFeatures = [
  {
    icon: SpeakerWaveIcon,
    title: "Пед за акордами пісні",
    description:
      "Не треба мультитреків і людини за пультом. Пед генерується з акордів, які вже написані в пісні — у її тональності й темпі. Кілька пресетів звуку.",
  },
  {
    icon: ClockIcon,
    title: "Метроном",
    description:
      "Клацання на всю пісню, у правий канал — щоб не змагалося з педом у навушнику.",
  },
  {
    icon: MusicalNoteIcon,
    title: "Хост звуку",
    description:
      "Один пристрій гурту грає на зал, а запустити, поставити на паузу чи перемкнути пісню може будь-хто зі свого телефона.",
  },
  {
    icon: PaperAirplaneIcon,
    title: "Режим зібрання",
    description:
      "Усе служіння одним безперервним звуком: пісня за піснею, з програшами між ними й паузою там, де говорить ведучий.",
  },
];

/** Банальна, але обов’язкова основа. Не продається — просто має бути. */
const baseFeatures = [
  {
    icon: MusicalNoteIcon,
    title: "Пісні гурту",
    description: "Тексти з акордами в одному місці, з пошуком.",
  },
  {
    icon: CalendarDaysIcon,
    title: "Списки служінь",
    description: "План на неділю чи репетицію, який бачить увесь гурт.",
  },
  {
    icon: UsersIcon,
    title: "Гурти та церкви",
    description: "Музиканти в гуртах, гурти в церкві. Кожен бачить своє.",
  },
  {
    icon: ArrowsRightLeftIcon,
    title: "Транспонування",
    description: "Змінити реальну тональність пісні — вже для всього гурту.",
  },
  {
    icon: DocumentArrowDownIcon,
    title: "Експорт у .docx",
    description: "Роздрукувати або віддати тому, хто не в застосунку.",
  },
  {
    icon: ChatBubbleLeftRightIcon,
    title: "Одна актуальна версія",
    description:
      "Регент правив у суботу — у неділю правильне вже в усіх. Без пересилання файлів.",
  },
];

/** Один аркуш, два різні екрани — те, про що заголовок. */
function SheetPreview({
  who,
  capo,
  chords,
}: {
  who: string;
  capo: string;
  chords: [string, string, string, string];
}) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-lg shadow-black/5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-muted-foreground">{who}</span>
        <span className="text-[10px] font-mono px-2 py-1 rounded bg-amber-50 text-amber-700 border border-amber-100">
          {capo}
        </span>
      </div>
      <div className="font-mono text-[13px] leading-6 whitespace-pre">
        <span className="text-amber-700 font-semibold">{chords[0]}</span>
        {"\n"}
        Великий Бог, як любиш Ти
        {"\n"}
        <span className="text-amber-700 font-semibold">{chords[1]}</span>
        {"\n"}
        Серця Своїх дітей
        {"\n"}
        <span className="text-amber-700 font-semibold">{chords[2]}</span>
        {"\n"}
        І жодна сила в світі цім
        {"\n"}
        <span className="text-amber-700 font-semibold">{chords[3]}</span>
        {"\n"}
        Не відірве нас від Тебе
      </div>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof MusicalNoteIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white/70 p-5 hover:bg-white hover:shadow-md hover:-translate-y-0.5 transition-all">
      <div className="size-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center mb-4">
        <Icon className="size-5" />
      </div>
      <h3 className="font-semibold mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {description}
      </p>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen w-full">
      {/* Header */}
      <header className="sticky top-0 z-30 w-full backdrop-blur-md bg-white/70 border-b border-black/5">
        <div className="mx-auto max-w-5xl px-5 py-3 flex items-center justify-between">
          <Link to="/landing" className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
              <MusicalNoteIcon className="size-5" />
            </div>
            <span className="font-semibold tracking-tight">Just Worship</span>
          </Link>
          <Link to="/login">
            <Button size="sm" variant="ghost">
              Увійти
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="px-5 pt-10 pb-14 sm:pt-16 sm:pb-20">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-3 py-1 text-xs text-muted-foreground mb-6">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            Для гуртів прославлення
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight leading-[1.05] text-foreground">
            Спільний аркуш.{" "}
            <span className="bg-gradient-to-r from-amber-600 to-rose-500 bg-clip-text text-transparent">
              Особистий вигляд.
            </span>
          </h1>
          <p className="mt-5 text-base sm:text-lg text-muted-foreground max-w-xl mx-auto">
            Гурт веде одну пісню — але кожен бачить її по-своєму: своє капо,
            свої згорнуті секції, свої примітки. А під живу гру застосунок сам
            згенерує пед із акордів цієї ж пісні.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-3 sm:gap-4 sm:justify-center">
            <a href={SUPPORT_TELEGRAM_URL} target="_blank" rel="noreferrer">
              <Button size="lg" className="w-full sm:w-auto h-12 px-6 text-base">
                Написати мені
                <ArrowRightIcon className="size-4" />
              </Button>
            </a>
            <Link to="/register" className="sm:w-auto">
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto h-12 px-6 text-base"
              >
                Створити акаунт
              </Button>
            </Link>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            Безкоштовно · Без реклами · Одне посилання, будь-який пристрій
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Гурт поки заводжу вручну — напиши, і зберу твій склад сам.
          </p>
        </div>

        {/* Один аркуш — два екрани */}
        <div className="mx-auto mt-12 sm:mt-16 max-w-2xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SheetPreview
              who="Оля · вокал"
              capo="без капо"
              chords={["D       A", "Bm      G", "D       A", "G       D"]}
            />
            <SheetPreview
              who="Андрій · гітара"
              capo="капо 2 · грає C"
              chords={["C       G", "Am      F", "C       G", "F       C"]}
            />
          </div>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Одна й та сама пісня в базі гурту. Різні екрани.
          </p>
        </div>
      </section>

      {/* Ядро 1 — персоналізація */}
      <section
        id="personal"
        className="px-5 py-14 sm:py-20 border-t border-black/5"
      >
        <div className="mx-auto max-w-5xl">
          <div className="max-w-2xl mb-10 sm:mb-14">
            <p className="text-sm font-medium text-amber-700 mb-2">
              Персональний показ
            </p>
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
              Один аркуш на гурт — своя версія в кожного
            </h2>
            <p className="mt-3 text-muted-foreground">
              Аркуш спільний і завжди актуальний. Але те, як він виглядає на
              твоєму екрані, налаштовуєш тільки ти — і нікому цим не заважаєш.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {personalFeatures.map((f) => (
              <FeatureCard key={f.title} {...f} />
            ))}
          </div>
        </div>
      </section>

      {/* Ядро 2 — звук */}
      <section
        id="sound"
        className="px-5 py-14 sm:py-20 border-t border-black/5"
      >
        <div className="mx-auto max-w-5xl">
          <div className="max-w-2xl mb-10 sm:mb-14">
            <p className="text-sm font-medium text-amber-700 mb-2">
              Звук під живу гру
            </p>
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
              Пед просто з аркуша, без мультитреків
            </h2>
            <p className="mt-3 text-muted-foreground">
              Гурт, якому потрібен фон і темп, зазвичай упирається не в музику,
              а в організацію: треки, ноутбук, пульт, людина, яка все це веде.
              Тут пед бере акорди прямо з пісні, а керує ним будь-хто з
              телефона.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {soundFeatures.map((f) => (
              <FeatureCard key={f.title} {...f} />
            ))}
          </div>
        </div>
      </section>

      {/* Основа */}
      <section className="px-5 py-14 sm:py-20 border-t border-black/5">
        <div className="mx-auto max-w-5xl">
          <div className="max-w-2xl mb-10 sm:mb-14">
            <p className="text-sm font-medium text-amber-700 mb-2">Основа</p>
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
              І звичайні речі, без яких перше й друге не працює
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {baseFeatures.map((f) => (
              <FeatureCard key={f.title} {...f} />
            ))}
          </div>
        </div>
      </section>

      {/* Чим це не є */}
      <section className="px-5 py-14 sm:py-20 border-t border-black/5">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            Чим це не є
          </h2>
          <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
            {[
              "Не бібліотека чужих пісень: пісні вносить сам гурт, свої.",
              "Не проєкція на екран залу.",
              "Не планування служителів і розкладу людей.",
              "Не бібліотека мультитреків.",
            ].map((t) => (
              <li key={t} className="flex items-start gap-3">
                <span className="mt-2 size-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="px-5 py-16 sm:py-24 border-t border-black/5">
        <div className="mx-auto max-w-2xl text-center rounded-3xl border border-black/10 bg-gradient-to-br from-amber-50 via-white to-rose-50 p-8 sm:p-12">
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            Спробуєш зі своїм гуртом?
          </h2>
          <p className="mt-3 text-muted-foreground">
            Напиши мені — заведу гурт, перенесу перші пісні й покажу, як це
            працює. Продукт молодий, тож роблю це особисто для кожного гурту.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:justify-center">
            <a href={SUPPORT_TELEGRAM_URL} target="_blank" rel="noreferrer">
              <Button size="lg" className="w-full sm:w-auto h-12 px-6 text-base">
                Написати мені
                <ArrowRightIcon className="size-4" />
              </Button>
            </a>
            <Link to="/register">
              <Button
                size="lg"
                variant="ghost"
                className="w-full sm:w-auto h-12 px-6 text-base"
              >
                Створити акаунт самому
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-5 py-8 border-t border-black/5">
        <div className="mx-auto max-w-5xl flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="size-6 rounded-md bg-primary text-primary-foreground flex items-center justify-center">
              <MusicalNoteIcon className="size-3.5" />
            </div>
            <span>Just Worship · © {new Date().getFullYear()}</span>
          </div>
          <a
            href={SUPPORT_TELEGRAM_URL}
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground transition-colors"
          >
            Зв’язатись з нами
          </a>
        </div>
      </footer>
    </div>
  );
}
