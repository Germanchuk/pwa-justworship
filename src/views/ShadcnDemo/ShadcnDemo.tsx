import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";

export default function ShadcnDemo() {
  return (
    <div className="p-8 space-y-8 max-w-3xl mx-auto">
      <header>
        <h1 className="text-2xl font-semibold">shadcn/ui smoke test</h1>
        <p className="text-muted-foreground">
          new-york + zinc, Tailwind v4. Light only.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Variants</h2>
        <div className="flex flex-wrap gap-3">
          <Button>Default</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Sizes</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">Small</Button>
          <Button size="default">Default</Button>
          <Button size="lg">Large</Button>
          <Button size="icon" aria-label="Mail">
            <Mail />
          </Button>
        </div>
      </section>
    </div>
  );
}
