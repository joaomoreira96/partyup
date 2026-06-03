"use client";

import { useUserContext } from "@/features/auth/components/user-provider";

export function useUser() {
  return useUserContext();
}
