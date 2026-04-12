export function formatDate(dateString) {
    if(!dateString) {
        return;
    }
    const months = [
        "січня", "лютого", "березня", "квітня", "травня", "червня",
        "липня", "серпня", "вересня", "жовтня", "листопада", "грудня"
    ];

    const [year, month, day] = dateString.split("-");
    const monthIndex = parseInt(month, 10) - 1; // Перетворюємо місяць у числовий індекс
    const formattedDay = parseInt(day, 10); // Видаляємо ведучий нуль з дня

    return `${formattedDay} ${months[monthIndex]} ${year}`;
}