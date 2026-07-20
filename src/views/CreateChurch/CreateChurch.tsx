import React from "react";
import { Button } from "@/components/ui/button";

export default function CreateChurch() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Зареєструвати церкву</h1>
      <label className="form-control w-full">
        <div className="label">
          <span className="label-text">Назва церкви:</span>
        </div>
        <input
          type="text"
          placeholder="Джерело життя"
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs w-full"
        />
      </label>
      <div className="py-4 flex justify-center">
        <Button>Зареєструвати</Button>
      </div>
    </div>
  );
}
