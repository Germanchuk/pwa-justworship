import ReactDOM from "react-dom";
import React from "react";
import {ChatBubbleLeftEllipsisIcon} from "@heroicons/react/24/outline";

export default function WelcomePage() {
  return (
    <>
      <div>
        <div className="chat chat-start">
          <div className="chat-bubble text-accent-content bg-base-200">
            Привіт! 😀
            <br/>
            Я радий, що ця платформа може бути для тебе корисною
          </div>
        </div>
        <div className="chat chat-start">
          <div className="chat-bubble text-accent-content bg-base-200">
            Щоб почати потрібно приєднатись до гурту або створити новий гурт 🎸
          </div>
        </div>
        <div className="chat chat-start">
          <div className="chat-bubble text-accent-content bg-base-200">
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
      <button
        className="btn btn-square bg-base-300 ring-neutral ring-1"
        onClick={openExternalLink}
      >
        <ChatBubbleLeftEllipsisIcon className="w-6 h-6" />
      </button>
    </div>, document.body
  );
}