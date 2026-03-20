import "server-only";

import { DEFAULT_USER_ID } from "@/lib/constants";

export interface CurrentUser {
  id: string;
}

export function getCurrentUser(): CurrentUser {
  return { id: DEFAULT_USER_ID };
}
