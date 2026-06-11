"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";

import { authApi, bookApi, narrationApi, readingApi, userApi } from "@/lib/api";
import { toast } from "@/components/ui/toast";
import type { Book, BookFilters, User } from "@/lib/types";

const PROCESSING = new Set(["pending", "processing"]);

type BookChanges = Parameters<typeof bookApi.update>[1];

export function useBooks(filters: BookFilters = {}) {
  return useQuery({
    queryKey: ["books", filters],
    queryFn: () => bookApi.list(filters),
    placeholderData: keepPreviousData,
    refetchInterval: (query) =>
      query.state.data?.some((book) => PROCESSING.has(book.extraction_status)) ? 2500 : false,
  });
}

export function useBook(id: string) {
  return useQuery({
    queryKey: ["book", id],
    queryFn: () => bookApi.get(id),
    refetchInterval: (query) =>
      query.state.data && PROCESSING.has(query.state.data.extraction_status) ? 2000 : false,
  });
}

function patchBookCaches(queryClient: QueryClient, id: string, changes: Partial<Book>) {
  const detail = queryClient.getQueryData<Book>(["book", id]);
  if (detail) {
    queryClient.setQueryData(["book", id], { ...detail, ...changes });
  }
  queryClient.setQueriesData<Book[]>({ queryKey: ["books"] }, (books) =>
    books?.map((book) => (book.id === id ? { ...book, ...changes } : book)),
  );
}

export function useUpdateBook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: BookChanges }) =>
      bookApi.update(id, changes),
    onMutate: async ({ id, changes }) => {
      await queryClient.cancelQueries({ queryKey: ["books"] });
      await queryClient.cancelQueries({ queryKey: ["book", id] });
      const lists = queryClient.getQueriesData<Book[]>({ queryKey: ["books"] });
      const detail = queryClient.getQueryData<Book>(["book", id]);
      patchBookCaches(queryClient, id, changes as Partial<Book>);
      return { lists, detail };
    },
    onError: (error, { id }, context) => {
      context?.lists.forEach(([key, data]) => queryClient.setQueryData(key, data));
      if (context?.detail) queryClient.setQueryData(["book", id], context.detail);
      toast(error.message);
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(["book", updated.id], updated);
      queryClient.setQueriesData<Book[]>({ queryKey: ["books"] }, (books) =>
        books?.map((book) => (book.id === updated.id ? updated : book)),
      );
    },
  });
}

export function useDeleteBook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => bookApi.remove(id),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: ["book", id] });
      queryClient.setQueriesData<Book[]>({ queryKey: ["books"] }, (books) =>
        books?.filter((book) => book.id !== id),
      );
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: (error) => toast(error.message),
  });
}

export function useUploadBook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      file,
      fields,
      onProgress,
    }: {
      file: File;
      fields: { title?: string; author?: string };
      onProgress: (fraction: number) => void;
    }) => bookApi.upload(file, fields, onProgress),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["books"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });
}

export function useReorderBooks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bookIds: string[]) => bookApi.reorder(bookIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["books"] }),
    onError: (error) => {
      queryClient.invalidateQueries({ queryKey: ["books"] });
      toast(error.message);
    },
  });
}

export function useUploadCover() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => bookApi.uploadCover(id, file),
    onSuccess: (updated) => {
      queryClient.setQueryData(["book", updated.id], updated);
      queryClient.invalidateQueries({ queryKey: ["books"] });
    },
    onError: (error) => toast(error.message),
  });
}

export function useVoices() {
  return useQuery({
    queryKey: ["voices"],
    queryFn: narrationApi.voices,
    staleTime: Infinity,
  });
}

export function useEmotions() {
  return useQuery({
    queryKey: ["emotions"],
    queryFn: narrationApi.emotions,
    staleTime: Infinity,
  });
}

export function useContentOverview(bookId: string, enabled = true) {
  return useQuery({
    queryKey: ["content", bookId],
    queryFn: () => narrationApi.content(bookId),
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function usePageContent(bookId: string, page: number, enabled = true) {
  return useQuery({
    queryKey: ["page-content", bookId, page],
    queryFn: () => narrationApi.page(bookId, page),
    enabled: enabled && page >= 1,
    staleTime: Infinity,
  });
}

export function useStats() {
  return useQuery({ queryKey: ["stats"], queryFn: userApi.stats });
}

export function useUpdateProgress(bookId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { current_page?: number; mark_read?: number[]; unmark_read?: number[] }) =>
      readingApi.updateProgress(bookId, body),
    onMutate: async (body) => {
      await queryClient.cancelQueries({ queryKey: ["book", bookId] });
      const detail = queryClient.getQueryData<Book>(["book", bookId]);
      if (detail) {
        const read = new Set(detail.progress?.pages_read ?? []);
        body.mark_read?.forEach((page) => read.add(page));
        body.unmark_read?.forEach((page) => read.delete(page));
        const pages = [...read].sort((a, b) => a - b);
        const percent = detail.page_count
          ? Math.min(100, Math.round((pages.length / detail.page_count) * 1000) / 10)
          : 0;
        queryClient.setQueryData(["book", bookId], {
          ...detail,
          status: detail.status === "to_read" ? "reading" : detail.status,
          progress: {
            current_page: body.current_page ?? detail.progress?.current_page ?? 1,
            pages_read: pages,
            percent,
            updated_at: detail.progress?.updated_at ?? null,
          },
        });
      }
      return { detail };
    },
    onError: (error, _body, context) => {
      if (context?.detail) queryClient.setQueryData(["book", bookId], context.detail);
      toast(error.message);
    },
    onSuccess: (progress) => {
      const detail = queryClient.getQueryData<Book>(["book", bookId]);
      if (detail) queryClient.setQueryData(["book", bookId], { ...detail, progress });
      queryClient.invalidateQueries({ queryKey: ["books"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });
}

export function useResetCover() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => bookApi.resetCover(id),
    onSuccess: (updated) => {
      queryClient.setQueryData(["book", updated.id], updated);
      queryClient.invalidateQueries({ queryKey: ["books"] });
    },
    onError: (error) => toast(error.message),
  });
}

export function useUpdateMe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string }) => userApi.update(body),
    onSuccess: (user) => {
      queryClient.setQueryData<User>(["me"], user);
      toast("Profile updated", "success");
    },
    onError: (error) => toast(error.message),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (body: { current_password: string; new_password: string }) =>
      userApi.changePassword(body),
    onSuccess: () => toast("Password changed", "success"),
    onError: (error) => toast(error.message),
  });
}

export function useUploadAvatar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => userApi.uploadAvatar(file),
    onSuccess: (user) => {
      queryClient.setQueryData<User>(["me"], user);
      toast("Looking good!", "success");
    },
    onError: (error) => toast(error.message),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => {
      queryClient.clear();
    },
  });
}

export function useReprocessBook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => bookApi.reprocess(id),
    onSuccess: (updated) => {
      queryClient.setQueryData(["book", updated.id], updated);
      queryClient.invalidateQueries({ queryKey: ["books"] });
      queryClient.invalidateQueries({ queryKey: ["content", updated.id] });
    },
    onError: (error) => toast(error.message),
  });
}
