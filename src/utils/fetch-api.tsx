import qs from "qs";
import { disableGlobalLoader, enableGlobalLoader } from "#layout/slices/viewConfigSlice";

let storePromise: Promise<{ default: { dispatch: (action: unknown) => void } }> | null = null;

const getStore = async () => {
  if (!storePromise) {
    storePromise = import("#/store");
  }

  const storeModule = await storePromise;
  return storeModule.default;
};

export function getStrapiURL(path = "") {
  return `${import.meta.env.VITE_API_URL}${path}`;
}

export async function fetchAPI(
  path: string,
  urlParamsObject: any = {},
  options = {},
  avoidGlobalLoader = false
) {
  const token = localStorage.getItem("authToken");
  if (!avoidGlobalLoader) {
    const store = await getStore();
    store.dispatch(enableGlobalLoader());
  }
  try {
    // Merge default and user options
    const mergedOptions = {
      next: { revalidate: 60 },
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      ...options,
    };

    // Build request URL
    const queryString = qs.stringify(urlParamsObject);

    const requestUrl = `${getStrapiURL(
      `/api${path}${queryString ? `?${queryString}` : ""}`
    )}`;
    // Trigger API call
    const response = await fetch(requestUrl, mergedOptions);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error.message);
    }

    return await response.json();

  } catch (error) {
    throw new Error(error);
  } finally {
    const store = await getStore();
    store.dispatch(disableGlobalLoader());
  }
}
