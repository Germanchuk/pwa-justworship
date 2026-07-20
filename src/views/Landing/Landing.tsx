import { Link } from "react-router-dom";
import {
  MusicalNoteIcon,
  SparklesIcon,
  CalendarDaysIcon,
  UsersIcon,
  ArrowsRightLeftIcon,
  DevicePhoneMobileIcon,
  DocumentArrowDownIcon,
  HeartIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: MusicalNoteIcon,
    title: "Бібліотека пісень",
    description:
      "Усі пісні гурту в одному місці — з акордами, текстом і нотатками. Швидкий пошук, теги та сортування.",
  },
  {
    icon: SparklesIcon,
    title: "Створення з AI",
    description:
      "Перетворюй звичайний текст пісні на готовий формат з акордами за лічені секунди.",
  },
  {
    icon: CalendarDaysIcon,
    title: "Розклади служінь",
    description:
      "Плануй недільні служіння й репетиції. Усі учасники гурту бачать сетлист наперед.",
  },
  {
    icon: UsersIcon,
    title: "Гурти та церкви",
    description:
      "Об’єднуй музикантів у гурти, гурти — у церкви. Кожен бачить саме те, що йому потрібно.",
  },
  {
    icon: ArrowsRightLeftIcon,
    title: "Транспонування акордів",
    description:
      "Зміни тональність пісні в один дотик — під вокаліста, інструмент чи зручність ведучого.",
  },
  {
    icon: DevicePhoneMobileIcon,
    title: "Працює офлайн",
    description:
      "Встанови як застосунок на телефон. Відкриєш сетлист навіть без інтернету на сцені.",
  },
  {
    icon: DocumentArrowDownIcon,
    title: "Експорт у DOCX",
    description:
      "Завантажуй сетлисти й окремі пісні у Word — для друку чи передачі поза платформою.",
  },
  {
    icon: HeartIcon,
    title: "Створено для служіння",
    description:
      "Платформа зроблена музикантами для музикантів, які прославляють Бога щонеділі.",
  },
];

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
            Платформа для прославлення
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight leading-[1.05] text-foreground">
            Усе для твого{" "}
            <span className="bg-gradient-to-r from-amber-600 to-rose-500 bg-clip-text text-transparent">
              гурту прославлення
            </span>{" "}
            в одному застосунку
          </h1>
          <p className="mt-5 text-base sm:text-lg text-muted-foreground max-w-xl mx-auto">
            Пісні, акорди, розклади служінь і спільна робота гурту — просто, швидко й під рукою на сцені.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-3 sm:gap-4 sm:justify-center">
            <Link to="/register" className="sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto h-12 px-6 text-base">
                Почати безкоштовно
                <ArrowRightIcon className="size-4" />
              </Button>
            </Link>
            <Link to="/login" className="sm:w-auto">
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto h-12 px-6 text-base"
              >
                У мене вже є акаунт
              </Button>
            </Link>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            Без реклами · Без оплати · Працює офлайн
          </p>
        </div>

        {/* Phone mock */}
        <div className="mx-auto mt-12 sm:mt-16 max-w-sm">
          <div className="relative rounded-[2rem] border border-black/10 bg-white shadow-2xl shadow-black/10 p-3">
            <div className="rounded-[1.5rem] bg-gradient-to-b from-amber-50 to-white p-5 min-h-[420px] flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Неділя · 10:00</span>
                <span>Сетлист</span>
              </div>
              {[
                { t: "Свят, Свят, Свят", k: "G" },
                { t: "Великий Бог", k: "D" },
                { t: "Достоєн Агнець", k: "A" },
                { t: "Ім’я понад іменами", k: "E" },
              ].map((s, i) => (
                <div
                  key={i}
                  className="rounded-xl bg-white border border-black/5 px-4 py-3 flex items-center justify-between shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center text-sm font-semibold">
                      {i + 1}
                    </div>
                    <span className="font-medium">{s.t}</span>
                  </div>
                  <span className="text-xs font-mono px-2 py-1 rounded bg-muted text-muted-foreground">
                    {s.k}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-5 py-14 sm:py-20 border-t border-black/5">
        <div className="mx-auto max-w-5xl">
          <div className="max-w-2xl mb-10 sm:mb-14">
            <p className="text-sm font-medium text-amber-700 mb-2">
              Можливості
            </p>
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
              Усе, що потрібно гурту прославлення
            </h2>
            <p className="mt-3 text-muted-foreground">
              Від першої ідеї пісні до сетлиста на сцені — Just Worship супроводжує кожен крок служіння.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((f) => (
              <div
                key={f.title}
                className="group rounded-2xl border border-black/5 bg-white/70 p-5 hover:bg-white hover:shadow-md hover:-translate-y-0.5 transition-all"
              >
                <div className="size-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center mb-4">
                  <f.icon className="size-5" />
                </div>
                <h3 className="font-semibold mb-1">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {f.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Highlighted big feature */}
      <section className="px-5 py-14 sm:py-20 border-t border-black/5">
        <div className="mx-auto max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-12 items-center">
          <div>
            <p className="text-sm font-medium text-amber-700 mb-2">
              Спільна робота
            </p>
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
              Редагуйте пісні разом — у реальному часі
            </h2>
            <p className="mt-3 text-muted-foreground">
              Один змінив акорд — інший побачив одразу. Без надсилання файлів,
              без «у кого остання версія». Тільки музика і служіння.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {[
                "Одночасне редагування пісні гуртом",
                "Історія змін і відкат версій",
                "Коментарі та нотатки до куплетів",
              ].map((t) => (
                <li key={t} className="flex items-start gap-3">
                  <div className="mt-1 size-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs">
                    ✓
                  </div>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-xl shadow-black/5">
            <div className="text-xs text-muted-foreground mb-3 font-mono">
              Великий Бог · D
            </div>
            <div className="font-mono text-sm leading-7 whitespace-pre">
              <span className="text-amber-700 font-semibold">D       </span>
              <span className="text-amber-700 font-semibold">A</span>
              {"\n"}
              Великий Бог, як любиш Ти
              {"\n"}
              <span className="text-amber-700 font-semibold">Bm      </span>
              <span className="text-amber-700 font-semibold">G</span>
              {"\n"}
              Серця Своїх дітей
              {"\n"}
              <span className="text-amber-700 font-semibold">D       </span>
              <span className="text-amber-700 font-semibold">A</span>
              {"\n"}
              І жодна сила в світі цім
              {"\n"}
              <span className="text-amber-700 font-semibold">G       </span>
              <span className="text-amber-700 font-semibold">D</span>
              {"\n"}
              Не відірве нас від Тебе
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <div className="flex -space-x-2">
                <div className="size-6 rounded-full bg-amber-300 border-2 border-white" />
                <div className="size-6 rounded-full bg-rose-300 border-2 border-white" />
                <div className="size-6 rounded-full bg-emerald-300 border-2 border-white" />
              </div>
              3 учасники зараз редагують
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-5 py-16 sm:py-24 border-t border-black/5">
        <div className="mx-auto max-w-2xl text-center rounded-3xl border border-black/10 bg-gradient-to-br from-amber-50 via-white to-rose-50 p-8 sm:p-12">
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            Готовий служити простіше?
          </h2>
          <p className="mt-3 text-muted-foreground">
            Створи акаунт за 30 секунд і запроси свій гурт.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:justify-center">
            <Link to="/register">
              <Button size="lg" className="w-full sm:w-auto h-12 px-6 text-base">
                Створити акаунт
                <ArrowRightIcon className="size-4" />
              </Button>
            </Link>
            <Link to="/login">
              <Button
                size="lg"
                variant="ghost"
                className="w-full sm:w-auto h-12 px-6 text-base"
              >
                Увійти
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
            href="https://t.me/w_platform_support"
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
