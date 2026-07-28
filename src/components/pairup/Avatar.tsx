import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const cache = new Map<string, string>();

/** Resolves a private-bucket avatar path into a signed URL (cached per session). */
export function useAvatarUrl(path?: string | null) {
  const [url, setUrl] = useState<string | null>(path ? (cache.get(path) ?? null) : null);

  useEffect(() => {
    let alive = true;
    if (!path) { setUrl(null); return; }
    if (cache.has(path)) { setUrl(cache.get(path)!); return; }
    supabase.storage.from("avatars").createSignedUrl(path, 60 * 60 * 12).then(({ data }) => {
      if (!alive || !data?.signedUrl) return;
      cache.set(path, data.signedUrl);
      setUrl(data.signedUrl);
    });
    return () => { alive = false; };
  }, [path]);

  return url;
}

export function Avatar({
  emoji, avatarPath, className = "", alt = "",
}: { emoji: string; avatarPath?: string | null; className?: string; alt?: string }) {
  const url = useAvatarUrl(avatarPath);
  if (url) {
    return <img src={url} alt={alt} loading="lazy" className={`h-full w-full rounded-full object-cover ${className}`} />;
  }
  return <span className={className}>{emoji}</span>;
}
