import { jwtDecode } from "jwt-decode";

const TOKEN_KEY = "authToken";

export const useAuth = () => {
  const token = localStorage.getItem(TOKEN_KEY);

  if (!token) {
    console.log("No token found. Redirecting to login...");
    return false;
  }

  if (isTokenExpired(token) && navigator?.onLine) {
      console.log("Token expired and user is online. Logging out...");
      localStorage.removeItem(TOKEN_KEY); // Remove the token
      return false;
  }

  return true;
};

export function isTokenExpired(token) {
  try {
    const { exp } = jwtDecode(token);
    const currentTime = Math.floor(Date.now() / 1000);
    return exp < currentTime; // Returns true if the token is expired
  } catch (e) {
    console.error("Invalid token format", e);
    return true; // Assume expired if token is invalid
  }
}
