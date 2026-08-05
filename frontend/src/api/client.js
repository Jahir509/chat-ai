import axios from "axios";

const api = axios.create({ baseURL: "/api" });

export const getAccess = () => localStorage.getItem("access");
const getRefresh = () => localStorage.getItem("refresh");

export function setTokens({ access, refresh }) {
  if (access) localStorage.setItem("access", access);
  if (refresh) localStorage.setItem("refresh", refresh);
}

export function clearTokens() {
  localStorage.removeItem("access");
  localStorage.removeItem("refresh");
}

api.interceptors.request.use((config) => {
  const token = getAccess();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401, silently refresh once and replay the original request.
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const isAuthCall = original?.url?.includes("/auth/");
    if (error.response?.status === 401 && !original._retried && !isAuthCall) {
      original._retried = true;
      try {
        const { data } = await axios.post("/api/auth/refresh/", {
          refresh: getRefresh(),
        });
        setTokens({ access: data.access, refresh: data.refresh });
        original.headers.Authorization = `Bearer ${data.access}`;
        return api(original);
      } catch {
        clearTokens();
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

// Flatten DRF's {field: ["msg"]} into one readable string.
export function apiError(err, fallback = "Something went wrong.") {
  const d = err.response?.data;
  // Django's DEBUG=True 500 pages arrive as an HTML string.
  if (!d || typeof d !== "object") return fallback;
  if (typeof d.detail === "string") return d.detail;
  const first = Object.values(d)[0];
  if (Array.isArray(first)) return String(first[0]);
  return typeof first === "string" ? first : fallback;
}


// List endpoints are paginated; detail endpoints are not.
export const listOf = (data) => data?.results ?? data ?? [];




export default api;