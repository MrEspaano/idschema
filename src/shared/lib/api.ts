interface ApiEnvelope<T> {
  data?: T;
  message?: string;
  ok?: boolean;
}

export const apiData = async <T>(resource: string, action: string, payload?: Record<string, unknown>): Promise<T> => {
  const response = await fetch("/api/data", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({ resource, action, payload: payload ?? {} }),
  });

  const body = (await response.json().catch(() => ({}))) as ApiEnvelope<T>;

  if (!response.ok) {
    throw new Error(body.message || `API-fel (${response.status})`);
  }

  return body.data as T;
};
