function extractImageSrc(rawString) {
  const regex = /<img [^>]*src="([^"]+)"/;
  const match = rawString.match(regex);
  return match ? match[1] : null;
}

async function getChordImg(chord) {
  try {
    const response = await fetch(
      "https://www.scales-chords.com/api/scapi.1.3.php",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          chord,
        }),
      }
    );
    const result = await response.text();
    return extractImageSrc(result);
  } catch (error) {
    console.error("Error fetching data:", error);
  }
}

export default getChordImg;
