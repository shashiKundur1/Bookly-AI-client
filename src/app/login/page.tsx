"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { shake } from "@/lib/animate";
import { ApiError, authApi } from "@/lib/api";
import { AuthCard } from "@/components/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const formRef = useRef<HTMLFormElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const login = useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      queryClient.setQueryData(["me"], data.user);
      router.replace("/library");
    },
  });

  useEffect(() => {
    if (login.isError) shake(formRef.current);
  }, [login.isError, login.failureCount]);

  const error = login.error instanceof ApiError ? login.error.message : null;

  return (
    <AuthCard title="Welcome back to your library">
      <form
        ref={formRef}
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          login.mutate({ email, password });
        }}
      >
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {error ? <p className="text-sm font-bold text-pow">{error}</p> : null}
        <Button type="submit" size="lg" loading={login.isPending} className="w-full">
          Sign in
        </Button>
      </form>
      <p className="mt-5 text-center text-sm font-medium text-muted">
        New here?{" "}
        <Link href="/register" className="font-bold text-boom hover:underline">
          Create an account
        </Link>
      </p>
    </AuthCard>
  );
}
