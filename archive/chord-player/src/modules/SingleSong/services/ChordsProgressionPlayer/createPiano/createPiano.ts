import * as Tone from "tone";

// Salamander Grand Piano (Yamaha C5) — Alexander Holm, CC-BY 3.0.
// Мінімізований набір із tonejs.github.io/audio/salamander: семпл на кожну
// малу терцію C2–C6, тож Sampler розтягує ≤ ±1.5 півтона — на слух чисто.
// (Старий варіант — один C4 на весь діапазон — і був причиною «жаху».)
import C2 from "./salamander/C2.mp3";
import Ds2 from "./salamander/Ds2.mp3";
import Fs2 from "./salamander/Fs2.mp3";
import A2 from "./salamander/A2.mp3";
import C3 from "./salamander/C3.mp3";
import Ds3 from "./salamander/Ds3.mp3";
import Fs3 from "./salamander/Fs3.mp3";
import A3 from "./salamander/A3.mp3";
import C4 from "./salamander/C4.mp3";
import Ds4 from "./salamander/Ds4.mp3";
import Fs4 from "./salamander/Fs4.mp3";
import A4 from "./salamander/A4.mp3";
import C5 from "./salamander/C5.mp3";
import Ds5 from "./salamander/Ds5.mp3";
import Fs5 from "./salamander/Fs5.mp3";
import A5 from "./salamander/A5.mp3";
import C6 from "./salamander/C6.mp3";

export const createPiano = () => {
  return new Tone.Sampler({
    urls: {
      C2, "D#2": Ds2, "F#2": Fs2, A2,
      C3, "D#3": Ds3, "F#3": Fs3, A3,
      C4, "D#4": Ds4, "F#4": Fs4, A4,
      C5, "D#5": Ds5, "F#5": Fs5, A5,
      C6,
    },
    baseUrl: "",
    release: 2,
    // Справжні семпли гучніші за старий тихий wav: базу тримаємо на 0 дБ,
    // точне місце в міксі — слайдером гучності в меню плеєра.
    volume: 0,
  }).toDestination();
};
