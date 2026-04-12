import React from "react";

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
          className="input input-bordered w-full"
        />
      </label>
      <div className="py-4 flex justify-center">
        <button className="btn btn-primary">Зареєструвати</button>
      </div>
    </div>
  );
}
