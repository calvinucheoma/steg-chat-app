"use client";
import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function EnsureUser() {
  const { user } = useUser();
  const ensure = useMutation(api.user.ensure); // note: "user", singular, matches your file name

  useEffect(() => {
    if (!user) return;
    ensure({
      email: user.primaryEmailAddress?.emailAddress ?? "",
      username: user.username ?? user.firstName ?? "anonymous",
      imageUrl: user.imageUrl ?? "",
    }).catch((err) => console.error("ensure failed", err));
  }, [user, ensure]);

  return null;
}
