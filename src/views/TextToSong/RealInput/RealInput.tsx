export default function RealInput({value, setValue}) {
  return (
    <textarea
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/\n{3,}/g, "\n\n"))}
          className="w-full h-full rounded ring-border ring-2 p-4 bg-background"
          style={{ fontSize: "18px", lineHeight: "28px" }}
          autoComplete="off"
          autoCorrect="off"
          rows={value.split("\n").length}
        />
  )
}
