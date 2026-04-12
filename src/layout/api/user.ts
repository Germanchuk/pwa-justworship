import { getStrapiURL } from "#utils/fetch-api";

export async function loginUser({ username, password }) {
  const response = await fetch(getStrapiURL("/api/auth/local"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      identifier: username,
      password,
    }),
  });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const data = await response.json();
  return data;
}

export async function registerUser({ username, password, email }) {
  const response = await fetch(getStrapiURL("/api/auth/local/register"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username,
      password,
      email,
    }),
  });
  if (!response.ok) {
    // @ts-ignore
    throw new Error(response);
  }
  const data = await response.json();
  return data;
}
