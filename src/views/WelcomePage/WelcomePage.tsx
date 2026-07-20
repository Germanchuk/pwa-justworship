import ReactDOM from "react-dom";
import React from "react";
import {ChatBubbleLeftEllipsisIcon} from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";

export default function WelcomePage() {
  return (
    <>
      <div>
        <div className="flex w-full gap-2 mb-2">
          <div className="rounded-lg bg-[oklch(0.93_0.025_85)] border border-border text-foreground px-3 py-2 max-w-[80%] shadow-xs">
            Привіт! 😀
            <br/>
            Я радий, що ця платформа може бути для тебе корисною
          </div>
        </div>
        <div className="flex w-full gap-2 mb-2">
          <div className="rounded-lg bg-[oklch(0.93_0.025_85)] border border-border text-foreground px-3 py-2 max-w-[80%] shadow-xs">
            Щоб почати потрібно приєднатись до гурту або створити новий гурт 🎸
          </div>
        </div>
        <div className="flex w-full gap-2 mb-2">
          <div className="rounded-lg bg-[oklch(0.93_0.025_85)] border border-border text-foreground px-3 py-2 max-w-[80%] shadow-xs">
            Для цього напиши мені в телеграм
            <br />
            кнопка нижче перенесе тебе до нас в діалог 👇
          </div>
        </div>
      </div>
      <SupportButton />
    </>
  );
}

function SupportButton() {
  const openExternalLink = () => {
    window.open('https://t.me/w_platform_support', '_blank');
  };
  return ReactDOM.createPortal(
    <div className="fixed bottom-4 right-4">
      <Button
        size="icon"
        variant="secondary"
        className="size-14 rounded-full ring-1 ring-neutral-400 shadow-md"
        onClick={openExternalLink}
      >
        <ChatBubbleLeftEllipsisIcon className="size-7" />
      </Button>
    </div>, document.body
  );
}