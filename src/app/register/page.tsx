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

export default function RegisterPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const formRef = useRef<HTMLFormElement>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const register = useMutation({
    mutationFn: authApi.register,
    onSuccess: (data) => {
      queryClient.setQueryData(["me"], data.user);
      router.replace("/library");
    },
  });

  useEffect(() => {
    if (register.isError) shake(formRef.current);
  }, [register.isError, register.failureCount]);

  const error = register.error instanceof ApiError ? register.error.message : null;

  return (
    <AuthCard title="Start your personal library">
      <form
        ref={formRef}
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          register.mutate({ name, email, password });
        }}
      >
        <Input
          label="Name"
          autoComplete="name"
          required
          minLength={1}
          maxLength={120}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
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
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {error ? <p className="text-sm font-bold text-pow">{error}</p> : null}
        <Button type="submit" size="lg" loading={register.isPending} className="w-full">
          Create account
        </Button>
      </form>
      <p className="mt-5 text-center text-sm font-medium text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-bold text-boom hover:underline">
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
}
